# YUiOS - 対話がOSになる

YUiは「対話によって人を勇気づけるAI」。
単なるチャットボットではなく、ユーザーの人生の文脈を記憶し、対話を通じて整理・共感・提案を行う。

## セットアップ

```bash
# 依存パッケージのインストール
python3 -m pip install -r requirements.txt

# .env に OpenAI API キーを設定
echo 'OPENAI_API_KEY=sk-...' > .env
```

## 起動

```bash
python3 main.py
```

`quit` または `Ctrl+C` で終了。

## アーキテクチャ

```
User
 ↓
Conversation Layer（対話エンジン）
 ↓
Intent Engine（意図分類）
 ↓
Action Router → Agent（chat / task / idea / search）
 ↓
Memory Layer（3層記憶：短期・中期・長期）
```

### プロジェクト構成

```
main.py                  # エントリーポイント
config.yaml              # 設定
yuios/
  personality/
    yui_core.py           # YUiの人格（傾聴・共感・勇気づけ）
  core/
    conversation.py       # 会話エンジン
    intent_engine.py      # 意図分類
    action_router.py      # エージェントルーティング
    llm_client.py         # LLMクライアント
  memory/
    memory_store.py       # 永続記憶（JSON）
  agents/
    base.py               # 共通インターフェース
    chat_agent.py          # 対話
    task_agent.py          # タスク整理
    idea_agent.py          # アイデア生成
    search_agent.py        # 情報検索
  tools/                  # ツール層（stub）
  voice/                  # 音声（stub）
data/
  memory.json             # ユーザーの記憶（自動生成）
```

## YUiの人格

- 傾聴：まず聴く
- 共感：気持ちに寄り添う
- 整理：思考を整理する手助け
- 勇気づけ：前に進む力を与える

## 記憶システム

YUiは会話からユーザーの情報を自動抽出し、`data/memory.json` に保存する。
次回以降の会話で自然に記憶を活用する。

| 層 | 内容 | 例 |
|---|---|---|
| 短期 | 現在の会話 | 会話履歴 |
| 中期 | 最近の出来事 | 仕事が忙しい、新プロジェクト |
| 長期 | 人生の特徴 | 名前、趣味、価値観 |

## 今後の拡張

- [ ] 音声入出力（Whisper / TTS）
- [ ] ウェブ検索ツール
- [ ] カレンダー連携
- [ ] エージェント追加（自動化、ロボット制御など）
