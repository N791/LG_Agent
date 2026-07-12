export interface ModelPricing {
  model: string;
  promptCostPer1k: number;
  completionCostPer1k: number;
}

export interface IPricingRepository {
  getPricing(model: string): Promise<ModelPricing | null>;
  getAllPricing(): Promise<ModelPricing[]>;
}
