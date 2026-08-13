from __future__ import annotations

import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .config import Settings
from .models import AgentConfig, HealthResponse, RunRequest, RunSummary, SceneConfig, ToolExecuteRequest, ToolExecuteResponse
from .orchestrator import Orchestrator
from .providers import SoCLaaSProvider, build_provider
from .repository import Repository
from .tools import ToolRegistry


settings = Settings.from_env()
repository = Repository(settings.database_path)
tools = ToolRegistry()
provider = build_provider(settings, tools)
orchestrator = Orchestrator(repository, provider)


@asynccontextmanager
async def lifespan(_: FastAPI):
    repository.initialize()
    yield


app = FastAPI(title="comman_agents API", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=False,
    allow_methods=["GET", "PUT", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok", provider=provider.name,
        live_provider_configured=isinstance(provider, SoCLaaSProvider), model=provider.model,
        database=str(settings.database_path), tools=tools.manifests(),
    )


@app.get("/api/agents", response_model=list[AgentConfig])
def list_agents() -> list[AgentConfig]:
    return repository.list_agents()


@app.post("/api/agents", response_model=AgentConfig, status_code=status.HTTP_201_CREATED)
def create_agent(agent: AgentConfig) -> AgentConfig:
    if repository.get_agent(agent.id):
        raise HTTPException(status_code=409, detail="Agent ID already exists")
    return repository.save_agent(agent)


@app.put("/api/agents/{agent_id}", response_model=AgentConfig)
def update_agent(agent_id: str, agent: AgentConfig) -> AgentConfig:
    if agent_id != agent.id:
        raise HTTPException(status_code=400, detail="Path and payload agent IDs differ")
    return repository.save_agent(agent)


@app.get("/api/scenes", response_model=list[SceneConfig])
def list_scenes() -> list[SceneConfig]:
    return repository.list_scenes()


@app.get("/api/models")
async def list_models():
    if isinstance(provider, SoCLaaSProvider):
        try:
            return {"provider": provider.name, "data": await provider.list_models()}
        except Exception as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"provider": provider.name, "data": [{"id": provider.model, "owned_by": "comman_agents", "description": "离线规则演示；配置 API Key 后自动切换 SoC LaaS。"}]}


@app.post("/api/tools/{tool_name}/execute", response_model=ToolExecuteResponse)
def execute_tool(tool_name: str, request: ToolExecuteRequest) -> ToolExecuteResponse:
    agent = repository.get_agent(request.agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if tool_name not in agent.tools:
        raise HTTPException(status_code=403, detail="Tool is not authorized for this agent")
    try:
        result = tools.execute(tool_name, request.arguments)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (ValueError, ArithmeticError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ToolExecuteResponse(agent_id=agent.id, tool=tool_name, result=result)


@app.post("/api/runs")
async def create_run(request: RunRequest) -> StreamingResponse:
    async def stream():
        try:
            async for event in orchestrator.run(request):
                yield json.dumps(event.model_dump(mode="json"), ensure_ascii=False) + "\n"
        except ValueError as exc:
            yield json.dumps({"type": "error", "content": str(exc)}, ensure_ascii=False) + "\n"

    return StreamingResponse(stream(), media_type="application/x-ndjson")


@app.get("/api/runs", response_model=list[RunSummary])
def list_runs(limit: int = Query(default=20, ge=1, le=100)) -> list[RunSummary]:
    return repository.list_runs(limit)


@app.get("/api/runs/{run_id}", response_model=RunSummary)
def get_run(run_id: str) -> RunSummary:
    run = repository.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@app.get("/")
def root():
    return {"name": "comman_agents API", "docs": "/docs", "health": "/api/health"}
