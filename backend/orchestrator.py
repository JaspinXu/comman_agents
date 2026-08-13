from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from uuid import uuid4

from .models import RunEvent, RunRequest
from .providers import LLMProvider
from .repository import Repository


class Orchestrator:
    def __init__(self, repository: Repository, provider: LLMProvider):
        self.repository = repository
        self.provider = provider

    async def run(self, request: RunRequest) -> AsyncIterator[RunEvent]:
        scene = self.repository.get_scene(request.scene_id)
        if not scene:
            raise ValueError(f"Unknown scene: {request.scene_id}")
        agents = []
        for agent_id in request.agent_ids:
            agent = self.repository.get_agent(agent_id)
            if not agent:
                raise ValueError(f"Unknown agent: {agent_id}")
            agents.append(agent)

        rounds = min(request.rounds, scene.max_rounds, 8)
        run_id = uuid4().hex
        model = request.model or self.provider.model
        self.repository.create_run(run_id, scene.id, request.prompt, self.provider.name, model)
        sequence = 0

        async def event(event_type: str, content: str, **kwargs) -> RunEvent:
            nonlocal sequence
            sequence += 1
            item = RunEvent(
                run_id=run_id, sequence=sequence, type=event_type, content=content,
                created_at=datetime.now(timezone.utc), **kwargs,
            )
            return await asyncio.to_thread(self.repository.add_event, item)

        yield await event("status", f"开始“{scene.title}”，共 {len(agents)} 名成员、{rounds} 轮。", metadata={"provider": self.provider.name, "model": model})
        transcript: list[dict[str, str]] = []
        try:
            for round_index in range(rounds):
                for agent in agents:
                    content = await self.provider.generate(agent, scene, request.prompt, transcript)
                    transcript.append({"agent_id": agent.id, "name": agent.name, "content": content})
                    yield await event(
                        "message", content, agent_id=agent.id, agent_name=agent.name,
                        metadata={"round": round_index + 1, "role": agent.role},
                    )
            self.repository.finish_run(run_id, "completed")
            yield await event("complete", "场景运行完成。", metadata={"message_count": len(transcript)})
        except Exception as exc:
            self.repository.finish_run(run_id, "failed")
            yield await event("error", str(exc))
