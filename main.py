"""YUiOS - Conversational Operating System

Usage:
    python main.py
"""

import os
import sys

import yaml
from dotenv import load_dotenv

from yuios.core.conversation import ConversationEngine


def load_config(path: str = "config.yaml") -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def main():
    load_dotenv()

    if not os.getenv("OPENAI_API_KEY"):
        print("Error: OPENAI_API_KEY が .env に設定されていません。")
        print("  echo 'OPENAI_API_KEY=sk-...' > .env")
        sys.exit(1)

    config = load_config()
    engine = ConversationEngine(config)

    print()
    print("=" * 50)
    print("  YUiOS v0.1 - 対話がOSになる")
    print("  'quit' で終了")
    print("=" * 50)
    print()

    # Initial greeting based on memory
    profile = engine.memory.load_user_context()
    if profile.get("name"):
        print(f"YUi: おかえりなさい、{profile['name']}さん！")
        if profile.get("last_topic"):
            print(f"     前回は「{profile['last_topic']}」の話をしてたね。")
    else:
        print("YUi: はじめまして！YUiです。")
        print("     あなたのことを教えてもらえたら嬉しいな。")
    print()

    while True:
        try:
            user_input = input("You: ").strip()
            if not user_input:
                continue
            if user_input.lower() in ("quit", "exit", "bye", "さようなら"):
                print()
                print("YUi: またね！いつでも話しかけてね。")
                break

            response = engine.process(user_input)
            print(f"\nYUi: {response}\n")

        except KeyboardInterrupt:
            print("\n\nYUi: またね！")
            break
        except Exception as e:
            print(f"\n[Error: {e}]\n")


if __name__ == "__main__":
    main()
