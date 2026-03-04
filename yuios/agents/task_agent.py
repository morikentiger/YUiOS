"""Task agent - extracts and manages tasks from conversation."""

from yuios.agents.base import Agent
from yuios.personality.yui_core import build_system_prompt

TASK_INSTRUCTION = """

## タスク管理モード
ユーザーがタスクについて話しています。以下を心がけてください：
- ユーザーの発言からタスクを整理して提示する
- 優先順位を提案する
- 実行可能な小さなステップに分解する
- 励ましの言葉を添える
- YUiらしい温かさを忘れずに
"""


class TaskAgent(Agent):
    def __init__(self, llm_client):
        super().__init__("task", "Task management agent")
        self.llm = llm_client

    def run(self, input_data: str, context: dict) -> str:
        system_prompt = build_system_prompt(context) + TASK_INSTRUCTION

        messages = [{"role": "system", "content": system_prompt}]
        for msg in context.get("history", []):
            messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": input_data})

        return self.llm.chat(messages)
