"""LLM client wrapper for YUiOS."""

from __future__ import annotations

from openai import OpenAI


class LLMClient:
    def __init__(self, config: dict):
        self.client = OpenAI()
        self.model = config.get("model", "gpt-4o-mini")
        self.temperature = config.get("temperature", 0.7)

    def chat(self, messages: list[dict], **kwargs) -> str:
        response = self.client.chat.completions.create(
            model=kwargs.get("model", self.model),
            messages=messages,
            temperature=kwargs.get("temperature", self.temperature),
        )
        return response.choices[0].message.content or ""
