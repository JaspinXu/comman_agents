from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def load_local_env(path: Path | None = None) -> None:
    """Load a small .env file without replacing already configured variables."""
    env_path = path or PROJECT_ROOT / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


@dataclass(frozen=True)
class Settings:
    database_path: Path
    soclaas_base_url: str
    soclaas_api_key: str | None
    soclaas_model: str
    request_timeout_seconds: float
    imagegen_base_url: str
    imagegen_api_key: str | None
    imagegen_model: str
    agent_image_path: Path

    @classmethod
    def from_env(cls) -> "Settings":
        load_local_env()
        legacy_database = PROJECT_ROOT / "data/persona_lab.db"
        default_database = "data/persona_lab.db" if legacy_database.exists() else "data/comman_agents.db"
        database_value = os.getenv("COMMAN_AGENTS_DB") or os.getenv("PERSONA_LAB_DB") or default_database
        database_path = Path(database_value)
        if not database_path.is_absolute():
            database_path = PROJECT_ROOT / database_path
        image_path_value = os.getenv("AGENT_IMAGE_PATH", "data/agent_images")
        agent_image_path = Path(image_path_value)
        if not agent_image_path.is_absolute():
            agent_image_path = PROJECT_ROOT / agent_image_path
        return cls(
            database_path=database_path,
            soclaas_base_url=os.getenv(
                "SOCLAAS_BASE_URL", "https://soclaas-api.comp.nus.edu.sg/v1"
            ).rstrip("/"),
            soclaas_api_key=os.getenv("SOCLAAS_API_KEY") or None,
            soclaas_model=os.getenv("SOCLAAS_MODEL", "qwen3.6:35b"),
            request_timeout_seconds=float(os.getenv("SOCLAAS_TIMEOUT", "90")),
            imagegen_base_url=os.getenv("IMAGEGEN_BASE_URL", "https://api.openai.com/v1").rstrip("/"),
            imagegen_api_key=os.getenv("IMAGEGEN_API_KEY") or os.getenv("OPENAI_API_KEY") or None,
            imagegen_model=os.getenv("IMAGEGEN_MODEL", "gpt-image-2"),
            agent_image_path=agent_image_path,
        )
