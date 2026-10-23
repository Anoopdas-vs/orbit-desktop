export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  tokenType: string;
  expiresAt: number; // Unix timestamp ms
  scope: string[];
}

export interface OAuthConfiguration {
  clientId: string;
  clientSecret?: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  redirectUri: string;
  scopes: string[];
}

export type IntegrationAuthStatus = 'UNAUTHENTICATED' | 'AUTHENTICATING' | 'AUTHENTICATED' | 'EXPIRED' | 'ERROR';

export interface IntegrationAccountStatus {
  serviceId: string;
  displayName: string;
  status: IntegrationAuthStatus;
  userEmail?: string;
  connectedAt?: string;
  error?: string;
}

export interface IIntegrationProvider {
  serviceId: string;
  displayName: string;
  getAuthStatus(): Promise<IntegrationAccountStatus>;
  authenticate(): Promise<boolean>;
  disconnect(): Promise<boolean>;
  getValidAccessToken(): Promise<string | null>;
}
