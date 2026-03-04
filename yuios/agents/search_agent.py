"""Search agent - handles information search requests.

MVP: Uses LLM knowledge.
Future: Integrate web search API, RAG, etc.
"""

from yuios.agents.base import Agent
from yuios.personality.yui_core import build_system_prompt

SEARCH_INSTRUCTION = """

## 情報検索モード
ユーザーが情報や知識を求めています。以下を心がけてください：
- 知っている範囲で正確に答える
- 不確かなことは正直に伝える
- 分かりやすく説明する
- 必要に応じて関連する情報も提供する
"""


class SearchAgent(Agent):
    def __init__(self, llm_client):
        super().__init__("search", "Information search agent")
        self.llm = llm_client

    def run(self, input_data: str, context: dict) -> str:
        system_prompt = build_system_prompt(context) + SEARCH_INSTRUCTION

        messages = [{"role": "system", "content": system_prompt}]
        for msg in context.get("history", []):
            messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": input_data})

        return self.llm.chat(messages)
