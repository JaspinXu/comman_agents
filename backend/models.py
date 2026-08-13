from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class Sliders(BaseModel):
    autonomy: int = Field(ge=0, le=100)
    empathy: int = Field(ge=0, le=100)
    creativity: int = Field(ge=0, le=100)
    rigor: int = Field(ge=0, le=100)


class CustomAttribute(BaseModel):
    name: str = Field(max_length=80)
    content: str = Field(max_length=2000)


class AgentConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(min_length=1, max_length=64, pattern=r"^[a-zA-Z0-9_-]+$")
    name: str = Field(min_length=1, max_length=80)
    english_name: str = Field(alias="englishName", min_length=1, max_length=80)
    role: str = Field(min_length=1, max_length=120)
    color: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    initials: str = Field(min_length=1, max_length=4)
    quote: str = Field(max_length=1000)
    outfit: str = Field(max_length=1000)
    worldview: str = Field(max_length=2000)
    traits: list[str] = Field(default_factory=list, max_length=24)
    sliders: Sliders
    tools: list[str] = Field(default_factory=list, max_length=32)
    custom_attributes: list[CustomAttribute] = Field(default_factory=list, alias="customAttributes", max_length=64)
    portrait_url: str | None = Field(default=None, alias="portraitUrl", max_length=1000)
    portrait_prompt: str | None = Field(default=None, alias="portraitPrompt", max_length=5000)


class StudioSettings(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    group_name: str = Field(default="产品共创小组", alias="groupName", min_length=1, max_length=80)


class EnsembleMessage(BaseModel):
    speaker_type: Literal["user", "agent"]
    name: str = Field(min_length=1, max_length=80)
    content: str = Field(min_length=1, max_length=4000)
    agent_id: str | None = Field(default=None, max_length=64)


class RunRequest(BaseModel):
    background: str = Field(min_length=1, max_length=8000)
    prompt: str = Field(default="请给出你最重要的判断。", min_length=1, max_length=4000)
    agent_ids: list[str] = Field(min_length=1, max_length=12)
    history: list[EnsembleMessage] = Field(default_factory=list, max_length=120)
    model: str | None = Field(default=None, max_length=200)


class RunEvent(BaseModel):
    id: int | None = None
    run_id: str
    sequence: int
    type: Literal["status", "message", "tool", "error", "complete"]
    agent_id: str | None = None
    agent_name: str | None = None
    content: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class RunSummary(BaseModel):
    id: str
    background: str
    prompt: str
    provider: str
    model: str
    status: str
    created_at: datetime
    completed_at: datetime | None = None
    events: list[RunEvent] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: Literal["ok"]
    provider: str
    live_provider_configured: bool
    model: str
    database: str
    tools: list[dict[str, Any]]
    image_provider: str
    image_generation_configured: bool


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class DirectChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=30)


class DirectChatResponse(BaseModel):
    agent_id: str
    agent_name: str
    reply: str


class ToolExecuteRequest(BaseModel):
    agent_id: str = Field(min_length=1, max_length=64)
    arguments: dict[str, Any] = Field(default_factory=dict)


class ToolExecuteResponse(BaseModel):
    agent_id: str
    tool: str
    result: str
