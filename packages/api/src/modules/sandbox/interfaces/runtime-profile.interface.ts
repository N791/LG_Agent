export interface IRuntimeProfile {
  getBuildCmd(): string;
  getLintCmd(): string;
  getTestCmd(): string;
  getRunCmd(entryPoint?: string): string;
}
