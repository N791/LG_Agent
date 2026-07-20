import { IRuntimeProfile } from './interfaces/runtime-profile.interface';

export class NodeRuntimeProfile implements IRuntimeProfile {
  getBuildCmd(): string {
    return 'npm install --no-audit --no-fund && npm run build --if-present';
  }

  getLintCmd(): string {
    return 'npm install --no-audit --no-fund && npm run lint --if-present';
  }

  getTestCmd(): string {
    return 'npm install --no-audit --no-fund && npm run test --if-present';
  }

  getRunCmd(entryPoint = 'index.js'): string {
    return `npm install --no-audit --no-fund && node ${entryPoint}`;
  }
}
