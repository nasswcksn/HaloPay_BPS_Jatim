import crypto from 'crypto';

export interface KeycloakUserInfo {
  nip_baru?: string;
  nipbaru?: string;
  niplama?: string;
  name?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  email_verified?: boolean;
  jabatan?: string;
  satker?: string;
  sub?: string;
  [key: string]: any;
}

export interface KeycloakTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_expires_in?: number;
  refresh_token?: string;
  token_type: string;
  id_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export function getKeycloakConfig() {
  const baseUrl = (process.env.KEYCLOAK_URL || 'https://auth.majapah.it').replace(/\/+$/, '');
  const realm = process.env.KEYCLOAK_REALM || 'majapahit';
  const clientId = process.env.KEYCLOAK_CLIENT_ID || 'halopay';
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

  return {
    baseUrl,
    realm,
    clientId,
    appUrl,
    redirectUri: `${appUrl}/api/auth/callback`,
    authEndpoint: `${baseUrl}/realms/${realm}/protocol/openid-connect/auth`,
    tokenEndpoint: `${baseUrl}/realms/${realm}/protocol/openid-connect/token`,
    userinfoEndpoint: `${baseUrl}/realms/${realm}/protocol/openid-connect/userinfo`,
    logoutEndpoint: `${baseUrl}/realms/${realm}/protocol/openid-connect/logout`,
  };
}

/**
 * Menghasilkan Code Verifier acak untuk PKCE (RFC 7636).
 */
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Menghasilkan Code Challenge dari Code Verifier menggunakan metode S256.
 */
export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Menghasilkan state token acak untuk mencegah CSRF pada alur OIDC.
 */
export function generateState(): string {
  return crypto.randomBytes(16).toString('base64url');
}

/**
 * Membangun URL Otorisasi Keycloak untuk mengarahkan pengguna ke portal Majapahit BPS.
 */
export function buildAuthorizationUrl(params: {
  state: string;
  codeChallenge: string;
  customRedirectUri?: string;
  prompt?: 'login' | 'consent' | 'none';
}): string {
  const config = getKeycloakConfig();
  const redirectUri = params.customRedirectUri || config.redirectUri;

  const url = new URL(config.authEndpoint);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile majapahit-claims');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', params.state);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');

  if (params.prompt) {
    url.searchParams.set('prompt', params.prompt);
  }

  return url.toString();
}

/**
 * Membangun URL Logout Keycloak (RP-Initiated Logout) untuk menghapus sesi SSO di server Keycloak BPS.
 */
export function buildLogoutUrl(customPostLogoutRedirectUri?: string): string {
  const config = getKeycloakConfig();
  const postLogoutRedirectUri = customPostLogoutRedirectUri || `${config.appUrl}/login`;

  const url = new URL(config.logoutEndpoint);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri);

  return url.toString();
}

/**
 * Menukar Authorization Code dari Keycloak dengan Access Token dan ID Token menggunakan PKCE Verifier.
 */
export async function exchangeCodeForTokens(params: {
  code: string;
  codeVerifier: string;
  customRedirectUri?: string;
}): Promise<KeycloakTokenResponse> {
  const config = getKeycloakConfig();
  const redirectUri = params.customRedirectUri || config.redirectUri;

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    code: params.code,
    redirect_uri: redirectUri,
    code_verifier: params.codeVerifier,
  });

  const response = await fetch(config.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const data = await response.json();
  return data;
}

/**
 * Mengambil profil identitas lengkap pengguna dari endpoint UserInfo Keycloak.
 */
export async function fetchKeycloakUserInfo(accessToken: string): Promise<KeycloakUserInfo> {
  const config = getKeycloakConfig();

  const response = await fetch(config.userinfoEndpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Gagal mengambil user info dari Keycloak: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}
