import { fetchEventSource } from '@microsoft/fetch-event-source';
import type {
  ExecutionResponseDTO,
  SandboxAction,
  WorkspaceDTO,
  WorkspaceFileDTO,
  WorkspaceVersionDTO,
} from '@lg-agent/contracts';
import request from '../../../utils/request';
import api from '../../../services/api';
import type { AuthoringWorkspacePort, WorkspaceExecutionPort } from '../ports';
import type { WorkspaceExecutionEvent } from '../model';

function unwrap(response: unknown): unknown {
  return (response as { data?: unknown }).data ?? response;
}

export class HttpAuthoringWorkspaceAdapter implements AuthoringWorkspacePort {
  async load(taskId: string): Promise<WorkspaceDTO> {
    try {
      return unwrap(
        await request.get<WorkspaceDTO | { data?: WorkspaceDTO }>(`/workspaces/${taskId}`),
      ) as WorkspaceDTO;
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status !== 400 && status !== 404) throw error;
      return unwrap(
        await request.post<WorkspaceDTO | { data?: WorkspaceDTO }>('/workspaces/init', { taskId }),
      ) as WorkspaceDTO;
    }
  }

  async saveFiles(
    taskId: string,
    files: Pick<WorkspaceFileDTO, 'path' | 'content'>[],
  ): Promise<WorkspaceDTO> {
    return unwrap(
      await request.put<WorkspaceDTO | { data?: WorkspaceDTO }>(`/workspaces/${taskId}/files`, {
        files,
      }),
    ) as WorkspaceDTO;
  }

  async deleteFile(taskId: string, path: string): Promise<WorkspaceDTO> {
    return unwrap(
      await request.delete<WorkspaceDTO | { data?: WorkspaceDTO }>(
        `/workspaces/${taskId}/files?path=${encodeURIComponent(path)}`,
      ),
    ) as WorkspaceDTO;
  }

  async createVersion(taskId: string, trigger: 'RUN' | 'SUBMIT' | 'MANUAL'): Promise<void> {
    await request.post(`/workspaces/${taskId}/versions`, { trigger });
  }

  async listVersions(taskId: string): Promise<WorkspaceVersionDTO[]> {
    return unwrap(
      await request.get<WorkspaceVersionDTO[] | { data?: WorkspaceVersionDTO[] }>(
        `/workspaces/${taskId}/versions`,
      ),
    ) as WorkspaceVersionDTO[];
  }

  async restoreVersion(taskId: string, versionId: string): Promise<WorkspaceDTO> {
    return unwrap(
      await request.post<WorkspaceDTO | { data?: WorkspaceDTO }>(
        `/workspaces/${taskId}/versions/${versionId}/restore`,
      ),
    ) as WorkspaceDTO;
  }
}

async function streamSubmission(
  submissionId: string,
  onEvent: (event: WorkspaceExecutionEvent) => void,
): Promise<void> {
  const token = localStorage.getItem('token');
  await fetchEventSource(`/api/v1/submissions/${submissionId}/logs`, {
    headers: { Authorization: `Bearer ${token ?? ''}` },
    onmessage(message) {
      if (message.event === 'FatalError') throw new Error(message.data);
      if (message.event === 'done') return;
      const event = JSON.parse(message.data) as WorkspaceExecutionEvent;
      if (event.type !== 'DONE') onEvent(event);
    },
  });
}

export class HttpWorkspaceExecutionAdapter implements WorkspaceExecutionPort {
  async run(
    taskId: string,
    action: SandboxAction,
    onEvent: (event: WorkspaceExecutionEvent) => void,
  ): Promise<string> {
    const { data } = await api.post<ExecutionResponseDTO>('/sandbox/execute', { taskId, action });
    const token = localStorage.getItem('token');
    const baseUrl = (import.meta.env as Record<string, string>)['VITE_API_URL'] ?? '/api/v1';
    const response = await fetch(
      `${baseUrl}/sandbox/executions/${data.executionId}/logs?taskId=${encodeURIComponent(taskId)}&action=${action}`,
      { headers: { Authorization: `Bearer ${token ?? ''}` } },
    );
    if (!response.body) throw new Error('Streaming execution logs is not supported.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6);
        const event = JSON.parse(payload) as WorkspaceExecutionEvent;
        if (event.type !== 'DONE') onEvent(event);
      }
    }
    return data.executionId;
  }

  async submit(taskId: string, onEvent: (event: WorkspaceExecutionEvent) => void): Promise<string> {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/v1/submissions/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token ?? ''}`,
      },
      body: JSON.stringify({ taskId }),
    });
    if (!response.ok) throw new Error('Failed to start submission');
    const body = (await response.json()) as
      { submissionId: string } | { data: { submissionId: string } };
    const submissionId = 'data' in body ? body.data.submissionId : body.submissionId;
    await streamSubmission(submissionId, onEvent);
    return submissionId;
  }
}
