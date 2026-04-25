# Spotify Genre Organizer

Web app que organiza tus **Liked Songs** de Spotify en hasta 5 playlists por género.  
Funciona con login de Spotify — cualquier usuario puede usarla desde el navegador.

**Live:** `https://TU_USUARIO.github.io/spotify-organizer-web/`

---

## Setup (una sola vez)

### 1. Fork o clona este repo en GitHub

### 2. Crea una Spotify App

1. Ve a [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Click **Create app**
3. En **Redirect URIs** agrega las dos:
   - `http://localhost:5500/` (para desarrollo local)
   - `https://TU_USUARIO.github.io/spotify-organizer-web/`
4. Activa **Web API**
5. Copia el **Client ID** (el Client Secret NO se necesita)

### 3. Consigue una API key de Last.fm

1. Ve a [last.fm/api/account/create](https://www.last.fm/api/account/create)
2. Crea una cuenta gratuita y copia tu API key

### 4. Edita `config.js`

```js
export const CLIENT_ID      = 'tu_client_id_de_spotify';
export const LASTFM_API_KEY = 'tu_api_key_de_lastfm';
```

> Ambas claves son seguras para commitear — el flujo PKCE no necesita Client Secret,  
> y la API de Last.fm es de solo lectura.

### 5. Habilita GitHub Pages

En **Settings → Pages → Source** selecciona la rama `gh-pages`.  
GitHub Actions deployará automáticamente cada vez que hagas push a `main`.

---

## Cómo funciona

1. El usuario hace login con su cuenta de Spotify (OAuth 2.0 + PKCE)
2. La app lee todas sus Liked Songs
3. Consulta el género de cada artista via Last.fm (con caché en localStorage)
4. Agrupa en los 5 géneros más populares; el resto va a "Otros"
5. Crea o actualiza las playlists `Género - Rock`, `Género - Hip-Hop`, etc.
6. El botón **Refresh** agrega canciones nuevas sin duplicar las existentes

---

## Desarrollo local

Abre `index.html` con cualquier servidor estático (no funciona con `file://`):

```bash
# Con VS Code: instala la extensión "Live Server" y abre con Go Live
# O con Python:
python -m http.server 5500
# O con Node:
npx serve .
```

---

## Estructura

```
spotify-organizer-web/
├── index.html              ← UI (3 pantallas: landing / running / results)
├── style.css               ← Tema Spotify oscuro
├── config.js               ← CLIENT_ID y LASTFM_API_KEY (editar aquí)
├── genre-map.json          ← 34 reglas de normalización de géneros
├── src/
│   ├── main.js             ← Punto de entrada, lógica de UI
│   ├── auth.js             ← OAuth 2.0 + PKCE
│   ├── spotify-api.js      ← Wrapper de Spotify API (fetch)
│   ├── lastfm.js           ← Last.fm API + caché en localStorage
│   ├── genre-normalizer.js ← Clasificador de géneros
│   └── organizer.js        ← Orquestación principal
└── .github/workflows/
    └── deploy.yml          ← Auto-deploy a GitHub Pages
```

---

## Personalizar géneros

Edita `genre-map.json`. Cada regla:

```json
{ "genre": "Metal", "keywords": ["metal", "metalcore", "deathcore"] }
```

El orden importa: las reglas más arriba tienen prioridad.
