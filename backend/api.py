from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import FileResponse, Response, StreamingResponse

from .imagegen import ImageGenerationError
from .models import AgentConfig, DirectChatRequest, DirectChatResponse, HealthResponse, RunRequest, RunSummary, StudioSettings, ToolExecuteRequest, ToolExecuteResponse
from .providers import SoCLaaSProvider
from .runtime import Runtime


DEFAULT_AGENT_PORTRAIT_URL = "/agent-images/linxi.webp"


def create_router(runtime: Runtime) -> APIRouter:
    router = APIRouter()
    repository = runtime.repository

    @router.get("/api/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse(
            status="ok", provider=runtime.provider.name,
            live_provider_configured=isinstance(runtime.provider, SoCLaaSProvider), model=runtime.provider.model,
            database=str(runtime.settings.database_path), tools=runtime.tools.manifests(),
            image_provider=runtime.portrait_generator.name,
            image_generation_configured=runtime.portrait_generator.configured,
        )

    @router.get("/api/agents", response_model=list[AgentConfig])
    def list_agents() -> list[AgentConfig]:
        return repository.list_agents()

    @router.get("/api/settings", response_model=StudioSettings)
    def get_settings() -> StudioSettings:
        return repository.get_studio_settings()

    @router.put("/api/settings", response_model=StudioSettings)
    def update_settings(settings: StudioSettings) -> StudioSettings:
        return repository.save_studio_settings(settings)

    @router.post("/api/agents", response_model=AgentConfig, status_code=status.HTTP_201_CREATED)
    def create_agent(agent: AgentConfig) -> AgentConfig:
        if repository.get_agent(agent.id):
            raise HTTPException(status_code=409, detail="Agent ID already exists")
        agent_with_portrait = agent if agent.portrait_url else agent.model_copy(
            update={"portrait_url": DEFAULT_AGENT_PORTRAIT_URL}
        )
        return repository.save_agent(agent_with_portrait)

    @router.put("/api/agents/{agent_id}", response_model=AgentConfig)
    def update_agent(agent_id: str, agent: AgentConfig) -> AgentConfig:
        if agent_id != agent.id:
            raise HTTPException(status_code=400, detail="Path and payload agent IDs differ")
        if not repository.get_agent(agent_id):
            raise HTTPException(status_code=404, detail="Agent not found")
        return repository.save_agent(agent)

    @router.delete("/api/agents/{agent_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
    def delete_agent(agent_id: str) -> Response:
        agent = repository.get_agent(agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        try:
            repository.delete_agent(agent_id)
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        if agent.portrait_url and agent.portrait_url.startswith("/api/agent-images/"):
            image_path = runtime.settings.agent_image_path / Path(agent.portrait_url).name
            if image_path.is_file():
                image_path.unlink()
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @router.post("/api/agents/{agent_id}/portrait", response_model=AgentConfig)
    async def generate_agent_portrait(agent_id: str) -> AgentConfig:
        agent = repository.get_agent(agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        try:
            updated = await runtime.portrait_generator.generate(agent)
        except ImageGenerationError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        return repository.save_agent(updated)

    @router.get("/api/agent-images/{filename}")
    def get_agent_image(filename: str) -> FileResponse:
        safe_name = Path(filename).name
        image_path = runtime.settings.agent_image_path / safe_name
        if safe_name != filename or not image_path.is_file():
            raise HTTPException(status_code=404, detail="Image not found")
        return FileResponse(image_path)

    @router.post("/api/agents/{agent_id}/chat", response_model=DirectChatResponse)
    async def direct_chat(agent_id: str, request: DirectChatRequest) -> DirectChatResponse:
        agent = repository.get_agent(agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        try:
            reply = await runtime.provider.direct_chat(agent, request.message, request.history)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        return DirectChatResponse(agent_id=agent.id, agent_name=agent.name, reply=reply)

    @router.get("/api/models")
    async def list_models():
        if isinstance(runtime.provider, SoCLaaSProvider):
            try:
                return {"provider": runtime.provider.name, "data": await runtime.provider.list_models()}
            except Exception as exc:
                raise HTTPException(status_code=502, detail=str(exc)) from exc
        return {"provider": runtime.provider.name, "data": [{"id": runtime.provider.model, "owned_by": "comman_agents", "description": "离线规则演示；配置 API Key 后自动切换 SoC LaaS。"}]}

    @router.post("/api/tools/{tool_name}/execute", response_model=ToolExecuteResponse)
    def execute_tool(tool_name: str, request: ToolExecuteRequest) -> ToolExecuteResponse:
        agent = repository.get_agent(request.agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        if tool_name not in agent.tools:
            raise HTTPException(status_code=403, detail="Tool is not authorized for this agent")
        try:
            result = runtime.tools.execute(tool_name, request.arguments)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except (ValueError, ArithmeticError) as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return ToolExecuteResponse(agent_id=agent.id, tool=tool_name, result=result)

    @router.post("/api/runs")
    async def create_run(request: RunRequest) -> StreamingResponse:
        async def stream():
            try:
                async for event in runtime.orchestrator.run(request):
                    yield json.dumps(event.model_dump(mode="json"), ensure_ascii=False) + "\n"
            except ValueError as exc:
                yield json.dumps({"type": "error", "content": str(exc)}, ensure_ascii=False) + "\n"
        return StreamingResponse(stream(), media_type="application/x-ndjson")

    @router.get("/api/runs", response_model=list[RunSummary])
    def list_runs(limit: int = Query(default=20, ge=1, le=100)) -> list[RunSummary]:
        return repository.list_runs(limit)

    @router.get("/api/runs/{run_id}", response_model=RunSummary)
    def get_run(run_id: str) -> RunSummary:
        run = repository.get_run(run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Run not found")
        return run

    @router.get("/")
    def root():
        return {"name": "comman_agents API", "docs": "/docs", "health": "/api/health"}

    return router
