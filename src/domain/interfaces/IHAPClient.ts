// HAP 客户端接口
// 边界：定义数据持久化的契约，具体实现由 infrastructure 层提供

import { Task } from '../entities/Task';
import { Video, VideoData } from '../entities/Video';
import { TaskStatus } from '../value-objects/Status';

export interface TaskData {
  title: string;
  status?: TaskStatus;
  originalVideo?: VideoData;
}

export interface TaskFilter {
  status?: TaskStatus;
  pageSize?: number;
  pageIndex?: number;
  sortBy?: 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface IHAPClient {
  // 创建任务
  createTask(data: TaskData): Promise<string>;
  
  // 查询任务列表
  getTasks(filter?: TaskFilter): Promise<Task[]>;
  
  // 查询单个任务
  getTask(id: string): Promise<Task | null>;
  
  // 更新任务
  updateTask(id: string, data: Partial<TaskData>): Promise<void>;
  
  // 更新任务状态
  updateTaskStatus(id: string, status: TaskStatus): Promise<void>;
  
  // 更新任务文件字段
  updateTaskVideoField(id: string, field: string, video: Video): Promise<void>;
  
  // 删除任务
  deleteTask(id: string): Promise<void>;
}
