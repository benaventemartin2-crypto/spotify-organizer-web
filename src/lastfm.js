/**
 * Last.fm API — fetches artist genre tags.
 * Caches results in localStorage so re-runs are instant.
 */

const BASE     = 'https://ws.audioscrobbler.com/2.0/';
const LS_KEY   = 'sgo_genre_cache';
const sleep    = (ms) => new Promise((r) => setTimeout(r, ms));

function loadCache() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
  catch { return {}; }
}

function saveCache(cache) {
  localStorage.setItem(LS_KEY, JSON.stringify(cache));
}

export class LastFM {
  constructor(apiKey) {
    this._key = apiKey;
  }

  async getArtistTags(name) {
    try {
      const params = new URLSearchParams({
        method:      'artist.getTopTags',
        artist:      name,
        api_key:     this._key,
        format:      'json',
        autocorrect: 1,
      });
      const res  = await fetch(`${BASE}?${params}`);
      if (!res.ok) return [];
      const data = await res.json();
      const tags = data?.toptags?.tag;
      if (!tags) return [];
      const arr = Array.isArray(tags) ? tags : [tags];
      return arr.slice(0, 6).map((t) => t.name.toLowerCase());
    } catch {
      return [];
    }
  }

  /**
   * Fetches genres for all artists in the map { id -> name }.
   * Returns Map<id, normalizedGenre>.
   */
  async fetchAllGenres(artistNameMap, normalizer, onProgress) {
    const result  = new Map();
    const cache   = loadCache();
    const entries = [...artistNameMap.entries()];

    const cached  = entries.filter(([, name]) => name in cache);
    const pending = entries.filter(([, name]) => !(name in cache));

    for (const [id, name] of cached) result.set(id, cache[name]);

    onProgress?.({ done: cached.length, total: entries.length, cached: cached.length });

    for (let i = 0; i < pending.length; i++) {
      const [id, name] = pending[i];
      const tags  = await this.getArtistTags(name);
      const genre = normalizer.normalize(tags);
      cache[name] = genre;
      result.set(id, genre);

      onProgress?.({ done: cached.length + i + 1, total: entries.length, cached: cached.length });

      if (i + 1 < pending.length) await sleep(220);
    }

    saveCache(cache);
    return result;
  }
}
