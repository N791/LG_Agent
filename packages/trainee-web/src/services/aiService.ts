/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import request from '../utils/request';
import type {
  CitationDTO,
  CitationOpenResponseDTO,
  ConversationDTO,
  ConversationMessageDTO,
  TutorStreamDoneDTO,
  VersionedSseEventDTO,
} from '@lg-agent/contracts';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useWorkspaceStore } from '../store/workspaceStore';
import { store } from '../store';
import { workspaceSession, workspaceSessionSelectors } from '../modules/workspace-session';

export const aiService = {
  async getConversationHistory(taskId: string): Promise<ConversationDTO | null> {
    const res = await request.get<{ data?: ConversationDTO } | ConversationDTO>(
      `/ai/tutor/conversations/${taskId}`,
    );
    return (
      (res as unknown as { data?: ConversationDTO }).data ?? (res as unknown as ConversationDTO)
    );
  },

  async openCitation(citation: CitationDTO): Promise<CitationOpenResponseDTO> {
    const res = await request.post<{ data?: CitationOpenResponseDTO } | CitationOpenResponseDTO>(
      '/ai/retrieval/citations/open',
      citation,
    );
    return (
      (res as unknown as { data?: CitationOpenResponseDTO }).data ??
      (res as unknown as CitationOpenResponseDTO)
    );
  },

  async getQuickActions(action: string): Promise<unknown[]> {
    const res = await request.get<{ data?: unknown[] } | unknown[]>(
      `/ai/tutor/quick-actions/${action}`,
    );
    return (res as unknown as { data?: unknown[] }).data ?? (res as unknown as unknown[]) ?? [];
  },

  async chat(taskId: string, action: string, content: string, activeFile?: string): Promise<void> {
    const token = store.getState().auth.token;
    const workspaceContext = workspaceSessionSelectors.activeFileContext(
      workspaceSession.getState(),
    );
    const selectedActiveFile = activeFile ?? workspaceContext?.path;

    // Create an optimistic user message
    const tempId = `temp-${String(Date.now())}`;
    const userMessage: ConversationMessageDTO = {
      id: tempId,
      role: 'user',
      content,
      createdAt: new Date(),
    };
    useWorkspaceStore.getState().appendAiMessage(userMessage);

    useWorkspaceStore.getState().setAiFeedback('');
    useWorkspaceStore.getState().setAiLoading(true);

    try {
      await fetchEventSource(`/api/v1/ai/tutor/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token ?? ''}`,
        },
        body: JSON.stringify({
          taskId,
          action,
          content,
          activeFile: selectedActiveFile,
          activeFileContent:
            workspaceContext?.path === selectedActiveFile ? workspaceContext?.content : undefined,
          stream: true,
        }),
        onmessage(msg) {
          if (msg.event === 'FatalError') {
            throw new Error(msg.data);
          }
          if (msg.event === 'done') {
            useWorkspaceStore.getState().setAiLoading(false);
            let done: TutorStreamDoneDTO | undefined;
            try {
              const event = JSON.parse(msg.data) as VersionedSseEventDTO<TutorStreamDoneDTO>;
              done = event.data;
            } catch {
              // Backward-compatible with an older server that emitted an empty done event.
            }
            const assistantContent = useWorkspaceStore.getState().aiFeedback;
            if (assistantContent) {
              useWorkspaceStore.getState().appendAiMessage({
                id: `assistant-${String(Date.now())}`,
                role: 'assistant',
                content: assistantContent,
                createdAt: new Date(),
                metadata: done
                  ? {
                      citations: done.citations,
                      traceSummary: done.traceSummary,
                      tokenBudget: done.tokenBudget,
                      evidenceSupport: done.evidenceSupport,
                      degraded: done.degraded,
                    }
                  : undefined,
              });
              useWorkspaceStore.getState().setAiFeedback('');
            }
            return;
          }

          try {
            const event = JSON.parse(msg.data) as VersionedSseEventDTO<
              string | { code?: string; recovery?: string }
            >;
            const eventContent = event.data;
            if (event.type === 'CHUNK' && typeof eventContent === 'string') {
              useWorkspaceStore.getState().setAiFeedback((prev) => prev + eventContent);
            } else if (event.type === 'ERROR') {
              const errorState =
                typeof eventContent === 'object' && eventContent !== null ? eventContent : {};
              useWorkspaceStore
                .getState()
                .setAiFeedback(
                  errorState.code === 'AI_PROVIDER_NOT_CONFIGURED'
                    ? `AI 未配置：${errorState.recovery ?? '请联系管理员配置生产 LLM Provider。'}`
                    : 'AI_TUTOR_STREAM_FAILED：回答生成失败。请重试，或联系导师在 Retrieval Preview 中检查索引状态。',
                );
            }
          } catch {
            throw new Error('Invalid AI SSE event');
          }
        },
        onerror(err) {
          console.error('SSE Error:', err);
          useWorkspaceStore.getState().setAiLoading(false);
          throw err;
        },
      });
    } catch (error) {
      console.error('Chat error:', error);
      useWorkspaceStore.getState().setAiLoading(false);
    }
  },
};
