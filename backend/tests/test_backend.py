from __future__ import annotations

import asyncio
import tempfile
import unittest
from pathlib import Path

from backend.imagegen import portrait_prompt
from backend.models import ChatMessage, CustomAttribute, EnsembleMessage, RunRequest
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
        self.assertEqual(agents[0].portrait_url, "/agent-images/linxi.webp")
        self.assertEqual(agents[0].custom_attributes[0].name, "沟通方式")
        updated = agents[0].model_copy(update={"role": "首席用户研究员"})
        self.repository.save_agent(updated)
        self.assertEqual(self.repository.get_agent("linxi").role, "首席用户研究员")

    def test_new_agent_can_be_created_and_listed(self) -> None:
        source = self.repository.get_agent("linxi")
        newcomer = source.model_copy(update={
            "id": "newcomer", "name": "新成员", "english_name": "NEWCOMER",
            "initials": "新", "role": "产品策略师",
        })
        self.repository.save_agent(newcomer)
        self.assertEqual(self.repository.get_agent("newcomer").name, "新成员")
        self.assertEqual(len(self.repository.list_agents()), 4)

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
            request = RunRequest(
                background="三位成员正在讨论一个尚未验证的新产品。",
                prompt="怎样验证需求？",
                agent_ids=["linxi", "chengye", "shenzhi"],
                history=[EnsembleMessage(speaker_type="user", name="用户", content="先从真实问题出发")],
            )
            return [event async for event in orchestrator.run(request)]

        events = asyncio.run(collect())
        self.assertEqual([event.type for event in events], ["status", "message", "message", "message", "complete"])
        run = self.repository.get_run(events[0].run_id)
        self.assertIsNotNone(run)
        self.assertEqual(run.status, "completed")
        self.assertEqual(run.background, "三位成员正在讨论一个尚未验证的新产品。")
        self.assertEqual(len(run.events), 5)
        self.assertIn("林溪", events[2].content)

    def test_portrait_prompt_uses_full_persona(self) -> None:
        agent = self.repository.get_agent("linxi")
        agent = agent.model_copy(update={"custom_attributes": [CustomAttribute(name="语气", content="温和但直接")]})
        self.repository.save_agent(agent)
        prompt = portrait_prompt(agent)
        self.assertIn(agent.role, prompt)
        self.assertIn(agent.outfit, prompt)
        self.assertIn(agent.worldview, prompt)
        self.assertIn(agent.traits[0], prompt)
        self.assertIn("语气: 温和但直接", prompt)
        loaded = self.repository.get_agent("linxi")
        self.assertEqual(loaded.custom_attributes, agent.custom_attributes)

    def test_direct_chat_stays_in_character(self) -> None:
        agent = self.repository.get_agent("chengye")
        provider = LocalDemoProvider(ToolRegistry())
        reply = asyncio.run(provider.direct_chat(agent, "这个方案可靠吗？", [ChatMessage(role="user", content="先看边界条件")]))
        self.assertIn(agent.role, reply)
        self.assertIn(agent.worldview, reply)


if __name__ == "__main__":
    unittest.main()
