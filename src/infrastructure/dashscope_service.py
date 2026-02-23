import os
import json
import time
import requests
from typing import List
from dashscope import Generation
from dashscope.audio.asr import Recognition
from dashscope.audio.tts import SpeechSynthesizer
from src.domain.ai_interfaces import IAiServices, SpeechSegment
from src.config import Config

class DashscopeService(IAiServices):
    def __init__(self):
        self.api_key = Config.DASHSCOPE_API_KEY
        if not self.api_key:
            raise ValueError("DASHSCOPE_API_KEY environment variable is missing")
        import dashscope
        dashscope.api_key = self.api_key
        
    def transcribe_audio(self, audio_file_path: str) -> List[SpeechSegment]:
        """
        Extract text and timestamps from an audio file using Alibaba Cloud Paraformer-v1.
        We request word-level/sentence-level timestamps so we know exactly when a sentence starts and ends.
        """
        # Note: Paraformer requires a URL or streaming, let's assume we handle local file uploading or async API later.
        # For simplicity in this mock/V1, we will use the sync Recognize API if applicable.
        # But realistically, long video = > 1 min, we must use file-transcription (async Task).
        
        # Here we mock the file transcription logic for now. 
        # In actual execution, we'll need to upload to OSS, pass URL to `dashscope.audio.asr.Transcription`
        print(f"[DashscopeService] Transcribing {audio_file_path} ... (Mock Implementation)")
        
    def transcribe_audio(self, audio_file_path: str) -> List[SpeechSegment]:
        """
        Extract text and timestamps from an audio file using Alibaba Cloud NLS (Intelligent Speech Interaction).
        Specifically uses the '识音石 V1' (speech recognition) via WebSocket.
        """
        print(f"[DashscopeService] Transcribing {audio_file_path} via NLS SDK ...")
        
        try:
            from aliyunsdkcore.client import AcsClient
            from aliyunsdkcore.request import CommonRequest
            import nls
            import threading
            import time
            
            # 1. Provide AK/SK to get a temporary NLS Token
            ak = Config.ALIYUN_AK_ID
            sk = Config.ALIYUN_AK_SECRET
            appkey = Config.NLS_APP_KEY
            
            if not ak or not sk or not appkey:
                print("[DashscopeService] Missing Aliyun NLS credentials (AK, SK, AppKey) in config.")
                return []
                
            client = AcsClient(ak, sk, "cn-shanghai")
            request = CommonRequest()
            request.set_method('POST')
            request.set_domain('nls-meta.cn-shanghai.aliyuncs.com')
            request.set_version('2019-02-28')
            request.set_action_name('CreateToken')
            
            token_response = client.do_action_with_exception(request)
            token = json.loads(token_response).get('Token').get('Id')
            
            # Use threading to wait for SpeechRecognizer to finish
            wait_event = threading.Event()
            segments = []
            
            def test_on_sentence_begin(message, *args):
                print(f"[NLS ASR] Sentence Begin: {message}")

            def test_on_sentence_end(message, *args):
                print(f"[NLS ASR] Sentence End: {message}")
                try:
                    msg_json = json.loads(message)
                    payload = msg_json.get("payload", {})
                    text = payload.get("result", "")
                    begin_time = payload.get("begin_time", 0)
                    time_end = payload.get("time", 0)
                    
                    if text:
                        segments.append(SpeechSegment(
                            start_time=begin_time,
                            end_time=time_end,
                            text=text
                        ))
                except Exception as e:
                    print(f"[NLS ASR] Error parsing sentence end: {e}")

            def test_on_result_changed(message, *args):
                print(f"[NLS ASR] Result Changed: {message}")

            def test_on_completed(message, *args):
                print(f"[NLS ASR] Recognition completed: {message}")
                wait_event.set()

            def test_on_error(message, *args):
                print(f"[NLS ASR] Error: {message}")
                wait_event.set()

            def test_on_close(*args):
                print("[NLS ASR] Connection closed.")
                wait_event.set()

            # Create the NLS Transcriber (for long/continuous speech with sentence ends)
            sr = nls.NlsSpeechTranscriber(
                url='wss://nls-gateway-cn-shanghai.aliyuncs.com/ws/v1',
                token=token,
                appkey=appkey,
                on_sentence_begin=test_on_sentence_begin,
                on_sentence_end=test_on_sentence_end,
                on_result_changed=test_on_result_changed,
                on_completed=test_on_completed,
                on_error=test_on_error,
                on_close=test_on_close,
                callback_args=[]
            )
            
            # Start streaming
            print("[NLS ASR] Starting stream (pcm)...")
            # We must enable voice detection/intermediate results for timestamps
            sr.start(aformat='pcm', enable_intermediate_result=False, enable_punctuation_prediction=True, enable_inverse_text_normalization=True)
            
            # Read local WAV file and push. Skip 44 byte WAV header for pure PCM.
            with open(audio_file_path, "rb") as f:
                f.read(44) # skip wav header
                while True:
                    data = f.read(3200) # Read in chunks (e.g. 100ms of 16k 16bit)
                    if not data:
                        break
                    sr.send_audio(data)
                    time.sleep(0.01) # Simulate realtime stream pace to avoid dropping
                    
            sr.stop()
            wait_event.wait(timeout=30)
            
            print(f"[NLS ASR] Extracted {len(segments)} segments.")
            return segments
            
        except Exception as e:
            print(f"[DashscopeService] Exception in NLS ASR: {e}")
            return []

    def detect_industry_context(self, segments: List[SpeechSegment]) -> str:
        """
        Reads a sample of the raw ASR text and uses the LLM to classify the industry context.
        Returns one of: 'manufacturing', 'banking', 'ngo', 'gov', or 'general'.
        """
        if not segments:
            return "general"
            
        print("[DashscopeService] Reading ASR text to auto-detect industry context...")
        
        # Sample the first 50 segments to get a strong gist of the video without overflowing the prompt cheaply
        sample_segments = segments[:50]
        sample_text = " ".join([seg.text for seg in sample_segments])
        
        prompt = (
            "你是一个极其聪明的语义分析系统。请阅读以下视频语音识别（ASR）文本的片段，并判断其所属的行业领域。\n"
            "文本片段：\n"
            f"「{sample_text}」\n\n"
            "请你只回答以下英文单词中的一个，不要回答任何汉字或标点符号：\n"
            "1. manufacturing (如果内容涉及：工厂、生产线、物料、BOM、模具、设备、库存、出库入库等)\n"
            "2. banking (如果内容涉及：银行、金融账户、开户、信贷、结算、风控等)\n"
            "3. ngo (如果内容涉及：非盈利组织、社区服务、慈善、社工、志愿者等)\n"
            "4. gov (如果内容涉及：政府部门、公共政策、施政报告、行政管理、法定等)\n"
            "5. general (如果上述都不是，或者只是一般的日常交流，请选择此项)\n\n"
            "你的回答："
        )
        
        try:
            response = Generation.call(
                model=Generation.Models.qwen_turbo,
                prompt=prompt
            )
            
            if response.status_code == 200:
                answer = response.output.text.strip().lower()
                
                # Failsafe standardizing
                valid_contexts = ["manufacturing", "banking", "ngo", "gov", "general"]
                for ctx in valid_contexts:
                    if ctx in answer:
                        print(f"[DashscopeService] Auto-detected context: {ctx}")
                        return ctx
                        
                print(f"[DashscopeService] Parsed unknown context '{answer}', defaulting to 'general'")
                return "general"
            else:
                print(f"[DashscopeService] LLM Context Detection Error: {response.code}")
                return "general"
        except Exception as e:
            print(f"[DashscopeService] Exception during Context Detection: {e}")
            return "general"


    def correct_transcription(self, segments: List[SpeechSegment], industry_context: str = "manufacturing") -> List[SpeechSegment]:
        """
        Uses Qwen-Turbo to correct typographical errors in the ASR output using context.
        Operates in batches to maintain strict line alignment and context memory.
        """
        if not segments:
            return []
            
        print(f"[DashscopeService] Correcting typos for {len(segments)} segments with context: {industry_context}...")
        import re
        
        batch_size = 50
        corrected_segments = []
        
        context_instructions = {
            "manufacturing": (
                "请结合【模具生产、库存管理、BOM物料、车间装配】的上下文语境，"
                "修正错词及口语瑕疵。\n特别注意以下同音/近音混淆：\n"
                "- “魔剧” 改为 “模具”\n"
                "- “办成品” 改为 “半成品”\n"
                "- “路酷”/“入哭” 改为 “入库”\n"
                "- “出哭” 改为 “出库”\n"
                "- “一杠八”/“衣纲八” 改为 “1-8”\n"
                "- “酒钢十六”/“九纲” 改为 “9-16”\n"
                "- “伪醉” 改为 “尾缀”\n"
                "- “穿投” 改为 “穿透”\n"
                "- “外乡” 改为 “外箱”\n"
                "- “手冻” 改为 “手动”\n"
            ),
            "banking": (
                "请结合【银行金融、柜台开户、信贷、结算、风险控制】的上下文语境，"
                "修正语音识别中极易出现的同音错别字和不符合金融业务逻辑的错词及口语瑕疵。\n"
            ),
            "ngo": (
                "请结合【香港NGO、非盈利组织、社区服务、志愿者行动、社会福利、慈善基金】的上下文语境，"
                "修正语音识别中可能出现的同音错别字和不符合社工或公益行业逻辑的错词及口语瑕疵。\n"
                "要求用词必须具有人文关怀和公益行业的专业性。\n"
            ),
            "gov": (
                "请结合【香港政府部门、公共服务、施政报告、政策宣导、行政干预、法定机构】的上下文语境，"
                "修正语音识别中可能出现的同音错别字和不符合政府官方严谨表述的错词及口语瑕疵。\n"
                "必须保证用词的高度严肃性、中立性与行政用语的准确性。\n"
            ),
            "general": (
                "请结合通用日常沟通语境，修正语音识别中可能存在的同音错别字、不连贯的错词以及口语瑕疵。\n"
            )
        }
        
        specific_instruction = context_instructions.get(industry_context.lower(), context_instructions["general"])
        
        for i in range(0, len(segments), batch_size):
            batch = segments[i:i + batch_size]
            
            # Prepare the numbered prompt
            lines = [f"{idx+1}. {seg.text}" for idx, seg in enumerate(batch)]
            text_block = "\n".join(lines)
            
            prompt = (
                f"你现在是一个极其严格的ERP系统和多行业字幕纠错专家。{specific_instruction}\n"
                "【执行纪律】：\n"
                "1. 必须完全保留原始的行号格式（例如“1. xxx”），严禁丢弃数字编号。\n"
                "2. 绝对不能合并行、删除行或新增行，输入的行数是多少，输出就必须是多少行！\n"
                "3. 仅返回带编号的文本，不要任何解释说明或废话。\n\n"
                f"{text_block}"
            )
            
            # API Request
            try:
                print(f"[DashscopeService]  -> Processing batch {i//batch_size + 1} ({len(batch)} lines)...")
                response = Generation.call(
                    model=Generation.Models.qwen_turbo,
                    prompt=prompt
                )
                
                if response.status_code == 200:
                    output_text = response.output.text.strip()
                    
                    # Parse numbered list strictly back to segment texts
                    # Example target: "1. 经过修正的句子"
                    parsed_lines = {}
                    for line in output_text.split('\n'):
                        line = line.strip()
                        match = re.match(r'^(\d+)[\.\,\、\s]\s*(.*)$', line)
                        if match:
                            num = int(match.group(1))
                            text = match.group(2).strip()
                            parsed_lines[num] = text
                    
                    # Reconstruct maintaining strict ordering
                    for idx, seg in enumerate(batch):
                        list_idx = idx + 1
                        if list_idx in parsed_lines and parsed_lines[list_idx]:
                            # Copy the segment object and update just the text
                            corrected_seg = SpeechSegment(
                                start_time=seg.start_time,
                                end_time=seg.end_time,
                                text=parsed_lines[list_idx]
                            )
                            corrected_segments.append(corrected_seg)
                        else:
                            print(f"[DashscopeService] Warning: Failed to parse line {list_idx} from LLM output. Falling back to original.")
                            corrected_segments.append(seg)
                else:
                    print(f"[DashscopeService] LLM Error during correction: {response.code} {response.message}")
                    corrected_segments.extend(batch) # Fallback to original
            except Exception as e:
                print(f"[DashscopeService] Exception during ASR correction loop: {e}")
                corrected_segments.extend(batch) # Fallback to original
                
        return corrected_segments

    def translate_to_cantonese(self, text: str) -> str:
        """
        Translate Mandarin text to Cantonese colloquialism using Qwen-Turbo.
        """
        prompt = (
            "你是一个专业的粤语配音文案翻译。请将以下普通话文本翻译成地道、自然的粤语口语（不要用书面语，要用直接讲出来的口语词汇）。"
            "只返回翻译后的粤语文本，不要有任何其他解释："
            f"\n\n{text}"
        )
        
        try:
            for attempt in range(3):
                try:
                    response = Generation.call(
                        model=Generation.Models.qwen_turbo,
                        prompt=prompt
                    )
                    
                    if response.status_code == 200:
                        return response.output.text.strip()
                    else:
                        print(f"[DashscopeService] LLM Error: {response.code} - {response.message}")
                        
                except Exception as e:
                    print(f"[DashscopeService] Exception in LLM translation attempt {attempt+1}: {e}")
                    time.sleep(1)
            
            return text # Fallback to original text if all 3 attempts fail
            
        except Exception as e:
            print(f"[DashscopeService] Fatal exception in LLM: {e}")
            return text

    def synthesize_speech(self, text: str, output_path: str) -> bool:
        """
        Generate Cantonese audio from text using Aliyun NLS (Intelligent Speech Interaction).
        Specifically uses the 'Kelly' voice model via WebSocket.
        """
        try:
            from aliyunsdkcore.client import AcsClient
            from aliyunsdkcore.request import CommonRequest
            import nls
            
            # 1. Provide AK/SK to get a temporary NLS Token
            ak = Config.ALIYUN_AK_ID
            sk = Config.ALIYUN_AK_SECRET
            appkey = Config.NLS_APP_KEY
            
            if not ak or not sk or not appkey:
                print("[DashscopeService] Missing Aliyun NLS credentials (AK, SK, AppKey) in config.")
                return False
                
            client = AcsClient(ak, sk, "cn-shanghai")
            request = CommonRequest()
            request.set_method('POST')
            request.set_domain('nls-meta.cn-shanghai.aliyuncs.com')
            request.set_version('2019-02-28')
            request.set_action_name('CreateToken')
            
            try:
                response = client.do_action_with_exception(request)
            except Exception as e:
                print(f"[DashscopeService] Failed to get NLS Token. Please check your AK/SK. Error: {e}")
                return False
                
            token = json.loads(response).get('Token').get('Id')
            
            # 2. Prepare file writer and callbacks for WebSocket stream
            # The SDK uses callbacks to write the audio stream into a file.
            file_ptr = open(output_path, "wb")
            
            def test_on_metainfo(message, *args):
                print(f"[DashscopeService - NLS] metainfo: {message}")
            
            def test_on_data(data, *args):
                try:
                    file_ptr.write(data)
                except Exception as e:
                    print(f"[DashscopeService - NLS] Error writing audio data: {e}")

            def test_on_completed(message, *args):
                print(f"[DashscopeService - NLS] completed: {message}")

            def test_on_error(message, *args):
                print(f"[DashscopeService - NLS] error: {message}")

            def test_on_close(*args):
                print("[DashscopeService - NLS] connection closed")
                file_ptr.close()

            # 3. Create the NLS Synthesizer
            synthesizer = nls.NlsSpeechSynthesizer(
                url='wss://nls-gateway-cn-shanghai.aliyuncs.com/ws/v1',
                token=token,
                appkey=appkey,
                on_metainfo=test_on_metainfo,
                on_data=test_on_data,
                on_completed=test_on_completed,
                on_error=test_on_error,
                on_close=test_on_close,
                callback_args=[]
            )
            
            # 4. Trigger the TTS request
            voice = 'Kelly'
            print(f"[DashscopeService] Requesting NLS TTS with voice: {voice}...")
            # Kelly is 16000 sample rate by default
            synthesizer.start(text, voice=voice, aformat='wav', sample_rate=16000)
            
            return os.path.exists(output_path)
            
        except Exception as e:
            print(f"[DashscopeService] Exception in TTS synthesis: {e}")
            return False
