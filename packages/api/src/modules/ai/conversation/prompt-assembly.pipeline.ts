import { Injectable } from '@nestjs/common';
import { ChatRequestDto } from '../tutor/interfaces';
import { ConversationMessageDTO } from '@lg-agent/contracts';
import { PromptBuilderService, PromptMessage } from '../prompt-builder.service';
import { ContextBuilder } from './context-builder';

@Injectable()
export class PromptAssemblyPipeline {
  constructor(
    private readonly promptBuilder: PromptBuilderService,
    private readonly contextBuilder: ContextBuilder,
  ) {}

  async assemble(
    request: ChatRequestDto,
    history: ConversationMessageDTO[],
    userId: string,
  ): Promise<PromptMessage[]> {
    // 1. Get Context via ContextBuilder (combines workspace, activeFile, etc.)
    const promptContext = await this.contextBuilder.buildContext(request, userId);

    // 2. Map actions to prompt templates. E.g. 'code-review' -> 'code_review'
    const templateId = request.action.replace('-', '_');

    // 3. Prepare variables
    const variables = {
      content: request.content,
      workspace: promptContext.workspaceContent,
      activeFileContext: promptContext.activeFileContext,
      // Future: add Task instructions from DB
    };

    // 4. Assemble base messages from template
    const baseMessages = await this.promptBuilder.assembleMessages(templateId, variables);

    // 5. Append History (excluding the very first system message if it conflicts, or just push user/assistant history)
    const historyMessages: PromptMessage[] = history.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // The current user request is already in variables.content and put into baseMessages by PromptBuilder.
    // However, if we just want history, we should place history between System prompt and Current User prompt.
    const systemPrompt = baseMessages.find((m) => m.role === 'system');
    const userPrompt = baseMessages.find((m) => m.role === 'user');

    const finalMessages: PromptMessage[] = [];
    if (systemPrompt) finalMessages.push(systemPrompt);
    finalMessages.push(...historyMessages);
    if (userPrompt) finalMessages.push(userPrompt);

    return finalMessages;
  }
}
