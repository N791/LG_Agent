import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SCHEMA_IDS } from '@lg-agent/contracts';
import { schemasService } from './schemas';

const { requestGet } = vi.hoisted(() => ({ requestGet: vi.fn() }));

vi.mock('../utils/request', () => ({
  default: {
    get: requestGet,
  },
}));

describe('schemasService', () => {
  beforeEach(() => {
    requestGet.mockReset();
  });

  it.each(Object.values(SCHEMA_IDS))(
    'encodes canonical schema id %s as one path segment',
    async (id) => {
      requestGet.mockResolvedValue({ $id: id });

      await expect(schemasService.getSchema(id)).resolves.toEqual({ $id: id });
      expect(requestGet).toHaveBeenCalledWith(`/schemas/${encodeURIComponent(id)}`);
    },
  );

  it('propagates a stable 404 instead of retrying and creating duplicate requests', async () => {
    const error = Object.assign(new Error('schema missing'), { response: { status: 404 } });
    requestGet.mockRejectedValue(error);

    await expect(schemasService.getSchema(SCHEMA_IDS.env)).rejects.toBe(error);
    expect(requestGet).toHaveBeenCalledTimes(1);
  });
});
