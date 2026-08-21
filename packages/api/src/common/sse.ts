import type { Response } from 'express';
import { SSE_CONTRACT_VERSION, type VersionedSseEventDTO } from '@lg-agent/contracts';

export function initializeSse(response: Response): void {
  response.setHeader('Content-Type', 'text/event-stream');
  response.setHeader('Cache-Control', 'no-cache');
  response.setHeader('Connection', 'keep-alive');
}

export function writeSseEvent<T>(
  response: Response,
  event: Omit<VersionedSseEventDTO<T>, 'version' | 'timestamp'> & { timestamp?: string },
  id?: number,
): void {
  if (id !== undefined) response.write(`id: ${String(id)}\n`);
  response.write('event: lg-agent.v1\n');
  response.write(
    `data: ${JSON.stringify({
      version: SSE_CONTRACT_VERSION,
      timestamp: event.timestamp ?? new Date().toISOString(),
      ...event,
    })}\n\n`,
  );
}

export function endSse(response: Response, data?: unknown): void {
  response.write('event: done\n');
  response.write(
    `data: ${JSON.stringify({
      version: SSE_CONTRACT_VERSION,
      type: 'DONE',
      ...(data === undefined ? {} : { data }),
      timestamp: new Date().toISOString(),
    })}\n\n`,
  );
  response.end();
}
