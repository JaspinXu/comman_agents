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
        agents = []
        for agent_id in request.agent_ids:
            agent = self.repository.get_agent(agent_id)
            if not agent:
                raise ValueError(f"Unknown agent: {agent_id}")
            agents.append(agent)

        run_id = uuid4().hex
        model = request.model or self.provider.model
        self.repository.create_run(run_id, request.background, request.prompt, self.provider.name, model)
        sequence = 0

        async def event(event_type: str, content: str, **kwargs) -> RunEvent:
            nonlocal sequence
            sequence += 1
            item = RunEvent(
                run_id=run_id, sequence=sequence, type=event_type, content=content,
                created_at=datetime.now(timezone.utc), **kwargs,
            )
            return await asyncio.to_thread(self.repository.add_event, item)

        yield await event("status", f"收到新的提问，{len(agents)} 名 Agent 将依次回答。", metadata={"provider": self.provider.name, "model": model})
        transcript = [
            {"agent_id": item.agent_id or "", "name": item.name, "content": item.content}
            for item in request.history[-60:]
        ]
        transcript.append({"agent_id": "", "name": "用户", "content": request.prompt})
        generated_count = 0
        try:
            for order, agent in enumerate(agents, start=1):
                content = await self.provider.generate(agent, request.background, request.prompt, transcript)
                transcript.append({"agent_id": agent.id, "name": agent.name, "content": content})
                generated_count += 1
                yield await event(
                    "message", content, agent_id=agent.id, agent_name=agent.name,
                    metadata={"order": order, "role": agent.role, "can_respond_to_previous": order > 1},
                )
            self.repository.finish_run(run_id, "completed")
            yield await event("complete", "所有 Agent 已依次回答。", metadata={"message_count": generated_count})
        except Exception as exc:
            self.repository.finish_run(run_id, "failed")
            yield await event("error", str(exc))
