from __future__ import annotations

import base64
from pathlib import Path
from urllib.parse import urlparse

import httpx

from .config import Settings
from .models import AgentConfig


class ImageGenerationError(RuntimeError):
    pass


def portrait_prompt(agent: AgentConfig) -> str:
    traits = "、".join(agent.traits) or "尚未设置"
    custom_attributes = "; ".join(
        f"{item.name.strip()}: {item.content.strip()}"
        for item in agent.custom_attributes
        if item.name.strip() or item.content.strip()
    ) or "none"
    return f"""Use case: photorealistic-natural
Asset type: vertical portrait for an AI agent profile card
Primary request: create a coherent portrait of {agent.name}, a {agent.role}, expressing the complete configured personality
Subject identity: Chinese adult; role is {agent.role}; core traits are {traits}
Clothing and appearance: {agent.outfit}
Character direction: {agent.worldview}
Personality description: {agent.quote}
User-defined characteristics: {custom_attributes}
Personality dimensions: autonomy {agent.sliders.autonomy}/100, empathy {agent.sliders.empathy}/100, creativity {agent.sliders.creativity}/100, rigor {agent.sliders.rigor}/100
Style/medium: premium contemporary editorial portrait photography, realistic skin and fabric texture
Composition/framing: vertical 4:5 waist-up portrait, one person only, centered, natural eye contact
Lighting/mood: personality-appropriate natural studio light
Color palette: use {agent.color} as a restrained accent with warm neutral surroundings
Constraints: faithfully synthesize every supplied characteristic; no text; no logo; no watermark; no UI frame"""


class PortraitGenerator:
    name = "imagegen-compatible"

    def __init__(self, settings: Settings):
        self.settings = settings

    @property
    def configured(self) -> bool:
        return bool(self.settings.imagegen_api_key)

    async def generate(self, agent: AgentConfig) -> AgentConfig:
        if not self.settings.imagegen_api_key:
            raise ImageGenerationError("未配置 IMAGEGEN_API_KEY，无法生成新人物形象")

        prompt = portrait_prompt(agent)
        payload = {
            "model": self.settings.imagegen_model,
            "prompt": prompt,
            "size": "1024x1536",
            "quality": "medium",
        }
        headers = {
            "Authorization": f"Bearer {self.settings.imagegen_api_key}",
            "Content-Type": "application/json",
        }
        timeout = max(self.settings.request_timeout_seconds, 180)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(f"{self.settings.imagegen_base_url}/images/generations", headers=headers, json=payload)
            if not response.is_success:
                raise ImageGenerationError(f"ImageGen {response.status_code}: {response.text[:500]}")
            try:
                item = response.json()["data"][0]
            except (KeyError, IndexError, TypeError, ValueError) as exc:
                raise ImageGenerationError("ImageGen 返回了无法识别的数据结构") from exc

            if item.get("b64_json"):
                image_bytes = base64.b64decode(item["b64_json"])
                suffix = ".png"
            elif item.get("url"):
                image_response = await client.get(item["url"])
                image_response.raise_for_status()
                image_bytes = image_response.content
                suffix = Path(urlparse(item["url"]).path).suffix or ".png"
            else:
                raise ImageGenerationError("ImageGen 未返回图片数据")

        self.settings.agent_image_path.mkdir(parents=True, exist_ok=True)
        image_path = self.settings.agent_image_path / f"{agent.id}{suffix}"
        image_path.write_bytes(image_bytes)
        return agent.model_copy(update={
            "portrait_url": f"/api/agent-images/{image_path.name}",
            "portrait_prompt": prompt,
        })
