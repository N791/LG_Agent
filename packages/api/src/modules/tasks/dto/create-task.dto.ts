import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, IsOptional, IsEnum, IsObject } from 'class-validator';
import { TaskType, TaskDifficulty, CreateTaskDTO } from '@lg-agent/contracts';

export class CreateTaskDto implements CreateTaskDTO {
  @ApiProperty({ description: '所属课程 ID' })
  @IsString()
  courseId!: string;

  @ApiProperty({ description: '任务名称' })
  @IsString()
  title!: string;

  @ApiProperty({ description: '任务摘要', required: false })
  @IsString()
  @IsOptional()
  summary?: string;

  @ApiProperty({ description: '任务描述 (Markdown)', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: '阶段序号' })
  @IsInt()
  stage!: number;

  @ApiProperty({ description: '任务类型', enum: TaskType, default: TaskType.MANDATORY })
  @IsEnum(TaskType)
  taskType!: TaskType;

  @ApiProperty({ description: '任务难度', enum: TaskDifficulty, default: TaskDifficulty.BEGINNER })
  @IsEnum(TaskDifficulty)
  difficulty!: TaskDifficulty;

  @ApiProperty({ description: '环境配置' })
  @IsObject()
  envConfig!: Record<string, unknown>;

  @ApiProperty({ description: '沙盒配置' })
  @IsObject()
  sandboxConfig!: Record<string, unknown>;

  @ApiProperty({ description: '自动测试配置' })
  @IsObject()
  testConfig!: Record<string, unknown>;

  @ApiProperty({ description: 'AI Prompt 配置' })
  @IsObject()
  promptConfig!: Record<string, unknown>;

  @ApiProperty({ description: '其他配置', required: false })
  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;

  @ApiProperty({ description: '元数据', required: false })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
