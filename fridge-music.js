/*
 * fridge.run background music - "Cellar Light", an original ambient loop (media/music/, made by tools/ambient/compose.py).
 *
 * Off until you press play: nothing sounds before you act. Your choices (playing, muted, volume) are kept in this
 * browser (localStorage) and nothing is sent anywhere. A static site reloads on every link, so where the loop had
 * got to is kept for the tab (sessionStorage); if the music was playing, it picks up again on your first click or
 * key press on the next page - browsers never allow sound before that, and neither do we.
 *
 * Web Audio plays one decoded buffer looped between LOOP_START and LOOP_START + LOOP_LEN (the file carries a few
 * seconds of the same audio either side, so the loop is gapless even where a decoder adds priming delay).
 * Only one tab plays at a time (BroadcastChannel). Remove the <script> tag from a page to drop the control there.
 */
(function () {
  'use strict';
  if (window.__fridgeMusic) return;                     // included twice: still one player
  window.__fridgeMusic = true;

  var LOOP_START = 1.0, LOOP_LEN = 112.941176, FADE = 1.2;
  var KEY = 'fridge.music', POS = 'fridge.music.pos';
  var AC = window.AudioContext || window.webkitAudioContext;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function load() {
    var s = { playing: false, muted: false, vol: 0.4 };
    try { var j = JSON.parse(localStorage.getItem(KEY) || '{}'); if (typeof j.playing === 'boolean') s.playing = j.playing;
      if (typeof j.muted === 'boolean') s.muted = j.muted; if (typeof j.vol === 'number' && j.vol >= 0 && j.vol <= 1) s.vol = j.vol } catch (e) {}
    return s;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ playing: state.playing, muted: state.muted, vol: state.vol })) } catch (e) {} }
  var state = load();
  var wanted = state.playing;                           // playing on the last page: resume on the first gesture here
  state.playing = false;

  // ---- the control -------------------------------------------------------------------------------------------
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
    play.setAttribute('aria-pressed', String(on));
    play.querySelector('.fm-icon').textContent = on ? '❚❚' : '▶';
    play.querySelector('.fm-sr').textContent = on ? 'Pause background music' : 'Play background music';
    mute.setAttribute('aria-pressed', String(state.muted));
    mute.querySelector('.fm-icon').textContent = state.muted || state.vol === 0 ? '🔇' : '🔉';
    mute.querySelector('.fm-sr').textContent = state.muted ? 'Unmute background music' : 'Mute background music';
    vol.setAttribute('aria-valuetext', Math.round(state.vol * 100) + ' percent');
    label.textContent = msg || (on ? (state.muted ? 'Muted' : 'Playing') : wanted ? 'Paused - click to resume' : 'Music');
    if (msg !== undefined || live.dataset.last !== label.textContent) { live.textContent = label.textContent; live.dataset.last = label.textContent }
  }
  function broken(why) {
    box.classList.add('fm-off');
    play.disabled = mute.disabled = vol.disabled = true;
    state.playing = false;
    render(why);
  }

  // ---- sound -------------------------------------------------------------------------------------------------
  var ctx = null, gain = null, buffer = null, loading = null, node = null, startedAt = 0, offset = 0;
  try { offset = Math.max(0, Math.min(LOOP_LEN, parseFloat(sessionStorage.getItem(POS)) || 0)) } catch (e) {}
  function src() {
    var a = document.createElement('audio');
    return a.canPlayType && a.canPlayType('audio/ogg; codecs="opus"') ? '/media/music/cellar-light.ogg' : '/media/music/cellar-light.m4a';
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
    if (!AC || !window.fetch) return Promise.reject(new Error('This browser cannot play the music.'));
    ctx = new AC();
    gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);
    loading = fetch(src(), { credentials: 'omit' }).then(function (r) {
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
  function position() {
    if (!node) return offset;
    return ((ctx.currentTime - startedAt) + offset) % LOOP_LEN;
  }
  function start() {
    wanted = false;
    disarm();
    render('Loading…');
    return ensure().then(function () {
      if (state.playing) return;
      if (ctx.state === 'suspended') ctx.resume();
      node = ctx.createBufferSource();
      node.buffer = buffer;
      node.loop = true;
      node.loopStart = LOOP_START;
      node.loopEnd = LOOP_START + LOOP_LEN;
      node.connect(gain);
      startedAt = ctx.currentTime;
      node.start(0, LOOP_START + offset);
      state.playing = true;
      ramp(level(), FADE);
      save();
      render();
      if (chan) chan.postMessage('playing');
    }).catch(function (e) { broken(e && e.message ? e.message : 'Music unavailable') });
  }
  function stop(quick) {
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

  play.addEventListener('click', function () { if (state.playing) stop(); else start() });
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

  // was playing on the page before: carry on at the first gesture on this one - never before
  function disarm() {
    document.removeEventListener('pointerdown', onFirstGesture, true);
    document.removeEventListener('keydown', onFirstGesture, true);
  }
  function onFirstGesture(e) {
    if (box.contains(e.target)) return;                // the control's own buttons do their own thing; keep waiting
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
  arm();

  // one tab at a time: another tab starting pauses this one (its choice is kept)
  var chan = null;
  try { chan = new BroadcastChannel('fridge-music'); chan.onmessage = function (m) { if (m.data === 'playing' && state.playing) { stop(true); state.playing = false; render('Playing in another tab') } } } catch (e) {}

  // leaving the page: remember where the loop had got to and whether it was playing
  function leaving() {
    try { sessionStorage.setItem(POS, String(position())) } catch (e) {}
    if (state.playing) { var was = true; stop(true); state.playing = was; save(); state.playing = false }
  }
  window.addEventListener('pagehide', leaving);
  window.addEventListener('pageshow', function (e) {         // back/forward cache: the page returns as it was left
    if (e.persisted) { state = load(); wanted = state.playing; state.playing = false; vol.value = Math.round(state.vol * 100); arm(); render() }
  });

  function mount() {
    document.body.appendChild(box);
    if (!AC) broken('Music unavailable in this browser');
    else render();
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
