/* ─── óga — Lógica ─────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  // ─── Keep-alive ──────────────────────────────────────────────────────────────
  const keepAlive = chrome.runtime.connect({ name: 'mono-keepalive' });

  // ─── DOM ─────────────────────────────────────────────────────────────────────
  const $ = s => document.querySelector(s);
  const html = document.documentElement;
  const elClock = $('#clock-time');
  const elDate = $('#date');
  const elGreeting = $('#greeting');
  const elTemp = $('#weather-temp');
  const elCity = $('#weather-city');
  const elWIcon = $('#weather-icon');
  const elNP = $('#nowplaying');
  const elNPTrack = $('#np-track');
  const elPhrase = $('#phrase');
  const elSearch = $('#search-input');
  const elToggle = $('#theme-toggle');
  const elLinks = $('#quick-links');
  const elPomoBtn = $('#pomodoro-btn');
  const elPomoFg = $('#pomodoro-fg');
  const elPomoTime = $('#pomodoro-time');
  const elSettingsBtn = $('#settings-btn');
  const elSettingsOverlay = $('#settings-overlay');
  const elSettingsClose = $('#settings-close');
  const elSettingsBody = $('#settings-body');

  const STORAGE_CLIMA = 'mono_weather';
  const STORAGE_MEDIA = 'mono_nowplaying';
  const STORAGE_LINKS = 'mono_links';
  const STORAGE_SETTINGS = 'mono_settings';
  const THEME_KEY = 'mono_theme';

  const LINK_DEFAULTS = [
    { url: 'https://gmail.com', icon: 'M' },
    { url: 'https://calendar.google.com', icon: 'C' },
    { url: 'https://github.com', icon: 'G' },
  ];

  let currentLang = 'es';

  function detectLang() {
    const nav = (navigator.language || '').slice(0, 2).toLowerCase();
    const map = { es: 'es', en: 'en', ko: 'ko', ja: 'ja', zh: 'zh' };
    return map[nav] || 'es';
  }

  currentLang = detectLang();

  // ═══════════════════════════════════════════════════════════════════════════
  //  1. RELOJ
  // ═══════════════════════════════════════════════════════════════════════════

  function tickClock() {
    const f = new Intl.DateTimeFormat(currentLang === 'es' ? 'es' : currentLang, {
      hour: '2-digit', minute: '2-digit', hour12: false
    });
    elClock.textContent = f.format(new Date());
  }
  tickClock();
  setInterval(tickClock, 1000);

  // ═══════════════════════════════════════════════════════════════════════════
  //  2. FECHA + SALUDO
  // ═══════════════════════════════════════════════════════════════════════════

  function renderDate() {
    const f = new Intl.DateTimeFormat(currentLang, {
      weekday: 'long', day: 'numeric', month: 'long'
    });
    elDate.textContent = f.format(new Date());
  }
  renderDate();
  setInterval(renderDate, 60000);

  function setGreeting() {
    const h = new Date().getHours();
    const g = t('greetings');
    let idx;
    if (h < 6) idx = 0;
    else if (h < 12) idx = 1;
    else if (h < 19) idx = 2;
    else idx = 3;
    elGreeting.textContent = g[idx];
    setTimeout(() => elGreeting.classList.add('show'), 800);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  3. CLIMA
  // ═══════════════════════════════════════════════════════════════════════════

  const WEATHER_SVG = {
    clear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
    partly: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>`,
    cloud: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>`,
    fog: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="10" x2="19" y2="10"/><line x1="5" y1="14" x2="19" y2="14"/><line x1="7" y1="18" x2="17" y2="18"/></svg>`,
    rain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="14" x2="12" y2="20"/><line x1="16" y1="14" x2="16" y2="20"/><line x1="8" y1="14" x2="8" y2="18"/><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>`,
    snow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><line x1="8" y1="16" x2="8.01" y2="16"/><line x1="8" y1="20" x2="8.01" y2="20"/><line x1="12" y1="18" x2="12.01" y2="18"/><line x1="12" y1="22" x2="12.01" y2="22"/><line x1="16" y1="16" x2="16.01" y2="16"/><line x1="16" y1="20" x2="16.01" y2="20"/></svg>`,
    storm: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 16.9A5 5 0 0 0 18 8h-1.26a8 8 0 1 0-11.62 9"/><polyline points="13 11 9 17 13 17 11 22"/></svg>`
  };

  function getWeatherIcon(code) {
    if (code === 0) return WEATHER_SVG.clear;
    if (code <= 2) return WEATHER_SVG.partly;
    if (code <= 3) return WEATHER_SVG.cloud;
    if (code === 45 || code === 48) return WEATHER_SVG.fog;
    if (code >= 51 && code <= 67) return WEATHER_SVG.rain;
    if (code >= 71 && code <= 86) return WEATHER_SVG.snow;
    if (code >= 95) return WEATHER_SVG.storm;
    return WEATHER_SVG.clear;
  }

  function renderWeather(data) {
    if (!data || data.temp === null || data.temp === undefined) {
      elTemp.textContent = '--°'; elCity.textContent = ''; elWIcon.innerHTML = '';
      return;
    }
    elTemp.textContent = `${data.temp}°`;
    elCity.textContent = data.city || '';
    elWIcon.innerHTML = getWeatherIcon(data.code);
  }

  async function loadWeather() {
    const { [STORAGE_CLIMA]: data } = await chrome.storage.local.get(STORAGE_CLIMA);
    renderWeather(data);
    if (!data) chrome.runtime.sendMessage({ action: 'requestWeather' }).catch(() => {});
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  4. NOW PLAYING
  // ═══════════════════════════════════════════════════════════════════════════

  function renderNowPlaying(data) {
    const serviceOnly = ['youtube music', 'spotify', 'deezer', 'tidal', 'soundcloud', 'bandcamp', 'music', 'youtube'];
    if (!data || !data.track || serviceOnly.includes(data.track.toLowerCase())) {
      elNP.classList.add('idle');
      return;
    }
    elNP.classList.remove('idle');
    const display = data.artist ? `${data.track} — ${data.artist}` : data.track;
    elNPTrack.textContent = display;
    elNP.title = display;
  }

  async function loadNowPlaying() {
    // Siempre mostrar ondas al cargar, sin data vieja
    elNP.classList.add('idle');
    chrome.storage.local.set({ [STORAGE_MEDIA]: null }).catch(() => {});
    chrome.runtime.sendMessage({ action: 'requestMedia' }).catch(() => {});
    const read = async () => {
      const { [STORAGE_MEDIA]: data } = await chrome.storage.local.get(STORAGE_MEDIA);
      renderNowPlaying(data);
      return data;
    };
    const data = await read();
    if (!data || !data.track) {
      let tries = 0;
      const retry = setInterval(async () => {
        tries++;
        const d = await read();
        if ((d && d.track) || tries >= 3) clearInterval(retry);
      }, 1000);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  5. FRASE DEL DÍA
  // ═══════════════════════════════════════════════════════════════════════════

  function setPhrase() {
    const phrases = t('phrases');
    if (!Array.isArray(phrases)) return;
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const idx = dayOfYear % phrases.length;
    const p = document.createElement('span');
    p.id = 'phrase-text';
    p.textContent = phrases[idx];
    elPhrase.innerHTML = '';
    elPhrase.appendChild(p);
  }
  // setPhrase se llama desde applyLang() al cargar ajustes

  // ═══════════════════════════════════════════════════════════════════════════
  //  6. LINKS RÁPIDOS
  // ═══════════════════════════════════════════════════════════════════════════

  function domainIcon(url) {
    const d = url.replace(/https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
    return d.charAt(0).toUpperCase();
  }

  let linksData = [];

  function renderLinks(links) {
    elLinks.innerHTML = '';
    linksData = links;

    for (const [i, link] of links.entries()) {
      const wrap = document.createElement('span');
      wrap.className = 'quick-link-wrap';

      const a = document.createElement('a');
      a.className = 'quick-link';
      a.href = link.url;
      a.title = link.url;
      a.textContent = link.icon || domainIcon(link.url);

      const edit = document.createElement('button');
      edit.className = 'quick-link-edit';
      edit.textContent = '✕';
      edit.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        const newUrl = prompt('URL:', link.url);
        if (newUrl && newUrl.trim()) {
          links[i].url = newUrl.trim();
          links[i].icon = domainIcon(newUrl.trim());
          saveLinks(links);
        }
      });

      wrap.appendChild(a);
      wrap.appendChild(edit);
      elLinks.appendChild(wrap);
    }

    const addBtn = document.createElement('button');
    addBtn.className = 'quick-link-add';
    addBtn.textContent = '+';
    addBtn.title = 'Añadir link';
    addBtn.addEventListener('click', () => {
      const url = prompt('URL del sitio:');
      if (url && url.trim()) {
        links.push({ url: url.trim(), icon: domainIcon(url.trim()) });
        saveLinks(links);
      }
    });
    elLinks.appendChild(addBtn);
  }

  async function loadLinks() {
    const { [STORAGE_LINKS]: links } = await chrome.storage.local.get(STORAGE_LINKS);
    renderLinks(links || LINK_DEFAULTS);
  }

  async function saveLinks(links) {
    await chrome.storage.local.set({ [STORAGE_LINKS]: links });
    renderLinks(links);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  7. POMODORO
  // ═══════════════════════════════════════════════════════════════════════════

  function playChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [523, 659].forEach((freq, i) => {
        const o = ctx.createOscillator();
        o.type = 'sine'; o.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.15);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.35);
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + i * 0.15);
        o.stop(ctx.currentTime + i * 0.15 + 0.35);
      });
    } catch (_) {}
  }

  const POMO_MIN = 25;
  const CIRCUM = 2 * Math.PI * 9; // ~56.52
  let pomoState = 'idle';
  let pomoEnd = 0;
  let pomoRaf = null;
  const STORAGE_POMO = 'mono_pomo';

  function pomoFormat(ms) {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  async function pomoPersist(state, end) {
    await chrome.storage.local.set({ [STORAGE_POMO]: { state, end } });
  }

  async function pomoClear() {
    await chrome.storage.local.remove(STORAGE_POMO);
  }

  async function pomoRestore() {
    const { [STORAGE_POMO]: saved } = await chrome.storage.local.get(STORAGE_POMO);
    if (!saved || saved.state !== 'running') return;
    const left = saved.end - Date.now();
    if (left <= 0) {
      // Ya terminó mientras no había pestaña
      pomoState = 'done';
      elPomoTime.textContent = '0:00';
      elPomoFg.style.strokeDashoffset = CIRCUM;
      elPomoBtn.classList.add('flash');
      playChime();
      setTimeout(() => {
        elPomoBtn.classList.remove('flash');
        pomoState = 'idle';
        elPomoTime.textContent = `${POMO_MIN}:00`;
        elPomoFg.style.strokeDashoffset = 0;
        elPomoBtn.classList.remove('running');
        pomoClear();
      }, 3000);
      return;
    }
    // Reanudar
    pomoState = 'running';
    pomoEnd = saved.end;
    elPomoBtn.classList.add('running');
    pomoUpdate();
  }

  function pomoUpdate() {
    const now = Date.now();
    const left = Math.max(0, pomoEnd - now);
    const total = POMO_MIN * 60000;
    const frac = left / total;

    elPomoFg.style.strokeDashoffset = CIRCUM * (1 - frac);
    elPomoTime.textContent = pomoFormat(left);

    if (left <= 0 && pomoState === 'running') {
      pomoState = 'done';
      playChime();
      elPomoBtn.classList.add('flash');
      elPomoTime.textContent = '0:00';
      elPomoFg.style.strokeDashoffset = CIRCUM;
      cancelAnimationFrame(pomoRaf);
      pomoClear();
      setTimeout(() => {
        elPomoBtn.classList.remove('flash');
        pomoState = 'idle';
        elPomoTime.textContent = `${POMO_MIN}:00`;
        elPomoFg.style.strokeDashoffset = 0;
        elPomoBtn.classList.remove('running');
      }, 3000);
      return;
    }

    pomoRaf = requestAnimationFrame(pomoUpdate);
  }

  function pomoToggle() {
    if (pomoState === 'idle' || pomoState === 'done') {
      pomoState = 'running';
      pomoEnd = Date.now() + POMO_MIN * 60000;
      elPomoBtn.classList.add('running');
      pomoPersist('running', pomoEnd);
      pomoUpdate();
    } else if (pomoState === 'running') {
      cancelAnimationFrame(pomoRaf);
      pomoState = 'idle';
      elPomoBtn.classList.remove('running');
      elPomoTime.textContent = `${POMO_MIN}:00`;
      elPomoFg.style.strokeDashoffset = 0;
      pomoClear();
    }
  }

  elPomoBtn.addEventListener('click', pomoToggle);

  // Sincronizar entre pestañas
  chrome.storage.onChanged.addListener((changes) => {
    if (changes[STORAGE_POMO]) {
      const saved = changes[STORAGE_POMO].newValue;
      if (!saved || saved.state !== 'running') {
        // Alguien canceló o terminó en otra pestaña
        cancelAnimationFrame(pomoRaf);
        pomoState = 'idle';
        elPomoBtn.classList.remove('running', 'flash');
        elPomoTime.textContent = `${POMO_MIN}:00`;
        elPomoFg.style.strokeDashoffset = 0;
      } else if (saved.state === 'running' && pomoState !== 'running') {
        // Otra pestaña inició el timer
        pomoState = 'running';
        pomoEnd = saved.end;
        elPomoBtn.classList.add('running');
        pomoUpdate();
      }
    }
  });

  // Restaurar estado al cargar la página
  pomoRestore();

  // ═══════════════════════════════════════════════════════════════════════════
  //  8. TEMA
  // ═══════════════════════════════════════════════════════════════════════════

  function setTheme(mode) {
    html.className = mode;
    try { localStorage.setItem(THEME_KEY, mode); } catch (_) {}
  }

  function toggleTheme() {
    setTheme(html.className === 'light' ? 'dark' : 'light');
  }

  function loadTheme() {
    const saved = (() => {
      try { return localStorage.getItem(THEME_KEY); } catch (_) { return null; }
    })();
    if (saved === 'light' || saved === 'dark') { setTheme(saved); return; }
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(prefersDark ? 'dark' : 'light');
  }

  elToggle.addEventListener('click', toggleTheme);

  // ─── Búsqueda ───────────────────────────────────────────────────────────────

  elSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = elSearch.value.trim();
      if (q) {
        window.location.href = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
        elSearch.blur();
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      elSearch.focus();
    }
  });

  // ─── Traducciones ────────────────────────────────────────────────────────────

  const LANG = {
    es: {
      name: 'Español', settings: 'ajustes', search: 'Buscar en la web…',
      always: 'siempre', language: 'Idioma',
      greetings: ['buena madrugada', 'buenos días', 'buenas tardes', 'buenas noches'],
      features: {
        weather: ['Clima', 'temperatura y ciudad'],
        date: ['Fecha y saludo', 'día y saludo según la hora'],
        search: ['Búsqueda', 'barra de búsqueda Google'],
        links: ['Links rápidos', 'accesos directos'],
        nowplaying: ['Now playing', 'canción en reproducción'],
        phrase: ['Frase del día', 'texto inspirador diario'],
        pomodoro: ['Pomodoro', 'temporizador de enfoque'],
      },
      clock: 'Reloj',
      phrases: [
        'menos es más', 'un día a la vez', 'la constancia vence',
        'empieza donde estás', 'lo simple es poderoso',
        'primero lo primero', 'la atención es el nuevo lujo',
        'una cosa a la vez', 'el silencio también habla',
        'menos ruido, más claridad', 'hazlo con calma',
        'la disciplina es libertad', 'respira',
        'sin prisa pero sin pausa', 'el enfoque es tu superpoder',
        'hoy es un buen día', 'menos cosas, más vida',
        'haz espacio para lo importante', 'ordena tu mente',
        'más presencia, menos pantallas',
      ],
    },
    en: {
      name: 'English', settings: 'settings', search: 'Search the web…',
      always: 'always', language: 'Language',
      greetings: ['early', 'good morning', 'good afternoon', 'good evening'],
      features: {
        weather: ['Weather', 'temperature and city'],
        date: ['Date & greeting', 'day and time-based greeting'],
        search: ['Search', 'Google search bar'],
        links: ['Quick links', 'shortcuts'],
        nowplaying: ['Now playing', 'current track'],
        phrase: ['Daily phrase', 'inspirational text'],
        pomodoro: ['Pomodoro', 'focus timer'],
      },
      clock: 'Clock',
      phrases: [
        'less is more', 'one day at a time', 'consistency wins',
        'start where you are', 'simple is powerful',
        'first things first', 'focus is the new luxury',
        'one thing at a time', 'silence speaks volumes',
        'less noise, more clarity', 'take it easy',
        'discipline equals freedom', 'breathe',
        'slow is smooth, smooth is fast',
        'today is a good day', 'own your attention',
        'make space for what matters', 'clear mind, clear life',
        'be present', 'progress not perfection',
      ],
    },
    ko: {
      name: '한국어', settings: '설정', search: '웹 검색…',
      always: '항상', language: '언어',
      greetings: ['새벽', '좋은 아침', '좋은 오후', '좋은 저녁'],
      features: {
        weather: ['날씨', '기온과 도시'],
        date: ['날짜 및 인사', '요일과 시간별 인사'],
        search: ['검색', 'Google 검색창'],
        links: ['바로가기', '즐겨찾는 링크'],
        nowplaying: ['재생 중', '현재 곡'],
        phrase: ['오늘의 문구', '영감을 주는 글'],
        pomodoro: ['뽀모도로', '집중 타이머'],
      },
      clock: '시계',
      phrases: [
        '적게 할수록 더 얻는다', '하루하루 살자', '꾸준함이 이긴다',
        '지금 있는 곳에서 시작하라', '단순함이 강하다',
        '가장 중요한 일부터', '집중이 가장 큰 자산이다',
        '한 번에 한 가지씩', '침묵도 말한다',
        '적은 소음, 더 선명하게', '침착하게 해라',
        '규율이 곧 자유다', '심호흡',
        '서두르지 말고 멈추지 말자',
        '오늘도 좋은 날이다', '너의 주의력을 가져라',
        '중요한 것을 위한 공간을', '마음 정리, 삶 정리',
        '지금 여기에 있어라', '완벽보다 진보',
      ],
    },
    ja: {
      name: '日本語', settings: '設定', search: 'ウェブ検索…',
      always: '常時', language: '言語',
      greetings: ['早朝', 'おはよう', 'こんにちは', 'こんばんは'],
      features: {
        weather: ['天気', '気温と都市'],
        date: ['日付と挨拶', '曜日と時間帯の挨拶'],
        search: ['検索', 'Google検索バー'],
        links: ['クイックリンク', 'ショートカット'],
        nowplaying: ['再生中', '現在の曲'],
        phrase: ['今日の言葉', '日々のインスピレーション'],
        pomodoro: ['ポモドーロ', '集中タイマー'],
      },
      clock: '時計',
      phrases: [
        '少ないほうが豊か', '一日一歩', '継続は力なり',
        '今いる場所から始めよ', 'シンプルが最強',
        'まず一番大事なことから', '注意力こそ新しい贅沢',
        '一度にひとつのこと', '沈黙も語る',
        '騒音を減らし clarity を', '落ち着いてやろう',
        '規律が自由を生む', '深呼吸',
        '急がず、しかし止まらず',
        '今日もいい日だ', '自分の注意力を大切に',
        '大事なもののための空間を', '心を整えれば人生が整う',
        '今ここにいる', '完璧より前進',
      ],
    },
    zh: {
      name: '中文', settings: '设置', search: '搜索网页…',
      always: '始终', language: '语言',
      greetings: ['凌晨', '早上好', '下午好', '晚上好'],
      features: {
        weather: ['天气', '温度和城市'],
        date: ['日期与问候', '星期和时段问候'],
        search: ['搜索', 'Google搜索栏'],
        links: ['快捷链接', '快捷方式'],
        nowplaying: ['正在播放', '当前曲目'],
        phrase: ['每日一语', '每日灵感'],
        pomodoro: ['番茄钟', '专注计时器'],
      },
      clock: '时钟',
      phrases: [
        '少即是多', '一天一步', '持之以恒',
        '从你所在的地方开始', '简单就是力量',
        '要事第一', '专注是新的奢侈品',
        '一次只做一件事', '沉默也是一种语言',
        '少些喧嚣，多些清晰', '从容行事',
        '自律即自由', '深呼吸',
        '不疾不徐，稳步前行',
        '今天是美好的一天', '守护你的注意力',
        '为重要的事物留出空间', '整理心灵，整理生活',
        '活在当下', '进步胜于完美',
      ],
    },
  };

  function t(key) {
    const parts = key.split('.');
    let val = LANG[currentLang];
    for (const p of parts) val = val && val[p];
    return val !== undefined && val !== null ? val : key;
  }

  function applyLang(lang) {
    currentLang = lang;
    elSearch.placeholder = t('search');
    setGreeting();
    renderDate();
    setPhrase();
    // La UI del panel se reconstruye al abrirlo
  }

  // ─── Ajustes ────────────────────────────────────────────────────────────────

  const FEATURES = [
    { id: 'weather', el: $('#weather') },
    { id: 'date', el: $('#greeting-area') },
    { id: 'search', el: $('#search-bar') },
    { id: 'links', el: $('#quick-links') },
    { id: 'nowplaying', el: $('#nowplaying') },
    { id: 'phrase', el: $('#phrase') },
    { id: 'pomodoro', el: document.querySelector('.pomo-group') },
  ];

  function applySettings(settings) {
    for (const f of FEATURES) {
      if (f.el) f.el.classList.toggle('feature-hidden', !settings[f.id]);
    }
    if (settings.lang && settings.lang !== currentLang) applyLang(settings.lang);
  }

  function buildSettingsPanel(settings) {
    elSettingsBody.innerHTML = '';

    // ── Idioma (dropdown redondeado)
    const langRow = document.createElement('div');
    langRow.className = 'setting-row';
    langRow.style.cssText = 'padding-bottom:4px';
    langRow.innerHTML = `<div class="setting-label" style="text-transform:uppercase;letter-spacing:0.04em;font-size:11px;color:var(--fg-muted)">${t('language')}</div>`;
    elSettingsBody.appendChild(langRow);

    const dd = document.createElement('div');
    dd.style.cssText = 'margin:0 20px 10px;position:relative';
    dd.innerHTML = `
      <button id="lang-btn" style="width:100%;padding:10px 14px;border-radius:24px;border:1px solid var(--border);background:var(--toggle-bg);color:var(--fg);font-family:var(--font);font-size:14px;font-weight:400;cursor:pointer;display:flex;align-items:center;justify-content:space-between;transition:background var(--transition)">
        <span>${LANG[settings.lang || currentLang].name}</span>
        <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 5l3 3 3-3"/></svg>
      </button>
      <div id="lang-options" style="display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:var(--bg);border:1px solid var(--border);border-radius:24px;overflow:hidden;z-index:10">
        ${['es','en','ko','ja','zh'].map(code => `
          <button data-lang="${code}" style="width:100%;padding:10px 14px;border:none;background:${code === (settings.lang || currentLang) ? 'var(--toggle-bg)' : 'transparent'};color:var(--fg);font-family:var(--font);font-size:14px;font-weight:${code === (settings.lang || currentLang) ? '500' : '400'};cursor:pointer;display:flex;align-items:center;justify-content:space-between;transition:background var(--transition);text-align:left"
            onmouseover="this.style.background='var(--toggle-bg)'" onmouseout="this.style.background='${code === (settings.lang || currentLang) ? 'var(--toggle-bg)' : 'transparent'}'">
            <span>${LANG[code].name}</span>
            ${code === (settings.lang || currentLang) ? '<svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 7l3 3 5-5"/></svg>' : ''}
          </button>
        `).join('')}
      </div>
    `;

    const langBtn = dd.querySelector('#lang-btn');
    const langOpts = dd.querySelector('#lang-options');

    function toggleDropdown(e) {
      e.stopPropagation();
      const isOpen = langOpts.style.display === 'block';
      langOpts.style.display = isOpen ? 'none' : 'block';
    }

    langBtn.addEventListener('click', toggleDropdown);

    langOpts.querySelectorAll('button[data-lang]').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.dataset.lang;
        settings.lang = code;
        chrome.storage.local.set({ [STORAGE_SETTINGS]: settings });
        applyLang(code);
        buildSettingsPanel(settings);
      });
    });

    document.addEventListener('click', () => { langOpts.style.display = 'none'; }, { once: true });

    // Evitar que el click en el dropdown cierre el overlay
    dd.addEventListener('click', e => e.stopPropagation());

    elSettingsBody.appendChild(dd);

    // ── Separador
    const sep = document.createElement('div');
    sep.style.cssText = 'height:1px;background:var(--border);margin:4px 20px 8px';
    elSettingsBody.appendChild(sep);

    // ── Reloj (siempre visible)
    const clockRow = document.createElement('div');
    clockRow.className = 'setting-row';
    clockRow.innerHTML = `<div class="setting-label">${t('clock')}<span class="setting-mandatory" style="margin-left:6px">${t('always')}</span></div>`;
    elSettingsBody.appendChild(clockRow);

    // ── Features toggleables
    for (const f of FEATURES) {
      const r = document.createElement('div');
      r.className = 'setting-row';
      const [label, desc] = t('features.' + f.id);
      r.innerHTML = `
        <div class="setting-label">${label}<small>${desc}</small></div>
        <div class="toggle ${settings[f.id] ? 'on' : ''}" data-feature="${f.id}">
          <div class="toggle-knob"></div>
        </div>
      `;
      r.querySelector('.toggle').addEventListener('click', () => {
        const newVal = !settings[f.id];
        settings[f.id] = newVal;
        r.querySelector('.toggle').classList.toggle('on', newVal);
        applySettings(settings);
        chrome.storage.local.set({ [STORAGE_SETTINGS]: settings });
      });
      elSettingsBody.appendChild(r);
    }
  }

  async function loadSettings() {
    const { [STORAGE_SETTINGS]: raw } = await chrome.storage.local.get(STORAGE_SETTINGS);
    const defaults = {};
    for (const f of FEATURES) defaults[f.id] = true;
    defaults.lang = detectLang();
    const settings = { ...defaults, ...raw };
    applySettings(settings);
    if (settings.lang) applyLang(settings.lang);
    buildSettingsPanel(settings);
  }

  elSettingsBtn.addEventListener('click', () => {
    elSettingsOverlay.classList.add('open');
    loadSettings(); // refrescar panel por si cambió externamente
  });

  function closeSettings() {
    elSettingsOverlay.classList.remove('open');
  }

  elSettingsClose.addEventListener('click', closeSettings);
  elSettingsOverlay.addEventListener('click', (e) => {
    if (e.target === elSettingsOverlay) closeSettings();
  });

  // ─── Storage changes ────────────────────────────────────────────────────────

  chrome.storage.onChanged.addListener((changes) => {
    if (changes[STORAGE_CLIMA]) renderWeather(changes[STORAGE_CLIMA].newValue);
    if (changes[STORAGE_MEDIA]) renderNowPlaying(changes[STORAGE_MEDIA].newValue);
  });

  // ─── Init ───────────────────────────────────────────────────────────────────

  loadTheme();
  loadWeather();
  loadNowPlaying();
  loadLinks();
  loadSettings();

  setInterval(loadWeather, 300000);
  setInterval(loadNowPlaying, 5000);

})();
