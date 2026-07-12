import { Injectable, Logger } from '@nestjs/common';
import { ModelInfoDTO } from '@lg-agent/contracts';
import { ProviderRegistry } from './providers/provider-registry.service';

@Injectable()
export class ModelRegistryService {
  private readonly logger = new Logger(ModelRegistryService.name);
  private cachedModels: ModelInfoDTO[] = [];

  constructor(private readonly providerRegistry: ProviderRegistry) {}

  async refreshProviders(): Promise<void> {
    this.logger.log('Refreshing models from all providers...');
    const providers = this.providerRegistry.getAllProviders();
    const allModels: ModelInfoDTO[] = [];

    for (const provider of providers) {
      try {
        const isHealthy = await provider.healthCheck();
        if (isHealthy) {
          const models = await provider.listModels();
          allModels.push(...models);
        } else {
          this.logger.warn(`Provider ${provider.name} is not healthy, skipping models.`);
        }
      } catch (error) {
        this.logger.error(`Failed to fetch models from provider ${provider.name}`, error);
      }
    }

    this.cachedModels = allModels;
    this.logger.log(`Refreshed ${String(this.cachedModels.length)} models.`);
  }

  async listModels(): Promise<ModelInfoDTO[]> {
    if (this.cachedModels.length === 0) {
      await this.refreshProviders();
    }
    return this.cachedModels;
  }

  async getDefaultModel(): Promise<ModelInfoDTO | undefined> {
    const models = await this.listModels();
    return models.find((m) => m.default && m.enabled) ?? models[0];
  }

  async findModel(id: string): Promise<ModelInfoDTO | undefined> {
    const models = await this.listModels();
    return models.find((m) => m.id === id);
  }
}
