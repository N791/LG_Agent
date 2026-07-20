import React, { useEffect, useRef, useState } from 'react';
import { Input, Button, Spin } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { aiService } from '../../services/aiService';

interface ChatPanelProps {
  taskId: string;
}

interface QuickAction {
  id: string;
  action: string;
  prompt: string;
  label: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ taskId }) => {
  const [input, setInput] = useState('');
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const history = useWorkspaceStore((state) => state.aiHistory);
  const loading = useWorkspaceStore((state) => state.aiLoading);
  const feedback = useWorkspaceStore((state) => state.aiFeedback);
  const activeFile = useWorkspaceStore((state) => state.activeFile);
  const setAiHistory = useWorkspaceStore((state) => state.setAiHistory);

  // Scroll to bottom when history or feedback changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, feedback]);

  // Load history and quick actions on mount
  useEffect(() => {
    let mounted = true;
    aiService
      .getConversationHistory(taskId)
      .then((conversation) => {
        if (mounted && conversation) {
          setAiHistory(conversation.messages);
        }
      })
      .catch(console.error);

    aiService
      .getQuickActions('chat')
      .then((actions) => {
        if (mounted) {
          setQuickActions(actions as QuickAction[]);
        }
      })
      .catch(console.error);

    return () => {
      mounted = false;
    };
  }, [taskId, setAiHistory]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    const content = input.trim();
    setInput('');

    // Send to backend
    void aiService.chat(taskId, 'chat', content, activeFile ?? undefined);
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {history.length === 0 && !loading && !feedback && (
          <div className="flex flex-col items-center justify-center text-gray-500 h-full">
            <p>Ask AI Tutor a question to get started!</p>
          </div>
        )}

        {history.map((msg) => {
          // Skip system messages from UI
          if (msg.role === 'system') return null;

          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`p-3 rounded-lg ${isUser ? 'bg-blue-50 ml-4' : 'bg-gray-50 mr-4'}`}
            >
              <span className="text-xs font-bold text-gray-500 uppercase">{msg.role}</span>
              <div className="prose prose-sm dark:prose-invert max-w-none mt-1">
                <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
              </div>
            </div>
          );
        })}

        {/* Streaming Feedback */}
        {(loading || feedback) && (
          <div className="p-3 rounded-lg bg-gray-50 mr-4">
            <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
              assistant {loading && !feedback && <Spin size="small" />}
            </span>
            <div className="prose prose-sm dark:prose-invert max-w-none mt-1">
              <Markdown remarkPlugins={[remarkGfm]}>{feedback}</Markdown>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 flex flex-col gap-2">
        {quickActions.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {quickActions.map((qa) => (
              <Button
                key={qa.id}
                size="small"
                shape="round"
                onClick={() => {
                  void aiService.chat(taskId, qa.action, qa.prompt, activeFile ?? undefined);
                }}
                disabled={loading}
              >
                {qa.label}
              </Button>
            ))}
          </div>
        )}
        <Input.TextArea
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
          }}
          placeholder="Ask a question... (Enter to send, Shift+Enter for new line)"
          autoSize={{ minRows: 2, maxRows: 6 }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={loading && !feedback}
        />
        <div className="flex justify-between items-center mt-1">
          <div className="text-xs text-gray-400">
            {activeFile ? `Context: ${activeFile}` : 'No active file selected'}
          </div>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            disabled={!input.trim() || (loading && !feedback)}
            loading={loading && !feedback}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
};
