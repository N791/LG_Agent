import { Controller, Get, Post, Body, Patch, Param, Delete, Request, Query } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { Prisma } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('courses')
@Roles('ADMIN', 'MENTOR')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  create(
    @Request() req: { user: { id: string; organizationId: string } },
    @Body() createCourseDto: Prisma.CourseUncheckedCreateInput,
  ) {
    // Inject user context from JWT
    const user = req.user;
    createCourseDto.createdById = user.id;

    // If not provided by frontend, force the org ID to be the user's org
    if (!createCourseDto.organizationId) {
      createCourseDto.organizationId = user.organizationId;
    }

    return this.coursesService.create(createCourseDto);
  }

  @Get()
  @Roles('ADMIN', 'MENTOR', 'TRAINEE')
  findAll(@Query('organizationId') organizationId?: string) {
    return this.coursesService.findAll(organizationId);
  }

  @Get(':id')
  @Roles('ADMIN', 'MENTOR', 'TRAINEE')
  findOne(@Param('id') id: string) {
    return this.coursesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCourseDto: Prisma.CourseUncheckedUpdateInput) {
    return this.coursesService.update(id, updateCourseDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.coursesService.remove(id);
  }
}
