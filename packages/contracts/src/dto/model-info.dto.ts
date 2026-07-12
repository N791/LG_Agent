export interface ModelInfoDTO {
  id: string;
  provider: string;
  model: string;
  name: string;
  enabled: boolean;
  default: boolean;
  contextWindow?: number;
  capabilities: ('chat' | 'stream' | 'embedding' | 'vision' | 'toolCalling')[];
  status: 'active' | 'inactive' | 'error';
}
