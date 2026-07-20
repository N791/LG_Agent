import request from '../utils/request';
import { ConversationDTO, ConversationMessageDTO } from '@lg-agent/contracts';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useWorkspaceStore } from '../store/workspaceStore';
import { store } from '../store';

export const aiService = {
  async getConversationHistory(taskId: string): Promise<ConversationDTO | null> {
    const res = await request.get<{ data?: ConversationDTO } | ConversationDTO>(
      `/ai/chat/${taskId}/conversation`,
    );
    return (res as unknown as { data?: ConversationDTO })?.data ?? (res as unknown as ConversationDTO);
  },

  async getQuickActions(action: string): Promise<any[]> {
    const res = await request.get<{ data?: any[] } | any[]>(
      `/ai/tutor/quick-actions/${action}`,
    );
    return (res as unknown as { data?: any[] })?.data ?? (res as unknown as any[]) ?? [];
  },

  async chat(
    taskId: string,
    action: string,
    content: string,
    activeFile?: string,
  ): Promise<void> {
    const token = store.getState().auth.token;
    
    // Create an optimistic user message
    const tempId = `temp-${Date.now()}`;
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
          activeFile,
          stream: true,
        }),
        onmessage(msg) {
          if (msg.event === 'FatalError') {
            throw new Error(msg.data);
          }
          if (msg.data === '[DONE]') {
            useWorkspaceStore.getState().setAiLoading(false);
            
            // Push the completed feedback into history and clear feedback
            const assistantContent = useWorkspaceStore.getState().aiFeedback;
            if (assistantContent) {
              useWorkspaceStore.getState().appendAiMessage({
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: assistantContent,
                createdAt: new Date(),
              });
              useWorkspaceStore.getState().setAiFeedback('');
            }
            return;
          }

          try {
            // Check if msg.data is JSON (sometimes standard streams return JSON, but here it's raw text chunks)
            useWorkspaceStore.getState().setAiFeedback((prev) => prev + msg.data);
          } catch {
            useWorkspaceStore.getState().setAiFeedback((prev) => prev + msg.data);
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
