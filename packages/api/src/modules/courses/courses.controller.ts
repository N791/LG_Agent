import { Controller, Get, Post, Body, Patch, Param, Delete, Request } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { Prisma } from '@prisma/client';
import { PERMISSIONS } from '@lg-agent/contracts';
import { RequirePermission } from '../authorization';
import type { TenantActor } from '../../common/tenant/organization-scoped.repository';

@Controller('courses')
@RequirePermission(PERMISSIONS.COURSE_MANAGE)
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  create(
    @Request() req: { user: TenantActor },
    @Body() createCourseDto: Prisma.CourseUncheckedCreateInput,
  ) {
    return this.coursesService.create(createCourseDto, req.user);
  }

  @Get()
  @RequirePermission(PERMISSIONS.COURSE_READ)
  findAll(@Request() req: { user: TenantActor }) {
    return this.coursesService.findAll(req.user);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.COURSE_READ)
  findOne(@Param('id') id: string, @Request() req: { user: TenantActor }) {
    return this.coursesService.findOne(id, req.user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCourseDto: Prisma.CourseUncheckedUpdateInput,
    @Request() req: { user: TenantActor },
  ) {
    return this.coursesService.update(id, updateCourseDto, req.user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: { user: TenantActor }) {
    return this.coursesService.remove(id, req.user);
  }
}
