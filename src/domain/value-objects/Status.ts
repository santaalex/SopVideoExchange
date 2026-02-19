// 任务状态值对象
// 边界：封装状态类型和转换规则，不涉及业务逻辑

export enum TaskStatus {
  PENDING = '待处理',
  RUNNING = '处理中',
  SUCCESS = '完成',
  FAILED = '失败',
}

export class Status {
  private readonly _value: TaskStatus;

  private constructor(value: TaskStatus) {
    this._value = value;
  }

  static fromString(value: string): Status {
    const status = Object.values(TaskStatus).find(s => s === value);
    if (!status) {
      throw new Error(`Invalid status: ${value}`);
    }
    return new Status(status);
  }

  static pending(): Status {
    return new Status(TaskStatus.PENDING);
  }

  static running(): Status {
    return new Status(TaskStatus.RUNNING);
  }

  static success(): Status {
    return new Status(TaskStatus.SUCCESS);
  }

  static failed(): Status {
    return new Status(TaskStatus.FAILED);
  }

  get value(): TaskStatus {
    return this._value;
  }

  toString(): string {
    return this._value;
  }

  equals(other: Status): boolean {
    return this._value === other._value;
  }

  isPending(): boolean {
    return this._value === TaskStatus.PENDING;
  }

  isRunning(): boolean {
    return this._value === TaskStatus.RUNNING;
  }

  isSuccess(): boolean {
    return this._value === TaskStatus.SUCCESS;
  }

  isFailed(): boolean {
    return this._value === TaskStatus.FAILED;
  }
}

// 状态转换规则
export class StatusTransition {
  private static readonly transitions: Record<TaskStatus, TaskStatus[]> = {
    [TaskStatus.PENDING]: [TaskStatus.RUNNING, TaskStatus.FAILED],
    [TaskStatus.RUNNING]: [TaskStatus.SUCCESS, TaskStatus.FAILED],
    [TaskStatus.SUCCESS]: [],
    [TaskStatus.FAILED]: [TaskStatus.PENDING], // 可以重试
  };

  static canTransition(from: TaskStatus, to: TaskStatus): boolean {
    return this.transitions[from].includes(to);
  }

  static getAllowedTransitions(from: TaskStatus): TaskStatus[] {
    return this.transitions[from];
  }
}
