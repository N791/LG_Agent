import React, { useEffect, useRef, useState } from 'react';
import { Input, Button, Spin, Avatar, Tag } from 'antd';
import { SendOutlined, RobotOutlined, UserOutlined, FileTextOutlined } from '@ant-design/icons';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useWorkspaceSession, workspaceSessionSelectors } from '../../modules/workspace-session';
import { aiService } from '../../services/aiService';
import { useTranslation } from 'react-i18next';
import type { CitationDTO, EvidenceSupportDTO } from '@lg-agent/contracts';
import { CitationList } from './CitationList';

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
  const { t } = useTranslation('workspace');
  const [input, setInput] = useState('');
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const history = useWorkspaceStore((state) => state.aiHistory);
  const loading = useWorkspaceStore((state) => state.aiLoading);
  const feedback = useWorkspaceStore((state) => state.aiFeedback);
  const activeFile = useWorkspaceSession(workspaceSessionSelectors.activeFile);
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
    <div className="flex flex-col h-full bg-gray-50">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {history.length === 0 && !loading && !feedback && (
          <div className="flex flex-col items-center justify-center text-gray-400 h-full">
            <RobotOutlined style={{ fontSize: 48, marginBottom: 16, color: '#e5e7eb' }} />
            <p>{t('chatPanel.emptyState')}</p>
          </div>
        )}

        {history.map((msg) => {
          // Skip system messages from UI
          if (msg.role === 'system') return null;

          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <Avatar
                icon={isUser ? <UserOutlined /> : <RobotOutlined />}
                style={{ backgroundColor: isUser ? '#1890ff' : '#7C3AED', flexShrink: 0 }}
              />
              <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[85%]`}>
                <span className="text-[10px] font-bold text-gray-400 uppercase mb-1 px-1">
                  {isUser ? t('chatPanel.you') : t('chatPanel.aiMentor')}
                </span>
                <div
                  className={`p-3 rounded-2xl shadow-sm ${
                    isUser
                      ? 'bg-blue-50 border border-blue-100 rounded-tr-sm'
                      : 'bg-white border border-gray-200 rounded-tl-sm'
                  }`}
                >
                  <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800">
                    <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
                  </div>
                  {!isUser ? (
                    <CitationList
                      citations={(msg.metadata?.['citations'] as CitationDTO[] | undefined) ?? []}
                      evidenceSupport={
                        msg.metadata?.['evidenceSupport'] as EvidenceSupportDTO | undefined
                      }
                      degraded={msg.metadata?.['degraded'] === true}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}

        {/* Streaming Feedback */}
        {(loading || feedback) && (
          <div className="flex items-start gap-3 flex-row">
            <Avatar
              icon={<RobotOutlined />}
              style={{ backgroundColor: '#7C3AED', flexShrink: 0 }}
            />
            <div className="flex flex-col items-start max-w-[85%]">
              <span className="text-[10px] font-bold text-gray-400 uppercase mb-1 px-1 flex items-center gap-2">
                {t('chatPanel.aiMentor')} {loading && !feedback && <Spin size="small" />}
              </span>
              <div className="p-3 rounded-2xl shadow-sm bg-white border border-gray-200 rounded-tl-sm">
                <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800">
                  {feedback ? (
                    <Markdown remarkPlugins={[remarkGfm]}>{feedback}</Markdown>
                  ) : (
                    <div className="flex gap-1 items-center h-5 px-1">
                      <div
                        className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: '0ms' }}
                      />
                      <div
                        className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: '150ms' }}
                      />
                      <div
                        className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: '300ms' }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 p-4 bg-white border-t border-gray-100 shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.05)] z-10">
        <div className="flex flex-col gap-3">
          {/* Context Carousel & Quick Actions */}
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar items-center">
            {activeFile && (
              <Tag
                icon={<FileTextOutlined />}
                color="purple"
                className="flex-shrink-0 m-0 py-1 border-purple-200 bg-purple-50 text-purple-700"
              >
                {t('chatPanel.context')} {activeFile.split('/').pop() ?? activeFile}
              </Tag>
            )}
            {quickActions.map((qa) => (
              <Button
                key={qa.id}
                size="small"
                shape="round"
                onClick={() => {
                  void aiService.chat(taskId, qa.action, qa.prompt, activeFile ?? undefined);
                }}
                disabled={loading}
                className="flex-shrink-0 text-gray-600 hover:text-purple-600 hover:border-purple-300"
              >
                {qa.label}
              </Button>
            ))}
          </div>

          <div className="flex items-end gap-2 bg-gray-50 p-1 pl-3 rounded-xl border border-gray-200 focus-within:border-purple-400 focus-within:ring-1 focus-within:ring-purple-400 transition-all">
            <Input.TextArea
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
              }}
              placeholder={t('chatPanel.placeholder')}
              autoSize={{ minRows: 1, maxRows: 6 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={loading && !feedback}
              className="flex-1 bg-transparent border-none shadow-none focus:shadow-none resize-none py-2 outline-none hover:bg-transparent focus:bg-transparent"
              style={{ boxShadow: 'none' }}
              variant="borderless"
            />
            <Button
              type="primary"
              shape="circle"
              icon={<SendOutlined />}
              onClick={handleSend}
              disabled={!input.trim() || (loading && !feedback)}
              loading={loading && !feedback}
              className="mb-1 mr-1 flex-shrink-0 border-none"
              style={{
                backgroundColor: input.trim() && !loading ? '#7C3AED' : '#d1d5db',
                color: '#fff',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
