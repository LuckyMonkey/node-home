/*
 * fridge.run background music - a small catalog of original ambient/tracker
 * loops (media/music/, made by tools/ambient/).
 * One script for both sites; each site (origin) remembers its own choice in localStorage. Nothing is sent anywhere.
 *
 *   <script src="https://fridge.run/fridge-music.js" defer></script>                  off until you turn it on (go.fridge.run)
 *   <script src="/fridge-music.js" data-autostart defer></script>                     on unless you turned it off (fridge.run)
 *
 * On: if the browser lets the page make sound by itself (you have used the site before), it starts at once; otherwise it
 * starts on your first tap, click or key press - browsers never allow sound earlier. Turned off stays off, on every page.
 * The loop position is kept for the tab, so following a link carries on where it was.
 *
 * Web Audio plays one decoded buffer looped using the selected track's loop
 * metadata (the file carries a little audio either side, so the loop is
 * gapless even where a decoder adds priming delay). One tab plays at a time
 * (BroadcastChannel). The control styles itself (no stylesheet needed).
 */
(function () {
  'use strict';
  if (window.__fridgeMusic) return;                     // included twice: still one player
  window.__fridgeMusic = true;

  var me = document.currentScript;
  var AUTOSTART = !!(me && me.hasAttribute('data-autostart'));
  var BASE = new URL('media/music/', (me && me.src) || location.href).href;
  var TRACKS = [
    { id: 'cellar-light', title: 'Cellar Light', mode: 'ambient', bpm: 68, file: 'cellar-light', loopStart: 1.0, loopLength: 112.941176 },
    { id: 'canopy-pulse', title: 'Canopy Pulse', mode: 'soft jungle', bpm: 86, file: 'canopy-pulse', loopStart: 0.5, loopLength: 44.651163 },
    { id: 'panda-drum-trail', title: 'Panda Drum Trail', mode: 'gentle toms', bpm: 78, file: 'panda-drum-trail', loopStart: 0.5, loopLength: 49.230769 },
    { id: 'moss-signal', title: 'Moss Signal', mode: 'night air', bpm: 64, file: 'moss-signal', loopStart: 0.5, loopLength: 60.0 }
  ];
  var TRACK_BY_ID = {};
  TRACKS.forEach(function (t) { TRACK_BY_ID[t.id] = t; });
  var FADE = 1.2;
  var KEY = 'fridge.music', POS = 'fridge.music.pos', TRACK = 'fridge.music.track';
  var AC = window.AudioContext || window.webkitAudioContext;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function load() {
    var s = { playing: AUTOSTART, muted: false, vol: 0.4, track: TRACKS[0].id }; // no choice made yet: the site's default
    try { var j = JSON.parse(localStorage.getItem(KEY) || '{}'); if (typeof j.playing === 'boolean') s.playing = j.playing;
      if (typeof j.muted === 'boolean') s.muted = j.muted; if (typeof j.vol === 'number' && j.vol >= 0 && j.vol <= 1) s.vol = j.vol;
      if (typeof j.track === 'string' && TRACK_BY_ID[j.track]) s.track = j.track;
    } catch (e) {}
    return s;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ playing: state.playing || wanted, muted: state.muted, vol: state.vol, track: track.id })) } catch (e) {} }
  var state = load();
  var wanted = state.playing;                           // "on": start as soon as the browser allows
  state.playing = false;
  var track = TRACK_BY_ID[state.track] || TRACKS[0];

  // ---- look (self-contained: the same pill on fridge.run and go.fridge.run) -------------------------------------
  // Scoped to #fridge-music and reset, so a host page's own button/input rules (go.fridge.run styles every button and
  // input) can never reach in: the id outranks any class-based rule, and all:unset clears what we don't set.
  var R = '#fridge-music';
  var css = R + '{all:initial;position:fixed;right:14px;bottom:14px;z-index:2147483000;display:flex;align-items:center;gap:6px;' +
    'box-sizing:border-box;padding:5px 10px 5px 6px;border-radius:999px;background:linear-gradient(180deg,#f3f4f6 0%,#e8eaee 100%);' +
    'border:1px solid #c9cdd5;box-shadow:0 1px 0 rgba(255,255,255,.8) inset,0 8px 24px rgba(0,0,0,.45),0 2px 6px rgba(0,0,0,.3);' +
    'font:12.5px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Ubuntu,sans-serif;color:#30333b;text-align:left;letter-spacing:normal;text-shadow:none}' +
    R + ' *{box-sizing:border-box}' +
    R + ' button{all:unset;box-sizing:border-box;display:grid;place-items:center;flex:none;width:30px;height:30px;border-radius:50%;' +
    'border:1px solid #c9cdd5;background:linear-gradient(180deg,#f6f7f9 0%,#dde0e5 100%);color:#131419;cursor:pointer;' +
    'font:13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Ubuntu,sans-serif;text-align:center}' +
    R + ' button.fm-play{background:#2bb59c;border-color:#1e8f7a;color:#fff}' +
    R + ' button.fm-step{font-size:18px}' +
    R + ' button.fm-track{width:auto;min-width:92px;padding:0 8px;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:11px;line-height:1.05}' +
    R + ' .fm-track-name{max-width:92px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}' +
    R + ' .fm-track-mode{display:block;color:#69707a;font-size:9px;font-weight:500;line-height:1}' +
    R + ' button:hover{filter:brightness(1.06);transform:none;box-shadow:none}' +
    R + ' button:focus-visible,' + R + ' input:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(43,181,156,.45)}' +
    R + ' button:disabled{opacity:.45;cursor:default}' +
    R + ' input.fm-vol{all:revert;-webkit-appearance:auto;appearance:auto;flex:none;width:84px;height:auto;margin:0;padding:0;border:0;' +
    'background:transparent;box-shadow:none;accent-color:#1e8f7a;vertical-align:middle}' +
    R + ' .fm-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}' +
    R + ' .fm-icon{font:inherit;line-height:1}' +
    R + ' .fm-eq{display:none;align-items:flex-end;gap:2px;height:12px;flex:none}' + R + '.fm-on .fm-eq{display:inline-flex}' +
    R + ' .fm-eq i{display:block;width:3px;height:5px;border-radius:1px;background:#1e8f7a;animation:fm-eq 1.6s ease-in-out infinite}' +
    R + ' .fm-eq i:nth-child(2){animation-delay:-.5s}' + R + ' .fm-eq i:nth-child(3){animation-delay:-1s}' +
    '@keyframes fm-eq{0%,100%{height:3px}50%{height:11px}}' + R + '.fm-still .fm-eq i{animation:none;height:8px}' +
    '@media (prefers-reduced-motion:reduce){' + R + ' .fm-eq i{animation:none;height:8px}}' +
    '@media (max-width:520px){body:has(#fridge-music){padding-bottom:52px}' + R + '{right:8px;bottom:8px;padding:4px 8px 4px 4px}' +
    R + ' input.fm-vol{width:64px}' + R + ' .fm-track{min-width:30px;width:30px;padding:0}' + R + ' .fm-track-name{display:none}' + R + ' .fm-track-mode{display:none}}' +
    '@media print{' + R + '{display:none}}';

  var box = document.createElement('div');
  box.className = 'fm';
  box.id = 'fridge-music';
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', 'Background music');
  box.innerHTML =
    '<button type="button" class="fm-step fm-prev" aria-label="Previous background mode" title="Previous mode">‹</button>' +
    '<button type="button" class="fm-play" aria-pressed="false"><span class="fm-icon" aria-hidden="true">▶</span><span class="fm-sr">Play background music</span></button>' +
    '<span class="fm-eq" aria-hidden="true"><i></i><i></i><i></i></span>' +
    '<button type="button" class="fm-track" aria-label="Change background mode" title="Change background mode"><span class="fm-track-name">Music</span><span class="fm-track-mode"></span></button>' +
    '<button type="button" class="fm-step fm-next" aria-label="Next background mode" title="Next mode">›</button>' +
    '<button type="button" class="fm-mute" aria-pressed="false"><span class="fm-icon" aria-hidden="true">🔊</span><span class="fm-sr">Mute background music</span></button>' +
    '<input type="range" class="fm-vol" min="0" max="100" step="5" aria-label="Background music volume">' +
    '<span class="fm-sr fm-live" role="status" aria-live="polite"></span>';
  var play = box.querySelector('.fm-play'), prev = box.querySelector('.fm-prev'), next = box.querySelector('.fm-next');
  var trackButton = box.querySelector('.fm-track'), trackName = box.querySelector('.fm-track-name'), trackMode = box.querySelector('.fm-track-mode');
  var mute = box.querySelector('.fm-mute'), vol = box.querySelector('.fm-vol'), live = box.querySelector('.fm-live');
  vol.value = Math.round(state.vol * 100);
  if (reduced) box.classList.add('fm-still');

  function render(msg) {
    var on = state.playing;
    box.classList.toggle('fm-on', on && !state.muted);
    play.setAttribute('aria-pressed', String(on || wanted));
    play.querySelector('.fm-icon').textContent = on ? '❚❚' : '▶';
    play.querySelector('.fm-sr').textContent = on || wanted ? 'Pause background music' : 'Play background music';
    mute.setAttribute('aria-pressed', String(state.muted));
    mute.querySelector('.fm-icon').textContent = state.muted || state.vol === 0 ? '🔇' : '🔉';
    mute.querySelector('.fm-sr').textContent = state.muted ? 'Unmute background music' : 'Mute background music';
    vol.setAttribute('aria-valuetext', Math.round(state.vol * 100) + ' percent');
    trackName.textContent = msg || track.title;
    trackMode.textContent = on ? (state.muted ? 'muted' : track.mode) : (wanted ? 'tap to start' : track.mode);
    trackButton.title = track.title + ' · ' + track.mode + ' · ' + track.bpm + ' BPM · click to change';
    if (live.dataset.last !== (msg || track.title)) { live.textContent = msg || track.title; live.dataset.last = msg || track.title }
  }
  function broken(why) {
    box.classList.add('fm-off');
    play.disabled = prev.disabled = next.disabled = trackButton.disabled = mute.disabled = vol.disabled = true;
    state.playing = false;
    wanted = false;
    render(why);
  }

  // ---- sound -------------------------------------------------------------------------------------------------
  var ctx = null, gain = null, buffer = null, bufferTrack = null, loading = null, loadingTrack = null;
  var node = null, startedAt = 0, offset = 0;
  try { offset = Math.max(0, Math.min(track.loopLength, parseFloat(sessionStorage.getItem(POS)) || 0)) } catch (e) {}
  function audioFile(t) {
    var a = document.createElement('audio');
    return BASE + (a.canPlayType && a.canPlayType('audio/ogg; codecs="opus"') ? t.file + '.ogg' : t.file + '.m4a');
  }
  function level() { return state.muted ? 0 : state.vol * state.vol * 0.9 }   // squared: the slider feels even
  function ramp(to, secs) {
    var t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(to, t + secs);
  }
  function ensure() {
    if (buffer && bufferTrack === track) return Promise.resolve(buffer);
    if (loading && loadingTrack === track) return loading;
    if (!AC || !window.fetch) return Promise.reject(new Error('Music unavailable in this browser'));
    if (!ctx) {
      ctx = new AC();
      gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
    }
    var requested = track;
    loadingTrack = requested;
    loading = fetch(audioFile(requested), { credentials: 'omit', mode: 'cors' }).then(function (r) {
      if (!r.ok) throw new Error('The music file did not load.');
      return r.arrayBuffer();
    }).then(function (data) {
      return new Promise(function (ok, fail) {             // older Safari: callback form only
        var p = ctx.decodeAudioData(data, ok, function () { fail(new Error('This browser cannot decode the music.')) });
        if (p && p.then) p.then(ok, function () { fail(new Error('This browser cannot decode the music.')) });
      });
    }).then(function (b) { buffer = b; bufferTrack = requested; return b });
    return loading;
  }
  function position() { return node ? ((ctx.currentTime - startedAt) + offset) % track.loopLength : offset }
  function begin() {
    if (state.playing) return;
    node = ctx.createBufferSource();
    node.buffer = buffer;
    node.loop = true;
    node.loopStart = track.loopStart;
    node.loopEnd = track.loopStart + track.loopLength;
    node.connect(gain);
    startedAt = ctx.currentTime;
    node.start(0, track.loopStart + offset);
    state.playing = true;
    wanted = false;
    disarm();
    ramp(level(), FADE);
    save();
    render();
    if (chan) chan.postMessage('playing');
  }
  function start() {                                     // from a gesture: resume the context, then play
    render('Loading…');
    var requested = track;
    return ensure().then(function () {
      if (track !== requested || bufferTrack !== requested) return;
      var r = ctx.state === 'suspended' ? ctx.resume() : null;
      return (r && r.then ? r : Promise.resolve()).then(begin);
    }).catch(function (e) { broken(e && e.message ? e.message : 'Music unavailable') });
  }
  function tryNow() {                                    // "on" without a gesture: play if the browser allows, else wait for one
    var requested = track;
    ensure().then(function () {
      if (track !== requested || bufferTrack !== requested) return;
      if (ctx.state === 'running') return begin();
      var r = ctx.resume();                              // allowed where the site already has the browser's trust
      var t = setTimeout(function () { render() }, 300);
      if (r && r.then) r.then(function () { clearTimeout(t); if (ctx.state === 'running' && wanted) begin() }, function () {});
    }).catch(function (e) { broken(e && e.message ? e.message : 'Music unavailable') });
  }
  function stop(quick) {
    wanted = false;
    disarm();
    if (!state.playing || !node) { state.playing = false; save(); render(); return }
    offset = position();
    var n = node;
    node = null;
    state.playing = false;
    ramp(0, quick ? 0.25 : FADE);
    setTimeout(function () { try { n.stop() } catch (e) {} }, (quick ? 0.25 : FADE) * 1000 + 50);
    save();
    render();
  }

  function changeTrack(delta) {
    var wasOn = state.playing || wanted;
    if (state.playing) stop(true);
    wanted = false;
    offset = 0;
    buffer = null;
    bufferTrack = null;
    loading = null;
    loadingTrack = null;
    var index = TRACKS.indexOf(track);
    track = TRACKS[(index + delta + TRACKS.length) % TRACKS.length];
    state.track = track.id;
    save();
    render();
    if (wasOn) { wanted = true; start(); }
  }

  play.addEventListener('click', function () { if (state.playing || wanted) stop(); else start() });
  prev.addEventListener('click', function () { changeTrack(-1) });
  next.addEventListener('click', function () { changeTrack(1) });
  trackButton.addEventListener('click', function () { changeTrack(1) });
  mute.addEventListener('click', function () {
    state.muted = !state.muted;
    if (ctx && state.playing) ramp(level(), 0.3);
    save();
    render();
  });
  vol.addEventListener('input', function () {
    state.vol = vol.value / 100;
    if (state.vol > 0 && state.muted) state.muted = false;
    if (ctx && state.playing) ramp(level(), 0.15);
    save();
    render();
  });

  // "on" but the browser wants a gesture first: the first tap, click or key anywhere starts it
  function disarm() {
    document.removeEventListener('pointerdown', onFirstGesture, true);
    document.removeEventListener('keydown', onFirstGesture, true);
  }
  function onFirstGesture(e) {
    if (box.contains(e.target)) return;                // the control's own buttons do their own thing
    disarm();
    if (wanted && !state.playing) start();
  }
  function arm() {
    disarm();
    if (wanted) {
      document.addEventListener('pointerdown', onFirstGesture, true);
      document.addEventListener('keydown', onFirstGesture, true);
    }
  }

  // one tab at a time: another tab starting pauses this one
  var chan = null;
  try { chan = new BroadcastChannel('fridge-music'); chan.onmessage = function (m) { if (m.data === 'playing' && state.playing) { stop(true); render('Playing in another tab') } } } catch (e) {}

  // leaving the page: remember where the loop had got to, and that it was on
  function leaving() {
    try { sessionStorage.setItem(POS, String(position())) } catch (e) {}
    if (state.playing) { stop(true); wanted = true; save(); wanted = false }
  }
  window.addEventListener('pagehide', leaving);
  window.addEventListener('pageshow', function (e) {         // back/forward cache: the page returns as it was left
    if (e.persisted) {
      state = load(); track = TRACK_BY_ID[state.track] || TRACKS[0]; wanted = state.playing; state.playing = false;
      offset = 0; buffer = null; bufferTrack = null; loading = null; loadingTrack = null;
      vol.value = Math.round(state.vol * 100); arm(); render(); if (wanted) tryNow()
    }
  });

  function mount() {
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
    document.body.appendChild(box);
    if (!AC) return broken('Music unavailable in this browser');
    render();
    if (wanted) { arm(); tryNow() }
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
