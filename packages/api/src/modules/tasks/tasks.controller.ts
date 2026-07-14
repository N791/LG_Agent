import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UsePipes } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { SchemaValidationPipe } from '../schemas/schema-validation.pipe';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@ApiTags('Tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @ApiOperation({ summary: 'Create a new task' })
  @Roles('ADMIN', 'MENTOR')
  @Post()
  @UsePipes(
    SchemaValidationPipe({
      promptConfig: 'lg-agent:schema:prompt',
      envConfig: 'lg-agent:schema:env',
      sandboxConfig: 'lg-agent:schema:sandbox',
      testConfig: 'lg-agent:schema:test',
    }),
  )
  create(@Body() createTaskDto: CreateTaskDto) {
    return this.tasksService.create(createTaskDto);
  }

  @ApiOperation({ summary: 'Get all tasks for a course' })
  @Roles('ADMIN', 'MENTOR', 'TRAINEE')
  @Get()
  findAll(@Query('courseId') courseId: string) {
    return this.tasksService.findAll(courseId);
  }

  @ApiOperation({ summary: 'Get a specific task by ID' })
  @Roles('ADMIN', 'MENTOR', 'TRAINEE')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a task' })
  @Roles('ADMIN', 'MENTOR')
  @Patch(':id')
  @UsePipes(
    SchemaValidationPipe({
      promptConfig: 'lg-agent:schema:prompt',
      envConfig: 'lg-agent:schema:env',
      sandboxConfig: 'lg-agent:schema:sandbox',
      testConfig: 'lg-agent:schema:test',
    }),
  )
  update(@Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto) {
    return this.tasksService.update(id, updateTaskDto);
  }

  @ApiOperation({ summary: 'Delete a task' })
  @Roles('ADMIN', 'MENTOR')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
  }
}
