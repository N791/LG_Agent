import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IPricingRepository } from './interfaces';

@Injectable()
export class CostCalculator {
  private readonly logger = new Logger(CostCalculator.name);

  constructor(
    @Inject('IPricingRepository')
    private readonly pricingRepository: IPricingRepository,
  ) {}

  async estimate(model: string, estimatedPromptTokens: number, estimatedCompletionTokens: number): Promise<number> {
    return this.calculate(model, estimatedPromptTokens, estimatedCompletionTokens);
  }

  async calculate(model: string, promptTokens: number, completionTokens: number): Promise<number> {
    const pricing = await this.pricingRepository.getPricing(model);
    
    if (!pricing) {
      this.logger.warn(`No pricing found for model: ${model}. Cost will be 0.`);
      return 0;
    }

    const promptCost = (promptTokens / 1000) * pricing.promptCostPer1k;
    const completionCost = (completionTokens / 1000) * pricing.completionCostPer1k;

    return promptCost + completionCost;
  }
}
