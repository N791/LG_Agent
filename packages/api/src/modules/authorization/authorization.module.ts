import { Module } from '@nestjs/common';
import { AuthorizationController } from './authorization.controller';
import { AuthorizationAdminService } from './authorization-admin.service';
import { AuthorizationService } from './authorization.service';
import {
  MentorAssignmentPolicy,
  SubmissionOwnerPolicy,
  WorkspaceParticipantPolicy,
} from './resource-policies';
import { AuthorizationAuditService } from './authorization-audit.service';
import { AuthorizationMetricsService } from './authorization-metrics.service';
import { LegacyRoleBridgeService } from './legacy-role-bridge.service';
import { AuthorizationRegistryService } from './authorization-registry.service';
import { AuditModule } from '../../common/audit';

@Module({
  imports: [AuditModule],
  controllers: [AuthorizationController],
  providers: [
    AuthorizationService,
    AuthorizationRegistryService,
    AuthorizationMetricsService,
    LegacyRoleBridgeService,
    AuthorizationAuditService,
    AuthorizationAdminService,
    WorkspaceParticipantPolicy,
    SubmissionOwnerPolicy,
    MentorAssignmentPolicy,
  ],
  exports: [
    AuthorizationService,
    AuthorizationRegistryService,
    AuthorizationAuditService,
    LegacyRoleBridgeService,
    WorkspaceParticipantPolicy,
    SubmissionOwnerPolicy,
    MentorAssignmentPolicy,
  ],
})
export class AuthorizationModule {}
