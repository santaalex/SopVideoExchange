// 任务列表 API
// 边界：HTTP 适配层，处理任务列表请求

import { NextApiRequest, NextApiResponse } from 'next';
import { TaskServiceImpl } from '@/application/services/TaskService';
import { HAPClient } from '@/infrastructure/hap/HAPClient';
import { TaskStatus, Status } from '@/domain/value-objects/Status';
import { logger } from '@/utils/logger';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { status, pageSize, pageIndex, sortBy, sortOrder } = req.query;

    logger.info('Tasks API called', { status, pageSize, pageIndex });

    // 初始化服务
    const hapClient = new HAPClient();
    const taskService = new TaskServiceImpl(hapClient);

    // 构建筛选条件
    const filter = {
      status: status ? Status.fromString(status as string).value : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : 20,
      pageIndex: pageIndex ? parseInt(pageIndex as string) : 1,
      sortBy: sortBy as 'createdAt' | 'updatedAt' : 'createdAt',
      sortOrder: sortOrder as 'asc' | 'desc' : 'desc',
    };

    // 获取任务列表
    const tasks = await taskService.getTasks(filter);

    logger.info('Tasks API completed', { count: tasks.length });

    return res.status(200).json({
      success: true,
      data: {
        tasks: tasks.map(task => ({
          id: task.id,
          title: task.title,
          status: task.status.toString(),
          createdAt: task.createdAt,
          canRetry: task.canRetry,
        })),
        pagination: {
          pageSize: filter.pageSize,
          pageIndex: filter.pageIndex,
          total: tasks.length,
        },
      },
    });
  } catch (error) {
    logger.error('Tasks API error', error);
    return res.status(500).json({
      error: 'Failed to fetch tasks',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
