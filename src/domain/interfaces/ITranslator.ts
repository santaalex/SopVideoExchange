// 翻译服务接口
// 边界：定义翻译的契约，具体实现由 infrastructure 层提供

import { SubtitleEntry } from './IASRService';

export interface TranslationResult {
  entries: TranslatedEntry[];
}

export interface TranslatedEntry {
  originalEntry: SubtitleEntry;
  translatedText: string;
}

export interface ITranslator {
  // 翻译字幕
  translate(entries: SubtitleEntry[], sourceLanguage: string, targetLanguage: string): Promise<TranslationResult>;
  
  // 将翻译结果转换为 SRT 格式
  toSRT(result: TranslationResult, includeOriginal: boolean): string;
  
  // 获取支持的语言列表
  getSupportedLanguages(): string[];
}
