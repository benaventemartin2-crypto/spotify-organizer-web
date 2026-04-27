/**
 * Spotify OAuth 2.0 + PKCE.
 * No client_secret — safe for public GitHub Pages deployment.
 *
 * Tokens stored in localStorage (persist across sessions).
 * PKCE verifier stored in sessionStorage (single-use, cleared after exchange).
 */

const SCOPES = [
  'user-read-private',
  'user-library-read',
  'playlist-read-private',
  'playlist-modify-public',
  'playlist-modify-private',
].join(' ');

const LS_KEY = 'sgo_tokens';

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function generateVerifier() {
  const arr = new Uint8Array(64);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ── Token storage ─────────────────────────────────────────────────────────────

function saveTokens(t) { localStorage.setItem(LS_KEY, JSON.stringify(t)); }

function loadTokens() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); }
  catch { return null; }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Step 1: Redirect to Spotify authorization page.
 */
export async function startLogin(clientId, redirectUri) {
  const verifier   = generateVerifier();
  const challenge  = await generateChallenge(verifier);
  const state      = crypto.randomUUID();

  sessionStorage.setItem('sgo_verifier', verifier);
  sessionStorage.setItem('sgo_state', state);

  const params = new URLSearchParams({
    client_id:             clientId,
    response_type:         'code',
    redirect_uri:          redirectUri,
    scope:                 SCOPES,
    state,
    code_challenge_method: 'S256',
    code_challenge:        challenge,
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

/**
 * Step 2: Detect ?code= in URL and exchange for tokens.
 * Returns tokens object on success, null if no code is present.
 * Throws on error.
 */
export async function handleCallback(clientId, redirectUri) {
  const params = new URLSearchParams(window.location.search);
  const code   = params.get('code');
  const state  = params.get('state');
  const error  = params.get('error');

  if (!code) return null;
  if (error) throw new Error(`Spotify rechazó el acceso: ${error}`);

  const savedState = sessionStorage.getItem('sgo_state');
  if (state !== savedState) throw new Error('State mismatch — intenta de nuevo');

  const verifier = sessionStorage.getItem('sgo_verifier');
  if (!verifier) throw new Error('No se encontró el verifier PKCE — intenta de nuevo');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  redirectUri,
      client_id:     clientId,
      code_verifier: verifier,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Error al obtener tokens: ${body.error_description || res.status}`);
  }

  const data   = await res.json();
  const tokens = {
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    expires_at:    Date.now() + data.expires_in * 1000,
    scope:         data.scope,
  };

  saveTokens(tokens);
  sessionStorage.removeItem('sgo_verifier');
  sessionStorage.removeItem('sgo_state');

  // Remove ?code= from URL without triggering a reload
  history.replaceState({}, '', window.location.pathname);

  return tokens;
}

/**
 * Returns valid tokens, auto-refreshing if expired.
 * Returns null if not authenticated.
 */
export async function getValidTokens(clientId) {
  const tokens = loadTokens();
  if (!tokens) return null;

  const expired = !tokens.expires_at || Date.now() >= tokens.expires_at - 60_000;
  if (!expired) return tokens;

  if (!tokens.refresh_token) { logout(); return null; }

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: tokens.refresh_token,
      client_id:     clientId,
    }),
  });

  if (!res.ok) { logout(); return null; }

  const data     = await res.json();
  const refreshed = {
    access_token:  data.access_token,
    refresh_token: data.refresh_token || tokens.refresh_token,
    expires_at:    Date.now() + data.expires_in * 1000,
    scope:         data.scope || tokens.scope,
  };

  saveTokens(refreshed);
  return refreshed;
}

export function logout() {
  localStorage.removeItem(LS_KEY);
}
