// ─── Spotify ──────────────────────────────────────────────────────────────────
// Safe to commit — PKCE flow doesn't need the client_secret.
// Get it at: https://developer.spotify.com/dashboard
export const CLIENT_ID = 'e92296a78a9d4c19ad9b4b1f1e7351c7';

// ─── Last.fm ──────────────────────────────────────────────────────────────────
export const LASTFM_API_KEY = 'c08ec84b84a36746f91ac0ac895bcf93';

// ─── Redirect URI ─────────────────────────────────────────────────────────────
// Auto-detected from browser URL — works on localhost AND GitHub Pages.
// Register this exact value in your Spotify App dashboard.
export const REDIRECT_URI = window.location.href.split('?')[0].split('#')[0];
