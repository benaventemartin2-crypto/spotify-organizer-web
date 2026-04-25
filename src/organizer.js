/**
 * Main orchestration:
 *   1. Reads liked songs from Spotify
 *   2. Gets genres via Last.fm (cached in localStorage)
 *   3. Groups into top 5 genres + "Otros"
 *   4. Creates/updates playlists with dedup
 *
 * Reports progress by dispatching CustomEvents on window:
 *   'organizer:progress'  { type, ...detail }
 */

import { SpotifyAPI }      from './spotify-api.js';
import { LastFM }          from './lastfm.js';
import { GenreNormalizer } from './genre-normalizer.js';

const PREFIX      = 'Género';
const MAX         = 5;
const DESCRIPTION = 'Generada por Spotify Genre Organizer';

export class Organizer {
  constructor(accessToken, lastfmApiKey, genreRules) {
    this.api        = new SpotifyAPI(accessToken);
    this.lastfm     = new LastFM(lastfmApiKey);
    this.normalizer = new GenreNormalizer(genreRules);
  }

  _emit(type, detail = {}) {
    window.dispatchEvent(new CustomEvent('organizer:progress', { detail: { type, ...detail } }));
  }

  async run() {
    // 1. User
    this._emit('status', { msg: 'Conectando con Spotify...' });
    const user = await this.api.getCurrentUser();
    this._emit('user', { user });

    // 2. Liked songs
    this._emit('status', { msg: 'Leyendo liked songs...' });
    const liked = await this.api.getLikedSongs((p) => this._emit('liked-songs', p));
    this._emit('liked-songs-done', { count: liked.length });

    if (liked.length === 0) {
      throw new Error('No tienes liked songs en tu cuenta.');
    }

    // 3. Artist map
    const artistMap = new Map();
    for (const item of liked) {
      const a = item.track?.artists?.[0];
      if (a?.id && a?.name) artistMap.set(a.id, a.name);
    }

    // 4. Genres
    this._emit('status', { msg: `Obteniendo géneros (${artistMap.size} artistas)...` });
    const artistGenres = await this.lastfm.fetchAllGenres(
      artistMap, this.normalizer, (p) => this._emit('genres', p)
    );
    this._emit('genres-done', { total: artistMap.size });

    // 5. Classify
    this._emit('status', { msg: 'Clasificando canciones...' });
    const groups = {};
    for (const item of liked) {
      const track = item.track;
      if (!track?.uri) continue;
      const genre = artistGenres.get(track.artists?.[0]?.id) || 'Otros';
      if (!groups[genre]) groups[genre] = new Set();
      groups[genre].add(track.uri);
    }

    const all      = Object.keys(groups).sort((a, b) => groups[b].size - groups[a].size);
    const top      = all.slice(0, MAX);
    const overflow = all.slice(MAX);

    if (overflow.length) {
      if (!groups['Otros']) groups['Otros'] = new Set();
      for (const g of overflow) {
        for (const uri of groups[g]) groups['Otros'].add(uri);
        delete groups[g];
      }
      if (!top.includes('Otros')) top.push('Otros');
    }

    const sorted = top.sort();
    this._emit('classification-done', {
      genres: sorted.map((g) => ({ name: g, count: groups[g].size })),
    });

    // 6. Existing playlists
    this._emit('status', { msg: 'Cargando playlists existentes...' });
    const existing = {};
    for (const pl of await this.api.getUserPlaylists()) existing[pl.name] = pl;

    // 7. Create / update
    this._emit('status', { msg: 'Actualizando playlists...' });
    const results = [];
    const stats   = { created: 0, reused: 0, added: 0, skipped: 0 };

    for (const genre of sorted) {
      const name  = `${PREFIX} - ${genre}`;
      const uris  = [...groups[genre]];
      let pl      = existing[name];
      if (pl && pl.owner?.id !== user.id) pl = null;
      const isNew = !pl;

      if (isNew) {
        pl = await this.api.createPlaylist(user.id, name, DESCRIPTION);
        stats.created++;
      } else {
        stats.reused++;
      }

      const existingUris = isNew ? new Set() : await this.api.getPlaylistTrackUris(pl.id);
      const newUris      = uris.filter((u) => !existingUris.has(u));
      const skipped      = uris.length - newUris.length;

      if (newUris.length > 0) {
        try {
          await this.api.addTracksToPlaylist(pl.id, newUris);
        } catch (err) {
          if (!err.message.includes('403')) throw err;
          // Playlist locked — create fresh
          pl = await this.api.createPlaylist(user.id, name, DESCRIPTION);
          await this.api.addTracksToPlaylist(pl.id, uris);
          stats.created++;
          stats.added += uris.length;
          results.push({ genre, total: uris.length, added: uris.length, skipped: 0, isNew: true });
          this._emit('playlist-done', { genre, total: uris.length, added: uris.length, skipped: 0, isNew: true });
          continue;
        }
      }

      stats.added   += newUris.length;
      stats.skipped += skipped;
      results.push({ genre, total: uris.length, added: newUris.length, skipped, isNew });
      this._emit('playlist-done', { genre, total: uris.length, added: newUris.length, skipped, isNew });
    }

    this._emit('done', { user, results, stats });
  }
}
