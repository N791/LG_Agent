import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { LLMGatewayService } from './gateway/llm-gateway.service';
import { TaskType, TaskDifficulty, GenerateTaskRequestDTO } from '@lg-agent/contracts';
import { PromptBuilderService } from './prompt-builder.service';
import type { TenantActor } from '../../common/tenant/organization-scoped.repository';

@Injectable()
export class Ai2TaskService {
  private readonly logger = new Logger(Ai2TaskService.name);

  constructor(
    private readonly llmGateway: LLMGatewayService,
    private readonly promptBuilder: PromptBuilderService,
  ) {}

  async generateTaskDraft(
    request: GenerateTaskRequestDTO,
    actor?: TenantActor,
  ): Promise<Record<string, unknown>> {
    if (!request.document.trim()) {
      throw new BadRequestException('errors.ai.contentRequired');
    }

    const messages = await this.promptBuilder.assembleMessages('task_generation', {
      document: request.document,
    });

    try {
      this.logger.log('Calling LLM to generate TaskDTO draft...');
      const llmResponse = await this.llmGateway.chat({
        messages,
        model: 'deepseek-chat', // Defaulting to a capable model, could be configurable
        temperature: 0.2, // Low temperature for consistent JSON output
        audit: actor ? { userId: actor.id, organizationId: actor.organizationId } : undefined,
      });

      let jsonStr = llmResponse.content.trim();

      // Attempt to clean up markdown code blocks if the LLM ignored instructions
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.substring(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.substring(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.substring(0, jsonStr.length - 3);
      }

      interface TaskDraft {
        title?: string;
        summary?: string;
        description?: string;
        taskType?: string;
        difficulty?: string;
        envConfig?: Record<string, unknown>;
        sandboxConfig?: Record<string, unknown>;
        testConfig?: Record<string, unknown>;
      }
      const parsedTask = JSON.parse(jsonStr) as TaskDraft;

      // Provide defaults for missing fields
      const draft = {
        title: parsedTask.title ?? 'Untitled Generated Task',
        summary: parsedTask.summary ?? 'Summary not provided.',
        description: parsedTask.description ?? 'No description provided.',
        taskType: parsedTask.taskType ?? TaskType.MANDATORY,
        difficulty: parsedTask.difficulty ?? TaskDifficulty.INTERMEDIATE,
        envConfig: parsedTask.envConfig ?? { image: 'node:20-alpine' },
        sandboxConfig: parsedTask.sandboxConfig ?? { template: [] },
        testConfig: parsedTask.testConfig ?? { script: '' },
      };
      await this.promptBuilder.validateOutput('task_generation', draft);
      return draft;
    } catch (error: unknown) {
      this.logger.error(`Failed to generate task draft: ${(error as Error).message}`);
      throw new BadRequestException('errors.ai.parseFailed');
    }
  }
}
