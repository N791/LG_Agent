import * as fs from 'fs';
import * as path from 'path';

export interface IWorkspaceProvider {
  createWorkspace(targetDir: string, taskConfig: any): Promise<void>;
}

export class LocalWorkspaceProvider implements IWorkspaceProvider {
  async createWorkspace(targetDir: string, taskConfig: any): Promise<void> {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Scaffold a basic node project as placeholder for MVP
    const indexJsPath = path.join(targetDir, 'index.js');
    if (!fs.existsSync(indexJsPath)) {
      fs.writeFileSync(indexJsPath, '// Write your code here\nconsole.log("Hello LG_Agent!");\n');
    }

    const packageJsonPath = path.join(targetDir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      const pkg = {
        name: `task-${taskConfig.id}`,
        version: '1.0.0',
        description: taskConfig.title,
        main: 'index.js',
      };
      fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2));
    }

    console.log(`Workspace prepared at ${targetDir}`);
  }
}
