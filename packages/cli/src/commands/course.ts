import { Command } from 'commander';
import { api } from '../api';
import chalk from 'chalk';

export const courseCommands = new Command('course').description('Course and Task discovery');

courseCommands
  .command('list')
  .description('List all available courses')
  .action(async () => {
    try {
      const courses = await api.get('/courses');
      if (courses.length === 0) {
        console.log(chalk.yellow('No courses found.'));
        return;
      }
      console.log(chalk.blue.bold('\nAvailable Courses:'));
      courses.forEach((c: any) => {
        console.log(`  - [${c.id}] ${c.title} (v${c.version})`);
      });
      console.log('');
    } catch (e: any) {
      console.log(chalk.red(`Failed to fetch courses: ${e.message}`));
    }
  });

courseCommands
  .command('tasks <courseId>')
  .description('List tasks for a specific course')
  .action(async (courseId: string) => {
    try {
      // Assuming tasks are nested or can be filtered. For MVP, we'll fetch course details
      // Wait, we have GET /tasks?courseId=...
      // Let's assume the API returns all tasks for now, and filter locally if API doesn't support query yet.
      const tasks = await api.get('/tasks');
      const courseTasks = tasks.filter((t: any) => t.courseId === courseId);

      if (courseTasks.length === 0) {
        console.log(chalk.yellow('No tasks found for this course.'));
        return;
      }

      console.log(chalk.blue.bold(`\nTasks for Course [${courseId}]:`));
      courseTasks.forEach((t: any) => {
        console.log(`  - [${t.id}] Stage ${t.stage}: ${t.title}`);
      });
      console.log('');
    } catch (e: any) {
      console.log(chalk.red(`Failed to fetch tasks: ${e.message}`));
    }
  });
