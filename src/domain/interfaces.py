from abc import ABC, abstractmethod
from typing import Optional

class IHapRepository(ABC):
    @abstractmethod
    def get_pending_task_details(self, row_id: str) -> tuple[str, str]:
        """Fetch a specific video processing task by its HAP row_id."""
        pass
        
    @abstractmethod
    def update_task_status(self, row_id: str, status: str, message: str = "") -> bool:
        """Update the status of the task in HAP."""
        pass
        
    @abstractmethod
    def upload_attachment(self, row_id: str, control_id: str, file_path: str) -> bool:
        """Upload a local file as an attachment to a specific record and field in HAP."""
        pass
