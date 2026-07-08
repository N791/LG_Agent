import { getGlobalConfig } from './config';

export async function request(method: string, endpoint: string, body?: any) {
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
      const errBody: any = await response.json();
      errMsg = errBody.message || JSON.stringify(errBody);
    } catch (e) {
      errMsg = await response.text();
    }
    throw new Error(`API Error ${response.status}: ${errMsg}`);
  }

  const resJson: any = await response.json();
  // Support transform interceptor wrapping data
  if (resJson.data !== undefined && resJson.code === 200) {
    return resJson.data;
  }
  // Support auth login wrapping data
  if (resJson.data !== undefined && resJson.code === 201) {
    return resJson.data;
  }
  return resJson;
}

export const api = {
  get: (endpoint: string) => request('GET', endpoint),
  post: (endpoint: string, body: any) => request('POST', endpoint, body),
};
