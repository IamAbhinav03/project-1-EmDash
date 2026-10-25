from __future__ import annotations

import mimetypes
import os
import re
from pathlib import Path
from typing import Any

from psycopg.types.json import Jsonb
from .database import connection
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
ASSETS_DIR = DATA_DIR / "assets"
if not os.getenv("VERCEL"):
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="EmDash Audio Editor API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173", "http://127.0.0.1:4173"],
    allow_credentials=True,
    allow_methods=["GET", "PUT", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


class ProjectPayload(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    tracks: list[dict[str, Any]] = Field(default_factory=list)
    assets: list[dict[str, Any]] = Field(default_factory=list)


def validate_project_id(project_id: str) -> str:
    if not re.fullmatch(r"[a-zA-Z0-9_-]{1,80}", project_id):
        raise HTTPException(status_code=400, detail="Invalid project id")
    return project_id


@app.get("/api/health")
def health() -> dict[str, str]:
    with connection() as conn:
        conn.execute("SELECT 1")
    return {"status": "ok", "service": "emdash-api"}


@app.get("/api/projects")
def list_projects() -> list[dict[str, Any]]:
    with connection() as conn:
        rows = conn.execute("SELECT id, name, updated_at FROM projects ORDER BY updated_at DESC").fetchall()
    return [{"id": row["id"], "name": row["name"], "updatedAt": row["updated_at"].isoformat()} for row in rows]


@app.get("/api/projects/{project_id}")
def get_project(project_id: str) -> dict[str, Any]:
    with connection() as conn:
        row = conn.execute("SELECT name, tracks, assets, updated_at FROM projects WHERE id = %s", (validate_project_id(project_id),)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"id": project_id, "name": row["name"], "tracks": row["tracks"], "assets": row["assets"], "updatedAt": row["updated_at"].isoformat()}


@app.put("/api/projects/{project_id}")
def save_project(project_id: str, payload: ProjectPayload) -> dict[str, Any]:
    with connection() as conn:
        row = conn.execute("""
            INSERT INTO projects (id, name, tracks, assets, updated_at)
            VALUES (%s, %s, %s, %s, now())
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name, tracks = EXCLUDED.tracks,
                assets = EXCLUDED.assets, updated_at = now()
            RETURNING updated_at
        """, (validate_project_id(project_id), payload.name, Jsonb(payload.tracks), Jsonb(payload.assets))).fetchone()
    return {"id": project_id, "name": payload.name, "updatedAt": row["updated_at"].isoformat()}


@app.post("/api/assets", status_code=201)
async def upload_asset(file: UploadFile = File(...)) -> dict[str, Any]:
    if os.getenv("VERCEL"):
        raise HTTPException(status_code=501, detail="Upload audio through the media library's Blob uploader")
    suffix = Path(file.filename or "audio").suffix.lower()
    content_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"
    if not content_type.startswith("audio/") and suffix not in {".wav", ".mp3", ".m4a", ".ogg", ".flac", ".aac", ".webm"}:
        raise HTTPException(status_code=415, detail="Upload an audio file")
    asset_id = uuid4().hex
    target = ASSETS_DIR / f"{asset_id}{suffix or '.audio'}"
    total = 0
    with target.open("wb") as output:
        while chunk := await file.read(1024 * 1024):
            total += len(chunk)
            if total > 250 * 1024 * 1024:
                target.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="Audio files must be smaller than 250 MB")
            output.write(chunk)
    return {"id": asset_id, "name": file.filename or target.name, "url": f"/api/assets/{asset_id}", "contentType": content_type, "size": total}


@app.get("/api/assets/{asset_id}")
def get_asset(asset_id: str) -> FileResponse:
    if not re.fullmatch(r"[a-f0-9]{32}", asset_id):
        raise HTTPException(status_code=400, detail="Invalid asset id")
    matches = list(ASSETS_DIR.glob(f"{asset_id}.*"))
    if not matches:
        raise HTTPException(status_code=404, detail="Audio asset not found")
    file_path = matches[0]
    return FileResponse(file_path, media_type=mimetypes.guess_type(file_path.name)[0] or "application/octet-stream", filename=file_path.name)
