import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AddDiscussionCommentRequestDTO,
  AssignDiscussionRequestDTO,
  ChangePasswordRequestDTO,
  ChatRequestDTO,
  CreateDiscussionRequestDTO,
  CreateWorkspaceVersionRequestDTO,
  ExecuteSandboxDTO,
  GenerateTaskRequestDTO,
  InitWorkspaceRequestDTO,
  LoginRequestDTO,
  RefreshTokenRequestDTO,
  RunSubmissionRequestDTO,
  SetPreferenceRequestDTO,
  TogglePreferenceRequestDTO,
  UpdateAiConfigsRequestDTO,
  UpdateDiscussionStatusRequestDTO,
  UpdateProfileRequestDTO,
  UpdateWorkspaceFilesRequestDTO,
  WorkspaceFileUpdateDTO,
} from '@lg-agent/contracts';

interface DtoClass {
  prototype: object;
}

function requiredString(target: DtoClass, property: string): void {
  ApiProperty({ type: String })(target.prototype, property);
  IsString()(target.prototype, property);
  IsNotEmpty()(target.prototype, property);
}

function optionalString(target: DtoClass, property: string): void {
  ApiPropertyOptional({ type: String })(target.prototype, property);
  IsString()(target.prototype, property);
  IsOptional()(target.prototype, property);
}

requiredString(RefreshTokenRequestDTO, 'refresh_token');
requiredString(LoginRequestDTO, 'username');
requiredString(LoginRequestDTO, 'password');
requiredString(InitWorkspaceRequestDTO, 'taskId');
requiredString(WorkspaceFileUpdateDTO, 'path');
ApiProperty({ type: String })(WorkspaceFileUpdateDTO.prototype, 'content');
IsString()(WorkspaceFileUpdateDTO.prototype, 'content');
ApiProperty({ type: [WorkspaceFileUpdateDTO] })(UpdateWorkspaceFilesRequestDTO.prototype, 'files');
IsArray()(UpdateWorkspaceFilesRequestDTO.prototype, 'files');
ValidateNested({ each: true })(UpdateWorkspaceFilesRequestDTO.prototype, 'files');
Type(() => WorkspaceFileUpdateDTO)(UpdateWorkspaceFilesRequestDTO.prototype, 'files');

ApiProperty({ enum: ['RUN', 'SUBMIT', 'MANUAL'] })(
  CreateWorkspaceVersionRequestDTO.prototype,
  'trigger',
);
IsIn(['RUN', 'SUBMIT', 'MANUAL'])(CreateWorkspaceVersionRequestDTO.prototype, 'trigger');

requiredString(RunSubmissionRequestDTO, 'taskId');
optionalString(RunSubmissionRequestDTO, 'idempotencyKey');
requiredString(ExecuteSandboxDTO, 'taskId');
ApiProperty({ enum: ['run', 'build', 'lint', 'test'] })(ExecuteSandboxDTO.prototype, 'action');
IsIn(['run', 'build', 'lint', 'test'])(ExecuteSandboxDTO.prototype, 'action');

for (const property of ['action', 'taskId', 'content']) requiredString(ChatRequestDTO, property);
ApiPropertyOptional({ type: Boolean, default: false })(ChatRequestDTO.prototype, 'stream');
IsBoolean()(ChatRequestDTO.prototype, 'stream');
IsOptional()(ChatRequestDTO.prototype, 'stream');
for (const property of ['conversationId', 'activeFile', 'activeFileContent']) {
  optionalString(ChatRequestDTO, property);
}
requiredString(GenerateTaskRequestDTO, 'document');

optionalString(UpdateProfileRequestDTO, 'nickname');
ApiPropertyOptional({ type: String, format: 'email' })(UpdateProfileRequestDTO.prototype, 'email');
IsEmail()(UpdateProfileRequestDTO.prototype, 'email');
IsOptional()(UpdateProfileRequestDTO.prototype, 'email');
requiredString(ChangePasswordRequestDTO, 'currentPassword');
ApiProperty({ type: String, minLength: 12 })(ChangePasswordRequestDTO.prototype, 'newPassword');
IsString()(ChangePasswordRequestDTO.prototype, 'newPassword');
MinLength(12)(ChangePasswordRequestDTO.prototype, 'newPassword');
requiredString(SetPreferenceRequestDTO, 'value');
ApiProperty({ type: Boolean })(TogglePreferenceRequestDTO.prototype, 'enabled');
IsBoolean()(TogglePreferenceRequestDTO.prototype, 'enabled');

for (const property of [
  'OPENAI_BASE_URL',
  'OPENAI_DEFAULT_MODEL',
  'OPENAI_API_KEY',
  'DEEPSEEK_BASE_URL',
  'DEEPSEEK_DEFAULT_MODEL',
  'DEEPSEEK_API_KEY',
  'MOCK_LLM_ENABLED',
  'DEFAULT_AI_PROVIDER',
  'RAG_ENABLED',
  'RAG_TOP_K',
  'RAG_CHUNK_SIZE',
]) {
  optionalString(UpdateAiConfigsRequestDTO, property);
}

for (const property of ['taskId', 'contextType', 'title', 'initialComment']) {
  requiredString(CreateDiscussionRequestDTO, property);
}
for (const property of ['workspaceId', 'submissionId', 'priority', 'filePath']) {
  optionalString(CreateDiscussionRequestDTO, property);
}
requiredString(AddDiscussionCommentRequestDTO, 'content');
for (const property of ['filePath']) optionalString(AddDiscussionCommentRequestDTO, property);

for (const target of [CreateDiscussionRequestDTO, AddDiscussionCommentRequestDTO]) {
  ApiPropertyOptional({ type: Object })(target.prototype, 'codeSnippet');
  IsObject()(target.prototype, 'codeSnippet');
  IsOptional()(target.prototype, 'codeSnippet');
  for (const property of ['startLine', 'endLine']) {
    ApiPropertyOptional({ type: Number })(target.prototype, property);
    IsNumber()(target.prototype, property);
    IsOptional()(target.prototype, property);
  }
  ApiPropertyOptional({ type: Boolean })(target.prototype, 'isInternal');
  IsBoolean()(target.prototype, 'isInternal');
  IsOptional()(target.prototype, 'isInternal');
  ApiPropertyOptional({ type: [String] })(target.prototype, 'mentions');
  IsArray()(target.prototype, 'mentions');
  IsOptional()(target.prototype, 'mentions');
}

requiredString(UpdateDiscussionStatusRequestDTO, 'status');
requiredString(AssignDiscussionRequestDTO, 'assignedToId');
