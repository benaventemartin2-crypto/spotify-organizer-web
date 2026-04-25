# Spotify Genre Organizer

Web app que organiza tus Liked Songs de Spotify en hasta 5 playlists por género.  
Los usuarios solo hacen click en "Iniciar sesión con Spotify" — no necesitan configurar nada.

**Live:** https://benaventemartin2-crypto.github.io/spotify-organizer-web/

---

## Para los usuarios (cero setup)

1. Visitan la URL
2. Hacen click en **Iniciar sesión con Spotify**
3. Spotify les pide permiso → aceptan
4. La app lee sus Liked Songs y crea las playlists en su cuenta automáticamente
5. El botón **Refresh** agrega las canciones nuevas sin duplicar

No necesitan cuenta de desarrollador, no tocan ningún archivo, no saben que existe un `config.js`.

---

## Setup del desarrollador (una sola vez)

Tú haces esto una vez. Los usuarios nunca lo ven.

### 1. Crea tu Spotify App

1. Ve a [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. **Create app** → ponle cualquier nombre (ej. "Genre Organizer")
3. En **Redirect URIs** agrega:
   - `http://localhost:5500/` (para probar en local)
   - `https://TU_USUARIO.github.io/spotify-organizer-web/`
4. Activa **Web API** → guarda
5. Copia el **Client ID** (el Client Secret no se necesita gracias a PKCE)

### 2. Consigue un API key de Last.fm

1. Ve a [last.fm/api/account/create](https://www.last.fm/api/account/create)
2. Regístrate gratis y copia tu API key

### 3. Edita `config.js`

```js
export const CLIENT_ID      = 'tu_client_id_de_spotify';
export const LASTFM_API_KEY = 'tu_api_key_de_lastfm';
```

Ambas claves son seguras para commitear — el Client ID es público por diseño (PKCE), y Last.fm es solo lectura.

### 4. Sube a GitHub y activa Pages

```bash
git remote add origin https://github.com/TU_USUARIO/spotify-organizer-web.git
git push -u origin main
```

En **Settings → Pages → Source** selecciona la rama `gh-pages`.  
GitHub Actions hace el deploy automáticamente en cada push.

---

## Límite de usuarios de Spotify

Por defecto, una Spotify App nueva está en **modo desarrollo**: solo 25 usuarios, y debes agregarlos manualmente en el dashboard (User Management).

Para acceso ilimitado, pide **Extended Quota Mode** desde el dashboard de tu app → es un formulario simple, gratis, y Spotify lo aprueba en pocos días.

---

## Personalizar géneros

Edita `genre-map.json`. El orden importa: las reglas más arriba tienen prioridad.

```json
{ "genre": "Metal", "keywords": ["metal", "metalcore", "deathcore"] }
```
