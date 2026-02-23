import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    HAP_APP_KEY = os.getenv("HAP_APP_KEY", "")
    HAP_SIGN = os.getenv("HAP_SIGN", "")
    HAP_WORKSHEET_ID = os.getenv("HAP_WORKSHEET_ID", "69971f499e51af719b1d557d")
    
    DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "")
    
    ALIYUN_AK_ID = os.getenv("ALIYUN_AK_ID", "")
    ALIYUN_AK_SECRET = os.getenv("ALIYUN_AK_SECRET", "")
    NLS_APP_KEY = os.getenv("NLS_APP_KEY", "")
    
    # Environment
    ENV = os.getenv("ENV", "development")
