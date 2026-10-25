/* Frame launcher: a dock of app cards that launches installed TV apps, over a wallpaper the
   viewer can pick (or let rotate). The apps are listed in js/apps.js; read your TV's app ids
   with `sdb shell 0 applist`. At startup they are checked against tizen.application.getAppsInfo()
   and the first installed candidate wins. In a desktop browser (no `tizen`) launches only show a toast.
   Wallpapers are listed in js/wallpapers.js; each has a full image, a pre-blurred copy for the
   glass and a thumbnail (see tools/wallpapers.sh). */
(function () {
  'use strict';

  var APPS = window.LAUNCHER_APPS || [];
  var WALLS = window.WALLPAPERS || [];
  var AUTO = [
    { label: 'Off', ms: 0, msg: 'Automatic switching is off' },
    { label: '15 min', ms: 15 * 60000, msg: 'Switching wallpaper every 15 minutes' },
    { label: '1 hour', ms: 60 * 60000, msg: 'Switching wallpaper every hour' },
    { label: '1 day', ms: 24 * 60 * 60000, msg: 'Switching wallpaper every day' }
  ];
  var THUMB_COLS = 5;

  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009, ESC: 27 };
  var onTV = typeof window.tizen !== 'undefined';

  var $ = function (id) { return document.getElementById(id); };
  var appsEl = $('apps'), settingsEl = $('settings'), wallsEl = $('walls'), toastEl = $('toast');
  var topBtns = [$('wall-btn'), $('settings-btn')];
  var row = 'dock';   // 'dock' or 'top'
  var index = 0;      // dock index
  var topIndex = 0;   // 0 = wallpaper, 1 = settings
  var pick = { row: 1, col: 0 };   // wallpaper sheet focus; row 0 = auto options, 1.. = thumbnails
  var toastTimer;

  // ---- per-viewer settings (localStorage; the TV keeps it across restarts) ----
  function load(key, fallback) {
    try { var v = localStorage.getItem('fl.' + key); return v === null ? fallback : JSON.parse(v); }
    catch (e) { return fallback; }
  }
  function save(key, value) { try { localStorage.setItem('fl.' + key, JSON.stringify(value)); } catch (e) {} }

  var state = {
    wall: Math.max(0, Math.min(load('wall', 0), WALLS.length - 1)),
    auto: load('auto', 0),
    switchedAt: load('switchedAt', Date.now())
  };

  // ---- render ----
  APPS.forEach(function (app) {
    var li = document.createElement('li');
    li.className = 'app';
    // A logo is optional (your own file in img/glyph/); without one, or if it fails to load,
    // the card shows the app's name.
    li.innerHTML = '<div class="cell"></div><span class="label"></span>';
    li.querySelector('.label').textContent = app.name;
    if (app.glyph) {
      var img = new Image();
      img.alt = app.name;
      img.onload = function () { li.replaceChild(img, li.querySelector('.label')); };
      img.src = 'img/glyph/' + app.glyph + '.png';
    }
    app.el = li;
    appsEl.appendChild(li);
  });

  // Line the pre-blurred wallpaper up with the real one behind every glass panel.
  function alignGlass() {
    var stage = $('stage').getBoundingClientRect();
    Array.prototype.forEach.call(document.querySelectorAll('.glass'), function (g) {
      var r = g.getBoundingClientRect();
      if (!r.width) return;
      g.style.backgroundPosition = (stage.left - r.left) + 'px ' + (stage.top - r.top) + 'px';
    });
  }

  function tick() {
    var d = new Date();
    $('time').textContent = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    var auto = AUTO[state.auto];
    if (WALLS.length && auto && auto.ms && Date.now() - state.switchedAt >= auto.ms) {
      showWall((state.wall + 1) % WALLS.length);
    }
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.className = 'show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = ''; }, 2600);
  }

  // ---- wallpaper: the new image fades in on top of the old one, then the old layer is cleared.
  // Only the latest request wins, in case a slow decode finishes after a newer pick.
  var front = $('wall-a'), back = $('wall-b'), wallReq = 0;
  function showWall(i, instant) {
    if (!WALLS.length) return;   // no wallpapers built: the CSS background stays
    var w = WALLS[i], req = ++wallReq;
    state.wall = i;
    save('wall', i);
    if (!instant) {   // the startup draw must not restart the auto-switch timer
      state.switchedAt = Date.now();
      save('switchedAt', state.switchedAt);
    }
    var img = new Image();
    img.onload = function () {
      if (req !== wallReq) return;
      var incoming = back, outgoing = front;
      incoming.style.backgroundImage = 'url(img/wall/' + w.id + '.jpg)';
      incoming.style.zIndex = 1;
      outgoing.style.zIndex = 0;
      incoming.className = 'wall' + (instant ? ' instant' : '');
      void incoming.offsetWidth;   // start the fade from opacity 0
      incoming.className = 'wall on' + (instant ? ' instant' : '');
      front = incoming; back = outgoing;
      setTimeout(function () { if (req === wallReq) outgoing.className = 'wall instant'; }, instant ? 0 : 1500);
      var blur = 'url(img/wall/' + w.id + '-blur.jpg)';
      Array.prototype.forEach.call(document.querySelectorAll('.glass'), function (g) { g.style.backgroundImage = blur; });
    };
    img.src = 'img/wall/' + w.id + '.jpg';
  }

  // ---- focus ----
  function paint() {
    APPS.forEach(function (a, i) { a.el.classList.toggle('focused', row === 'dock' && i === index); });
    topBtns.forEach(function (b, i) { b.classList.toggle('focused', row === 'top' && i === topIndex); });
  }

  // ---- installed apps ----
  function resolve(done) {
    if (!onTV) {
      APPS.forEach(function (a) { a.appId = a.ids[0]; });
      return done();
    }
    try {
      tizen.application.getAppsInfo(function (list) {
        var have = {};
        list.forEach(function (info) { have[info.id] = true; });
        APPS.forEach(function (a) {
          a.appId = a.ids.filter(function (id) { return have[id]; })[0] || null;
          a.el.classList.toggle('missing', !a.appId);
        });
        done();
      }, function (err) { toast('Could not read the app list: ' + err.message); done(); });
    } catch (e) { toast('Could not read the app list: ' + e.message); done(); }
  }

  function launch(app) {
    if (!app.appId) return toast(app.name + ' is not installed');
    if (!onTV) return toast('Would open ' + app.name + ' (' + app.appId + ')');
    toast('Opening ' + app.name + '…');
    try {
      tizen.application.launch(app.appId, function () {},
        function (err) { toast(app.name + ': ' + err.name + ' ' + err.message); });
    } catch (e) { toast(app.name + ': ' + e.message); }
  }

  // ---- settings sheet ----
  function openSettings() {
    $('resolved').innerHTML = APPS.map(function (a) {
      return '<li><span>' + a.name + '</span><code>' + (a.appId || 'not found') + '</code></li>';
    }).join('');
    settingsEl.hidden = false;
    alignGlass();
  }

  // ---- wallpaper sheet ----
  var thumbsBuilt = false;
  function openWalls() {
    if (!WALLS.length) return toast('No wallpapers yet: run tools/wallpapers.sh and reinstall');
    if (!thumbsBuilt) {
      $('thumbs').innerHTML = WALLS.map(function (w) {
        return '<li><img src="img/wall/' + w.id + '-thumb.jpg" alt=""></li>';
      }).join('');
      $('auto-opts').innerHTML = AUTO.map(function (a) { return '<li>' + a.label + '</li>'; }).join('');
      thumbsBuilt = true;
    }
    pick = { row: 1 + Math.floor(state.wall / THUMB_COLS), col: state.wall % THUMB_COLS };
    wallsEl.hidden = false;
    alignGlass();
    paintWalls();
  }
  function paintWalls() {
    var thumbs = $('thumbs').children, opts = $('auto-opts').children;
    for (var i = 0; i < thumbs.length; i++) {
      thumbs[i].classList.toggle('current', i === state.wall);
      thumbs[i].classList.toggle('focused', pick.row > 0 && i === (pick.row - 1) * THUMB_COLS + pick.col);
    }
    for (var j = 0; j < opts.length; j++) {
      opts[j].classList.toggle('current', j === state.auto);
      opts[j].classList.toggle('focused', pick.row === 0 && j === pick.col);
    }
    var focusedWall = pick.row > 0 ? WALLS[(pick.row - 1) * THUMB_COLS + pick.col] : WALLS[state.wall];
    $('credit').textContent = focusedWall ? focusedWall.title + ' · ' + focusedWall.credit : '';
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
        state.auto = pick.col;
        save('auto', state.auto);
        state.switchedAt = Date.now();
        save('switchedAt', state.switchedAt);
        toast(AUTO[state.auto].msg);
      } else {
        showWall((pick.row - 1) * THUMB_COLS + pick.col);
      }
    } else if (k === KEY.BACK || k === KEY.ESC) { wallsEl.hidden = true; return; }
    pick.col = Math.min(pick.col, width(pick.row) - 1);
    paintWalls();
  }

  function openBack() {
    // Back from the dock opens LAUNCHER_BACK_TARGET (default: Samsung Smart Hub). See apps.js.
    var target = window.LAUNCHER_BACK_TARGET || 'com.samsung.tv.csfs';
    if (!onTV) return toast('Back: would open ' + target);
    try {
      tizen.application.launch(target, function () {}, function (err) {
        toast('Back: ' + err.name + ' ' + err.message);
      });
    } catch (e) { toast('Back: ' + e.message); }
  }

  // ---- keys ----
  document.addEventListener('keydown', function (e) {
    var k = e.keyCode;
    e.preventDefault();
    if (!wallsEl.hidden) return wallsKey(k);
    if (!settingsEl.hidden) {
      if (k === KEY.BACK || k === KEY.ESC || k === KEY.ENTER) settingsEl.hidden = true;
      return;
    }
    if (row === 'dock') {
      if (k === KEY.LEFT) index = Math.max(0, index - 1);
      else if (k === KEY.RIGHT) index = Math.min(APPS.length - 1, index + 1);
      else if (k === KEY.UP) row = 'top';
      else if (k === KEY.ENTER) launch(APPS[index]);
      else if (k === KEY.BACK || k === KEY.ESC) openBack();
    } else {
      if (k === KEY.LEFT) topIndex = Math.max(0, topIndex - 1);
      else if (k === KEY.RIGHT) topIndex = Math.min(topBtns.length - 1, topIndex + 1);
      else if (k === KEY.DOWN) row = 'dock';
      else if (k === KEY.ENTER) { if (topIndex === 0) openWalls(); else openSettings(); }
      else if (k === KEY.BACK || k === KEY.ESC) row = 'dock';
    }
    paint();
  });

  // Coming back from a launched app: re-check, an app may have been (un)installed.
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { tick(); resolve(paint); }
  });

  showWall(state.wall, true);
  tick();
  setInterval(tick, 10000);
  alignGlass();
  window.addEventListener('load', alignGlass);
  resolve(paint);
})();
