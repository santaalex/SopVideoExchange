// 阿里灵杰 TTS 服务实现
// 边界：实现 ITTSService 接口，封装阿里灵杰语音合成 API 调用

import axios from 'axios';
import { ITTSService, TTSResult, VoiceOption } from '../../domain/interfaces/ITTSService';
import { SubtitleEntry } from '../../domain/interfaces/IASRService';
import { logger } from '../../utils/logger';
import { getConfig } from '../../utils/config';

export class TTSService implements ITTSService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultVoiceId: string;

  constructor() {
    const config = getConfig();
    this.apiKey = config.aliyun.apiKey;
    this.baseUrl = config.aliyun.baseUrl;
    this.defaultVoiceId = 'aitts_happy_female'; // 粤语女声，需根据实际 API 调整
  }

  async synthesize(text: string, language: string, voiceId?: string): Promise<TTSResult> {
    logger.info('Starting TTS synthesis', { textLength: text.length, language });

    try {
      const response = await axios.post<{
        data?: { audio_url: string; duration: number };
      }>(`${this.baseUrl}/audio/synthesis`, {
        model: 'cosyvoice-v1',
        input: {
          text,
        },
        parameters: {
          voice: voiceId || this.defaultVoiceId,
          language,
          rate: 1.0,
          volume: 0.8,
        },
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      const result: TTSResult = {
        audioUrl: response.data.data?.audio_url || '',
        duration: response.data.data?.duration || 0,
      };

      logger.info('TTS synthesis completed', { textLength: text.length, duration: result.duration });
      return result;
    } catch (error) {
      logger.error('TTS synthesis failed', error, { textLength: text.length });
      throw new Error(`TTS synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async synthesizeSubtitles(
    entries: SubtitleEntry[],
    language: string,
    voiceId?: string
  ): Promise<TTSResult> {
    logger.info('Starting TTS synthesis for subtitles', { 
      entryCount: entries.length,
      language 
    });

    try {
      // 合并所有字幕文本（用空格分隔）
      const allText = entries.map(e => e.text).join(' ');
      
      const result = await this.synthesize(allText, language, voiceId);
      
      logger.info('TTS synthesis for subtitles completed', { 
        entryCount: entries.length,
        duration: result.duration 
      });
      
      return result;
    } catch (error) {
      logger.error('TTS synthesis for subtitles failed', error);
      throw error;
    }
  }

  async getAvailableVoices(language?: string): Promise<VoiceOption[]> {
    // 简化实现，返回预设的音色列表
    // 实际需要调用阿里灵杰 API 获取可用音色
    const voices: VoiceOption[] = [
      { id: 'aitts_happy_female', name: '粤语女声', language: 'zh-HK', gender: 'female' },
      { id: 'aitts_calm_female', name: '粤语女声（温柔）', language: 'zh-HK', gender: 'female' },
      { id: 'aitts_happy_male', name: '粤语男声', language: 'zh-HK', gender: 'male' },
      { id: 'zh-CN_Xiaoxiao_normal', name: '普通话女声', language: 'zh-CN', gender: 'female' },
      { id: 'zh-CN_Xiaoyu_normal', name: '普通话男声', language: 'zh-CN', gender: 'male' },
    ];

    if (language) {
      return voices.filter(v => v.language.startsWith(language));
    }

    return voices;
  }

  async downloadAudio(url: string): Promise<Buffer> {
    logger.info('Downloading audio', { url });

    try {
      const response = await axios.get<Buffer>(url, {
        responseType: 'arraybuffer',
      });

      logger.info('Audio downloaded successfully', { url, size: response.data.length });
      return Buffer.from(response.data);
    } catch (error) {
      logger.error('Failed to download audio', error, { url });
      throw new Error(`Failed to download audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
