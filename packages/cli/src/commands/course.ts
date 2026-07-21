import { Command } from 'commander';
import { api } from '../api';
import chalk from 'chalk';
import { t } from '../i18n';

export const courseCommands = new Command('course').description('Course and Task discovery');

interface Course {
  id: string;
  title: string;
  version: string;
}

interface Task {
  id: string;
  courseId: string;
  stage: string | number;
  title: string;
}

courseCommands
  .command('list')
  .description(t('course.list'))
  .action(async () => {
    try {
      const courses = await api.get<Course[]>('/courses');
      if (courses.length === 0) {
        console.log(chalk.yellow(t('course.noCourses')));
        return;
      }
      console.log(chalk.blue.bold(t('course.availableCourses')));
      courses.forEach((c) => {
        console.log(`  - [${c.id}] ${c.title} (v${c.version})`);
      });
      console.log('');
    } catch (_e) {
      const e = _e as Error;
      console.log(chalk.red(t('course.fetchCoursesFailed', { message: e.message })));
    }
  });

courseCommands
  .command('tasks <courseId>')
  .description(t('course.tasks'))
  .action(async (courseId: string) => {
    try {
      // Assuming tasks are nested or can be filtered. For MVP, we'll fetch course details
      // Wait, we have GET /tasks?courseId=...
      // Let's assume the API returns all tasks for now, and filter locally if API doesn't support query yet.
      const tasks = await api.get<Task[]>('/tasks');
      const courseTasks = tasks.filter((t) => t.courseId === courseId);

      if (courseTasks.length === 0) {
        console.log(chalk.yellow(t('course.noTasks')));
        return;
      }

      console.log(chalk.blue.bold(t('course.tasksForCourse', { courseId })));
      courseTasks.forEach((t) => {
        console.log(`  - [${t.id}] Stage ${String(t.stage)}: ${t.title}`);
      });
      console.log('');
    } catch (_e) {
      const e = _e as Error;
      console.log(chalk.red(t('course.fetchTasksFailed', { message: e.message })));
    }
  });
