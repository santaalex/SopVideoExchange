import os
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi.staticfiles import StaticFiles

load_dotenv()

# create tmp_workspace if not exists
import os
os.makedirs("tmp_workspace", exist_ok=True)

app = FastAPI(title="SopVideoExchange Webhook Trigger")

# Mount static files for Mingdao URL Pull
app.mount("/download", StaticFiles(directory="tmp_workspace"), name="download")

class WebhookPayload(BaseModel):
    rowId: str
    
from src.infrastructure.hap_repository import HapRepository
from src.infrastructure.dashscope_service import DashscopeService
from src.infrastructure.ffmpeg_processor import FfmpegMediaProcessor
from src.application.pipeline import VideoProcessingPipeline

def process_video_background(row_id: str):
    print(f"Starting background processing for row: {row_id}")
    
    # Use the robust production pipeline directly
    pipeline = VideoProcessingPipeline()
    
    # Execute
    pipeline.process_task(row_id)

@app.post("/webhook/trigger_video_process")
async def trigger_video_process(payload: WebhookPayload, background_tasks: BackgroundTasks):
    if not payload.rowId:
        raise HTTPException(status_code=400, detail="rowId is required")
        
    # Queue the long-running task to the background
    background_tasks.add_task(process_video_background, payload.rowId)
    
    return {"status": "accepted", "message": f"Processing queued for row {payload.rowId}"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
