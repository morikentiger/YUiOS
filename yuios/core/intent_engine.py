"""Intent detection engine for YUiOS.

Classifies user messages into intent categories
to route them to the appropriate agent.
Also extracts a short topic label for last_topic tracking.
"""

INTENT_TYPES = {
    "chat": "雑談・相談・感情の共有・励まし",
    "task_management": "タスクの作成・整理・一覧・完了",
    "idea_generation": "ブレインストーミング・アイデア出し・創造的思考",
    "information_search": "情報検索・質問・知識を求める",
    "memory_update": "個人情報の共有・自己紹介・記憶の更新",
}


class IntentEngine:
    def __init__(self, llm_client):
        self.llm = llm_client

    def detect(self, user_message: str) -> dict:
        """Detect intent and extract topic in a single LLM call.

        Returns:
            {"intent": str, "topic": str}
        """
        intent_list = "\n".join(
            f"- {key}: {desc}" for key, desc in INTENT_TYPES.items()
        )

        prompt = (
            "以下のユーザーメッセージを分析してください。\n\n"
            f"カテゴリ:\n{intent_list}\n\n"
            f"メッセージ: {user_message}\n\n"
            "以下の形式で2行だけ返してください:\n"
            "intent:カテゴリ名\n"
            "topic:話題を10文字以内で要約"
        )

        messages = [{"role": "user", "content": prompt}]
        result = self.llm.chat(messages, temperature=0.0)

        intent = "chat"
        topic = ""

        for line in result.strip().split("\n"):
            line = line.strip()
            if line.startswith("intent:"):
                val = line[7:].strip().lower()
                if val in INTENT_TYPES:
                    intent = val
            elif line.startswith("topic:"):
                topic = line[6:].strip()

        return {"intent": intent, "topic": topic}
