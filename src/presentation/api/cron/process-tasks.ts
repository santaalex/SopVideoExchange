// Cron 处理任务 API
// 边界：定时任务触发器，处理所有待处理任务

import { NextApiRequest, NextApiResponse } from 'next';
import { TaskServiceImpl } from '@/application/services/TaskService';
import { TaskWorkerImpl } from '@/application/worker/TaskWorker';
import { HAPClient } from '@/infrastructure/hap/HAPClient';
import { ASRService } from '@/infrastructure/aliyun/ASRService';
import { LLMService } from '@/infrastructure/aliyun/LLMService';
import { TTSService } from '@/infrastructure/aliyun/TTSService';
import { FFmpegService } from '@/infrastructure/ffmpeg/FFmpegService';
import { logger } from '@/utils/logger';

// 简化的 Cron 处理
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 验证 Cron Secret（生产环境应该配置）
  const cronSecret = req.headers['x-cron-secret'];
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    logger.info('Cron task processing started');

    // 初始化服务
    const hapClient = new HAPClient();
    const taskService = new TaskServiceImpl(hapClient);
    const asrService = new ASRService();
    const llmService = new LLMService();
    const ttsService = new TTSService();
    const ffmpegService = new FFmpegService();
    const taskWorker = new TaskWorkerImpl(
      taskService,
      asrService,
      llmService,
      ttsService,
      ffmpegService
    );

    // 处理所有待处理任务
    const result = await taskWorker.processAllPendingTasks();

    logger.info('Cron task processing completed', result);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Cron task processing failed', error);
    return res.status(500).json({
      error: 'Cron processing failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
