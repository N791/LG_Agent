import { Injectable, Inject } from '@nestjs/common';
import { ChatRequestDto } from '../tutor/interfaces';
import { ConversationMessageDTO } from '@lg-agent/contracts';
import type { WorkspaceRepository } from '@lg-agent/contracts';
import { PromptBuilderService, PromptMessage } from '../prompt-builder.service';

@Injectable()
export class PromptAssemblyPipeline {
  constructor(
    private readonly promptBuilder: PromptBuilderService,
    // Transitional: We will use the workspace payload for now, but inject the repository
    // TODO (Epic 40): Workspace will be loaded from DB using DatabaseWorkspaceRepository
    @Inject('WorkspaceRepository')
    private readonly workspaceRepository: WorkspaceRepository,
  ) {}

  async assemble(
    request: ChatRequestDto,
    history: ConversationMessageDTO[],
    userId: string,
  ): Promise<PromptMessage[]> {
    // 1. Get Workspace Context
    const workspace = await this.workspaceRepository.getWorkspace(request.taskId, userId);

    // 2. Map actions to prompt templates. E.g. 'code-review' -> 'code_review'
    const templateId = request.action.replace('-', '_');

    // 3. Prepare variables
    const variables = {
      content: request.content,
      workspace: JSON.stringify(workspace.fileContents, null, 2),
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
