"""YUiOS API Server

Usage:
    python3 -m uvicorn server:app --reload --port 8000
"""

from __future__ import annotations

import asyncio

import yaml
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from yuios.core.conversation import ConversationEngine

load_dotenv()

with open("config.yaml", "r", encoding="utf-8") as f:
    config = yaml.safe_load(f)

engine = ConversationEngine(config)

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


@app.post("/api/chat")
async def chat(req: ChatRequest):
    response = await asyncio.to_thread(engine.process, req.message)
    return {"response": response}


@app.get("/api/profile")
async def profile():
    return engine.memory.load_user_context()
