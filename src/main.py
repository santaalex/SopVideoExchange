from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
from typing import Dict, Any

from src.application.pipeline import VideoProcessingPipeline
from src.domain.video_task import TaskStatusEnum

app = FastAPI(title="SopVideoExchange Automation Server", version="1.0.0")
pipeline = VideoProcessingPipeline()

class WebhookPayload(BaseModel):
    row_id: str
    
@app.post("/api/v1/video/translate")
async def trigger_translation_task(payload: WebhookPayload, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    """
    Webhook endpoint to be called by Mingdao Cloud when a new video task is submitted.
    Because video processing takes minutes, we return 200 OK immediately and process in the background.
    """
    if not payload.row_id:
        raise HTTPException(status_code=400, detail="Missing row_id")
        
    # Queue the heavy pipeline task in the background
    background_tasks.add_task(pipeline.process_task, payload.row_id)
    
    return {
        "status": "success",
        "message": f"Task {payload.row_id} has been queued for background processing."
    }

@app.get("/health")
def health_check():
    return {"status": "ok"}
