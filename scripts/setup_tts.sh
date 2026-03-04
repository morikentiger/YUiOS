#!/usr/bin/env bash
#
# Setup Style-BERT-VITS2 TTS server for YUiOS.
#
# Usage:
#   bash scripts/setup_tts.sh
#
# After setup, start the TTS server with:
#   bash scripts/start_tts.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TTS_DIR="$PROJECT_DIR/tts"

echo "=== Style-BERT-VITS2 Setup for YUiOS ==="
echo ""

# 1. Clone if not already present
if [ -d "$TTS_DIR" ]; then
  echo "[skip] tts/ already exists"
else
  echo "[1/4] Cloning Style-BERT-VITS2..."
  git clone https://github.com/litagin02/Style-Bert-VITS2.git "$TTS_DIR"
fi

cd "$TTS_DIR"

# 2. Create venv
if [ -d "venv" ]; then
  echo "[skip] venv already exists"
else
  echo "[2/4] Creating Python venv..."
  python3 -m venv venv
fi

# Activate
source venv/bin/activate

# 3. Install dependencies
echo "[3/4] Installing dependencies (torch + requirements)..."
pip install --upgrade pip
pip install torch torchaudio  # MPS auto-detected on Apple Silicon
pip install -r requirements.txt

# 4. Download default model
echo "[4/4] Downloading default model..."
python initialize.py

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Start the TTS server with:"
echo "  bash scripts/start_tts.sh"
echo ""
echo "Or manually:"
echo "  cd tts && source venv/bin/activate && python server_fastapi.py --port 5000"
