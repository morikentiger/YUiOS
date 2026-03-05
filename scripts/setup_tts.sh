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

# Use Python 3.11 (Homebrew) — Style-BERT-VITS2 requires >= 3.10
PYTHON="/opt/homebrew/bin/python3.11"
if [ ! -x "$PYTHON" ]; then
  echo "Error: Python 3.11 not found at $PYTHON"
  echo "Install with: brew install python@3.11"
  exit 1
fi
echo "Using $($PYTHON --version)"

echo "=== Style-BERT-VITS2 Setup for YUiOS ==="
echo ""

# 1. Clone if not already present
if [ -d "$TTS_DIR" ]; then
  echo "[skip] tts/ already exists"
else
  echo "[1/6] Cloning Style-BERT-VITS2..."
  git clone https://github.com/litagin02/Style-Bert-VITS2.git "$TTS_DIR"
fi

cd "$TTS_DIR"

# 2. Create venv with Python 3.11
if [ -d "venv" ]; then
  VENV_PY_VER=$(venv/bin/python --version 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
  if [ "$VENV_PY_VER" != "3.11" ]; then
    echo "[2/6] Recreating venv with Python 3.11 (was $VENV_PY_VER)..."
    rm -rf venv
    "$PYTHON" -m venv venv
  else
    echo "[skip] venv already uses Python 3.11"
  fi
else
  echo "[2/6] Creating Python 3.11 venv..."
  "$PYTHON" -m venv venv
fi

# Activate
source venv/bin/activate

# 3. Install dependencies (avoid broken version pins in upstream requirements)
echo "[3/6] Installing dependencies..."
pip install --upgrade pip
pip install "setuptools<81"  # needed for pkg_resources (pyopenjtalk)
pip install torch torchaudio  # MPS auto-detected on Apple Silicon
pip install "numpy==1.26.4"  # pyopenjtalk-dict binary requires numpy 1.x

# Install core inference deps individually (upstream requirements have incompatible pins)
pip install \
  accelerate cmudict cn2an "faster-whisper>=1.0" g2p_en GPUtil \
  "gradio>=4.32" jieba loguru "nltk<=3.8.1" num2words \
  onnx onnxconverter-common onnxruntime onnxsim-prebuilt \
  psutil pyopenjtalk-dict pypinyin pyworld-prebuilt \
  transformers scipy uvicorn fastapi numba

# 4. Download default model
echo "[4/6] Downloading default model..."
python initialize.py

# 5. Fix tokenizer: remove fast tokenizer json (incompatible with BertJapaneseTokenizer)
echo "[5/6] Fixing JP BERT tokenizer..."
if [ -f "bert/deberta-v2-large-japanese-char-wwm/tokenizer.json" ]; then
  mv "bert/deberta-v2-large-japanese-char-wwm/tokenizer.json" \
     "bert/deberta-v2-large-japanese-char-wwm/tokenizer.json.bak"
fi

# 6. Fix BERT fp16→fp32 for CPU inference
echo "[6/6] Patching BERT feature extraction for fp32..."
sed -i.bak 's/res = torch.cat(res\["hidden_states"\]\[-3:-2\], -1)\[0\].cpu()/res = torch.cat(res["hidden_states"][-3:-2], -1)[0].cpu().float()/' \
  style_bert_vits2/nlp/japanese/bert_feature.py

# 7. Configure server port (5001 to avoid macOS AirPlay on 5000)
if grep -q "port: 5000" config.yml 2>/dev/null; then
  sed -i.bak 's/port: 5000/port: 5001/' config.yml
  echo "  → Server port set to 5001"
fi
if grep -q 'device: "cuda"' config.yml 2>/dev/null; then
  sed -i.bak 's/device: "cuda"/device: "cpu"/' config.yml
  echo "  → Device set to cpu"
fi

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Start the TTS server with:"
echo "  bash scripts/start_tts.sh"
echo ""
echo "Or manually:"
echo "  cd tts && source venv/bin/activate && python server_fastapi.py"
