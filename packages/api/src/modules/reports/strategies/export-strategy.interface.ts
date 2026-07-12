export interface IExportStrategy {
  export(data: Record<string, unknown>[], headers?: string[]): Promise<Buffer | string>;
}
