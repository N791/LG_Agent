import api from './api';
import { ExecutionResponseDTO, SandboxAction } from '@lg-agent/contracts';

export const executeSandboxAction = async (
  taskId: string,
  action: SandboxAction,
): Promise<ExecutionResponseDTO> => {
  const { data } = await api.post<ExecutionResponseDTO>('/sandbox/execute', { taskId, action });
  return data;
};

export const stopExecution = async (executionId: string): Promise<void> => {
  await api.post(`/sandbox/executions/${executionId}/stop`);
};

export async function* streamExecutionLogs(
  executionId: string,
  taskId: string,
  action: SandboxAction,
) {
  const token = localStorage.getItem('token');
  const url = `${(import.meta.env as Record<string, string>)['VITE_API_URL'] ?? '/api/v1'}/sandbox/executions/${executionId}/logs?taskId=${taskId}&action=${action}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token ?? ''}`,
    },
  });

  if (!response.body) {
    throw new Error('ReadableStream not yet supported in this browser.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        const event = JSON.parse(data) as { type: string };
        if (event.type === 'DONE') {
          return;
        }
        yield event;
      }
    }
  }
}
