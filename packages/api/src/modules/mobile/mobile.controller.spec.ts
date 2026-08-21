import { PERMISSIONS } from '@lg-agent/contracts';
import { REQUIRED_PERMISSIONS_KEY } from '../authorization/require-permission.decorator';
import { MobileController } from './mobile.controller';

describe('MobileController authorization contract', () => {
  it('requires task and training read permissions for the mobile read model', () => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, MobileController)).toEqual({
      permissions: [PERMISSIONS.TASK_READ, PERMISSIONS.TRAINING_READ],
      mode: 'ALL',
    });
  });

  it('requires submission read permission for the redacted failure summary', () => {
    const handler = Object.getOwnPropertyDescriptor(
      MobileController.prototype,
      'getSubmissionSummary',
    )?.value as object;
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, handler)).toEqual({
      permissions: [PERMISSIONS.SUBMISSION_READ],
      mode: 'ALL',
    });
  });
});
