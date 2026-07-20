/* eslint-disable @typescript-eslint/no-explicit-any */
export interface DiscussionCommentDTO {
  id: string;
  discussionId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  content: string;
  codeSnippet?: any;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  isInternal?: boolean;
  mentions?: string[];
  createdAt: string;
}

export interface DiscussionDTO {
  id: string;
  userId: string;
  userName: string;
  taskId: string;
  submissionId?: string;
  workspaceId?: string;
  contextType: string;
  title: string;
  status: string;
  priority: string;
  assignedToId?: string;
  assignedToName?: string;
  assignedAt?: string | null;
  lastActivityAt?: string;
  internalNoteCount?: number;
  mentionCount?: number;
  slaStatus?: string;
  waitingForTrainee?: boolean;
  isOverdue?: boolean;
  createdAt: string;
  updatedAt: string;
  comments?: DiscussionCommentDTO[];
}

export interface CreateDiscussionDTO {
  taskId: string;
  submissionId?: string;
  workspaceId?: string;
  contextType: string;
  title: string;
  priority?: string;
  initialComment: string;
  codeSnippet?: any;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  isInternal?: boolean;
  mentions?: string[];
}

export interface AddCommentDTO {
  content: string;
  codeSnippet?: any;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  isInternal?: boolean;
  mentions?: string[];
}

export interface UpdateDiscussionStatusDTO {
  status: string;
}

export interface AssignDiscussionDTO {
  assignedToId: string;
}

export interface DiscussionAnalyticsDTO {
  totalDiscussions: number;
  activeDiscussions: number;
  overdueCount: number;
  waitingForTraineeCount: number;
  avgResponseMinutes: number;
}
