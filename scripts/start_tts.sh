#!/usr/bin/env bash
#
# Start Style-BERT-VITS2 TTS server for YUiOS.
# Run setup_tts.sh first if you haven't already.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TTS_DIR="$(dirname "$SCRIPT_DIR")/tts"

if [ ! -d "$TTS_DIR/venv" ]; then
  echo "Error: TTS not set up yet. Run: bash scripts/setup_tts.sh"
  exit 1
fi

cd "$TTS_DIR"
source venv/bin/activate

echo "Starting Style-BERT-VITS2 on port 5000..."
python server_fastapi.py --port 5000
