import requests
from typing import Optional
from src.domain.interfaces import IHapRepository
from src.domain.entities import VideoTask, TaskStatus
from src.config import Config

class HapRepository(IHapRepository):
    def __init__(self):
        self.base_url = "https://api.mingdao.com/v2"
        self.app_key = Config.HAP_APP_KEY
        self.sign = Config.HAP_SIGN
        self.worksheet_id = Config.HAP_WORKSHEET_ID
        
    def _get_headers(self):
        return {
            "Content-Type": "application/json"
        }
        
    def get_pending_task_details(self, row_id: str) -> tuple[str, str]:
        """
        Returns (video_download_url, video_filename) for the given row.
        """
        # API V3: GET https://api.mingdao.com/v3/app/worksheets/{worksheet_id}/rows/{row_id}
        url = f"https://api.mingdao.com/v3/app/worksheets/{self.worksheet_id}/rows/{row_id}"
        
        headers = {
            "HAP-Appkey": self.app_key,
            "HAP-Sign": self.sign
        }
        
        try:
            response = requests.get(url, headers=headers, timeout=(10, 30))
            response.raise_for_status()
            res_json = response.json()
            
            if res_json.get("success"): # Success for V3 API
                row_data = res_json.get("data", {})
                
                # Extract attachments URL (assuming control alias 'vid_original')
                import json
                
                # Check for 'original_video' or 'vid_original' etc based on your specific HAP column alias
                # Let's check common names
                keys_to_check = ['original_video', 'vid_original', 'video', 'file', 'attachments']
                
                for key in keys_to_check:
                    if row_data.get(key):
                        try:
                            # In V3, it might be a JSON string or already parsed list of dicts.
                            attachments = row_data[key]
                            if isinstance(attachments, str):
                                attachments = json.loads(attachments)
                            
                            if isinstance(attachments, list) and len(attachments) > 0:
                                return attachments[0].get("DownloadUrl") or attachments[0].get("downloadUrl"), attachments[0].get("original_file_name", "downloaded_video.mp4")
                        except Exception as parse_e:
                            print(f"Error parsing attachment json: {parse_e}")
                            
                return "", ""
            else:
                print(f"HAP API Error: {res_json}")
                return "", ""
                
        except Exception as e:
            print(f"Error fetching task {row_id} from HAP: {e}")
            return "", ""

    def update_task_status(self, row_id: str, status: str, message: str = "") -> bool:
        # User defined the field ID for status is 699720406272340c521f50b8
        url = f"https://api.mingdao.com/v3/app/worksheets/{self.worksheet_id}/rows/{row_id}"
        
        headers = {
            "HAP-Appkey": self.app_key,
            "HAP-Sign": self.sign,
            "Content-Type": "application/json"
        }
        
        payload = {
            "fields": [
                {
                    "id": "699720406272340c521f50b8",
                    "value": status.value if hasattr(status, 'value') else status
                }
            ]
        }
        
        try:
            response = requests.patch(url, json=payload, headers=headers, timeout=(10, 30))
            response.raise_for_status()
            res_json = response.json()
            return res_json.get("success") == True
        except Exception as e:
            print(f"Error updating task {row_id} status: {e}")
            return False

    def upload_attachment(self, row_id: str, control_id: str, file_path: str) -> bool:
        # V3 works by patching the row with base64 data for the attachment field
        url = f"https://api.mingdao.com/v3/app/worksheets/{self.worksheet_id}/rows/{row_id}"
        
        headers = {
            "HAP-Appkey": self.app_key,
            "HAP-Sign": self.sign,
            "Content-Type": "application/json"
        }
        
        import os
        import base64
        filename = os.path.basename(file_path)
        
        try:
            public_host = os.getenv("PUBLIC_HOST_URL")
            mime_type = "application/octet-stream"
            if filename.endswith(".mp4"): mime_type = "video/mp4"
            elif filename.endswith(".wav"): mime_type = "audio/wav"
            elif filename.endswith(".srt"): mime_type = "text/plain"
            
            # Map logical control_id to actual Mingdao V3 Field IDs from the picture
            field_id_map = {
                "output_video": "699720108272310c521f50b6",
                "cantonese_audio": "699720108272310c521f50b5",
                "cantonese_subtitle": "699720406272340c521f50b4",
                "mandarin_subtitle": "699720406272340c521f50b3"
            }
            actual_field_id = field_id_map.get(control_id, control_id)
            
            # URL Pull logic for large files if host is defined
            if public_host and (filename.endswith(".mp4") or filename.endswith(".wav")):
                rel_path = file_path.split("tmp_workspace" + os.sep)[-1].replace("\\", "/")
                download_url = f"{public_host.rstrip('/')}/download/{rel_path}"
                print(f"[HAP Repo] URL Pull Strategy using {download_url}")
                
                payload = {
                    "fields": [
                        {
                            "id": actual_field_id,
                            "value": download_url
                        }
                    ]
                }
            else:
                with open(file_path, 'rb') as f:
                    b64_data = base64.b64encode(f.read()).decode('utf-8')
                
                payload = {
                    "fields": [
                        {
                            "id": actual_field_id,
                            "value": [{
                                "name": filename,
                                "url": f"data:{mime_type};base64,{b64_data}"
                            }]
                        }
                    ]
                }
            
            response = requests.patch(url, headers=headers, json=payload, timeout=(10, 60))
            response.raise_for_status()
            res_json = response.json()
            is_success = res_json.get("success") == True
            
            if not is_success:
                print(f"[HAP Repo] Mingdao rejected attachment {filename}. API Response: {res_json}")
                
            return is_success
            
        except Exception as e:
            print(f"Error uploading attachment to {control_id}: {e}")
            return False

    def upload_translated_video(self, row_id: str, file_path: str) -> bool:
        """
        Helper method to upload the final video to the specific HAP column.
        We will try 'output_video' as the control alias by default.
        """
        return self.upload_attachment(row_id, "output_video", file_path)
        
    def upload_mandarin_subtitle(self, row_id: str, file_path: str) -> bool:
        """Uploads the corrected Mandarin .srt file"""
        print(f"[HAP Repo] Uploading Mandarin Subtitles for {row_id}...")
        return self.upload_attachment(row_id, "mandarin_subtitle", file_path)

    def upload_cantonese_subtitle(self, row_id: str, file_path: str) -> bool:
        """Uploads the translated Cantonese .srt file"""
        print(f"[HAP Repo] Uploading Cantonese Subtitles for {row_id}...")
        return self.upload_attachment(row_id, "cantonese_subtitle", file_path)
        
    def upload_cantonese_audio(self, row_id: str, file_path: str) -> bool:
        """Uploads the merged Cantonese .wav file"""
        print(f"[HAP Repo] Uploading Cantonese Audio for {row_id}...")
        return self.upload_attachment(row_id, "cantonese_audio", file_path)

    def upload_error_log(self, row_id: str, log_content: str) -> bool:
        """
        Uploads an error traceback or service log string to the multi-line text field 
        in Mingdao Cloud (service_log: 699b103b9e51af719b1dc5a0).
        """
        url = f"https://api.mingdao.com/v3/app/worksheets/{self.worksheet_id}/rows/{row_id}"
        
        headers = {
            "HAP-Appkey": self.app_key,
            "HAP-Sign": self.sign,
            "Content-Type": "application/json"
        }
        
        payload = {
            "fields": [
                {
                    "id": "699b103b9e51af719b1dc5a0",
                    "value": log_content
                }
            ]
        }
        
        try:
            response = requests.patch(url, headers=headers, json=payload, timeout=(10, 30))
            response.raise_for_status()
            res_json = response.json()
            if res_json.get("success"):
                print(f"[HAP Repo] Successfully pushed error log to row {row_id}")
                return True
            else:
                print(f"[HAP Repo] Failed to push error log. Response: {res_json}")
                return False
        except Exception as e:
            print(f"[HAP Repo] Exception while pushing error log: {e}")
            return False

