import { Controller, Get } from '@nestjs/common';
import { LLMGatewayService } from './gateway/llm-gateway.service';

@Controller('v1/ai')
export class AiController {
  constructor(private readonly llmGatewayService: LLMGatewayService) {}

  @Get('models')
  // @UseGuards(JwtAuthGuard) // Can be added later when auth is wired up
  getModels() {
    return {
      success: true,
      data: this.llmGatewayService.getAvailableModels(),
    };
  }
}
