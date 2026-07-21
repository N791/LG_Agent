import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { LLMGatewayService } from './gateway/llm-gateway.service';
import { TaskType, TaskDifficulty } from '@lg-agent/contracts';

export class GenerateTaskRequest {
  document!: string;
}

@Injectable()
export class Ai2TaskService {
  private readonly logger = new Logger(Ai2TaskService.name);

  constructor(private readonly llmGateway: LLMGatewayService) {}

  async generateTaskDraft(request: GenerateTaskRequest): Promise<Record<string, unknown>> {
    if (!request.document.trim()) {
      throw new BadRequestException('errors.ai.contentRequired');
    }

    const systemPrompt = `
You are an expert curriculum designer and software engineering mentor.
Your task is to analyze the following technical document or instructions and generate a structured JSON object representing a coding task.

The JSON MUST conform to the following schema structure:
{
  "title": "String, a clear and concise title for the task",
  "summary": "String, a 1-2 sentence summary of what the trainee needs to do",
  "description": "String, detailed markdown instructions for the task",
  "taskType": "MANDATORY" | "ELECTIVE",
  "difficulty": "BEGINNER" | "INTERMEDIATE" | "ADVANCED",
  "envConfig": {
    "image": "node:20-alpine",
    "packages": { "express": "^4.18.2" },
    "node": true
  },
  "sandboxConfig": {
    "template": [
      {
        "path": "index.js",
        "content": "// Add starter code here"
      }
    ]
  },
  "testConfig": {
    "script": "// Add javascript test code here"
  }
}

CRITICAL RULES:
1. ONLY return the valid JSON object. Do not include any markdown formatting like \`\`\`json.
2. The response must be perfectly parseable by JSON.parse().
3. Generate realistic template code and test scripts based on the document.
4. If the document doesn't specify a technology, default to Node.js/Express.
`;

    try {
      this.logger.log('Calling LLM to generate TaskDTO draft...');
      const llmResponse = await this.llmGateway.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: request.document },
        ],
        model: 'deepseek-chat', // Defaulting to a capable model, could be configurable
        temperature: 0.2, // Low temperature for consistent JSON output
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
      return {
        title: parsedTask.title ?? 'Untitled Generated Task',
        summary: parsedTask.summary ?? 'Summary not provided.',
        description: parsedTask.description ?? 'No description provided.',
        taskType: parsedTask.taskType ?? TaskType.MANDATORY,
        difficulty: parsedTask.difficulty ?? TaskDifficulty.INTERMEDIATE,
        envConfig: parsedTask.envConfig ?? { image: 'node:20-alpine' },
        sandboxConfig: parsedTask.sandboxConfig ?? { template: [] },
        testConfig: parsedTask.testConfig ?? { script: '' },
      };
    } catch (error: unknown) {
      this.logger.error(`Failed to generate task draft: ${(error as Error).message}`);
      throw new BadRequestException('errors.ai.parseFailed');
    }
  }
}
