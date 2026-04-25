import { CLIENT_ID, LASTFM_API_KEY, REDIRECT_URI } from '../config.js';
import { startLogin, handleCallback, getValidTokens, logout } from './auth.js';
import { Organizer } from './organizer.js';

const PREFIX = 'Género';

// ── DOM helpers ───────────────────────────────────────────────────────────────

const $     = (id) => document.getElementById(id);
const show  = (id) => {
  ['screen-landing', 'screen-running', 'screen-results'].forEach(
    (s) => $(s).classList.toggle('hidden', s !== id)
  );
};

// ── Progress log ──────────────────────────────────────────────────────────────

function log(text, cls = '') {
  const el  = $('progress-log');
  const div = document.createElement('div');
  div.className = 'ln' + (cls ? ' ' + cls : '');
  div.textContent = text;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function setBar(pct) {
  $('progress-bar').style.width = Math.min(100, Math.round(pct)) + '%';
}

function setTitle(msg) {
  $('running-title').textContent = msg;
}

// ── User display ──────────────────────────────────────────────────────────────

function showUser(user) {
  const name = user.display_name || user.id;
  const img  = user.images?.[0]?.url;

  for (const [nameId, avatarId] of [['user-name', 'user-avatar'], ['result-name', 'result-avatar']]) {
    $(nameId).textContent = name;
    if (img) {
      $(avatarId).src = img;
      $(avatarId).classList.remove('hidden');
    }
  }
}

// ── Results screen ────────────────────────────────────────────────────────────

function renderResults(results, stats) {
  const grid = $('results-grid');
  grid.innerHTML = results.map(({ genre, total, added }) => {
    const badge = added > 0
      ? `<span class="badge">+${added} nueva${added !== 1 ? 's' : ''}</span>`
      : `<span class="badge zero">sin cambios</span>`;
    return `
      <div class="result-row">
        <span class="result-genre">Género - ${genre}</span>
        <div class="result-right"><span>${total} canciones</span>${badge}</div>
      </div>`;
  }).join('');

  const { created, reused, added } = stats;
  $('results-stats').textContent =
    `${created} playlist${created !== 1 ? 's' : ''} nueva${created !== 1 ? 's' : ''} · ` +
    `${reused} reutilizada${reused !== 1 ? 's' : ''} · ` +
    `${added} canción${added !== 1 ? 'es' : ''} agregada${added !== 1 ? 's' : ''}`;
}

// ── Error toast ───────────────────────────────────────────────────────────────

function showError(msg) {
  $('toast-msg').textContent = msg;
  $('toast').classList.remove('hidden');
}

// ── Organizer run ─────────────────────────────────────────────────────────────

async function runOrganizer(accessToken) {
  $('progress-log').innerHTML = '';
  setBar(0);
  setTitle('Organizando tu música...');
  show('screen-running');

  const genreRules = await fetch('./genre-map.json').then((r) => r.json());
  const organizer  = new Organizer(accessToken, LASTFM_API_KEY, genreRules);

  function handler(e) {
    const d = e.detail;

    if (d.type === 'user') {
      showUser(d.user);
    }

    if (d.type === 'status') {
      setTitle(d.msg);
      log('→ ' + d.msg, 'hi');
    }

    if (d.type === 'liked-songs') {
      setBar(d.total > 0 ? (d.count / d.total) * 20 : 0);
      // Only update log every 50 songs to keep it readable
      if (d.count % 50 === 0 || d.count === d.total) {
        log(`  Liked songs: ${d.count} / ${d.total}`);
      }
    }

    if (d.type === 'liked-songs-done') {
      log(`  ✓ ${d.count} liked songs leídas`, 'ok');
    }

    if (d.type === 'genres') {
      setBar(20 + (d.total > 0 ? (d.done / d.total) * 55 : 0));
      if (d.done % 20 === 0 || d.done === d.total) {
        const cached = d.done === d.cached ? ` (${d.cached} desde caché)` : '';
        log(`  Géneros: ${d.done} / ${d.total} artistas${cached}`);
      }
    }

    if (d.type === 'genres-done') {
      log(`  ✓ Géneros obtenidos para ${d.total} artistas`, 'ok');
    }

    if (d.type === 'classification-done') {
      setBar(80);
      log('  Top géneros:');
      d.genres.forEach((g) => log(`    ${g.name.padEnd(22, ' ')}  ${g.count} canciones`));
    }

    if (d.type === 'playlist-done') {
      const msg = d.added > 0 ? `+${d.added} nuevas` : 'sin cambios';
      log(`  ${d.isNew ? '[nueva]    ' : '[existente]'} ${PREFIX} - ${d.genre}: ${msg}`, d.added > 0 ? 'ok' : '');
    }

    if (d.type === 'done') {
      window.removeEventListener('organizer:progress', handler);
      setBar(100);
      renderResults(d.results, d.stats);
      showUser(d.user);
      show('screen-results');
    }
  }

  window.addEventListener('organizer:progress', handler);

  try {
    await organizer.run();
  } catch (err) {
    window.removeEventListener('organizer:progress', handler);
    showError(err.message);
    show('screen-landing');
  }
}

// ── Login button setup ────────────────────────────────────────────────────────

function setupLoginBtn(hasSession) {
  const btn = $('btn-login');
  const txt = $('btn-login-text');

  // Remove existing listeners by cloning
  const clone = btn.cloneNode(true);
  btn.parentNode.replaceChild(clone, btn);

  if (hasSession) {
    document.getElementById('btn-login-text').textContent = '▶ Organizar mi música';
    document.getElementById('btn-login').addEventListener('click', async () => {
      const tokens = await getValidTokens(CLIENT_ID).catch(() => null);
      if (tokens) runOrganizer(tokens.access_token);
      else         startLogin(CLIENT_ID, REDIRECT_URI);
    });
  } else {
    document.getElementById('btn-login-text').textContent = 'Iniciar sesión con Spotify';
    document.getElementById('btn-login').addEventListener('click', () =>
      startLogin(CLIENT_ID, REDIRECT_URI)
    );
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  // Handle OAuth callback
  if (window.location.search.includes('code=')) {
    try {
      const tokens = await handleCallback(CLIENT_ID, REDIRECT_URI);
      if (tokens) { await runOrganizer(tokens.access_token); return; }
    } catch (err) {
      showError(err.message);
    }
  }

  // Check for existing session
  const tokens = await getValidTokens(CLIENT_ID).catch(() => null);
  setupLoginBtn(!!tokens);
  show('screen-landing');
}

// ── Logout helpers ────────────────────────────────────────────────────────────

function doLogout() {
  logout();
  setupLoginBtn(false);
  show('screen-landing');
}

$('btn-logout-running').addEventListener('click', doLogout);
$('btn-logout-results').addEventListener('click', doLogout);

$('btn-refresh').addEventListener('click', async () => {
  const tokens = await getValidTokens(CLIENT_ID).catch(() => null);
  if (tokens) runOrganizer(tokens.access_token);
  else        startLogin(CLIENT_ID, REDIRECT_URI);
});

$('toast-close').addEventListener('click', () => $('toast').classList.add('hidden'));

init();
