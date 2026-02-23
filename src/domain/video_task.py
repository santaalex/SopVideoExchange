from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum

class TaskStatusEnum(str, Enum):
    PENDING = "待处理"
    PROCESSING = "处理中"
    SUCCESS = "已完成"
    FAILED = "失败"

class VideoTask(BaseModel):
    """
    Represents a single video processing task originating from the HAP (Mingdao) platform.
    """
    row_id: str = Field(..., description="The unique row ID in the HAP worksheet")
    original_video_url: str = Field(..., description="The download URL for the original video attachment")
    original_video_name: str = Field(..., description="The original filename of the video")
    
    status: TaskStatusEnum = Field(default=TaskStatusEnum.PENDING)
    error_message: Optional[str] = None
    
    # Optional fields for local processing state tracking
    local_video_path: Optional[str] = None
    local_audio_path: Optional[str] = None
    local_srt_path: Optional[str] = None
    local_final_video_path: Optional[str] = None
