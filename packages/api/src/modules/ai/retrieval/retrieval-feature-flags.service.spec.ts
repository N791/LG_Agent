import { ConfigService } from '@nestjs/config';
import { RetrievalFeatureFlags } from './retrieval-feature-flags.service';

describe('RetrievalFeatureFlags', () => {
  it('keeps organizations outside the allowlist on instant-rollback legacy mode', () => {
    const flags = new RetrievalFeatureFlags(
      new ConfigService({
        RETRIEVAL_ROLLOUT_MODE: 'ACTIVE',
        RETRIEVAL_ROLLOUT_ORGANIZATIONS: 'enabled-org',
      }),
    );

    expect(flags.forOrganization('enabled-org')).toEqual({
      mode: 'ACTIVE',
      shadowRead: false,
      useVersionedResult: true,
    });
    expect(flags.forOrganization('other-org')).toEqual({
      mode: 'LEGACY',
      shadowRead: false,
      useVersionedResult: false,
    });
  });

  it('marks shadow reads without serving the versioned result', () => {
    const flags = new RetrievalFeatureFlags(
      new ConfigService({
        RETRIEVAL_ROLLOUT_MODE: 'SHADOW',
        RETRIEVAL_ROLLOUT_ORGANIZATIONS: 'shadow-org',
      }),
    );
    expect(flags.forOrganization('shadow-org')).toMatchObject({
      mode: 'SHADOW',
      shadowRead: true,
      useVersionedResult: false,
    });
  });
});
