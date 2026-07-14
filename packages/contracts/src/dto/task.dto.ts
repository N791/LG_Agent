export enum TaskType {
  MANDATORY = 'MANDATORY',
  ELECTIVE = 'ELECTIVE',
}

export enum TaskDifficulty {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
}

export interface TaskDTO {
  id: string;
  courseId: string;
  title: string;
  summary?: string | null;
  description?: string | null;
  stage: number;
  taskType: TaskType;
  difficulty: TaskDifficulty;
  version: number;
  envConfig: Record<string, unknown>;
  sandboxConfig: Record<string, unknown>;
  testConfig: Record<string, unknown>;
  promptConfig: Record<string, unknown>;
  config?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export type CreateTaskDTO = Omit<TaskDTO, 'id' | 'version'>;
export type UpdateTaskDTO = Partial<CreateTaskDTO>;
