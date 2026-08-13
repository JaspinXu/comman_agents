from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from typing import Any

from .models import AgentConfig, RunEvent, RunSummary
from .seed import SEED_AGENTS


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Repository:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()

    @contextmanager
    def connect(self):
        connection = sqlite3.connect(self.path, check_same_thread=False)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA foreign_keys=ON")
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def initialize(self) -> None:
        with self._lock, self.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS agents (
                    id TEXT PRIMARY KEY, config_json TEXT NOT NULL, updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS agent_tombstones (
                    id TEXT PRIMARY KEY, deleted_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS runs (
                    id TEXT PRIMARY KEY, story_background TEXT NOT NULL, prompt TEXT NOT NULL,
                    provider TEXT NOT NULL, model TEXT NOT NULL, status TEXT NOT NULL,
                    created_at TEXT NOT NULL, completed_at TEXT
                );
                CREATE TABLE IF NOT EXISTS run_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL,
                    sequence INTEGER NOT NULL, type TEXT NOT NULL, agent_id TEXT,
                    agent_name TEXT, content TEXT NOT NULL, metadata_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(run_id) REFERENCES runs(id) ON DELETE CASCADE,
                    UNIQUE(run_id, sequence)
                );
                CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at);
            """)
            run_columns = {row["name"] for row in db.execute("PRAGMA table_info(runs)").fetchall()}
            if "story_background" not in run_columns:
                db.execute("ALTER TABLE runs ADD COLUMN story_background TEXT NOT NULL DEFAULT ''")
            now = utc_now().isoformat()
            for agent in SEED_AGENTS:
                deleted = db.execute("SELECT 1 FROM agent_tombstones WHERE id = ?", (agent.id,)).fetchone()
                if deleted:
                    continue
                db.execute(
                    "INSERT OR IGNORE INTO agents VALUES (?, ?, ?)",
                    (agent.id, agent.model_dump_json(by_alias=True), now),
                )
                row = db.execute("SELECT config_json FROM agents WHERE id = ?", (agent.id,)).fetchone()
                existing = json.loads(row["config_json"])
                if not existing.get("portraitUrl"):
                    existing["portraitUrl"] = agent.portrait_url
                    existing["portraitPrompt"] = agent.portrait_prompt
                    db.execute(
                        "UPDATE agents SET config_json = ?, updated_at = ? WHERE id = ?",
                        (json.dumps(existing, ensure_ascii=False), now, agent.id),
                    )
                if "customAttributes" not in existing:
                    existing["customAttributes"] = [item.model_dump() for item in agent.custom_attributes]
                    db.execute(
                        "UPDATE agents SET config_json = ?, updated_at = ? WHERE id = ?",
                        (json.dumps(existing, ensure_ascii=False), now, agent.id),
                    )
            db.execute("PRAGMA optimize")

    def list_agents(self) -> list[AgentConfig]:
        with self.connect() as db:
            rows = db.execute("SELECT config_json FROM agents ORDER BY rowid").fetchall()
        return [AgentConfig.model_validate_json(row["config_json"]) for row in rows]

    def get_agent(self, agent_id: str) -> AgentConfig | None:
        with self.connect() as db:
            row = db.execute("SELECT config_json FROM agents WHERE id = ?", (agent_id,)).fetchone()
        return AgentConfig.model_validate_json(row["config_json"]) if row else None

    def save_agent(self, agent: AgentConfig) -> AgentConfig:
        with self._lock, self.connect() as db:
            db.execute("DELETE FROM agent_tombstones WHERE id = ?", (agent.id,))
            db.execute(
                "INSERT INTO agents VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET config_json=excluded.config_json, updated_at=excluded.updated_at",
                (agent.id, agent.model_dump_json(by_alias=True), utc_now().isoformat()),
            )
        return agent

    def delete_agent(self, agent_id: str) -> bool:
        with self._lock, self.connect() as db:
            exists = db.execute("SELECT 1 FROM agents WHERE id = ?", (agent_id,)).fetchone()
            if not exists:
                return False
            remaining = db.execute("SELECT COUNT(*) AS count FROM agents").fetchone()["count"]
            if remaining <= 1:
                raise ValueError("At least one Agent must remain")
            db.execute("DELETE FROM agents WHERE id = ?", (agent_id,))
            db.execute(
                "INSERT INTO agent_tombstones (id, deleted_at) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET deleted_at=excluded.deleted_at",
                (agent_id, utc_now().isoformat()),
            )
        return True

    def create_run(self, run_id: str, background: str, prompt: str, provider: str, model: str) -> None:
        with self._lock, self.connect() as db:
            columns = {row["name"] for row in db.execute("PRAGMA table_info(runs)").fetchall()}
            if "scene_id" in columns:
                # Older local databases retain this required column; it is no longer exposed or used as product state.
                db.execute(
                    "INSERT INTO runs (id, scene_id, story_background, prompt, provider, model, status, created_at, completed_at) VALUES (?, 'custom-story', ?, ?, ?, ?, 'running', ?, NULL)",
                    (run_id, background, prompt, provider, model, utc_now().isoformat()),
                )
            else:
                db.execute(
                    "INSERT INTO runs (id, story_background, prompt, provider, model, status, created_at, completed_at) VALUES (?, ?, ?, ?, ?, 'running', ?, NULL)",
                    (run_id, background, prompt, provider, model, utc_now().isoformat()),
                )

    def add_event(self, event: RunEvent) -> RunEvent:
        with self._lock, self.connect() as db:
            cursor = db.execute(
                "INSERT INTO run_events (run_id, sequence, type, agent_id, agent_name, content, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (event.run_id, event.sequence, event.type, event.agent_id, event.agent_name, event.content, json.dumps(event.metadata, ensure_ascii=False), event.created_at.isoformat()),
            )
            return event.model_copy(update={"id": cursor.lastrowid})

    def finish_run(self, run_id: str, status: str) -> None:
        with self._lock, self.connect() as db:
            db.execute("UPDATE runs SET status = ?, completed_at = ? WHERE id = ?", (status, utc_now().isoformat(), run_id))

    def list_runs(self, limit: int = 20) -> list[RunSummary]:
        with self.connect() as db:
            rows = db.execute("SELECT * FROM runs ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
        return [self._row_to_run(row, []) for row in rows]

    def get_run(self, run_id: str) -> RunSummary | None:
        with self.connect() as db:
            run = db.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
            if not run:
                return None
            event_rows = db.execute("SELECT * FROM run_events WHERE run_id = ? ORDER BY sequence", (run_id,)).fetchall()
        events = [RunEvent(
            id=row["id"], run_id=row["run_id"], sequence=row["sequence"], type=row["type"],
            agent_id=row["agent_id"], agent_name=row["agent_name"], content=row["content"],
            metadata=json.loads(row["metadata_json"]), created_at=datetime.fromisoformat(row["created_at"]),
        ) for row in event_rows]
        return self._row_to_run(run, events)

    @staticmethod
    def _row_to_run(row: sqlite3.Row, events: list[RunEvent]) -> RunSummary:
        return RunSummary(
            id=row["id"], background=row["story_background"], prompt=row["prompt"], provider=row["provider"],
            model=row["model"], status=row["status"], created_at=datetime.fromisoformat(row["created_at"]),
            completed_at=datetime.fromisoformat(row["completed_at"]) if row["completed_at"] else None,
            events=events,
        )
