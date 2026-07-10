import { Controller, Post, Body, Res, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { AiTutorService } from './tutor/ai-tutor.service';
import { ChatRequestDto } from './tutor/interfaces';
import { LLMResponse } from './interfaces/llm-provider.interface';

@Controller('ai')
export class AiController {
  constructor(private readonly aiTutorService: AiTutorService) {}

  @Post('chat')
  async chat(@Body() request: ChatRequestDto, @Res() res: Response) {
    if (!request.action || !request.content) {
      throw new BadRequestException('action and content are required');
    }

    try {
      const result = await this.aiTutorService.chat(request);

      // Handle Stream
      if (request.stream) {
        const stream = result as AsyncGenerator<string, void, unknown>;
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        for await (const chunk of stream) {
          res.write(`data: ${chunk}\n\n`);
        }
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        // Handle normal response
        const response = result as LLMResponse;
        res.json(response);
      }
    } catch (error: unknown) {
      const err = error as Error;
      if (
        err.name === 'BadRequestException' ||
        err.message.includes('safety') ||
        err.message.includes('blocked')
      ) {
        res.status(400).json({ error: err.message });
      } else if (err.name === 'NotFoundException') {
        res.status(404).json({ error: err.message });
      } else {
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
      }
    }
  }
}
