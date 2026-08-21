import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SystemConfigService } from './system-config.service';
import { PERMISSIONS, UpdateAiConfigsRequestDTO } from '@lg-agent/contracts';
import { RequirePermission } from '../../authorization';

@Controller('system/configs')
@UseGuards(JwtAuthGuard)
export class SystemConfigController {
  constructor(private readonly configService: SystemConfigService) {}

  @Get('ai')
  @RequirePermission(PERMISSIONS.SYSTEM_CONFIG_READ)
  async getAiConfigs() {
    // Only fetch non-sensitive or masked sensitive configs for the frontend
    // We never expose actual raw keys here for security
    const hasOpenAiKey = !!(await this.configService.get('OPENAI_API_KEY'));
    const hasDeepSeekKey = !!(await this.configService.get('DEEPSEEK_API_KEY'));

    return {
      OPENAI_BASE_URL: await this.configService.get('OPENAI_BASE_URL'),
      OPENAI_DEFAULT_MODEL: await this.configService.get('OPENAI_DEFAULT_MODEL'),
      OPENAI_API_KEY_EXISTS: hasOpenAiKey,

      DEEPSEEK_BASE_URL: await this.configService.get('DEEPSEEK_BASE_URL'),
      DEEPSEEK_DEFAULT_MODEL: await this.configService.get('DEEPSEEK_DEFAULT_MODEL'),
      DEEPSEEK_API_KEY_EXISTS: hasDeepSeekKey,

      MOCK_LLM_ENABLED: await this.configService.get('MOCK_LLM_ENABLED'),
      DEFAULT_AI_PROVIDER: await this.configService.get('DEFAULT_AI_PROVIDER'),

      RAG_ENABLED: await this.configService.get('RAG_ENABLED'),
      RAG_TOP_K: await this.configService.get('RAG_TOP_K'),
      RAG_CHUNK_SIZE: await this.configService.get('RAG_CHUNK_SIZE'),
    };
  }

  @Post('ai')
  @RequirePermission(PERMISSIONS.SYSTEM_CONFIG_MANAGE)
  async updateAiConfigs(@Body() body: UpdateAiConfigsRequestDTO) {
    const {
      OPENAI_BASE_URL,
      OPENAI_DEFAULT_MODEL,
      OPENAI_API_KEY,

      DEEPSEEK_BASE_URL,
      DEEPSEEK_DEFAULT_MODEL,
      DEEPSEEK_API_KEY,

      MOCK_LLM_ENABLED,
      DEFAULT_AI_PROVIDER,

      RAG_ENABLED,
      RAG_TOP_K,
      RAG_CHUNK_SIZE,
    } = body;

    // Update if provided
    if (OPENAI_BASE_URL !== undefined)
      await this.configService.set('OPENAI_BASE_URL', OPENAI_BASE_URL);
    if (OPENAI_DEFAULT_MODEL !== undefined)
      await this.configService.set('OPENAI_DEFAULT_MODEL', OPENAI_DEFAULT_MODEL);
    if (OPENAI_API_KEY !== undefined && OPENAI_API_KEY !== '')
      await this.configService.set('OPENAI_API_KEY', OPENAI_API_KEY, true);

    if (DEEPSEEK_BASE_URL !== undefined)
      await this.configService.set('DEEPSEEK_BASE_URL', DEEPSEEK_BASE_URL);
    if (DEEPSEEK_DEFAULT_MODEL !== undefined)
      await this.configService.set('DEEPSEEK_DEFAULT_MODEL', DEEPSEEK_DEFAULT_MODEL);
    if (DEEPSEEK_API_KEY !== undefined && DEEPSEEK_API_KEY !== '')
      await this.configService.set('DEEPSEEK_API_KEY', DEEPSEEK_API_KEY, true);

    if (MOCK_LLM_ENABLED !== undefined)
      await this.configService.set('MOCK_LLM_ENABLED', MOCK_LLM_ENABLED);
    if (DEFAULT_AI_PROVIDER !== undefined)
      await this.configService.set('DEFAULT_AI_PROVIDER', DEFAULT_AI_PROVIDER);

    if (RAG_ENABLED !== undefined) await this.configService.set('RAG_ENABLED', RAG_ENABLED);
    if (RAG_TOP_K !== undefined) await this.configService.set('RAG_TOP_K', RAG_TOP_K);
    if (RAG_CHUNK_SIZE !== undefined)
      await this.configService.set('RAG_CHUNK_SIZE', RAG_CHUNK_SIZE);

    return { success: true };
  }
}
