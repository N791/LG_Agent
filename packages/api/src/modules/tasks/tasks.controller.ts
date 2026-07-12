import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UsePipes } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { Prisma } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { SchemaValidationPipe } from '../schemas/schema-validation.pipe';

@Controller('tasks')
@Roles('ADMIN', 'MENTOR')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @UsePipes(SchemaValidationPipe({
    promptConfig: 'lg-agent:schema:prompt',
    envConfig: 'lg-agent:schema:env',
    sandboxConfig: 'lg-agent:schema:sandbox',
    testConfig: 'lg-agent:schema:test'
  }))
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
  @UsePipes(SchemaValidationPipe({
    promptConfig: 'lg-agent:schema:prompt',
    envConfig: 'lg-agent:schema:env',
    sandboxConfig: 'lg-agent:schema:sandbox',
    testConfig: 'lg-agent:schema:test'
  }))
  update(@Param('id') id: string, @Body() updateTaskDto: Prisma.TaskUncheckedUpdateInput) {
    return this.tasksService.update(id, updateTaskDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
  }
}
