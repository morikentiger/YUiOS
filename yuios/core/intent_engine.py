"""Intent detection engine for YUiOS.

Classifies user messages into intent categories
to route them to the appropriate agent.
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

    def detect(self, user_message: str) -> str:
        intent_list = "\n".join(
            f"- {key}: {desc}" for key, desc in INTENT_TYPES.items()
        )

        prompt = (
            "以下のユーザーメッセージを、最も適切な意図カテゴリに分類してください。\n\n"
            f"カテゴリ:\n{intent_list}\n\n"
            f"メッセージ: {user_message}\n\n"
            "カテゴリ名だけを返してください（例: chat）"
        )

        messages = [{"role": "user", "content": prompt}]
        result = self.llm.chat(messages, temperature=0.0)

        intent = result.strip().lower()
        if intent not in INTENT_TYPES:
            return "chat"
        return intent
