import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface AgentConfig {
  token?: string;
  baseUrl: string;
}

export interface WorkspaceConfig {
  taskId: string;
  courseId?: string;
  createdAt: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.lg-agent');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const WORKSPACE_FILE = '.lg-agent-workspace.json';

export function getGlobalConfig(): AgentConfig {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { baseUrl: 'http://localhost:3000/api/v1' };
  }
  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return { baseUrl: 'http://localhost:3000/api/v1' };
  }
}

export function saveGlobalConfig(config: AgentConfig) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function getWorkspaceConfig(): WorkspaceConfig | null {
  const wsPath = path.join(process.cwd(), WORKSPACE_FILE);
  if (!fs.existsSync(wsPath)) {
    return null;
  }
  try {
    const data = fs.readFileSync(wsPath, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
}

export function saveWorkspaceConfig(config: WorkspaceConfig, targetDir: string) {
  const wsPath = path.join(targetDir, WORKSPACE_FILE);
  fs.writeFileSync(wsPath, JSON.stringify(config, null, 2));
}
