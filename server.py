"""YUiOS API Server

Usage:
    python3 -m uvicorn server:app --reload --port 8000
"""

from __future__ import annotations

import asyncio
import logging

import httpx
import yaml
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from yuios.core.conversation import ConversationEngine

load_dotenv()
logger = logging.getLogger("yuios")

with open("config.yaml", "r", encoding="utf-8") as f:
    config = yaml.safe_load(f)

engine = ConversationEngine(config)

# TTS config (Style-BERT-VITS2)
tts_config = config.get("tts", {})
TTS_URL = tts_config.get("url", "http://localhost:5000")
TTS_MODEL_ID = tts_config.get("model_id", 0)
TTS_STYLE = tts_config.get("style", "Neutral")

app = FastAPI(title="YUiOS")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str


class TTSRequest(BaseModel):
    text: str
    style: str | None = None


@app.post("/api/chat")
async def chat(req: ChatRequest):
    response = await asyncio.to_thread(engine.process, req.message)
    return {"response": response}


@app.get("/api/profile")
async def profile():
    return engine.memory.load_user_context()


@app.post("/api/tts")
async def tts(req: TTSRequest):
    """Proxy TTS request to Style-BERT-VITS2 API server."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{TTS_URL}/voice",
                params={
                    "text": req.text,
                    "model_id": TTS_MODEL_ID,
                    "language": "JP",
                    "style": req.style or TTS_STYLE,
                },
            )
            resp.raise_for_status()
        return Response(
            content=resp.content,
            media_type="audio/wav",
        )
    except (httpx.ConnectError, httpx.TimeoutException):
        logger.warning("Style-BERT-VITS2 server not reachable at %s", TTS_URL)
        return Response(status_code=503, content="TTS server unavailable")
    except httpx.HTTPStatusError as e:
        logger.error("TTS error: %s", e)
        return Response(status_code=502, content="TTS synthesis failed")
