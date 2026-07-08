import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { Prisma } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('tasks')
@Roles('ADMIN', 'MENTOR')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(@Body() createTaskDto: Prisma.TaskUncheckedCreateInput) {
    return this.tasksService.create(createTaskDto);
  }

  @Get()
  findAll(@Query('courseId') courseId: string) {
    return this.tasksService.findAll(courseId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTaskDto: Prisma.TaskUncheckedUpdateInput) {
    return this.tasksService.update(id, updateTaskDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
  }
}
