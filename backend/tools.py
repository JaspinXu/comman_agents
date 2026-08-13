from __future__ import annotations

import ast
import operator
from datetime import datetime, timezone
from typing import Any, Callable


ToolHandler = Callable[[dict[str, Any]], str]


class ToolRegistry:
    """Safe local tool boundary. MCP transports can register handlers here later."""

    def __init__(self) -> None:
        self._handlers: dict[str, ToolHandler] = {}
        self._descriptions: dict[str, str] = {}
        self.register("current_time", "返回当前 UTC 时间。", self._current_time)
        self.register("calculator", "计算只包含数字和基础运算符的表达式。", self._calculator)
        self.register("memory", "声明该 Agent 可以读写项目持久化记忆。", lambda _: "持久化记忆由运行记录提供。")

    def register(self, name: str, description: str, handler: ToolHandler) -> None:
        if not name.replace("_", "").isalnum():
            raise ValueError("Tool names may only contain letters, digits, and underscores")
        self._handlers[name] = handler
        self._descriptions[name] = description

    def manifests(self) -> list[dict[str, Any]]:
        return [{"id": name, "label": name.replace("_", " ").title(), "description": self._descriptions[name], "uri": f"mcp://local/{name}"} for name in self._handlers]

    def describe(self, names: list[str]) -> str:
        available = [f"- {name}: {self._descriptions[name]}" for name in names if name in self._handlers]
        return "\n".join(available) if available else "- 无本地工具授权"

    def execute(self, name: str, arguments: dict[str, Any]) -> str:
        handler = self._handlers.get(name)
        if not handler:
            raise KeyError(f"Unknown tool: {name}")
        return handler(arguments)

    @staticmethod
    def _current_time(_: dict[str, Any]) -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _calculator(arguments: dict[str, Any]) -> str:
        expression = str(arguments.get("expression", ""))
        if len(expression) > 200:
            raise ValueError("Expression is too long")
        operations = {
            ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
            ast.Div: operator.truediv, ast.FloorDiv: operator.floordiv,
            ast.Mod: operator.mod, ast.Pow: operator.pow,
            ast.USub: operator.neg, ast.UAdd: operator.pos,
        }

        def evaluate(node: ast.AST) -> float | int:
            if isinstance(node, ast.Expression):
                return evaluate(node.body)
            if isinstance(node, ast.Constant) and type(node.value) in (int, float):
                return node.value
            if isinstance(node, ast.BinOp) and type(node.op) in operations:
                return operations[type(node.op)](evaluate(node.left), evaluate(node.right))
            if isinstance(node, ast.UnaryOp) and type(node.op) in operations:
                return operations[type(node.op)](evaluate(node.operand))
            raise ValueError("Only numeric arithmetic is allowed")

        return str(evaluate(ast.parse(expression, mode="eval")))
