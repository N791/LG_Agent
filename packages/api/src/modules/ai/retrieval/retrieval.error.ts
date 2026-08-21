import { RetrievalErrorCodeDTO } from '@lg-agent/contracts';

export class RetrievalPortError extends Error {
  constructor(
    public readonly code: RetrievalErrorCodeDTO,
    message: string,
  ) {
    super(message);
    this.name = 'RetrievalPortError';
  }
}
