import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UsePipes,
  Request,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { PERMISSIONS } from '@lg-agent/contracts';
import { RequirePermission } from '../authorization';
import { SchemaValidationPipe } from '../schemas/schema-validation.pipe';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import type { TenantActor } from '../../common/tenant/organization-scoped.repository';

@ApiTags('Tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @ApiOperation({ summary: 'Create a new task' })
  @RequirePermission(PERMISSIONS.TASK_MANAGE)
  @Post()
  @UsePipes(
    SchemaValidationPipe({
      promptConfig: 'lg-agent:schema:prompt',
      envConfig: 'lg-agent:schema:env',
      sandboxConfig: 'lg-agent:schema:sandbox',
      testConfig: 'lg-agent:schema:test',
    }),
  )
  create(@Body() createTaskDto: CreateTaskDto, @Request() req: { user: TenantActor }) {
    return this.tasksService.create(createTaskDto, req.user);
  }

  @ApiOperation({ summary: 'Get all tasks for a course' })
  @RequirePermission(PERMISSIONS.TASK_READ)
  @Get()
  findAll(@Query('courseId') courseId: string, @Request() req: { user: TenantActor }) {
    return this.tasksService.findAll(courseId, req.user);
  }

  @ApiOperation({ summary: 'Get a specific task by ID' })
  @RequirePermission(PERMISSIONS.TASK_READ)
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: { user: TenantActor }) {
    return this.tasksService.findOne(id, req.user);
  }

  @ApiOperation({ summary: 'Update a task' })
  @RequirePermission(PERMISSIONS.TASK_MANAGE)
  @Patch(':id')
  @UsePipes(
    SchemaValidationPipe({
      promptConfig: 'lg-agent:schema:prompt',
      envConfig: 'lg-agent:schema:env',
      sandboxConfig: 'lg-agent:schema:sandbox',
      testConfig: 'lg-agent:schema:test',
    }),
  )
  update(
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
    @Request() req: { user: TenantActor },
  ) {
    return this.tasksService.update(id, updateTaskDto, req.user);
  }

  @ApiOperation({ summary: 'Delete a task' })
  @RequirePermission(PERMISSIONS.TASK_MANAGE)
  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: { user: TenantActor }) {
    return this.tasksService.remove(id, req.user);
  }
}
