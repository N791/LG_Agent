import { Controller, Get, Post, Body, Patch, Param, Delete, Request } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { Prisma } from '@prisma/client';
import { PERMISSIONS } from '@lg-agent/contracts';
import { RequirePermission } from '../authorization';
import type { TenantActor } from '../../common/tenant/organization-scoped.repository';
import type { OrganizationSummaryDTO } from '@lg-agent/contracts';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @RequirePermission(PERMISSIONS.PLATFORM_ORGANIZATION_MANAGE)
  create(@Body() createOrganizationDto: Prisma.OrganizationCreateInput) {
    return this.organizationsService.create(createOrganizationDto);
  }

  @Get()
  @RequirePermission(PERMISSIONS.PLATFORM_ORGANIZATION_MANAGE)
  findAll() {
    return this.organizationsService.findAll();
  }

  @Get('current')
  @RequirePermission(PERMISSIONS.ORGANIZATION_READ)
  async current(@Request() req: { user: TenantActor }): Promise<OrganizationSummaryDTO> {
    const organization = await this.organizationsService.findOne(req.user.organizationId);
    return {
      id: organization.id,
      name: organization.name,
      code: organization.code,
      status: organization.status,
    };
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.PLATFORM_ORGANIZATION_MANAGE)
  findOne(@Param('id') id: string) {
    return this.organizationsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.PLATFORM_ORGANIZATION_MANAGE)
  update(@Param('id') id: string, @Body() updateOrganizationDto: Prisma.OrganizationUpdateInput) {
    return this.organizationsService.update(id, updateOrganizationDto);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.PLATFORM_ORGANIZATION_MANAGE)
  remove(@Param('id') id: string) {
    return this.organizationsService.remove(id);
  }
}
