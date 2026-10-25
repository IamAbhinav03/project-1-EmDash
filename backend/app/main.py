from __future__ import annotations

import json
import mimetypes
import re
import os
from pathlib import Path
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

DATA_DIR = Path(os.environ.get("DATA_DIR", "/tmp/emdash-data"))
PROJECTS_DIR = DATA_DIR / "projects"
ASSETS_DIR = DATA_DIR / "assets"

PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
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


def project_path(project_id: str) -> Path:
    if not re.fullmatch(r"[a-zA-Z0-9_-]{1,80}", project_id):
        raise HTTPException(status_code=400, detail="Invalid project id")
    return PROJECTS_DIR / f"{project_id}.json"


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "emdash-api"}


@app.get("/api/projects")
def list_projects() -> list[dict[str, Any]]:
    projects = []
    for path in PROJECTS_DIR.glob("*.json"):
        try:
            project = json.loads(path.read_text(encoding="utf-8"))
            projects.append({"id": path.stem, "name": project["name"], "updatedAt": project["updatedAt"]})
        except (OSError, ValueError, KeyError):
            continue
    return sorted(projects, key=lambda item: item["updatedAt"], reverse=True)


@app.get("/api/projects/{project_id}")
def get_project(project_id: str) -> dict[str, Any]:
    path = project_path(project_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    return json.loads(path.read_text(encoding="utf-8"))


@app.put("/api/projects/{project_id}")
def save_project(project_id: str, payload: ProjectPayload) -> dict[str, Any]:
    path = project_path(project_id)
    project = payload.model_dump()
    project["updatedAt"] = datetime.now(timezone.utc).isoformat()
    path.write_text(json.dumps(project, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"id": project_id, "name": project["name"], "updatedAt": project["updatedAt"]}


@app.post("/api/assets", status_code=201)
async def upload_asset(file: UploadFile = File(...)) -> dict[str, Any]:
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
