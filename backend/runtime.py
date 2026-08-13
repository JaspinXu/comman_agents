from __future__ import annotations

from dataclasses import dataclass

from .config import Settings
from .imagegen import PortraitGenerator
from .orchestrator import Orchestrator
from .providers import LLMProvider, build_provider
from .repository import Repository
from .tools import ToolRegistry


@dataclass(frozen=True)
class Runtime:
    settings: Settings
    repository: Repository
    tools: ToolRegistry
    provider: LLMProvider
    orchestrator: Orchestrator
    portrait_generator: PortraitGenerator


def build_runtime(settings: Settings | None = None) -> Runtime:
    resolved_settings = settings or Settings.from_env()
    repository = Repository(resolved_settings.database_path)
    tools = ToolRegistry()
    provider = build_provider(resolved_settings, tools)
    return Runtime(
        settings=resolved_settings,
        repository=repository,
        tools=tools,
        provider=provider,
        orchestrator=Orchestrator(repository, provider),
        portrait_generator=PortraitGenerator(resolved_settings),
    )
