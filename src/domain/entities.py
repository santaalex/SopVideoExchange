from pydantic import BaseModel
from typing import Optional
from enum import Enum

class TaskStatus(str, Enum):
    # Mingdao Dropdown V3 option keys
    PENDING = "f4ecc5ab-6148-47bd-b0db-b2cad518e2d5"
    PROCESSING = "2c81d8c7-b041-4af8-bec3-b02f8153c331"
    COMPLETED = "c0d03acb-9341-4bfa-8426-d3dbab72dda1"
    FAILED = "791cce52-c0ee-419a-b2df-7101a28fc460"

class VideoTask(BaseModel):
    row_id: str
    title: Optional[str] = None
    original_video_url: Optional[str] = None
    status: TaskStatus = TaskStatus.PENDING
