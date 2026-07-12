import { Course, Task } from '@prisma/client';

export const CourseFixture = {
  createBasic: (overrides?: Partial<Course>): Course => ({
    id: 'course-1',
    title: 'Basic Onboarding',
    description: 'A basic onboarding course',
    status: 'draft',
    organizationId: 'org-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
};

export const TaskFixture = {
  createBasic: (overrides?: Partial<Task>): Task => ({
    id: 'task-1',
    title: 'Hello World Task',
    courseId: 'course-1',
    description: 'Write a hello world program',
    order: 1,
    type: 'coding',
    points: 10,
    config: {},
    metadata: {},
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
};
