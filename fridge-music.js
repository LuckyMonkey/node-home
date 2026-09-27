/*
 * fridge.run background music - "Cellar Light", an original ambient loop (media/music/, made by tools/ambient/compose.py).
 * One script for both sites; each site (origin) remembers its own choice in localStorage. Nothing is sent anywhere.
 *
 *   <script src="https://fridge.run/fridge-music.js" defer></script>                  off until you turn it on (go.fridge.run)
 *   <script src="/fridge-music.js" data-autostart defer></script>                     on unless you turned it off (fridge.run)
 *
 * On: if the browser lets the page make sound by itself (you have used the site before), it starts at once; otherwise it
 * starts on your first tap, click or key press - browsers never allow sound earlier. Turned off stays off, on every page.
 * The loop position is kept for the tab, so following a link carries on where it was.
 *
 * Web Audio plays one decoded buffer looped between LOOP_START and LOOP_START + LOOP_LEN (the file carries a few seconds
 * of the same audio either side, so the loop is gapless even where a decoder adds priming delay). One tab plays at a
 * time (BroadcastChannel). The control styles itself (no stylesheet needed).
 */
(function () {
  'use strict';
  if (window.__fridgeMusic) return;                     // included twice: still one player
  window.__fridgeMusic = true;

  var me = document.currentScript;
  var AUTOSTART = !!(me && me.hasAttribute('data-autostart'));
  var BASE = new URL('media/music/', (me && me.src) || location.href).href;
  var LOOP_START = 1.0, LOOP_LEN = 112.941176, FADE = 1.2;
  var KEY = 'fridge.music', POS = 'fridge.music.pos';
  var AC = window.AudioContext || window.webkitAudioContext;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function load() {
    var s = { playing: AUTOSTART, muted: false, vol: 0.4 };      // no choice made yet: the site's default
    try { var j = JSON.parse(localStorage.getItem(KEY) || '{}'); if (typeof j.playing === 'boolean') s.playing = j.playing;
      if (typeof j.muted === 'boolean') s.muted = j.muted; if (typeof j.vol === 'number' && j.vol >= 0 && j.vol <= 1) s.vol = j.vol } catch (e) {}
    return s;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ playing: state.playing || wanted, muted: state.muted, vol: state.vol })) } catch (e) {} }
  var state = load();
  var wanted = state.playing;                           // "on": start as soon as the browser allows
  state.playing = false;

  // ---- look (self-contained: the same pill on fridge.run and go.fridge.run) -------------------------------------
  var css = '.fm{position:fixed;right:14px;bottom:14px;z-index:9990;display:flex;align-items:center;gap:6px;padding:5px 10px 5px 6px;' +
    'border-radius:999px;background:linear-gradient(180deg,#f3f4f6 0%,#e8eaee 100%);border:1px solid #c9cdd5;' +
    'box-shadow:0 1px 0 rgba(255,255,255,.8) inset,0 8px 24px rgba(0,0,0,.45),0 2px 6px rgba(0,0,0,.3);' +
    'font:12.5px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Ubuntu,sans-serif;color:#30333b}' +
    '.fm button{display:grid;place-items:center;width:30px;height:30px;padding:0;margin:0;border-radius:50%;border:1px solid #c9cdd5;' +
    'background:linear-gradient(180deg,#f6f7f9 0%,#dde0e5 100%);color:#131419;cursor:pointer;font-size:13px;line-height:1}' +
    '.fm .fm-play{background:#2bb59c;border-color:#1e8f7a;color:#fff}.fm button:hover{filter:brightness(1.05)}' +
    '.fm button:focus-visible,.fm input:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(43,181,156,.45)}' +
    '.fm button:disabled{opacity:.45;cursor:default}.fm-label{min-width:3.5em;white-space:nowrap}' +
    '.fm-vol{width:84px;accent-color:#1e8f7a;margin:0}' +
    '.fm-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}' +
    '.fm-eq{display:none;align-items:flex-end;gap:2px;height:12px}.fm-on .fm-eq{display:inline-flex}' +
    '.fm-eq i{width:3px;height:5px;border-radius:1px;background:#1e8f7a;animation:fm-eq 1.6s ease-in-out infinite}' +
    '.fm-eq i:nth-child(2){animation-delay:-.5s}.fm-eq i:nth-child(3){animation-delay:-1s}' +
    '@keyframes fm-eq{0%,100%{height:3px}50%{height:11px}}.fm-still .fm-eq i{animation:none;height:8px}' +
    '@media (prefers-reduced-motion:reduce){.fm-eq i{animation:none;height:8px}}.fm-off .fm-label{color:#585c67}' +
    '@media (max-width:520px){body:has(.fm){padding-bottom:52px}.fm{right:8px;bottom:8px;padding:4px 8px 4px 4px}.fm-vol{width:64px}.fm-label{display:none}}' +
    '@media print{.fm{display:none}}';

  var box = document.createElement('div');
  box.className = 'fm';
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', 'Background music');
  box.innerHTML =
    '<button type="button" class="fm-play" aria-pressed="false"><span class="fm-icon" aria-hidden="true">▶</span><span class="fm-sr">Play background music</span></button>' +
    '<span class="fm-eq" aria-hidden="true"><i></i><i></i><i></i></span>' +
    '<span class="fm-label">Music</span>' +
    '<button type="button" class="fm-mute" aria-pressed="false"><span class="fm-icon" aria-hidden="true">🔊</span><span class="fm-sr">Mute background music</span></button>' +
    '<input type="range" class="fm-vol" min="0" max="100" step="5" aria-label="Background music volume">' +
    '<span class="fm-sr fm-live" role="status" aria-live="polite"></span>';
  var play = box.querySelector('.fm-play'), mute = box.querySelector('.fm-mute'), vol = box.querySelector('.fm-vol');
  var label = box.querySelector('.fm-label'), live = box.querySelector('.fm-live');
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
    label.textContent = msg || (on ? (state.muted ? 'Muted' : 'Playing') : wanted ? 'Tap anywhere for music' : 'Music');
    if (live.dataset.last !== label.textContent) { live.textContent = label.textContent; live.dataset.last = label.textContent }
  }
  function broken(why) {
    box.classList.add('fm-off');
    play.disabled = mute.disabled = vol.disabled = true;
    state.playing = false;
    wanted = false;
    render(why);
  }

  // ---- sound -------------------------------------------------------------------------------------------------
  var ctx = null, gain = null, buffer = null, loading = null, node = null, startedAt = 0, offset = 0;
  try { offset = Math.max(0, Math.min(LOOP_LEN, parseFloat(sessionStorage.getItem(POS)) || 0)) } catch (e) {}
  function src() {
    var a = document.createElement('audio');
    return BASE + (a.canPlayType && a.canPlayType('audio/ogg; codecs="opus"') ? 'cellar-light.ogg' : 'cellar-light.m4a');
  }
  function level() { return state.muted ? 0 : state.vol * state.vol * 0.9 }   // squared: the slider feels even
  function ramp(to, secs) {
    var t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(to, t + secs);
  }
  function ensure() {
    if (loading) return loading;
    if (!AC || !window.fetch) return Promise.reject(new Error('Music unavailable in this browser'));
    ctx = new AC();
    gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);
    loading = fetch(src(), { credentials: 'omit', mode: 'cors' }).then(function (r) {
      if (!r.ok) throw new Error('The music file did not load.');
      return r.arrayBuffer();
    }).then(function (data) {
      return new Promise(function (ok, fail) {             // older Safari: callback form only
        var p = ctx.decodeAudioData(data, ok, function () { fail(new Error('This browser cannot decode the music.')) });
        if (p && p.then) p.then(ok, function () { fail(new Error('This browser cannot decode the music.')) });
      });
    }).then(function (b) { buffer = b; return b });
    return loading;
  }
  function position() { return node ? ((ctx.currentTime - startedAt) + offset) % LOOP_LEN : offset }
  function begin() {
    if (state.playing) return;
    node = ctx.createBufferSource();
    node.buffer = buffer;
    node.loop = true;
    node.loopStart = LOOP_START;
    node.loopEnd = LOOP_START + LOOP_LEN;
    node.connect(gain);
    startedAt = ctx.currentTime;
    node.start(0, LOOP_START + offset);
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
    return ensure().then(function () {
      var r = ctx.state === 'suspended' ? ctx.resume() : null;
      return (r && r.then ? r : Promise.resolve()).then(begin);
    }).catch(function (e) { broken(e && e.message ? e.message : 'Music unavailable') });
  }
  function tryNow() {                                    // "on" without a gesture: play if the browser allows, else wait for one
    ensure().then(function () {
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

  play.addEventListener('click', function () { if (state.playing || wanted) stop(); else start() });
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
    if (e.persisted) { state = load(); wanted = state.playing; state.playing = false; vol.value = Math.round(state.vol * 100); arm(); render(); if (wanted) tryNow() }
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
