import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { IPricingRepository, ModelPricing } from './interfaces';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class JsonPricingRepository implements IPricingRepository, OnModuleInit {
  private readonly logger = new Logger(JsonPricingRepository.name);
  private pricingData = new Map<string, ModelPricing>();

  onModuleInit() {
    this.loadPricingData();
  }

  private loadPricingData() {
    try {
      const configPath = path.join(process.cwd(), 'config', 'pricing.json');
      if (fs.existsSync(configPath)) {
        const fileContent = fs.readFileSync(configPath, 'utf8');
        const parsed = JSON.parse(fileContent) as ModelPricing[];
        for (const item of parsed) {
          this.pricingData.set(item.model, item);
        }
        this.logger.log(`Loaded ${String(this.pricingData.size)} pricing configurations from JSON.`);
      } else {
        this.logger.warn(`Pricing config not found at ${configPath}. Cost calculation will default to 0.`);
      }
    } catch (error) {
      this.logger.error('Failed to load pricing config', (error as Error).stack);
    }
  }

  getPricing(model: string): Promise<ModelPricing | null> {
    return Promise.resolve(this.pricingData.get(model) ?? null);
  }

  getAllPricing(): Promise<ModelPricing[]> {
    return Promise.resolve(Array.from(this.pricingData.values()));
  }
}
