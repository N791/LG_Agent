import { getGlobalConfig } from './config';

export async function request<T = unknown>(
  method: string,
  endpoint: string,
  body?: unknown,
): Promise<T> {
  const config = getGlobalConfig();
  const url = `${config.baseUrl}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (config.token) {
    headers['Authorization'] = `Bearer ${config.token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let errMsg = response.statusText;
    try {
      const errBody = (await response.json()) as Record<string, unknown>;
      errMsg =
        typeof errBody['message'] === 'string' ? errBody['message'] : JSON.stringify(errBody);
    } catch (_e) {
      errMsg = await response.text();
    }
    throw new Error(`API Error ${String(response.status)}: ${errMsg}`);
  }

  const resJson = (await response.json()) as Record<string, unknown>;
  // Support transform interceptor wrapping data
  if (resJson['data'] !== undefined && (resJson['code'] === 200 || resJson['code'] === 201)) {
    return resJson['data'] as T;
  }
  return resJson as T;
}

export const api = {
  get: <T = unknown>(endpoint: string) => request<T>('GET', endpoint),
  post: <T = unknown>(endpoint: string, body: unknown) => request<T>('POST', endpoint, body),
};
