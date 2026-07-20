/* eslint-disable @typescript-eslint/require-await */
 
import { Injectable } from '@nestjs/common';
import { IQuickActionProvider } from './interfaces';
import { QuickActionDTO, ConversationType } from '@lg-agent/contracts';

@Injectable()
export class StaticFollowUpProvider implements IQuickActionProvider {
  public readonly name = 'StaticFollowUpProvider';

  async getQuickActions(contextAction?: string): Promise<QuickActionDTO[]> {
    if (!contextAction || contextAction === 'chat') {
      return [
        {
          id: 'qa-hint',
          label: '💡 Give me a hint',
          action: ConversationType.HINT,
          prompt: 'I am stuck on this task. Could you give me a conceptual hint?',
        },
        {
          id: 'qa-review',
          label: '👀 Review my code',
          action: ConversationType.CODE_REVIEW,
          prompt: 'Please review the code I have written so far.',
        },
        {
          id: 'qa-explain',
          label: '❓ Explain this error',
          action: ConversationType.EXPLAIN_ERROR,
          prompt: 'Can you explain the error I am getting?',
        }
      ];
    }

    if (contextAction === 'hint') {
      return [
        {
          id: 'qa-hint-more',
          label: '💡 Another hint',
          action: ConversationType.HINT,
          prompt: 'Can you give me another hint?',
        },
        {
          id: 'qa-chat-stuck',
          label: '❓ Still stuck',
          action: ConversationType.CHAT,
          prompt: 'I am still stuck, can you explain further?',
        }
      ];
    }

    if (contextAction === 'explain-error') {
      return [
        {
          id: 'qa-err-fix',
          label: '🛠️ How to fix?',
          action: ConversationType.CHAT,
          prompt: 'How do I fix this error?',
        }
      ];
    }

    if (contextAction === 'code-review') {
      return [
        {
          id: 'qa-rev-refactor',
          label: '🧹 Refactor for me',
          action: ConversationType.CHAT,
          prompt: 'Can you show me how to refactor this?',
        }
      ];
    }

    return [];
  }
}
