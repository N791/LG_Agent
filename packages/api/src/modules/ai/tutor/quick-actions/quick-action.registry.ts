import { Injectable, Logger } from '@nestjs/common';
import { IQuickActionProvider } from './interfaces';
import { QuickActionDTO } from '@lg-agent/contracts';

@Injectable()
export class QuickActionRegistry {
  private readonly logger = new Logger(QuickActionRegistry.name);
  private providers: IQuickActionProvider[] = [];

  register(provider: IQuickActionProvider) {
    this.providers.push(provider);
    this.logger.log(`Registered Quick Action Provider: ${provider.name}`);
  }

  async getActions(contextAction?: string): Promise<QuickActionDTO[]> {
    const actions: QuickActionDTO[] = [];
    for (const provider of this.providers) {
      try {
        const providerActions = await provider.getQuickActions(contextAction);
        actions.push(...providerActions);
      } catch (err: any) {
        this.logger.error(`Error getting actions from ${provider.name}: ${err.message}`);
      }
    }
    return actions;
  }
}
