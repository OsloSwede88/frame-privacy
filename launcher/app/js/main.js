/* Frame launcher: a dock of app cards over a wallpaper, with an editable dock, clock/date
   options and weather. Installed apps are read with tizen.application.getAppsInfo(); the dock
   the viewer builds is saved in localStorage and survives restarts. In a desktop browser
   (no `tizen`) a small fake app list is used and launches only show a toast.
   Catalog/defaults: js/apps.js. Wallpapers: js/wallpapers.js (see tools/wallpapers.sh). */
(function () {
  'use strict';

  var GLYPHS = window.LAUNCHER_GLYPHS || {};
  var CLS = window.LAUNCHER_CLASS || {};
  var GLYPH_CLS = window.LAUNCHER_GLYPH_CLASS || {};
  var STREAM_IDS = window.LAUNCHER_STREAMING_IDS || {};
  var STREAM_WORDS = window.LAUNCHER_STREAMING_WORDS || [];
  var DEFAULT_DOCK = window.LAUNCHER_DEFAULT_DOCK || [];
  var LOCS = window.LAUNCHER_LOCATIONS || [{ name: 'Oslo', lat: 59.9139, lon: 10.7522 }];
  var WALLS = window.WALLPAPERS || [];

  var AUTO = [
    { label: 'Av', ms: 0, msg: 'Automatisk bytte er av' },
    { label: '15 min', ms: 15 * 60000, msg: 'Bytter bakgrunn hvert kvarter' },
    { label: '1 time', ms: 60 * 60000, msg: 'Bytter bakgrunn hver time' },
    { label: '1 dag', ms: 24 * 60 * 60000, msg: 'Bytter bakgrunn hver dag' }
  ];
  var THUMB_COLS = 5;
  var DAYS = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
  var MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august',
    'september', 'oktober', 'november', 'desember'];

  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009, ESC: 27 };
  var onTV = typeof window.tizen !== 'undefined';

  var $ = function (id) { return document.getElementById(id); };
  var appsEl = $('apps'), settingsEl = $('settings'), wallsEl = $('walls'), dockeditEl = $('dockedit'),
      toastEl = $('toast');
  var topBtns = [$('wall-btn'), $('settings-btn')];

  var view = 'home';           // 'home' | 'settings' | 'walls' | 'dockedit'
  var row = 'dock';            // home: 'dock' or 'top'
  var index = 0;               // home dock index
  var topIndex = 0;            // 0 = wallpaper, 1 = settings
  var setIndex = 0;            // settings menu index
  var catIndex = 0;            // dock editor index
  var pick = { row: 1, col: 0 };
  var toastTimer, wxTimer;

  // ---- per-viewer settings (localStorage; the TV keeps it across restarts) ----
  function load(key, fallback) {
    try { var v = localStorage.getItem('fl.' + key); return v === null ? fallback : JSON.parse(v); }
    catch (e) { return fallback; }
  }
  function save(key, value) { try { localStorage.setItem('fl.' + key, JSON.stringify(value)); } catch (e) {} }

  var state = {
    wall: Math.min(load('wall', 0), Math.max(0, WALLS.length - 1)),
    auto: load('auto', 0),
    switchedAt: load('switchedAt', Date.now()),
    dock: load('dock', null),            // array of app ids, or null = use default
    clock24: load('clock24', true),
    seconds: load('seconds', false),
    showDate: load('showDate', true),
    weatherOn: load('weatherOn', true),
    loc: Math.min(load('loc', 0), Math.max(0, LOCS.length - 1))
  };

  var installed = [];   // [{id,name}] all launchable apps on the TV
  var APPS = [];        // the dock cards actually shown

  // ---- build the dock cards from the saved (or default) id list ----
  function nameFor(id) {
    for (var i = 0; i < installed.length; i++) if (installed[i].id === id) return installed[i].name;
    return id;
  }
  function installedHas(id) { return installed.some(function (a) { return a.id === id; }); }
  // A streaming app's name may contain a known word (catches services whose id we don't list).
  function wordMatch(name) {
    var n = (name || '').toLowerCase();
    for (var i = 0; i < STREAM_WORDS.length; i++) if (n.indexOf(STREAM_WORDS[i].word) >= 0) return STREAM_WORDS[i];
    return null;
  }
  function glyphFor(id) { if (GLYPHS[id]) return GLYPHS[id]; var m = wordMatch(nameFor(id)); return m ? m.glyph : null; }
  function clsFor(id) { if (CLS[id]) return CLS[id]; var g = glyphFor(id); return (g && GLYPH_CLS[g]) || ''; }
  function isStreaming(id) { return !!STREAM_IDS[id] || !!wordMatch(nameFor(id)); }
  // Two installed apps that resolve to the same logo (e.g. the two YouTube apps) are one entry.
  function dedupeKey(id) { var g = glyphFor(id); return g ? 'g:' + g : 'n:' + (nameFor(id) || id).toLowerCase(); }
  function dedupeIds(ids) {
    var seen = {}, out = [];
    ids.forEach(function (id) { var k = dedupeKey(id); if (seen[k]) return; seen[k] = 1; out.push(id); });
    return out;
  }

  function buildApps() {
    var ids = (state.dock && state.dock.length) ? state.dock.slice() : DEFAULT_DOCK.slice();
    // keep only ids that are installed (once we know what is installed), else keep as-is for browser
    if (installed.length) ids = ids.filter(installedHas);
    ids = dedupeIds(ids);
    APPS = ids.map(function (id) {
      return { id: id, appId: id, name: nameFor(id), glyph: glyphFor(id), cls: clsFor(id) };
    });
    renderApps();
  }
  function renderApps() {
    appsEl.innerHTML = '';
    APPS.forEach(function (app) {
      var li = document.createElement('li');
      li.className = 'app' + (app.cls ? ' ' + app.cls : '');
      li.innerHTML = '<div class="cell"></div><span class="label"></span>';
      li.querySelector('.label').textContent = app.name;
      if (app.glyph) {
        var img = new Image();
        img.alt = app.name;
        img.onload = function () { if (li.querySelector('.label')) li.replaceChild(img, li.querySelector('.label')); };
        img.src = 'img/glyph/' + app.glyph + '.png';
      }
      app.el = li;
      appsEl.appendChild(li);
    });
    if (index >= APPS.length) index = Math.max(0, APPS.length - 1);
    alignGlass();
  }

  // Line the pre-blurred wallpaper up with the real one behind every glass panel.
  function alignGlass() {
    var stage = $('stage').getBoundingClientRect();
    Array.prototype.forEach.call(document.querySelectorAll('.glass'), function (g) {
      var r = g.getBoundingClientRect();
      if (!r.width) return;
      g.style.backgroundPosition = (stage.left - r.left) + 'px ' + (stage.top - r.top) + 'px';
    });
  }

  // ---- clock + date ----
  function two(n) { return (n < 10 ? '0' : '') + n; }
  function tick() {
    var d = new Date();
    var h = d.getHours(), ampm = '';
    if (!state.clock24) { ampm = h < 12 ? ' AM' : ' PM'; h = h % 12; if (h === 0) h = 12; }
    var t = (state.clock24 ? two(h) : h) + ':' + two(d.getMinutes());
    if (state.seconds) t += ':' + two(d.getSeconds());
    $('time').textContent = t + ampm;
    var dateEl = $('date');
    if (state.showDate) { dateEl.style.display = 'block'; var ds = DAYS[d.getDay()] + ' ' + d.getDate() + '. ' + MONTHS[d.getMonth()]; dateEl.textContent = ds.charAt(0).toUpperCase() + ds.slice(1); }
    else { dateEl.style.display = 'none'; }

    var auto = AUTO[state.auto];
    if (WALLS.length && auto && auto.ms && Date.now() - state.switchedAt >= auto.ms) {
      showWall((state.wall + 1) % WALLS.length);
    }
  }

  // ---- weather (Open-Meteo, no key) ----
  // WMO weather code -> a small icon name + Norwegian label.
  function wx(code) {
    if (code === 0) return { i: 'sun', t: 'Klart' };
    if (code <= 2) return { i: 'partly', t: 'Lettskyet' };
    if (code === 3) return { i: 'cloud', t: 'Skyet' };
    if (code <= 48) return { i: 'fog', t: 'Takete' };
    if (code <= 67) return { i: 'rain', t: 'Regn' };
    if (code <= 77) return { i: 'snow', t: 'Snø' };
    if (code <= 82) return { i: 'rain', t: 'Regnbyger' };
    if (code <= 86) return { i: 'snow', t: 'Snøbyger' };
    return { i: 'storm', t: 'Torden' };
  }
  var WX_SVG = {
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.5 4.5l2 2M17.5 17.5l2 2M19.5 4.5l-2 2M6.5 17.5l-2 2"/></g></svg>',
    partly: '<svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3.4" fill="currentColor"/><g stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M8 1.8v2M1.8 8h2M3.8 3.8l1.4 1.4M12.2 3.8l-1.4 1.4"/></g><path d="M9 17.5a3.5 3.5 0 0 1 .6-7 5 5 0 0 1 9.5 1.6 3 3 0 0 1-.6 5.9z" fill="currentColor"/></svg>',
    cloud: '<svg viewBox="0 0 24 24"><path d="M7 18.5a4 4 0 0 1-.4-8 6 6 0 0 1 11.6 1.7 3.6 3.6 0 0 1-.7 7z" fill="currentColor"/></svg>',
    fog: '<svg viewBox="0 0 24 24"><path d="M7 14.5a4 4 0 0 1-.4-8 6 6 0 0 1 11.6 1.7 3.6 3.6 0 0 1-.7 7z" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 18.5h16M6 21.5h12"/></g></svg>',
    rain: '<svg viewBox="0 0 24 24"><path d="M7 13.5a4 4 0 0 1-.4-8 6 6 0 0 1 11.6 1.7 3.6 3.6 0 0 1-.7 7z" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 17l-1 3M13 17l-1 3M18 17l-1 3"/></g></svg>',
    snow: '<svg viewBox="0 0 24 24"><path d="M7 13.5a4 4 0 0 1-.4-8 6 6 0 0 1 11.6 1.7 3.6 3.6 0 0 1-.7 7z" fill="currentColor"/><g fill="currentColor"><circle cx="8" cy="19" r="1.2"/><circle cx="13" cy="19" r="1.2"/><circle cx="17" cy="19" r="1.2"/></g></svg>',
    storm: '<svg viewBox="0 0 24 24"><path d="M7 13.5a4 4 0 0 1-.4-8 6 6 0 0 1 11.6 1.7 3.6 3.6 0 0 1-.7 7z" fill="currentColor"/><path d="M12 15l-2 4h2l-1 3 3-4h-2z" fill="currentColor"/></svg>'
  };
  function fetchWeather() {
    if (!state.weatherOn) { $('weather').hidden = true; return; }
    var loc = LOCS[state.loc] || LOCS[0];
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + loc.lat + '&longitude=' + loc.lon +
      '&current=temperature_2m,weather_code&timezone=auto';
    try {
      var x = new XMLHttpRequest();
      x.open('GET', url, true);
      x.timeout = 12000;
      x.onreadystatechange = function () {
        if (x.readyState !== 4) return;
        if (x.status < 200 || x.status >= 300) return;   // keep last shown value on failure
        try {
          var c = JSON.parse(x.responseText).current;
          var info = wx(c.weather_code);
          $('wx-icon').innerHTML = WX_SVG[info.i] || '';
          $('wx-temp').textContent = Math.round(c.temperature_2m) + '°';
          $('wx-place').textContent = loc.name;
          $('weather').hidden = false;
        } catch (e) {}
      };
      x.send();
    } catch (e) {}
  }
  function scheduleWeather() {
    clearInterval(wxTimer);
    if (state.weatherOn) { fetchWeather(); wxTimer = setInterval(fetchWeather, 30 * 60000); }
    else $('weather').hidden = true;
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.className = 'show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = ''; }, 2600);
  }

  // ---- wallpaper: the new image fades in over the old one, then the old layer is cleared. ----
  var front = $('wall-a'), back = $('wall-b'), wallReq = 0;
  function showWall(i, instant) {
    if (!WALLS.length) return;
    var w = WALLS[i], req = ++wallReq;
    state.wall = i;
    save('wall', i);
    if (!instant) { state.switchedAt = Date.now(); save('switchedAt', state.switchedAt); }
    var img = new Image();
    img.onload = function () {
      if (req !== wallReq) return;
      var incoming = back, outgoing = front;
      incoming.style.backgroundImage = 'url(img/wall/' + w.id + '.jpg)';
      incoming.style.zIndex = 1; outgoing.style.zIndex = 0;
      incoming.className = 'wall' + (instant ? ' instant' : '');
      void incoming.offsetWidth;
      incoming.className = 'wall on' + (instant ? ' instant' : '');
      front = incoming; back = outgoing;
      setTimeout(function () { if (req === wallReq) outgoing.className = 'wall instant'; }, instant ? 0 : 1500);
      var blur = 'url(img/wall/' + w.id + '-blur.jpg)';
      Array.prototype.forEach.call(document.querySelectorAll('.glass'), function (g) { g.style.backgroundImage = blur; });
    };
    img.src = 'img/wall/' + w.id + '.jpg';
  }

  // ---- focus paint (home) ----
  function paint() {
    APPS.forEach(function (a, i) { a.el.classList.toggle('focused', view === 'home' && row === 'dock' && i === index); });
    topBtns.forEach(function (b, i) { b.classList.toggle('focused', view === 'home' && row === 'top' && i === topIndex); });
  }

  // ---- installed apps ----
  function resolve(done) {
    if (!onTV) {
      // Browser preview: fake a small installed list from the catalog + a couple of extras.
      installed = DEFAULT_DOCK.map(function (id) { return { id: id, name: (GLYPHS[id] || id) }; });
      installed.push({ id: 'x.disneyplus', name: 'Disney+' });
      installed.push({ id: 'x.max', name: 'Max' });
      installed.push({ id: 'x.viaplay', name: 'Viaplay' });
      installed.push({ id: 'x.skyshowtime', name: 'SkyShowtime' });
      installed.push({ id: 'x.paramount', name: 'Paramount+' });
      installed.push({ id: 'x.tv2play', name: 'TV 2 Play' });
      installed.push({ id: 'x.spotify', name: 'Spotify' });
      installed.push({ id: 'org.tizen.settings', name: 'Innstillinger' });   // non-streaming: must be hidden
      return done();
    }
    try {
      tizen.application.getAppsInfo(function (list) {
        installed = list.filter(function (info) { return info.show !== false; })
          .map(function (info) { return { id: info.id, name: info.name || info.id }; })
          .sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; });
        done();
      }, function (err) { toast('Fikk ikke applisten: ' + err.message); done(); });
    } catch (e) { toast('Fikk ikke applisten: ' + e.message); done(); }
  }

  function launch(app) {
    if (!app.appId) return toast(app.name + ' er ikke installert');
    if (!onTV) return toast('Ville åpnet ' + app.name + ' (' + app.appId + ')');
    toast('Åpner ' + app.name + '...');
    try {
      tizen.application.launch(app.appId, function () {},
        function (err) { toast(app.name + ': ' + err.name + ' ' + err.message); });
    } catch (e) { toast(app.name + ': ' + e.message); }
  }

  // ---- settings menu ----
  var setItems = ['dock', 'clock', 'seconds', 'date', 'weather', 'loc'];
  function openSettings() {
    view = 'settings'; setIndex = 0; settingsEl.hidden = false;
    paintSettings(); alignGlass();
  }
  function paintSettings() {
    $('s-clock').textContent = state.clock24 ? '24-timer' : '12-timer';
    $('s-seconds').textContent = state.seconds ? 'På' : 'Av';
    $('s-date').textContent = state.showDate ? 'På' : 'Av';
    $('s-weather').textContent = state.weatherOn ? 'På' : 'Av';
    $('s-loc').textContent = (LOCS[state.loc] || LOCS[0]).name;
    var items = $('setmenu').children;
    for (var i = 0; i < items.length; i++) items[i].classList.toggle('focused', i === setIndex);
  }
  function settingsKey(k) {
    if (k === KEY.UP) setIndex = Math.max(0, setIndex - 1);
    else if (k === KEY.DOWN) setIndex = Math.min(setItems.length - 1, setIndex + 1);
    else if (k === KEY.BACK || k === KEY.ESC) { settingsEl.hidden = true; view = 'home'; paint(); return; }
    else {
      var act = setItems[setIndex];
      if (act === 'loc' && (k === KEY.LEFT || k === KEY.RIGHT)) {
        state.loc = (state.loc + (k === KEY.RIGHT ? 1 : LOCS.length - 1)) % LOCS.length;
        save('loc', state.loc); scheduleWeather();
      } else if (k === KEY.ENTER) {
        if (act === 'dock') { openDockEdit(); return; }
        else if (act === 'clock') { state.clock24 = !state.clock24; save('clock24', state.clock24); tick(); }
        else if (act === 'seconds') { state.seconds = !state.seconds; save('seconds', state.seconds); tick(); }
        else if (act === 'date') { state.showDate = !state.showDate; save('showDate', state.showDate); tick(); }
        else if (act === 'weather') { state.weatherOn = !state.weatherOn; save('weatherOn', state.weatherOn); scheduleWeather(); }
        else if (act === 'loc') { state.loc = (state.loc + 1) % LOCS.length; save('loc', state.loc); scheduleWeather(); }
      }
    }
    paintSettings();
  }

  // ---- dock editor (streaming apps only, deduped by logo) ----
  var catalog = [];   // [{id,name}] the streaming apps offered in the editor
  function buildCatalog() {
    var seen = {};
    catalog = installed.filter(function (a) { return isStreaming(a.id); })
      .filter(function (a) { var k = dedupeKey(a.id); if (seen[k]) return false; seen[k] = 1; return true; });
  }
  function openDockEdit() {
    view = 'dockedit'; settingsEl.hidden = true; dockeditEl.hidden = false;
    buildCatalog();
    // Materialise and clean the saved dock: installed only, no duplicate logos.
    if (!state.dock) state.dock = dedupeIds(DEFAULT_DOCK.filter(installedHas));
    else if (installed.length) state.dock = dedupeIds(state.dock.filter(installedHas));
    catIndex = 0; renderCatalog(); alignGlass();
  }
  // Match the dock by logo, not exact id, so an old saved dock still lines up with the catalog.
  function dockPos(id) {
    var k = dedupeKey(id);
    for (var i = 0; i < state.dock.length; i++) if (dedupeKey(state.dock[i]) === k) return i;
    return -1;
  }
  function renderCatalog() {
    var ul = $('appcatalog');
    ul.innerHTML = '';
    catalog.forEach(function (a, i) {
      var li = document.createElement('li');
      var pos = dockPos(a.id);
      li.className = 'catrow' + (pos >= 0 ? ' on' : '') + (i === catIndex ? ' focused' : '');
      li.innerHTML = '<span class="cat-check"></span><span class="cat-name"></span><span class="cat-pos"></span>';
      li.querySelector('.cat-name').textContent = a.name;
      li.querySelector('.cat-pos').textContent = pos >= 0 ? (pos + 1) + '' : '';
      ul.appendChild(li);
      if (i === catIndex) li.scrollIntoView({ block: 'nearest' });
    });
    if (!catalog.length) ul.innerHTML = '<li class="catrow empty"><span class="cat-name">Ingen strømmetjenester funnet</span></li>';
    $('dock-hint').textContent = state.dock.length + ' app' + (state.dock.length === 1 ? '' : 'er') + ' i menyen';
  }
  function dockEditKey(k) {
    var a = catalog[catIndex];
    if (k === KEY.UP) catIndex = Math.max(0, catIndex - 1);
    else if (k === KEY.DOWN) catIndex = Math.min(catalog.length - 1, catIndex + 1);
    else if (k === KEY.ENTER && a) {
      var p = dockPos(a.id);
      if (p >= 0) state.dock.splice(p, 1); else state.dock.push(a.id);
    } else if ((k === KEY.LEFT || k === KEY.RIGHT) && a) {
      var pos = dockPos(a.id);
      if (pos >= 0) {
        var np = pos + (k === KEY.RIGHT ? 1 : -1);
        if (np >= 0 && np < state.dock.length) {
          var moved = state.dock.splice(pos, 1)[0]; state.dock.splice(np, 0, moved);
        }
      }
    } else if (k === KEY.BACK || k === KEY.ESC) {
      save('dock', state.dock);
      dockeditEl.hidden = true;
      buildApps(); resolveMissing();
      openSettings();
      return;
    }
    renderCatalog();
  }

  // After editing, mark any dock card whose id is not installed (shouldn't happen, but safe).
  function resolveMissing() {
    APPS.forEach(function (a) {
      var have = installed.some(function (x) { return x.id === a.appId; });
      if (a.el) a.el.classList.toggle('missing', onTV && !have);
    });
  }

  // ---- wallpaper sheet ----
  var thumbsBuilt = false;
  function openWalls() {
    if (!WALLS.length) return toast('Ingen bakgrunner ennå');
    view = 'walls';
    if (!thumbsBuilt) {
      $('thumbs').innerHTML = WALLS.map(function (w) { return '<li><img src="img/wall/' + w.id + '-thumb.jpg" alt=""></li>'; }).join('');
      $('auto-opts').innerHTML = AUTO.map(function (a) { return '<li>' + a.label + '</li>'; }).join('');
      thumbsBuilt = true;
    }
    pick = { row: 1 + Math.floor(state.wall / THUMB_COLS), col: state.wall % THUMB_COLS };
    wallsEl.hidden = false; alignGlass(); paintWalls();
  }
  function paintWalls() {
    var thumbs = $('thumbs').children, opts = $('auto-opts').children;
    for (var i = 0; i < thumbs.length; i++) {
      thumbs[i].classList.toggle('current', i === state.wall);
      var foc = pick.row > 0 && i === (pick.row - 1) * THUMB_COLS + pick.col;
      thumbs[i].classList.toggle('focused', foc);
      if (foc) thumbs[i].scrollIntoView({ block: 'nearest' });
    }
    for (var j = 0; j < opts.length; j++) {
      opts[j].classList.toggle('current', j === state.auto);
      opts[j].classList.toggle('focused', pick.row === 0 && j === pick.col);
    }
    var fw = pick.row > 0 ? WALLS[(pick.row - 1) * THUMB_COLS + pick.col] : WALLS[state.wall];
    $('credit').textContent = fw ? fw.title + ' · ' + fw.credit : '';
  }
  function wallsKey(k) {
    var rows = Math.ceil(WALLS.length / THUMB_COLS);
    var width = function (r) { return r === 0 ? AUTO.length : Math.min(THUMB_COLS, WALLS.length - (r - 1) * THUMB_COLS); };
    if (k === KEY.LEFT) pick.col = Math.max(0, pick.col - 1);
    else if (k === KEY.RIGHT) pick.col = Math.min(width(pick.row) - 1, pick.col + 1);
    else if (k === KEY.UP && pick.row > 0) pick.row--;
    else if (k === KEY.DOWN && pick.row < rows) pick.row++;
    else if (k === KEY.ENTER) {
      if (pick.row === 0) {
        state.auto = pick.col; save('auto', state.auto);
        state.switchedAt = Date.now(); save('switchedAt', state.switchedAt);
        toast(AUTO[state.auto].msg);
      } else { showWall((pick.row - 1) * THUMB_COLS + pick.col); }
    } else if (k === KEY.BACK || k === KEY.ESC) { wallsEl.hidden = true; view = 'home'; paint(); return; }
    pick.col = Math.min(pick.col, width(pick.row) - 1);
    paintWalls();
  }

  // ---- keys ----
  document.addEventListener('keydown', function (e) {
    var k = e.keyCode;
    e.preventDefault();
    if (view === 'walls') return wallsKey(k);
    if (view === 'settings') return settingsKey(k);
    if (view === 'dockedit') return dockEditKey(k);
    // home
    if (row === 'dock') {
      if (k === KEY.LEFT) index = Math.max(0, index - 1);
      else if (k === KEY.RIGHT) index = Math.min(APPS.length - 1, index + 1);
      else if (k === KEY.UP) row = 'top';
      else if (k === KEY.ENTER) { if (APPS[index]) launch(APPS[index]); }
      else if (k === KEY.BACK || k === KEY.ESC) openSmartHub();
    } else {
      if (k === KEY.LEFT) topIndex = Math.max(0, topIndex - 1);
      else if (k === KEY.RIGHT) topIndex = Math.min(topBtns.length - 1, topIndex + 1);
      else if (k === KEY.DOWN) row = 'dock';
      else if (k === KEY.ENTER) { if (topIndex === 0) openWalls(); else openSettings(); }
      else if (k === KEY.BACK || k === KEY.ESC) row = 'dock';
    }
    paint();
  });

  function openSmartHub() {
    if (!onTV) return toast('Back: ville apnet Smart Hub');
    try {
      tizen.application.launch('com.samsung.tv.csfs', function () {}, function (err) {
        toast('Smart Hub: ' + err.name + ' ' + err.message);
      });
    } catch (e) { toast('Smart Hub: ' + e.message); }
  }

  // Coming back from a launched app: re-check installed apps and refresh.
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { tick(); if (state.weatherOn) fetchWeather(); resolve(function () { buildApps(); resolveMissing(); paint(); }); }
  });

  // ---- start ----
  // Paint the dock immediately from the saved/default list so the launcher takes over the
  // screen as fast as possible on a cold boot, instead of waiting for the TV's app-list query
  // (slow when the system is loaded). resolve() then reconciles against what is really installed.
  tick();
  buildApps(); paint();
  showWall(state.wall, true);
  setInterval(tick, 1000);
  scheduleWeather();
  window.addEventListener('load', alignGlass);
  resolve(function () { buildApps(); resolveMissing(); paint(); });
})();
