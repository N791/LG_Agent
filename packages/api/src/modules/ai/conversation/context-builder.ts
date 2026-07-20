import { Injectable, Inject } from '@nestjs/common';
import type { WorkspaceRepository } from '@lg-agent/contracts';
import { ChatRequestDto } from '../tutor/interfaces';

export interface PromptContext {
  workspaceContent: string;
  activeFileContext: string;
  // Extension points for future context elements:
  // taskDescription?: string;
  // relatedFiles?: string[];
  // gitDiff?: string;
}

export interface ContextProvider {
  build(request: ChatRequestDto, userId: string, currentContext: Partial<PromptContext>): Promise<Partial<PromptContext>>;
}

@Injectable()
export class WorkspaceContextProvider implements ContextProvider {
  constructor(
    @Inject('WorkspaceRepository')
    private readonly workspaceRepository: WorkspaceRepository,
  ) {}

  async build(request: ChatRequestDto, userId: string): Promise<Partial<PromptContext>> {
    const workspace = await this.workspaceRepository.getWorkspace(request.taskId, userId);
    return {
      workspaceContent: JSON.stringify(workspace.fileContents, null, 2),
    };
  }
}

@Injectable()
export class ActiveFileProvider implements ContextProvider {
  constructor(
    @Inject('WorkspaceRepository')
    private readonly workspaceRepository: WorkspaceRepository,
  ) {}

  async build(request: ChatRequestDto, userId: string, currentContext: Partial<PromptContext>): Promise<Partial<PromptContext>> {
    if (!request.activeFile) return {};
    
    // In the future, we might fetch only the active file, but for now we extract it from the workspace
    // if the workspace was already fetched by WorkspaceContextProvider.
    let content = 'Not found';
    if (currentContext.workspaceContent) {
      try {
        const parsed = JSON.parse(currentContext.workspaceContent) as Record<string, string>;
        content = parsed[request.activeFile] ?? 'Not found';
      } catch {
        // ignore
      }
    } else {
      const workspace = await this.workspaceRepository.getWorkspace(request.taskId, userId);
      content = workspace.fileContents[request.activeFile] ?? 'Not found';
    }

    return {
      activeFileContext: `\n### Active File (${request.activeFile}) ###\n${content}\n`,
    };
  }
}

@Injectable()
export class ContextBuilder {
  private providers: ContextProvider[] = [];

  constructor(
    workspaceProvider: WorkspaceContextProvider,
    activeFileProvider: ActiveFileProvider,
  ) {
    // Register default providers. Active file has high priority (added last so it overrides/appends)
    this.providers = [workspaceProvider, activeFileProvider];
  }

  // Extension point for adding custom providers (e.g. for enterprise features)
  addProvider(provider: ContextProvider) {
    this.providers.push(provider);
  }

  async buildContext(request: ChatRequestDto, userId: string): Promise<PromptContext> {
    let context: Partial<PromptContext> = {};

    for (const provider of this.providers) {
      const partial = await provider.build(request, userId, context);
      context = { ...context, ...partial };
    }

    return {
      workspaceContent: context.workspaceContent ?? '{}',
      activeFileContext: context.activeFileContext ?? '',
    };
  }
}
