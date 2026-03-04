"""Idea generation agent - creative brainstorming partner."""

from yuios.agents.base import Agent
from yuios.personality.yui_core import build_system_prompt

IDEA_INSTRUCTION = """

## アイデア生成モード
ユーザーがアイデアや創造的な思考を求めています。以下を心がけてください：
- 複数の視点からアイデアを提案する
- ユーザーの興味や経験を踏まえて提案する
- 実現可能性も考慮する
- 創造的で、ワクワクするような提案を心がける
- YUiらしい好奇心と温かさで一緒に考える姿勢を見せる
"""


class IdeaAgent(Agent):
    def __init__(self, llm_client):
        super().__init__("idea", "Idea generation agent")
        self.llm = llm_client

    def run(self, input_data: str, context: dict) -> str:
        system_prompt = build_system_prompt(context) + IDEA_INSTRUCTION

        messages = [{"role": "system", "content": system_prompt}]
        for msg in context.get("history", []):
            messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": input_data})

        return self.llm.chat(messages)
