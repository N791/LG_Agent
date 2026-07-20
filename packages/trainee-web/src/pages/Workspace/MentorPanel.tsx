import React, { useEffect, useState } from 'react';
import { Button, Input, Spin, Tag, Typography, message, Space, Avatar, Checkbox, Select, List } from 'antd';
import { VirtualizedList } from '../../components/VirtualizedList';
import { ArrowLeftOutlined, MessageOutlined, UserOutlined, TeamOutlined } from '@ant-design/icons';
import { DiscussionApi } from '../../services/discussion.service';
import { DiscussionDTO } from '@lg-agent/contracts';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

const { Option } = Select;
const { Text, Title } = Typography;
const { TextArea } = Input;

interface MentorPanelProps {
  taskId: string;
  workspaceId?: string;
}

export const MentorPanel: React.FC<MentorPanelProps> = ({ taskId, workspaceId }) => {
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
  const [analytics, setAnalytics] = useState<{ totalDiscussions: number; activeDiscussions: number; overdueCount: number; waitingForTraineeCount: number; avgResponseMinutes: number } | null>(null);

  const user = useSelector((state: RootState) => state.auth.user);

  const fetchDiscussions = async () => {
    setLoading(true);
    try {
      const data = await DiscussionApi.getDiscussions(taskId, workspaceId);
      setDiscussions(data);
    } catch (err) {
      message.error('Failed to load discussions');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const data = await DiscussionApi.getAnalytics();
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load discussion analytics', err);
    }
  };

  useEffect(() => {
    void fetchDiscussions();
    void fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const handleCreate = async () => {
    if (!newTitle.trim() || !newComment.trim()) {
      return message.warning('Title and question cannot be empty');
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
      message.success('Question sent to mentor!');
      setIsCreating(false);
      setNewTitle('');
      setNewComment('');
      setDiscussions([discussion, ...discussions]);
      setActiveDiscussion(discussion);
    } catch (err) {
      message.error('Failed to create discussion');
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
      } as any);
      setActiveDiscussion(updated);
      setReplyText('');
      setInternalNote(false);
      setMentions([]);
      setDiscussions(discussions.map(d => d.id === updated.id ? updated : d));
    } catch (err) {
      message.error('Failed to send reply');
    } finally {
      setReplying(false);
    }
  };

  const handleAssign = async () => {
    if (!activeDiscussion) return;
    setAssigning(true);
    try {
      const updated = await DiscussionApi.assignDiscussion(activeDiscussion.id, user?.id || '');
      setActiveDiscussion(updated);
      setDiscussions(discussions.map(d => d.id === updated.id ? updated : d));
      message.success('Discussion assigned to you');
    } catch (err) {
      message.error('Failed to assign discussion');
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
      setDiscussions(prev => prev.map(d => d.id === updated.id ? updated : d));
      await fetchAnalytics();
      message.success('Discussion marked as resolved');
    } catch (err) {
      message.error('Failed to resolve discussion');
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
      setDiscussions(prev => prev.map(d => d.id === updated.id ? updated : d));
      await fetchAnalytics();
      message.success('Marked as waiting for trainee');
    } catch (err) {
      message.error('Failed to update discussion status');
    } finally {
      setStatusUpdating(false);
    }
  };

  const renderStatus = (status: string) => {
    switch (status) {
      case 'OPEN': return <Tag color="blue">OPEN</Tag>;
      case 'IN_PROGRESS': return <Tag color="orange">IN PROGRESS</Tag>;
      case 'WAITING_FOR_TRAINEE': return <Tag color="gold">WAITING FOR TRAINEE</Tag>;
      case 'RESOLVED': return <Tag color="green">RESOLVED</Tag>;
      case 'CLOSED': return <Tag color="default">CLOSED</Tag>;
      default: return <Tag>{status}</Tag>;
    }
  };

  const queueStats = {
    needsAttention: discussions.filter(item => item.status !== 'RESOLVED' && item.status !== 'CLOSED' && (item.isOverdue || item.priority === 'URGENT' || item.priority === 'HIGH')).length,
    waitingForTrainee: discussions.filter(item => item.status === 'WAITING_FOR_TRAINEE').length,
    resolved: discussions.filter(item => item.status === 'RESOLVED' || item.status === 'CLOSED').length,
  };

  if (isCreating) {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Space style={{ marginBottom: 16 }}>
          <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => setIsCreating(false)} />
          <Title level={5} style={{ margin: 0 }}>Ask Mentor</Title>
        </Space>

        <Input
          placeholder="Summary of your question"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          style={{ marginBottom: 12 }}
        />
        <TextArea
          placeholder="Describe where you are stuck..."
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          rows={6}
          style={{ marginBottom: 16, flex: 1 }}
        />
        <Button type="primary" onClick={handleCreate} loading={loading} block>
          Send Question
        </Button>
      </div>
    );
  }

  if (activeDiscussion) {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Space style={{ marginBottom: 16 }}>
          <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => setActiveDiscussion(null)} />
          <Title level={5} style={{ margin: 0 }}>{activeDiscussion.title}</Title>
        </Space>

        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
          <Space style={{ marginBottom: 12 }}>
            {renderStatus(activeDiscussion.status)}
            {activeDiscussion.assignedToId && <Tag icon={<TeamOutlined />} color="purple">Assigned</Tag>}
            {activeDiscussion.internalNoteCount ? <Tag color="gold">{activeDiscussion.internalNoteCount} internal notes</Tag> : null}
            {activeDiscussion.mentionCount ? <Tag color="blue">{activeDiscussion.mentionCount} mentions</Tag> : null}
            {activeDiscussion.isOverdue ? <Tag color="red">Overdue</Tag> : null}
          </Space>
          <VirtualizedList
            data={activeDiscussion.comments || []}
            height={300}
            renderItem={(comment: any) => {
              const isMe = comment.authorId === user?.id;
              return (
                <div style={{ marginBottom: 16, display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                  <Avatar icon={<UserOutlined />} style={{ backgroundColor: isMe ? '#1890ff' : '#52c41a' }} />
                  <div style={{
                    maxWidth: '80%',
                    marginLeft: isMe ? 0 : 12,
                    marginRight: isMe ? 12 : 0,
                    padding: '8px 12px',
                    borderRadius: 8,
                    backgroundColor: isMe ? '#e6f7ff' : '#f6ffed',
                    border: '1px solid',
                    borderColor: isMe ? '#91d5ff' : '#b7eb8f'
                  }}>
                    <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>
                      {comment.authorName} ({comment.authorRole}) • {new Date(comment.createdAt).toLocaleTimeString()}
                    </div>
                    {comment.isInternal ? <Tag color="gold" style={{ marginBottom: 8 }}>Internal Note</Tag> : null}
                    {comment.mentions && comment.mentions.length > 0 ? <Tag color="blue" style={{ marginBottom: 8 }}>@{comment.mentions.join(', @')}</Tag> : null}
                    <Text>{comment.content}</Text>
                  </div>
                </div>
              );
            }}
          />
        </div>

        {activeDiscussion.status !== 'CLOSED' && activeDiscussion.status !== 'RESOLVED' && (
          <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
            <Space style={{ marginBottom: 8 }}>
              <Checkbox checked={internalNote} onChange={e => setInternalNote(e.target.checked)}>Internal note</Checkbox>
              <Select
                mode="tags"
                style={{ minWidth: 180 }}
                placeholder="Mentions"
                value={mentions}
                onChange={value => setMentions(value as string[])}
              >
                <Option value="alice">alice</Option>
                <Option value="mentor">mentor</Option>
              </Select>
            </Space>
            <TextArea
              placeholder="Type your reply..."
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              autoSize={{ minRows: 2, maxRows: 4 }}
              style={{ marginBottom: 8 }}
            />
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <Button onClick={handleAssign} loading={assigning}>Take it</Button>
                <Button onClick={handleWaitingForTrainee} loading={statusUpdating}>Waiting for trainee</Button>
                <Button onClick={handleResolve} loading={resolving}>Resolve</Button>
              </Space>
              <Button type="primary" onClick={handleReply} loading={replying}>
                Reply
              </Button>
            </Space>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <Title level={5} style={{ margin: 0 }}>Mentor Discussions</Title>
        <Button type="primary" icon={<MessageOutlined />} onClick={() => setIsCreating(true)}>
          Ask Mentor
        </Button>
      </Space>

      {analytics ? (
        <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Tag color="blue">Open/Active: {analytics.activeDiscussions}</Tag>
          <Tag color="red">Overdue: {analytics.overdueCount}</Tag>
          <Tag color="gold">Waiting for trainee: {analytics.waitingForTraineeCount}</Tag>
          <Tag color="green">Avg response: {analytics.avgResponseMinutes}m</Tag>
        </div>
      ) : null}

      <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Tag color="red">Needs attention: {queueStats.needsAttention}</Tag>
        <Tag color="gold">Waiting trainee: {queueStats.waitingForTrainee}</Tag>
        <Tag color="green">Resolved: {queueStats.resolved}</Tag>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', marginTop: 32 }}><Spin /></div>
      ) : (
        <VirtualizedList
          data={discussions}
          height={500}
          emptyText="No discussions yet. Get stuck? Ask a mentor!"
          renderItem={(item: any) => (
            <List.Item
              onClick={() => setActiveDiscussion(item)}
              style={{ cursor: 'pointer', padding: '12px', border: '1px solid #f0f0f0', borderRadius: 8, marginBottom: 8 }}
            >
              <List.Item.Meta
                title={<Text strong>{item.title}</Text>}
                description={
                  <Space direction="vertical" size="small" style={{ marginTop: 8, width: '100%' }}>
                    <Space>
                      {renderStatus(item.status)}
                      {item.isOverdue ? <Tag color="red">Overdue</Tag> : null}
                      {item.priority === 'URGENT' ? <Tag color="magenta">Urgent</Tag> : null}
                      {item.priority === 'HIGH' ? <Tag color="orange">High</Tag> : null}
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Last activity: {new Date(item.updatedAt).toLocaleString()}
                    </Text>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );
};
