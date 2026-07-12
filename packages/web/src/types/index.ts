export enum Role {
  ADMIN = 'ADMIN',
  MENTOR = 'MENTOR',
  TRAINEE = 'TRAINEE',
}

export interface Organization {
  id: string;
  name: string;
  code: string;
  status: number;
  createdAt: string;
}

export interface User {
  id: string;
  organizationId: string;
  username: string;
  nickname?: string;
  email?: string;
  role: Role;
  status: number;
  createdAt: string;
  organization?: Organization;
}

export interface Course {
  id: string;
  organizationId: string;
  title: string;
  description?: string;
  version: string;
  status: number;
  createdById: string;
  createdAt: string;
  organization?: Organization;
  createdBy?: User;
}

export interface Task {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  stage: number;
  envConfig: Record<string, unknown>;
  sandboxConfig: Record<string, unknown>;
  testConfig: Record<string, unknown>;
  promptConfig: Record<string, unknown>;
  course?: Course;
}

export interface Submission {
  id: string;
  taskId: string;
  userId: string;
  status: 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED';
  score: number;
  logs?: string;
  report?: Record<string, unknown>;
  createdAt: string;
  task?: Task;
  user?: User;
}

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}
