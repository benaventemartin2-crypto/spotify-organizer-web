// ─── Spotify ──────────────────────────────────────────────────────────────────
// Safe to commit — PKCE flow doesn't need the client_secret.
// Get it at: https://developer.spotify.com/dashboard
export const CLIENT_ID = 'TU_SPOTIFY_CLIENT_ID_AQUI';

// ─── Last.fm ──────────────────────────────────────────────────────────────────
// Free key: https://www.last.fm/api/account/create
export const LASTFM_API_KEY = 'TU_LASTFM_API_KEY_AQUI';

// ─── Redirect URI ─────────────────────────────────────────────────────────────
// Auto-detected from browser URL — works on localhost AND GitHub Pages.
// Register this exact value in your Spotify App dashboard.
export const REDIRECT_URI = window.location.href.split('?')[0].split('#')[0];
