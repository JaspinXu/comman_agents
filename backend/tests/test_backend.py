from __future__ import annotations

import asyncio
import tempfile
import unittest
from pathlib import Path

from backend.models import RunRequest
from backend.orchestrator import Orchestrator
from backend.providers import LocalDemoProvider
from backend.repository import Repository
from backend.tools import ToolRegistry


class BackendTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.repository = Repository(Path(self.temp.name) / "test.db")
        self.repository.initialize()

    def tearDown(self) -> None:
        self.temp.cleanup()

    def test_seed_and_agent_persistence(self) -> None:
        agents = self.repository.list_agents()
        self.assertEqual([agent.id for agent in agents], ["linxi", "chengye", "shenzhi"])
        updated = agents[0].model_copy(update={"role": "首席用户研究员"})
        self.repository.save_agent(updated)
        self.assertEqual(self.repository.get_agent("linxi").role, "首席用户研究员")

    def test_safe_calculator(self) -> None:
        tools = ToolRegistry()
        self.assertEqual(tools.execute("calculator", {"expression": "(12 + 3) * 2"}), "30")
        with self.assertRaises(ValueError):
            tools.execute("calculator", {"expression": "__import__('os').getcwd()"})

    def test_tool_permission_is_explicit(self) -> None:
        linxi = self.repository.get_agent("linxi")
        shenzhi = self.repository.get_agent("shenzhi")
        self.assertIn("calculator", linxi.tools)
        self.assertNotIn("calculator", shenzhi.tools)

    def test_multi_agent_run_is_persisted(self) -> None:
        async def collect():
            orchestrator = Orchestrator(self.repository, LocalDemoProvider(ToolRegistry()))
            request = RunRequest(scene_id="discovery", prompt="怎样验证需求？", agent_ids=["linxi", "chengye", "shenzhi"])
            return [event async for event in orchestrator.run(request)]

        events = asyncio.run(collect())
        self.assertEqual([event.type for event in events], ["status", "message", "message", "message", "complete"])
        run = self.repository.get_run(events[0].run_id)
        self.assertIsNotNone(run)
        self.assertEqual(run.status, "completed")
        self.assertEqual(len(run.events), 5)


if __name__ == "__main__":
    unittest.main()
