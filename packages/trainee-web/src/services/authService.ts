import request from '../utils/request';
import type { AuthTokenPairDTO } from '@lg-agent/contracts';

/**
 * JWT Payload structure matching the backend AuthService.login() token generation.
 */
export interface JwtPayload {
  sub: string;
  username: string;
  role: string;
  organizationId: string;
  exp: number;
  iat: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Centralized authentication service.
 * All auth-related API calls and token operations go through this service.
 */
class AuthService {
  /**
   * Authenticate user and return token pair.
   */
  async login(username: string, password: string): Promise<AuthTokenPairDTO> {
    const response = await request.post<AuthTokenPairDTO>('/auth/login', {
      username,
      password,
    });
    // request interceptor unwraps axios .data, so response IS the data
    const data = response as unknown as AuthTokenPairDTO;
    return data;
  }

  /**
   * Exchange a valid refresh token for a new token pair.
   * Uses a raw axios instance to avoid the request interceptor (which would
   * try to refresh again on 401, causing infinite loops).
   */
  async refreshTokens(refreshToken: string): Promise<AuthTokenPairDTO> {
    const response = await request.post<AuthTokenPairDTO>('/auth/refresh', {
      refresh_token: refreshToken,
    });
    return response as unknown as AuthTokenPairDTO;
  }

  /**
   * Decode a JWT token payload without verification.
   * Verification is done server-side; this is for extracting claims client-side.
   */
  decodeToken(token: string): JwtPayload {
    const base64Url = token.split('.')[1];
    if (!base64Url) throw new Error('Invalid JWT token structure');

    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    const paddedBase64 = pad ? base64 + '='.repeat(4 - pad) : base64;

    const jsonPayload = decodeURIComponent(
      atob(paddedBase64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );

    return JSON.parse(jsonPayload) as JwtPayload;
  }

  /**
   * Check if a JWT token has expired.
   */
  isTokenExpired(token: string): boolean {
    try {
      const payload = this.decodeToken(token);
      // exp is in seconds, Date.now() in ms
      return Date.now() >= payload.exp * 1000;
    } catch {
      return true;
    }
  }

  /**
   * Get milliseconds until token expires.
   * Returns 0 if already expired or invalid.
   */
  getTokenExpiresIn(token: string): number {
    try {
      const payload = this.decodeToken(token);
      const expiresAt = payload.exp * 1000;
      const remaining = expiresAt - Date.now();
      return remaining > 0 ? remaining : 0;
    } catch {
      return 0;
    }
  }
}

export const authService = new AuthService();
