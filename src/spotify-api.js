/**
 * Spotify Web API wrapper using native fetch.
 * Handles 429 rate-limiting, retries on 5xx, and transparent pagination.
 */

const BASE = 'https://api.spotify.com/v1';
const MAX_RETRIES = 4;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class SpotifyAPI {
  constructor(accessToken) {
    this._token = accessToken;
  }

  get _headers() {
    return {
      Authorization:  `Bearer ${this._token}`,
      'Content-Type': 'application/json',
    };
  }

  async _req(method, path, { body = null, params = null } = {}, attempt = 0) {
    let url = BASE + path;
    if (params) {
      const q = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      );
      url += '?' + q;
    }

    const res = await fetch(url, {
      method,
      headers: this._headers,
      ...(body != null ? { body: JSON.stringify(body) } : {}),
    });

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const wait = parseInt(res.headers.get('retry-after') || '2') * 1000;
      await sleep(wait);
      return this._req(method, path, { body, params }, attempt + 1);
    }

    if (res.status >= 500 && attempt < MAX_RETRIES) {
      await sleep(1000 * (attempt + 1));
      return this._req(method, path, { body, params }, attempt + 1);
    }

    if (res.status === 204) return null;

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Spotify ${method} ${path} → ${res.status}: ${err?.error?.message || res.statusText}`);
    }

    return res.json();
  }

  getCurrentUser() {
    return this._req('GET', '/me');
  }

  async getLikedSongs(onProgress) {
    const tracks = [];
    let offset = 0;
    let total  = null;

    while (true) {
      const data = await this._req('GET', '/me/tracks', { params: { limit: 50, offset } });
      if (total === null) total = data.total;

      for (const item of data.items) {
        if (item?.track?.uri && !item.track.uri.startsWith('spotify:local:')) {
          tracks.push(item);
        }
      }

      onProgress?.({ count: tracks.length, total });

      if (!data.next) break;
      offset += 50;
    }

    return tracks;
  }

  getUserPlaylists() {
    return this._paginate('/me/playlists');
  }

  createPlaylist(userId, name, description) {
    return this._req('POST', '/me/playlists', {
      body: { name, description, public: true },
    });
  }

  async getPlaylistTrackUris(playlistId) {
    const uris = new Set();
    try {
      const items = await this._paginate(`/playlists/${playlistId}/tracks`);
      for (const item of items) {
        if (item?.track?.uri) uris.add(item.track.uri);
      }
    } catch { /* 403: return empty set, Spotify will skip duplicates */ }
    return uris;
  }

  async addTracksToPlaylist(playlistId, uris) {
    for (let i = 0; i < uris.length; i += 100) {
      await this._req('POST', `/playlists/${playlistId}/tracks`, {
        body: { uris: uris.slice(i, i + 100) },
      });
      if (i + 100 < uris.length) await sleep(200);
    }
  }

  async _paginate(path) {
    const items = [];
    let offset  = 0;

    while (true) {
      const data = await this._req('GET', path, { params: { limit: 50, offset } });
      items.push(...data.items);
      if (!data.next) break;
      offset += 50;
    }

    return items;
  }
}
