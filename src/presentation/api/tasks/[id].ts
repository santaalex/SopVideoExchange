// 任务详情 API
// 边界：HTTP 适配层，处理单个任务的操作

import { NextApiRequest, NextApiResponse } from 'next';
import { TaskServiceImpl } from '@/application/services/TaskService';
import { TaskWorkerImpl } from '@/application/worker/TaskWorker';
import { HAPClient } from '@/infrastructure/hap/HAPClient';
import { ASRService } from '@/infrastructure/aliyun/ASRService';
import { LLMService } from '@/infrastructure/aliyun/LLMService';
import { TTSService } from '@/infrastructure/aliyun/TTSService';
import { FFmpegService } from '@/infrastructure/ffmpeg/FFmpegService';
import { logger } from '@/utils/logger';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Task ID is required' });
  }

  try {
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

    switch (req.method) {
      case 'GET':
        return await getTask(taskService, id, res);
      case 'POST':
        return await retryTask(taskWorker, id, res);
      case 'DELETE':
        return await deleteTask(taskService, id, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    logger.error('Task API error', error, { taskId: id });
    return res.status(500).json({
      error: 'Operation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function getTask(
  taskService: TaskServiceImpl,
  id: string,
  res: NextApiResponse
) {
  logger.info('Getting task', { taskId: id });

  const task = await taskService.getTask(id);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  return res.status(200).json({
    success: true,
    data: {
      id: task.id,
      title: task.title,
      status: task.status.toString(),
      createdAt: task.createdAt,
      errorMessage: task.errorMessage,
      retryCount: task.retryCount,
      canRetry: task.canRetry,
      originalVideo: task.originalVideo?.toJSON(),
      mandarinSubtitle: task.mandarinSubtitle?.toJSON(),
      cantoneseSubtitle: task.cantoneseSubtitle?.toJSON(),
      cantoneseAudio: task.cantoneseAudio?.toJSON(),
      outputVideo: task.outputVideo?.toJSON(),
    },
  });
}

async function retryTask(
  taskWorker: TaskWorkerImpl,
  id: string,
  res: NextApiResponse
) {
  logger.info('Retrying task', { taskId: id });

  await taskWorker.processTask(id);

  return res.status(200).json({
    success: true,
    message: 'Task retry initiated',
  });
}

async function deleteTask(
  taskService: TaskServiceImpl,
  id: string,
  res: NextApiResponse
) {
  logger.info('Deleting task', { taskId: id });

  await taskService.deleteTask(id);

  return res.status(200).json({
    success: true,
    message: 'Task deleted',
  });
}
