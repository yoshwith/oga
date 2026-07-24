// ─── Monochrome Home — Background Service Worker ───────────────────────────

const WEATHER_STORAGE_KEY = 'mono_weather';
const MEDIA_STORAGE_KEY  = 'mono_nowplaying';
const CACHE_TTL_MS       = 30 * 60 * 1000; // 30 min

// ─── Inicialización ─────────────────────────────────────────────────────────

function bootstrap() {
  chrome.alarms.create('updateWeather', { periodInMinutes: 30 });
  updateWeather();
  checkNowPlaying(); // detectar música al inicio
}

chrome.runtime.onInstalled.addListener(bootstrap);
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.get('updateWeather', (a) => { if (!a) bootstrap(); });
  updateWeather();
  checkNowPlaying();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'updateWeather') updateWeather();
});

// ─── Clima — Open‑Meteo (sin API key) ───────────────────────────────────────

async function updateWeather() {
  try {
    // 1. Geolocalización por IP
    const ipData = await getLocation();
    if (!ipData) throw new Error('No se pudo obtener ubicación');

    const { lat, lon, city } = ipData;

    // 2. Clima actual
    const wRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current_weather=true&timezone=auto`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!wRes.ok) throw new Error(`Open‑Meteo HTTP ${wRes.status}`);
    const wData = await wRes.json();
    if (!wData.current_weather) throw new Error('Open‑Meteo: sin datos current_weather');

    const weather = {
      temp: Math.round(wData.current_weather.temperature),
      code: wData.current_weather.weathercode,
      city: city || '',
      unit: '°C',
      ts: Date.now()
    };

    await chrome.storage.local.set({ [WEATHER_STORAGE_KEY]: weather });
    console.log('[mono] Weather OK:', weather.temp + '°', weather.city);
  } catch (err) {
    console.error('[mono] Weather error:', err.message);
    const { [WEATHER_STORAGE_KEY]: existing } = await chrome.storage.local.get(WEATHER_STORAGE_KEY);
    if (!existing) {
      await chrome.storage.local.set({
        [WEATHER_STORAGE_KEY]: { temp: null, code: null, city: '', unit: '°C', ts: 0 }
      });
    }
  }
}

// ─── Geolocalización con fallback ───────────────────────────────────────────

async function getLocation() {
  // Intento 1: ip-api.com (HTTP — free)
  try {
    const res = await fetch('http://ip-api.com/json/?fields=status,city,lat,lon,countryCode', {
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success' && data.lat && data.lon) {
        return { lat: data.lat, lon: data.lon, city: data.city || data.countryCode };
      }
    }
  } catch (_) { /* fallback */ }

  // Intento 2: ipapi.co (HTTPS — 1000/día gratis)
  try {
    const res = await fetch('https://ipapi.co/json/', {
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.latitude && data.longitude) {
        return { lat: data.latitude, lon: data.longitude, city: data.city || data.country_code };
      }
    }
  } catch (_) { /* fallback */ }

  return null;
}

// ─── Detección de reproducción musical (Spotify / YT Music / Deezer) ────────

const MUSIC_DOMAINS = {
  'open.spotify.com':  'Spotify',
  'music.youtube.com': 'YouTube Music',
  'deezer.com':        'Deezer',
  'play.google.com':   'Google Play Music',
  'tidal.com':         'Tidal',
  'soundcloud.com':    'SoundCloud',
  'bandcamp.com':      'Bandcamp'
};

function extractTrack(domain, title) {
  if (!title) return null;

  // 1. Quitar sufijo del servicio/platform
  let cleaned = title;

  if (domain === 'open.spotify.com') {
    cleaned = title
      .replace(/\s*[-·–—|]\s*Spotify.*$/i, '')
      .trim();
  } else if (domain === 'music.youtube.com') {
    cleaned = title
      .replace(/\s*[-·–—|]\s*(YouTube\s*Music|Music|YouTube).*$/i, '')
      .trim();
  } else if (domain === 'deezer.com') {
    cleaned = title
      .replace(/\s*[-·–—|]\s*Deezer.*$/i, '')
      .trim();
  } else if (domain === 'tidal.com') {
    cleaned = title.replace(/\s*[-·–—|]\s*Tidal.*$/i, '').trim();
  } else if (domain === 'soundcloud.com') {
    cleaned = title.replace(/\s*[-·–—|]\s*SoundCloud.*$/i, '').trim();
  } else if (domain === 'bandcamp.com') {
    cleaned = title.replace(/\s*[-·–—|]\s*Bandcamp.*$/i, '').trim();
  }

  // 2. Separar canción y artista en el primer separador
  const parts = cleaned.split(/[-·–—|]\s*/);
  const track = (parts[0] || cleaned).trim();
  const artist = parts.length > 1 ? parts.slice(1).join(' - ').trim() : '';

  // 3. Validar
  if (!track || track.length < 2) return null;

  // 4. Rechazar si solo es el nombre del servicio
  const serviceOnly = ['youtube music', 'spotify', 'deezer', 'tidal', 'soundcloud', 'bandcamp', 'music', 'youtube'];
  if (serviceOnly.includes(track.toLowerCase())) return null;

  return { track, artist };
}

async function checkNowPlaying() {
  try {
    const tabs = await chrome.tabs.query({ audible: true });
    let nowPlaying = null;

    for (const tab of tabs) {
      const url = tab.url || '';
      const domain = Object.keys(MUSIC_DOMAINS).find(d => url.includes(d));
      if (!domain) continue;

      const result = extractTrack(domain, tab.title);
      if (result) {
        nowPlaying = {
          track: result.track,
          artist: result.artist,
          service: MUSIC_DOMAINS[domain],
          serviceIcon: getServiceIcon(MUSIC_DOMAINS[domain]),
          url: url,
          ts: Date.now()
        };
        break; // usamos la primera coincidencia audible
      }
    }

    const prev = await chrome.storage.local.get(MEDIA_STORAGE_KEY);
    const prevData = prev[MEDIA_STORAGE_KEY];

    // Solo escribir si encontramos datos válidos
    if (nowPlaying) {
      // Verificar si realmente cambió
      const changed = !prevData ||
        prevData.track !== nowPlaying.track ||
        prevData.artist !== nowPlaying.artist;
      if (changed) {
        await chrome.storage.local.set({ [MEDIA_STORAGE_KEY]: nowPlaying });
      }
    } else if (prevData) {
      // No hay música sonando — limpiar datos anteriores
      await chrome.storage.local.set({ [MEDIA_STORAGE_KEY]: null });
    }
  } catch (err) {
    console.warn('[mono] Media detection failed:', err.message);
  }
}

function getServiceIcon(name) {
  const icons = {
    'Spotify': `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 17.5c3.5-1.5 8.5-1.5 12 0M4 13c4.5-2 11-2 16 0M2 8.5c6-2.5 14-2.5 20 0" stroke-linecap="round"/></svg>`,
    'YouTube Music': `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="5,3 19,12 5,21" fill="currentColor" stroke="none"/></svg>`,
    'Deezer': `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="4" height="2" rx="1"/><rect x="2" y="9" width="4" height="2" rx="1"/><rect x="2" y="14" width="4" height="2" rx="1"/><rect x="2" y="19" width="4" height="2" rx="1"/><rect x="8" y="4" width="4" height="2" rx="1"/><rect x="8" y="9" width="4" height="2" rx="1"/><rect x="8" y="14" width="4" height="2" rx="1"/><rect x="14" y="4" width="4" height="2" rx="1"/><rect x="14" y="9" width="4" height="2" rx="1"/><rect x="14" y="14" width="4" height="2" rx="1"/><rect x="14" y="19" width="4" height="2" rx="1"/></svg>`
  };
  return icons[name] || '';
}

// ─── Eventos de tabs ───────────────────────────────────────────────────────

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.title || changeInfo.audible !== undefined) {
    checkNowPlaying();
  }
});

chrome.tabs.onActivated.addListener(() => {
  checkNowPlaying();
});

// Verificar también cuando se remueve un tab (por si era el único reproductor)
chrome.tabs.onRemoved.addListener(() => {
  checkNowPlaying();
});

// ─── Mensajes desde newtab ──────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'requestWeather') {
    updateWeather().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg.action === 'requestMedia') {
    checkNowPlaying().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
});

// ─── Conexión keep‑alive desde newtab ───────────────────────────────────────

// La página newtab mantiene una conexión de puerto para que el SW
// no se suspenda mientras el usuario tenga la pestaña abierta.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'mono-keepalive') {
    checkNowPlaying(); // detectar música cuando se abre la pestaña
    port.onDisconnect.addListener(() => {}); // cleanup implícito
  }
});
