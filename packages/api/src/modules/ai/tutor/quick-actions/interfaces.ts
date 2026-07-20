export interface IQuickActionProvider {
  name: string;
  getQuickActions(contextAction?: string): Promise<any[]>;
}
