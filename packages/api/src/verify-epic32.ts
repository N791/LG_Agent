import { SandboxService } from './modules/sandbox/sandbox.service';
import { EnvDetectorService } from './modules/sandbox/env-detector.service';
import { DockerExecutor } from './modules/sandbox/docker.executor';
import { WorkspaceService } from './modules/sandbox/workspace.service';
import { WorkspaceDTO, ExecutionEventType } from '@lg-agent/contracts';

async function runTest(pass: boolean) {
  const envDetector = new EnvDetectorService();
  const workspaceService = new WorkspaceService();
  const dockerExecutor = new DockerExecutor(workspaceService);

  const sandboxService = new SandboxService(dockerExecutor, envDetector);

  const code = pass ? `console.log("Hello from test");` : `throw new Error("Failed");`;

  const workspaceDto: WorkspaceDTO = {
    taskId: 'test-task',
    workspace: {
      entry: 'index.js',
      files: [
        {
          path: 'index.js',
          content: code,
          language: 'javascript',
        },
      ],
    },
  };

  const config = {
    testScript: undefined,
  };

  console.log(`\n--- Running test (Expected pass: ${String(pass)}) ---`);

  const stream = sandboxService.runTask('test-task', 'user1', workspaceDto, config);

  let finalStatus = '';

  for await (const event of stream) {
    if (event.type === ExecutionEventType.LOG) {
      const text = (event.data as { text?: string }).text ?? '';
      process.stdout.write(text);
    } else if (event.type === ExecutionEventType.SUCCESS) {
      finalStatus = 'SUCCESS';
    } else if (event.type === ExecutionEventType.FAILED) {
      finalStatus = 'FAILED';
    } else if (event.type === ExecutionEventType.ERROR) {
      console.error(`[ERROR EVENT] ${event.message ?? 'Unknown error'}`);
    }
  }

  console.log(`\nFinal Status: ${finalStatus}`);

  if (pass && finalStatus === 'SUCCESS') {
    console.log('✅ Passing execution verified successfully.');
  } else if (!pass && finalStatus === 'FAILED') {
    console.log(
      '✅ Failing execution verified successfully (Frontend would now trigger AI Review).',
    );
  } else {
    console.error('❌ Verification failed!');
  }
}

async function main() {
  await runTest(true);
  await runTest(false);
}

main().catch(console.error);
