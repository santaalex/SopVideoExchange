// 任务处理工作器
// 边界：编排视频处理流程，协调各 Service

import { TaskServiceImpl } from '../services/TaskService';
import { IASRService, ASRResult } from '../../domain/interfaces/IASRService';
import { ITranslator, TranslationResult } from '../../domain/interfaces/ITranslator';
import { ITTSService, TTSResult } from '../../domain/interfaces/ITTSService';
import { IFFmpegService, FFmpegResult } from '../../domain/interfaces/IFFmpegService';
import { Task } from '../../domain/entities/Task';
import { TaskStatus } from '../../domain/value-objects/Status';
import { logger } from '../../utils/logger';

export interface TaskWorker {
  processTask(taskId: string): Promise<void>;
}

export class TaskWorkerImpl implements TaskWorker {
  private readonly taskService: TaskServiceImpl;
  private readonly asrService: IASRService;
  private readonly translatorService: ITranslator;
  private readonly ttsService: ITTSService;
  private readonly ffmpegService: IFFmpegService;

  constructor(
    taskService: TaskServiceImpl,
    asrService: IASRService,
    translatorService: ITranslator,
    ttsService: ITTSService,
    ffmpegService: IFFmpegService
  ) {
    this.taskService = taskService;
    this.asrService = asrService;
    this.translatorService = translatorService;
    this.ttsService = ttsService;
    this.ffmpegService = ffmpegService;
  }

  async processTask(taskId: string): Promise<void> {
    logger.info('Starting task processing', { taskId });

    const task = await this.taskService.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (!task.isPending) {
      logger.warn('Task is not pending, skipping', { taskId, status: task.status });
      return;
    }

    try {
      // Step 1: 标记为运行中
      await this.taskService.markTaskAsRunning(taskId);
      logger.info('Task marked as running', { taskId });

      // Step 2: 检查是否有原始视频
      if (!task.originalVideo) {
        throw new Error('Task has no original video');
      }

      // Step 3: 语音识别（ASR）
      logger.info('Step 1: Starting ASR', { taskId });
      const asrResult = await this.asrService.transcribe(task.originalVideo);
      const mandarinSrt = this.asrService.toSRT(asrResult);
      logger.info('Step 1: ASR completed', { taskId, subtitleCount: asrResult.subtitles.length });

      // Step 4: 翻译成粤语
      logger.info('Step 2: Starting translation', { taskId });
      const translationResult = await this.translatorService.translate(
        asrResult.subtitles,
        'zh-CN',
        'zh-HK'
      );
      const cantoneseSrt = this.translatorService.toSRT(translationResult, true); // 双语字幕
      logger.info('Step 2: Translation completed', { taskId, translatedCount: translationResult.entries.length });

      // Step 5: 粤语 TTS
      logger.info('Step 3: Starting TTS', { taskId });
      const ttsResult = await this.ttsService.synthesizeSubtitles(
        asrResult.subtitles,
        'zh-HK'
      );
      logger.info('Step 3: TTS completed', { taskId, audioDuration: ttsResult.duration });

      // Step 6: 时间轴对齐（调整 TTS 音频速度）
      logger.info('Step 4: Aligning audio timeline', { taskId });
      const alignedAudioPath = await this.ffmpegService.adjustAudioSpeed(
        ttsResult.audioUrl,
        asrResult.subtitles.reduce((acc, e) => acc + (e.endTime - e.startTime), 0)
      );
      logger.info('Step 4: Audio timeline aligned', { taskId });

      // Step 7: FFmpeg 合成
      logger.info('Step 5: Starting FFmpeg composition', { taskId });
      const ffResult = await this.ffmpegService.combine(
        task.originalVideo,
        [{ srtContent: cantoneseSrt, position: 'bottom' }],
        { audioUrl: alignedAudioPath, volume: 0.8 }
      );
      logger.info('Step 5: FFmpeg composition completed', { taskId, outputDuration: ffResult.duration });

      // Step 8: 标记为成功
      await this.taskService.markTaskAsSuccess(taskId);
      logger.info('Task completed successfully', { taskId });

    } catch (error) {
      logger.error('Task processing failed', error, { taskId });
      await this.taskService.markTaskAsFailed(
        taskId,
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }

  // 处理所有待处理任务（用于 Cron Job）
  async processAllPendingTasks(): Promise<{ success: number; failed: number }> {
    logger.info('Processing all pending tasks');

    const tasks = await this.taskService.getTasks({
      status: TaskStatus.PENDING,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });

    logger.info(`Found ${tasks.length} pending tasks`);

    let success = 0;
    let failed = 0;

    for (const task of tasks) {
      try {
        await this.processTask(task.id);
        success++;
      } catch (error) {
        failed++;
        logger.error('Task processing failed', error, { taskId: task.id });
      }
    }

    logger.info('All pending tasks processed', { success, failed });
    return { success, failed };
  }
}
