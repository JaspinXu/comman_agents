from __future__ import annotations

import json
from abc import ABC, abstractmethod
from typing import Any

import httpx

from .config import Settings
from .models import AgentConfig, ChatMessage
from .prompts import direct_chat_system_prompt, system_prompt
from .tools import ToolRegistry


class ProviderError(RuntimeError):
    pass


class LLMProvider(ABC):
    name: str
    model: str

    @abstractmethod
    async def generate(self, agent: AgentConfig, background: str, prompt: str, transcript: list[dict[str, str]]) -> str:
        raise NotImplementedError

    @abstractmethod
    async def direct_chat(self, agent: AgentConfig, message: str, history: list[ChatMessage]) -> str:
        raise NotImplementedError


class SoCLaaSProvider(LLMProvider):
    name = "soclaas"

    def __init__(self, settings: Settings, tools: ToolRegistry):
        if not settings.soclaas_api_key:
            raise ValueError("SOCLAAS_API_KEY is required")
        self.settings = settings
        self.tools = tools
        self.model = settings.soclaas_model

    async def list_models(self) -> list[dict[str, Any]]:
        async with httpx.AsyncClient(timeout=self.settings.request_timeout_seconds) as client:
            response = await client.get(
                f"{self.settings.soclaas_base_url}/models",
                headers={"Authorization": f"Bearer {self.settings.soclaas_api_key}"},
            )
            self._raise(response)
            return response.json().get("data", [])

    async def generate(self, agent: AgentConfig, background: str, prompt: str, transcript: list[dict[str, str]]) -> str:
        messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt(agent, background, self.tools)}]
        if transcript:
            context = "\n".join(f"{item['name']}：{item['content']}" for item in transcript[-30:])
            messages.append({"role": "user", "content": f"此前的连续对话（包括用户与其他 Agent）：\n{context}"})
        messages.append({"role": "user", "content": prompt})
        payload = {"model": self.model, "messages": messages, "temperature": 0.75, "max_tokens": 600}
        async with httpx.AsyncClient(timeout=self.settings.request_timeout_seconds) as client:
            response = await client.post(
                f"{self.settings.soclaas_base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.settings.soclaas_api_key}", "Content-Type": "application/json"},
                content=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            )
            self._raise(response)
            data = response.json()
        try:
            return data["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, TypeError) as exc:
            raise ProviderError("SoC LaaS returned an unexpected response shape") from exc

    async def direct_chat(self, agent: AgentConfig, message: str, history: list[ChatMessage]) -> str:
        messages: list[dict[str, str]] = [{"role": "system", "content": direct_chat_system_prompt(agent, self.tools)}]
        messages.extend({"role": item.role, "content": item.content} for item in history[-20:])
        messages.append({"role": "user", "content": message})
        payload = {"model": self.model, "messages": messages, "temperature": 0.8, "max_tokens": 700}
        async with httpx.AsyncClient(timeout=self.settings.request_timeout_seconds) as client:
            response = await client.post(
                f"{self.settings.soclaas_base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.settings.soclaas_api_key}", "Content-Type": "application/json"},
                content=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            )
            self._raise(response)
            data = response.json()
        try:
            return data["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, TypeError) as exc:
            raise ProviderError("SoC LaaS returned an unexpected response shape") from exc

    @staticmethod
    def _raise(response: httpx.Response) -> None:
        if response.is_success:
            return
        try:
            detail = response.json().get("error", response.text)
        except ValueError:
            detail = response.text
        raise ProviderError(f"SoC LaaS {response.status_code}: {detail}")


class LocalDemoProvider(LLMProvider):
    """Deterministic offline provider for demos and tests; never presented as live AI."""

    name = "local-demo"
    model = "persona-rule-engine"

    def __init__(self, tools: ToolRegistry):
        self.tools = tools

    async def generate(self, agent: AgentConfig, background: str, prompt: str, transcript: list[dict[str, str]]) -> str:
        previous_agent = next((item for item in reversed(transcript) if item.get("agent_id")), None)
        previous = f"我想接着回应{previous_agent['name']}：{previous_agent['content'][:42]}……" if previous_agent else "这是我在这一轮首先关注的事情。"
        trait = agent.traits[0] if agent.traits else "审慎"
        return (
            f"{previous} 作为{agent.role}，我会以“{trait}”为起点处理“{prompt}”。"
            f"结合共同背景“{background[:80]}”，我建议先建立一个可验证的判断，"
            f"再明确证据、负责人和下一步。我的原则是：{agent.worldview}"
        )

    async def direct_chat(self, agent: AgentConfig, message: str, history: list[ChatMessage]) -> str:
        context = f"你刚才提到“{history[-1].content[:36]}”，" if history else ""
        trait = agent.traits[0] if agent.traits else "审慎"
        return (
            f"{context}我会以{agent.role}的经验和“{trait}”的方式理解你的问题。"
            f"对于“{message}”，我目前最重要的判断是：{agent.worldview} "
            "如果你愿意，我们可以继续把目标、证据和下一步拆得更具体。"
        )


def build_provider(settings: Settings, tools: ToolRegistry) -> LLMProvider:
    if settings.soclaas_api_key:
        return SoCLaaSProvider(settings, tools)
    return LocalDemoProvider(tools)
