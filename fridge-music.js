/*
 * fridge.run background music - songs played live, not recordings (Mail #15).
 *
 * Each song is a few step patterns (16 steps a bar) for synthesized instruments - bongos, congas, djembe and
 * jungle toms, shaker, clave, kalimba, marimba, bass, pad - and a seed. A small Web Audio sequencer plays them
 * with seeded variations and a fill every fourth bar, so a song never repeats exactly. No audio files.
 *
 *   <script src="https://fridge.run/fridge-music.js" defer></script>        off until you turn it on (go.fridge.run)
 *   <script src="/fridge-music.js" data-autostart defer></script>           on unless you turned it off (fridge.run)
 *   <script src="..." data-engine-only defer></script>                      the engine without the player (the music page)
 *
 * The player is a small round button while you browse; it opens on hover or tap: play, the song list, next, and one
 * speaker button (mute) with a vertical volume slider. Songs saved on the music page (go.fridge.run/music) join the
 * list on that site. Each site remembers its own choice in localStorage; nothing is sent anywhere.
 * window.FridgeMusic is the engine: { songs, instruments, start(song), stop(), setVolume(v), onStep(fn) }.
 */
(function () {
  'use strict';
  if (window.FridgeMusic) return;                        // included twice: still one engine

  var me = document.currentScript;
  var AUTOSTART = !!(me && me.hasAttribute('data-autostart'));
  var ENGINE_ONLY = !!(me && me.hasAttribute('data-engine-only'));
  var AC = window.AudioContext || window.webkitAudioContext;
  var KEY = 'fridge.music', SONGS_KEY = 'fridge.music.songs';

  // ---- songs: x = accent, o = soft, . = rest; melodic lines use scale degrees 1-9, - holds, . rests ---------------
  var BUILT_IN = [
    {id: 'jungle-run', title: 'Jungle Run', mood: 'bongos, quick', bpm: 112, root: 57, scale: 'minor-pent', seed: 11, parts: {
      bongo_hi: 'x..o..x.x..o.x..', bongo_lo: '..x...x...x...xo', conga: 'x...o.x.x...o.x.', shaker: 'oxoxoxoxoxoxoxox',
      kick: 'x.......x..x....', bass: '1...1.3.5...4.3.', kalimba: '5.3.1...5.6.5...'}},
    {id: 'canopy-drums', title: 'Canopy Drums', mood: 'congas and djembe', bpm: 98, root: 55, scale: 'dorian', seed: 23, parts: {
      djembe: 'x..x..x...x.x...', conga: '.o..x..o.o..x..o', bongo_hi: '...o...o...o..oo', shaker: 'o.o.o.o.o.o.o.o.',
      bass: '1.....1.4.....5.', marimba: '1.3.5.3.2.4.6.4.', pad: '1---------------'}},
    {id: 'rain-dance', title: 'Rain Dance', mood: 'heavy jungle drums', bpm: 120, root: 52, scale: 'phrygian', seed: 37, parts: {
      tom_lo: 'x..x..x.x..x..x.', tom_hi: '..o...o...o.o.o.', djembe: 'x.x...x.x.x...x.', kick: 'x...x...x...x...',
      shaker: 'oooooooooooooooo', clave: 'x..x..x...x.x...', bass: '1..1..1.1..2..1.'}},
    {id: 'night-market', title: 'Night Market', mood: 'clave and kalimba', bpm: 92, root: 60, scale: 'major-pent', seed: 41, parts: {
      clave: 'x..x..x...x.x...', bongo_lo: 'x.....x.x.......', shaker: '.o.o.o.o.o.o.o.o',
      kalimba: '1.3.5.6.5.3.2...', bass: '1...5...6...4...', pad: '1-------4-------'}},
    {id: 'panda-trail', title: 'Panda Trail', mood: 'gentle toms', bpm: 78, root: 57, scale: 'minor', seed: 7, parts: {
      tom_lo: 'x.......o.......', tom_hi: '....o.......o..o', shaker: 'o...o...o...o...', marimba: '5.....3.....1...', pad: '1-------6-------'}},
    {id: 'cellar-light', title: 'Cellar Light', mood: 'ambient', bpm: 68, root: 50, scale: 'dorian', seed: 3, parts: {
      pad: '1---------------', kalimba: '5.......3...2...', tom_lo: 'o...............', bass: '1.......5.......'}}
  ];
  var SCALES = {
    'minor-pent': [0, 3, 5, 7, 10], 'major-pent': [0, 2, 4, 7, 9], minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11]
  };
  function customSongs() { try { var a = JSON.parse(localStorage.getItem(SONGS_KEY) || '[]'); return Array.isArray(a) ? a.filter(function (s) { return s && s.id && s.parts; }) : []; } catch (e) { return []; } }
  function allSongs() { return BUILT_IN.concat(customSongs()); }
  function songById(id) { return allSongs().find(function (s) { return s.id === id; }) || BUILT_IN[0]; }

  // ---- instruments: tiny synthesized voices -----------------------------------------------------------------------
  var ctx = null, master = null, noiseBuf = null;
  function audio() {
    if (!ctx) {
      ctx = new AC(); master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return ctx;
  }
  function env(g, t, peak, a, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function drum(t, f0, f1, decay, peak, type, slap) {
    var o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + decay * 0.6);
    env(g, t, peak, 0.003, decay); o.connect(g); g.connect(master); o.start(t); o.stop(t + decay + 0.05);
    if (slap) noise(t, slap[0], slap[1], slap[2], 'bandpass');
  }
  function noise(t, freq, peak, decay, type) {
    var n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); n.buffer = noiseBuf;
    f.type = type || 'highpass'; f.frequency.value = freq; env(g, t, peak, 0.002, decay);
    n.connect(f); f.connect(g); g.connect(master); n.start(t, Math.random() * 0.5); n.stop(t + decay + 0.05);
  }
  function tone(t, freq, peak, decay, type, partial) {
    var o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'sine'; o.frequency.value = freq;
    env(g, t, peak, 0.004, decay); o.connect(g); g.connect(master); o.start(t); o.stop(t + decay + 0.05);
    if (partial) { var p = ctx.createOscillator(), pg = ctx.createGain(); p.frequency.value = freq * partial; env(pg, t, peak * 0.3, 0.002, decay * 0.25); p.connect(pg); pg.connect(master); p.start(t); p.stop(t + decay); }
  }
  function pad(t, freq, peak, len) {
    var f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'lowpass'; f.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + Math.min(1.2, len * 0.4)); g.gain.linearRampToValueAtTime(0.0001, t + len);
    [1, 1.005, 1.5].forEach(function (r) { var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq * r; o.connect(f); o.start(t); o.stop(t + len + 0.1); });
    f.connect(g); g.connect(master);
  }
  var INSTRUMENTS = {
    bongo_hi: {label: 'Bongo high', play: function (t, v) { drum(t, 470, 330, 0.12, 0.5 * v, 'sine', [3200, 0.12 * v, 0.02]); }},
    bongo_lo: {label: 'Bongo low', play: function (t, v) { drum(t, 300, 210, 0.16, 0.55 * v, 'sine', [2400, 0.1 * v, 0.02]); }},
    conga: {label: 'Conga', play: function (t, v) { drum(t, 230, 165, 0.26, 0.6 * v, 'sine', [1800, 0.14 * v, 0.03]); }},
    djembe: {label: 'Djembe', play: function (t, v) { drum(t, 180, 95, 0.32, 0.7 * v, 'sine', [1500, 0.2 * v, 0.04]); }},
    tom_hi: {label: 'Jungle tom high', play: function (t, v) { drum(t, 160, 110, 0.35, 0.6 * v, 'triangle'); }},
    tom_lo: {label: 'Jungle tom low', play: function (t, v) { drum(t, 105, 62, 0.45, 0.75 * v, 'triangle'); }},
    kick: {label: 'Kick', play: function (t, v) { drum(t, 120, 42, 0.32, 0.8 * v, 'sine'); }},
    shaker: {label: 'Shaker', play: function (t, v) { noise(t, 6500, 0.12 * v, 0.05); }},
    clave: {label: 'Clave', play: function (t, v) { tone(t, 2100, 0.22 * v, 0.05, 'sine'); }},
    kalimba: {label: 'Kalimba', melodic: true, play: function (t, v, f) { tone(t, f * 2, 0.22 * v, 0.7, 'sine', 4.1); }},
    marimba: {label: 'Marimba', melodic: true, play: function (t, v, f) { tone(t, f * 2, 0.26 * v, 0.4, 'sine', 3.9); }},
    bass: {label: 'Bass', melodic: true, play: function (t, v, f) { tone(t, f / 2, 0.36 * v, 0.34, 'triangle'); }},
    pad: {label: 'Pad', melodic: true, held: true, play: function (t, v, f, len) { pad(t, f, 0.05 * v, len); }}
  };

  // ---- the sequencer -------------------------------------------------------------------------------------------
  function rng(seed) { var x = seed >>> 0 || 1; return function () { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 10000) / 10000; }; }
  function freqOf(song, degree) { var sc = SCALES[song.scale] || SCALES.minor, d = degree - 1, oct = Math.floor(d / sc.length); return 440 * Math.pow(2, ((song.root || 57) + sc[((d % sc.length) + sc.length) % sc.length] + 12 * oct - 69) / 12); }
  var song = null, step = 0, nextAt = 0, timer = 0, rand = null, stepFns = [], vol = 0.4, muted = false;
  function level() { return muted ? 0 : vol * vol * 0.9; }
  function schedule() {
    var dur = 60 / song.bpm / 4;
    while (nextAt < ctx.currentTime + 0.12) {
      var s = step % 16, bar = Math.floor(step / 16), fill = bar % 4 === 3 && s >= 12;
      Object.keys(song.parts).forEach(function (name) {
        var ins = INSTRUMENTS[name], pat = String(song.parts[name] || ''); if (!ins || !pat) return;
        var c = pat.charAt(s % pat.length);
        if (ins.melodic) {
          if (!/[1-9]/.test(c)) return;
          var len = dur; if (ins.held) { for (var k = s + 1; k < 16 && pat.charAt(k) === '-'; k++) len += dur; }
          var deg = +c + (rand() < 0.12 ? (rand() < 0.5 ? 1 : -1) : 0);           // a passing note now and then
          ins.play(nextAt, 0.85 + rand() * 0.15, freqOf(song, deg), len);
          return;
        }
        var v = c === 'x' ? 1 : c === 'o' ? 0.55 : 0;
        if (!v && fill && /tom|conga|djembe|bongo/.test(name) && rand() < 0.45) v = 0.6;   // fills at the end of every fourth bar
        if (!v && rand() < 0.03 && /bongo|conga|shaker/.test(name)) v = 0.3;               // ghost notes
        if (v && rand() < 0.04 && c !== 'x') v = 0;                                          // the odd drop
        if (v) ins.play(nextAt + (rand() - 0.5) * 0.006, v);
      });
      var at = nextAt, st = s;
      stepFns.forEach(function (fn) { try { fn(st, at); } catch (e) {} });
      nextAt += dur * (s % 2 ? 0.94 : 1.06);                                                // a little swing
      step++;
    }
  }
  var Engine = {
    get songs() { return allSongs(); }, builtIn: BUILT_IN, instruments: INSTRUMENTS, scales: SCALES, customKey: SONGS_KEY,
    get playing() { return !!timer; }, get song() { return song; },
    start: function (s) {
      if (!AC) return Promise.reject(new Error('No Web Audio here'));
      audio(); Engine.stop(true);
      song = s; step = 0; rand = rng(s.seed || 1); nextAt = ctx.currentTime + 0.08;
      return (ctx.state === 'suspended' ? ctx.resume() : Promise.resolve()).then(function () {
        master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
        master.gain.linearRampToValueAtTime(level(), ctx.currentTime + 0.6);
        timer = window.setInterval(schedule, 25); schedule();
      });
    },
    stop: function (quick) {
      if (!timer) return; window.clearInterval(timer); timer = 0;
      if (ctx) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(master.gain.value, ctx.currentTime); master.gain.linearRampToValueAtTime(0, ctx.currentTime + (quick ? 0.08 : 0.5)); }
    },
    setVolume: function (v, m) { vol = Math.max(0, Math.min(1, v)); muted = !!m; if (ctx && timer) master.gain.linearRampToValueAtTime(level(), ctx.currentTime + 0.12); },
    onStep: function (fn) { stepFns.push(fn); },
    get running() { return !!(ctx && ctx.state === 'running'); }
  };
  window.FridgeMusic = Engine;
  if (ENGINE_ONLY) return;

  // ---- the player: a small button that opens on hover ---------------------------------------------------------
  function load() {
    var s = {playing: AUTOSTART, muted: false, vol: 0.4, track: BUILT_IN[0].id};
    try { var j = JSON.parse(localStorage.getItem(KEY) || '{}'); if (typeof j.playing === 'boolean') s.playing = j.playing; if (typeof j.muted === 'boolean') s.muted = j.muted; if (typeof j.vol === 'number') s.vol = Math.max(0, Math.min(1, j.vol)); if (typeof j.track === 'string') s.track = j.track; } catch (e) {}
    return s;
  }
  var state = load(), wanted = state.playing;
  function save() { try { localStorage.setItem(KEY, JSON.stringify({playing: Engine.playing || wanted, muted: state.muted, vol: state.vol, track: state.track})); } catch (e) {} }
  vol = state.vol; muted = state.muted;

  var R = '#fridge-music';
  var css = R + '{all:initial;position:fixed;right:14px;bottom:14px;z-index:2147483000;display:flex;align-items:center;gap:5px;box-sizing:border-box;' +
    'height:40px;padding:4px;border-radius:999px;background:rgba(23,27,34,.86);border:1px solid rgba(255,255,255,.14);box-shadow:0 6px 18px rgba(0,0,0,.35);' +
    'font:12px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Ubuntu,sans-serif;color:#e8edf1;transition:padding .2s}' +
    R + ' *{box-sizing:border-box}' +
    R + ' button{all:unset;box-sizing:border-box;display:grid;place-items:center;flex:none;width:30px;height:30px;border-radius:50%;cursor:pointer;color:#e8edf1;font-family:inherit;font-size:14px;line-height:1;text-align:center}' +
    R + ' button:hover{background:rgba(255,255,255,.12)}' + R + ' button:focus-visible,' + R + ' select:focus-visible{outline:2px solid #2bb59c;outline-offset:1px}' +
    R + ' .fm-dot{width:32px;height:32px;background:#2bb59c;color:#fff}' + R + '.fm-on .fm-dot{background:#1e8f7a}' +
    R + ' .fm-more{display:none;align-items:center;gap:4px}' + R + '.fm-open .fm-more{display:flex}' +
    R + ' select.fm-song{all:unset;box-sizing:border-box;height:28px;max-width:150px;padding:0 22px 0 9px;border-radius:14px;background:rgba(255,255,255,.08) url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2710%27 height=%276%27%3E%3Cpath d=%27M0 0l5 6 5-6z%27 fill=%27%23aab4be%27/%3E%3C/svg%3E") no-repeat right 8px center;color:#e8edf1;font-family:inherit;font-weight:600;font-size:12px;line-height:28px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    R + ' select.fm-song option{color:#16181d}' +
    R + ' .fm-spk{position:relative}' +
    R + ' .fm-volbox{display:none;position:absolute;bottom:36px;left:50%;transform:translateX(-50%);width:34px;height:118px;padding:8px 0;border-radius:17px;background:rgba(23,27,34,.92);border:1px solid rgba(255,255,255,.14)}' +
    R + ' .fm-spk:hover .fm-volbox,' + R + ' .fm-spk:focus-within .fm-volbox{display:block}' +
    R + ' input.fm-vol{all:revert;-webkit-appearance:slider-vertical;appearance:slider-vertical;writing-mode:vertical-lr;direction:rtl;width:18px;height:100px;margin:0 auto;display:block;accent-color:#2bb59c}' +
    R + ' .fm-eq{display:inline-flex;align-items:flex-end;gap:2px;height:12px}' + R + ' .fm-eq i{display:block;width:3px;height:4px;border-radius:1px;background:#fff}' +
    R + '.fm-on .fm-eq i{animation:fm-eq 1.2s ease-in-out infinite}' + R + ' .fm-eq i:nth-child(2){animation-delay:-.4s}' + R + ' .fm-eq i:nth-child(3){animation-delay:-.8s}' +
    '@keyframes fm-eq{0%,100%{height:3px}50%{height:12px}}@media (prefers-reduced-motion:reduce){' + R + ' .fm-eq i{animation:none!important;height:8px}}' +
    R + ' .fm-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}@media print{' + R + '{display:none}}';

  var box = document.createElement('div');
  box.id = 'fridge-music'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Background music');
  box.innerHTML =
    '<button type="button" class="fm-dot fm-play" aria-pressed="false" title="Music"><span class="fm-eq" aria-hidden="true"><i></i><i></i><i></i></span><span class="fm-sr">Play background music</span></button>' +
    '<span class="fm-more"><select class="fm-song" aria-label="Song"></select>' +
    '<button type="button" class="fm-next" title="Next song" aria-label="Next song">⏭</button>' +
    '<span class="fm-spk"><button type="button" class="fm-mute" aria-pressed="false" title="Mute - hover for volume">🔉</button>' +
    '<span class="fm-volbox"><input type="range" class="fm-vol" min="0" max="100" step="5" aria-label="Volume" orient="vertical"></span></span></span>' +
    '<span class="fm-sr fm-live" role="status" aria-live="polite"></span>';
  var play = box.querySelector('.fm-play'), select = box.querySelector('.fm-song'), next = box.querySelector('.fm-next');
  var mute = box.querySelector('.fm-mute'), volIn = box.querySelector('.fm-vol'), live = box.querySelector('.fm-live');
  volIn.value = Math.round(state.vol * 100);

  function fillSongs() {
    select.innerHTML = allSongs().map(function (s) { return '<option value="' + s.id + '">' + String(s.title).replace(/[<&]/g, '') + '</option>'; }).join('');
    if (!allSongs().some(function (s) { return s.id === state.track; })) state.track = BUILT_IN[0].id;
    select.value = state.track;
  }
  function render() {
    var on = Engine.playing, s = songById(state.track);
    box.classList.toggle('fm-on', on && !state.muted);
    play.setAttribute('aria-pressed', String(on || wanted));
    play.title = (on ? 'Pause' : wanted ? 'Tap anywhere to start' : 'Play') + ' · ' + s.title + ' (' + s.mood + ')';
    play.querySelector('.fm-sr').textContent = on || wanted ? 'Pause background music' : 'Play background music';
    mute.setAttribute('aria-pressed', String(state.muted));
    mute.textContent = state.muted || state.vol === 0 ? '🔇' : '🔉';
    live.textContent = s.title;
  }
  function start() { var s = songById(state.track); Engine.setVolume(state.vol, state.muted); return Engine.start(s).then(function () { wanted = false; disarm(); save(); render(); if (chan) chan.postMessage('playing'); }, function () {}); }
  function stop() { wanted = false; disarm(); Engine.stop(); save(); render(); }

  play.addEventListener('click', function () { if (Engine.playing || wanted) stop(); else start(); });
  select.addEventListener('change', function () { state.track = select.value; save(); if (Engine.playing) start(); render(); });
  next.addEventListener('click', function () { var all = allSongs(), i = all.findIndex(function (s) { return s.id === state.track; }); state.track = all[(i + 1) % all.length].id; select.value = state.track; save(); if (Engine.playing || wanted) start(); render(); });
  mute.addEventListener('click', function () { state.muted = !state.muted; Engine.setVolume(state.vol, state.muted); save(); render(); });
  volIn.addEventListener('input', function () { state.vol = volIn.value / 100; if (state.vol > 0) state.muted = false; Engine.setVolume(state.vol, state.muted); save(); render(); });

  // small while you browse: opens on hover or focus, closes a moment after you leave
  var closeT = 0;
  function open() { window.clearTimeout(closeT); box.classList.add('fm-open'); }
  function closeSoon() { window.clearTimeout(closeT); closeT = window.setTimeout(function () { if (!box.contains(document.activeElement)) box.classList.remove('fm-open'); }, 1200); }
  box.addEventListener('pointerenter', open); box.addEventListener('pointerleave', closeSoon);
  box.addEventListener('focusin', open); box.addEventListener('focusout', closeSoon);
  play.addEventListener('touchstart', open, {passive: true});

  // "on" but the browser wants a gesture first: the first tap, click or key anywhere starts it
  function disarm() { document.removeEventListener('pointerdown', onFirst, true); document.removeEventListener('keydown', onFirst, true); }
  function onFirst(e) { if (box.contains(e.target)) return; disarm(); if (wanted && !Engine.playing) start(); }
  function arm() { disarm(); if (wanted) { document.addEventListener('pointerdown', onFirst, true); document.addEventListener('keydown', onFirst, true); } }

  var chan = null;
  try { chan = new BroadcastChannel('fridge-music'); chan.onmessage = function (m) { if (m.data === 'playing' && Engine.playing) { Engine.stop(true); wanted = false; save(); render(); } }; } catch (e) {}
  window.addEventListener('pagehide', function () { if (Engine.playing) { wanted = true; save(); } });
  window.addEventListener('storage', function (e) { if (e.key === SONGS_KEY) fillSongs(); });

  function mount() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    document.body.appendChild(box);
    fillSongs(); render();
    if (!AC) { play.disabled = true; play.title = 'Music unavailable in this browser'; return; }
    if (wanted) { arm(); audio(); if (ctx.state === 'running') start(); }
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
}());
