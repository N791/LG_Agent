/* eslint-disable @typescript-eslint/no-explicit-any */
export interface IQuickActionProvider {
  name: string;
  getQuickActions(contextAction?: string): Promise<any[]>;
}
