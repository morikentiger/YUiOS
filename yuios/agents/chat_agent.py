"""Chat agent - handles general conversation with YUi personality.

This is the core agent. Most interactions flow through here.
YUi's personality shines through empathetic, encouraging dialogue.
"""

from __future__ import annotations

from yuios.agents.base import Agent
from yuios.personality.yui_core import build_system_prompt


class ChatAgent(Agent):
    def __init__(self, llm_client):
        super().__init__("chat", "General conversation with YUi personality")
        self.llm = llm_client

    def run(self, input_data: str, context: dict) -> str:
        messages = self._build_messages(input_data, context)
        return self.llm.chat(messages)

    def _build_messages(self, user_input: str, context: dict) -> list[dict]:
        system_prompt = build_system_prompt(context)
        messages = [{"role": "system", "content": system_prompt}]

        for msg in context.get("history", []):
            messages.append({"role": msg["role"], "content": msg["content"]})

        messages.append({"role": "user", "content": user_input})
        return messages
