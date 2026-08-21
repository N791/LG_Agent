import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Input,
  Spin,
  Tag,
  Typography,
  message,
  Avatar,
  Checkbox,
  Select,
} from 'antd';
import { ArrowLeftOutlined, MessageOutlined, UserOutlined, TeamOutlined } from '@ant-design/icons';
import { DiscussionApi } from '../../services/discussion.service';
import { DiscussionDTO, DiscussionCommentDTO } from '@lg-agent/contracts';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useTranslation } from 'react-i18next';

const { Option } = Select;
const { Text } = Typography;
const { TextArea } = Input;

interface MentorPanelProps {
  taskId: string;
  workspaceId?: string;
}

export const MentorPanel: React.FC<MentorPanelProps> = ({ taskId, workspaceId }) => {
  const { t } = useTranslation('workspace');
  const [discussions, setDiscussions] = useState<DiscussionDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeDiscussion, setActiveDiscussion] = useState<DiscussionDTO | null>(null);

  // Create Discussion State
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newComment, setNewComment] = useState('');

  // Reply State
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [internalNote, setInternalNote] = useState(false);
  const [mentions, setMentions] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [analytics, setAnalytics] = useState<{
    totalDiscussions: number;
    activeDiscussions: number;
    overdueCount: number;
    waitingForTraineeCount: number;
    avgResponseMinutes: number;
  } | null>(null);
  const [analyticsUnavailable, setAnalyticsUnavailable] = useState(false);
  const loadedKeyRef = useRef<string | null>(null);

  const user = useSelector((state: RootState) => state.auth.user);
  const canLoadOrganizationAnalytics = user?.role === 'MENTOR' || user?.role === 'ADMIN';

  const fetchDiscussions = async () => {
    setLoading(true);
    try {
      const data = await DiscussionApi.getDiscussions(taskId, workspaceId);
      setDiscussions(data);
    } catch (_err) {
      message.error(t('mentorPanel.messages.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    if (!canLoadOrganizationAnalytics) return;
    try {
      const data = await DiscussionApi.getAnalytics();
      setAnalytics(data);
      setAnalyticsUnavailable(false);
    } catch (_err) {
      setAnalyticsUnavailable(true);
    }
  };

  useEffect(() => {
    const loadKey = `${taskId}:${workspaceId ?? ''}:${canLoadOrganizationAnalytics ? 'manage' : 'personal'}`;
    if (loadedKeyRef.current === loadKey) return;
    loadedKeyRef.current = loadKey;
    void fetchDiscussions();
    if (canLoadOrganizationAnalytics) void fetchAnalytics();
  }, [taskId, workspaceId, canLoadOrganizationAnalytics]);

  const handleCreate = async () => {
    if (!newTitle.trim() || !newComment.trim()) {
      return message.warning(t('mentorPanel.messages.emptyTitle'));
    }
    setLoading(true);
    try {
      const discussion = await DiscussionApi.createDiscussion({
        taskId,
        workspaceId,
        contextType: 'WORKSPACE',
        title: newTitle,
        initialComment: newComment,
      });
      message.success(t('mentorPanel.messages.sentSuccess'));
      setIsCreating(false);
      setNewTitle('');
      setNewComment('');
      setDiscussions([discussion, ...discussions]);
      setActiveDiscussion(discussion);
    } catch (_err) {
      message.error(t('mentorPanel.messages.createFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !activeDiscussion) return;
    setReplying(true);
    try {
      const updated = await DiscussionApi.addComment(activeDiscussion.id, {
        content: replyText,
        isInternal: internalNote,
        mentions,
      });
      setActiveDiscussion(updated);
      setReplyText('');
      setInternalNote(false);
      setMentions([]);
      setDiscussions(discussions.map((d) => (d.id === updated.id ? updated : d)));
    } catch (_err) {
      message.error(t('mentorPanel.messages.replyFailed'));
    } finally {
      setReplying(false);
    }
  };

  const handleAssign = async () => {
    if (!activeDiscussion) return;
    setAssigning(true);
    try {
      const updated = await DiscussionApi.assignDiscussion(activeDiscussion.id, user?.id ?? '');
      setActiveDiscussion(updated);
      setDiscussions(discussions.map((d) => (d.id === updated.id ? updated : d)));
      message.success(t('mentorPanel.messages.assignSuccess'));
    } catch (_err) {
      message.error(t('mentorPanel.messages.assignFailed'));
    } finally {
      setAssigning(false);
    }
  };

  const handleResolve = async () => {
    if (!activeDiscussion) return;
    setResolving(true);
    try {
      const updated = await DiscussionApi.resolveDiscussion(activeDiscussion.id);
      setActiveDiscussion(updated);
      setDiscussions((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      await fetchAnalytics();
      message.success(t('mentorPanel.messages.resolveSuccess'));
    } catch (_err) {
      message.error(t('mentorPanel.messages.resolveFailed'));
    } finally {
      setResolving(false);
    }
  };

  const handleWaitingForTrainee = async () => {
    if (!activeDiscussion) return;
    setStatusUpdating(true);
    try {
      const updated = await DiscussionApi.updateStatus(activeDiscussion.id, 'WAITING_FOR_TRAINEE');
      setActiveDiscussion(updated);
      setDiscussions((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      await fetchAnalytics();
      message.success(t('mentorPanel.messages.waitSuccess'));
    } catch (_err) {
      message.error(t('mentorPanel.messages.statusFailed'));
    } finally {
      setStatusUpdating(false);
    }
  };

  const renderStatus = (status: string) => {
    switch (status) {
      case 'OPEN':
        return (
          <Tag color="blue" className="m-0 text-[10px] leading-tight px-1.5 border-0">
            {t('mentorPanel.status.open')}
          </Tag>
        );
      case 'IN_PROGRESS':
        return (
          <Tag color="orange" className="m-0 text-[10px] leading-tight px-1.5 border-0">
            {t('mentorPanel.status.inProgress')}
          </Tag>
        );
      case 'WAITING_FOR_TRAINEE':
        return (
          <Tag color="gold" className="m-0 text-[10px] leading-tight px-1.5 border-0">
            {t('mentorPanel.status.waitingForTrainee')}
          </Tag>
        );
      case 'RESOLVED':
        return (
          <Tag color="green" className="m-0 text-[10px] leading-tight px-1.5 border-0">
            {t('mentorPanel.status.resolved')}
          </Tag>
        );
      case 'CLOSED':
        return (
          <Tag color="default" className="m-0 text-[10px] leading-tight px-1.5 border-0">
            {t('mentorPanel.status.closed')}
          </Tag>
        );
      default:
        return <Tag className="m-0 text-[10px] leading-tight px-1.5 border-0">{status}</Tag>;
    }
  };

  const personalStats = {
    needsAttention: discussions.filter(
      (item) =>
        item.status !== 'RESOLVED' &&
        item.status !== 'CLOSED' &&
        (item.isOverdue === true || item.priority === 'URGENT' || item.priority === 'HIGH'),
    ).length,
    waitingForTrainee: discussions.filter((item) => item.status === 'WAITING_FOR_TRAINEE').length,
    resolved: discussions.filter((item) => item.status === 'RESOLVED' || item.status === 'CLOSED')
      .length,
  };
  const queueStats = analytics
    ? {
        needsAttention: analytics.overdueCount,
        waitingForTrainee: analytics.waitingForTraineeCount,
        resolved: personalStats.resolved,
      }
    : personalStats;

  if (isCreating) {
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="flex-shrink-0 p-3 border-b border-gray-100 flex items-center gap-2 sticky top-0 bg-white z-10 shadow-sm">
          <Button
            icon={<ArrowLeftOutlined />}
            type="text"
            onClick={() => {
              setIsCreating(false);
            }}
            className="flex-shrink-0"
          />
          <h2 className="text-sm font-semibold text-gray-800 m-0">
            {t('mentorPanel.createTitle')}
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          <Input
            placeholder={t('mentorPanel.titlePlaceholder')}
            value={newTitle}
            onChange={(e) => {
              setNewTitle(e.target.value);
            }}
            className="rounded-md"
          />
          <TextArea
            placeholder={t('mentorPanel.descPlaceholder')}
            value={newComment}
            onChange={(e) => {
              setNewComment(e.target.value);
            }}
            rows={8}
            className="rounded-md flex-1"
          />
          <Button
            type="primary"
            onClick={() => {
              void handleCreate();
            }}
            loading={loading}
            block
          >
            {t('mentorPanel.sendQuestion')}
          </Button>
        </div>
      </div>
    );
  }

  if (activeDiscussion) {
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="flex-shrink-0 p-3 border-b border-gray-100 flex items-center gap-2 sticky top-0 bg-white z-10 shadow-sm">
          <Button
            icon={<ArrowLeftOutlined />}
            type="text"
            onClick={() => {
              setActiveDiscussion(null);
            }}
            className="flex-shrink-0"
          />
          <h2
            className="text-sm font-semibold text-gray-800 m-0 truncate"
            title={activeDiscussion.title}
          >
            {activeDiscussion.title}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/30">
          <div className="flex flex-wrap gap-1.5 mb-4">
            {renderStatus(activeDiscussion.status)}
            {activeDiscussion.assignedToId && (
              <Tag
                icon={<TeamOutlined />}
                color="purple"
                className="m-0 text-[10px] leading-tight px-1.5 border-0"
              >
                {t('mentorPanel.assigned')}
              </Tag>
            )}
            {activeDiscussion.internalNoteCount ? (
              <Tag color="gold" className="m-0 text-[10px] leading-tight px-1.5 border-0">
                {t('mentorPanel.internalNotes', { count: activeDiscussion.internalNoteCount })}
              </Tag>
            ) : null}
            {activeDiscussion.mentionCount ? (
              <Tag color="blue" className="m-0 text-[10px] leading-tight px-1.5 border-0">
                {t('mentorPanel.mentions', { count: activeDiscussion.mentionCount })}
              </Tag>
            ) : null}
            {activeDiscussion.isOverdue ? (
              <Tag color="red" className="m-0 text-[10px] leading-tight px-1.5 border-0">
                {t('mentorPanel.overdue')}
              </Tag>
            ) : null}
          </div>

          <div className="flex flex-col gap-4">
            {activeDiscussion.comments?.map((comment: DiscussionCommentDTO) => {
              const isMe = comment.authorId === user?.id;
              return (
                <div
                  key={comment.id}
                  className={`flex ${isMe ? 'flex-row-reverse' : 'flex-row'} gap-3 items-start`}
                >
                  <Avatar
                    icon={<UserOutlined />}
                    className="flex-shrink-0 mt-1"
                    style={{ backgroundColor: isMe ? '#1890ff' : '#52c41a' }}
                  />
                  <div
                    className={`max-w-[85%] p-3 rounded-lg border shadow-sm ${
                      isMe
                        ? 'bg-blue-50 border-blue-100 rounded-tr-none'
                        : 'bg-white border-gray-100 rounded-tl-none'
                    }`}
                  >
                    <div className="text-[10px] text-gray-400 mb-1.5 font-medium">
                      {comment.authorName} ({comment.authorRole}) •{' '}
                      {new Date(comment.createdAt).toLocaleTimeString()}
                    </div>
                    {((comment.isInternal ?? false) || (comment.mentions?.length ?? 0) > 0) && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {comment.isInternal && (
                          <Tag
                            color="gold"
                            className="m-0 text-[10px] leading-tight px-1.5 border-0"
                          >
                            {t('mentorPanel.internalNote')}
                          </Tag>
                        )}
                        {comment.mentions?.length ? (
                          <Tag
                            color="blue"
                            className="m-0 text-[10px] leading-tight px-1.5 border-0"
                          >
                            @{comment.mentions.join(', @')}
                          </Tag>
                        ) : null}
                      </div>
                    )}
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">
                      {comment.content}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {activeDiscussion.status !== 'CLOSED' && activeDiscussion.status !== 'RESOLVED' && (
          <div className="flex-shrink-0 p-4 border-t border-gray-100 bg-white">
            <div className="flex items-center gap-3 mb-3">
              <Checkbox
                checked={internalNote}
                onChange={(e) => {
                  setInternalNote(e.target.checked);
                }}
                className="text-xs"
              >
                {t('mentorPanel.internalNote')}
              </Checkbox>
              <Select
                mode="tags"
                className="flex-1"
                placeholder={t('mentorPanel.mentionPlaceholder')}
                value={mentions}
                onChange={(value) => {
                  setMentions(value);
                }}
                size="small"
              >
                <Option value="alice">alice</Option>
                <Option value="mentor">mentor</Option>
              </Select>
            </div>
            <TextArea
              placeholder={t('mentorPanel.replyPlaceholder')}
              value={replyText}
              onChange={(e) => {
                setReplyText(e.target.value);
              }}
              autoSize={{ minRows: 2, maxRows: 4 }}
              className="mb-3 rounded-md"
            />
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <Button
                  size="small"
                  onClick={() => {
                    void handleAssign();
                  }}
                  loading={assigning}
                >
                  {t('mentorPanel.assignToMe')}
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    void handleWaitingForTrainee();
                  }}
                  loading={statusUpdating}
                >
                  {t('mentorPanel.waitTrainee')}
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    void handleResolve();
                  }}
                  loading={resolving}
                >
                  {t('mentorPanel.resolve')}
                </Button>
              </div>
              <Button
                type="primary"
                onClick={() => {
                  void handleReply();
                }}
                loading={replying}
              >
                {t('mentorPanel.sendReply')}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex-shrink-0 p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
        <h2 className="text-sm font-semibold text-gray-800 m-0 flex items-center gap-2">
          <TeamOutlined /> {t('mentorPanel.title')}
        </h2>
        <Button
          size="small"
          type="primary"
          icon={<MessageOutlined />}
          onClick={() => {
            setIsCreating(true);
          }}
          className="text-[11px] h-7 flex items-center"
        >
          {t('mentorPanel.askQuestion')}
        </Button>
      </div>

      <div className="flex-shrink-0 p-3 bg-gray-50/50 border-b border-gray-100">
        {analyticsUnavailable ? (
          <Alert
            className="mb-2"
            type="warning"
            showIcon
            message={t('mentorPanel.analyticsUnavailable')}
            action={
              <Button size="small" onClick={() => void fetchAnalytics()}>
                {t('mentorPanel.retry')}
              </Button>
            }
          />
        ) : null}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="text-gray-500 font-medium mr-1">{t('mentorPanel.stats')}</span>
          <span className="text-red-600 font-medium">
            {t('mentorPanel.needsAttention', { count: queueStats.needsAttention })}
          </span>
          <span className="text-yellow-600 font-medium">
            {t('mentorPanel.waiting', { count: queueStats.waitingForTrainee })}
          </span>
          <span className="text-green-600 font-medium">
            {t('mentorPanel.resolved', { count: queueStats.resolved })}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center p-8">
            <Spin />
          </div>
        ) : discussions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-gray-400 gap-3 mt-10">
            <MessageOutlined className="text-4xl text-gray-200" />
            <div className="text-center">
              <div className="text-sm font-medium text-gray-500 mb-1">
                {t('mentorPanel.emptyStateTitle')}
              </div>
              <div className="text-xs text-gray-400 max-w-[180px]">
                {t('mentorPanel.emptyStateDesc')}
              </div>
            </div>
            <Button
              size="small"
              className="mt-2"
              onClick={() => {
                setIsCreating(true);
              }}
            >
              {t('mentorPanel.askNow')}
            </Button>
          </div>
        ) : (
          <div className="p-2">
            {discussions.map((item: DiscussionDTO) => (
              <div
                key={item.id}
                onClick={() => {
                  setActiveDiscussion(item);
                }}
                className="group cursor-pointer p-3 rounded-md mb-1 border border-transparent hover:border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <div className="text-sm font-medium text-gray-800 mb-1.5 line-clamp-1">
                  {item.title}
                </div>
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {renderStatus(item.status)}
                  {item.isOverdue ? (
                    <Tag color="red" className="m-0 text-[10px] leading-tight px-1.5 border-0">
                      {t('mentorPanel.overdue')}
                    </Tag>
                  ) : null}
                  {item.priority === 'URGENT' ? (
                    <Tag color="magenta" className="m-0 text-[10px] leading-tight px-1.5 border-0">
                      {t('mentorPanel.urgent')}
                    </Tag>
                  ) : null}
                  {item.priority === 'HIGH' ? (
                    <Tag color="orange" className="m-0 text-[10px] leading-tight px-1.5 border-0">
                      {t('mentorPanel.high')}
                    </Tag>
                  ) : null}
                </div>
                <Text type="secondary" className="text-[10px] text-gray-400">
                  {t('mentorPanel.lastActive', { time: new Date(item.updatedAt).toLocaleString() })}
                </Text>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
