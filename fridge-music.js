/*
 * fridge.run background music - songs played live, not recordings (Mail #15).
 *
 * Each song is a few step patterns (16 steps a bar) for synthesized instruments - bongos, congas, djembe and
 * jungle toms, shaker, clave, kalimba, marimba, bass, pad; a rock kit (snare, hats, crash) and synth bass, horn and
 * brass for darker songs; boom, crack, distorted lead, didgeridoo drone and gulls for industrial ones - and a seed. A small Web Audio sequencer plays them
 * with seeded variations and a fill every fourth bar, so a song never repeats exactly. No audio files.
 *
 *   <script src="https://fridge.run/fridge-music.js" defer></script>        off until you turn it on (go.fridge.run)
 *   <script src="/fridge-music.js" data-autostart defer></script>           on unless you turned it off (fridge.run)
 *   <script src="..." data-engine-only defer></script>                      the engine without the player (the music page)
 *
 * The player is a small round button while you browse; it opens on hover or tap: play, the song list, next, and one
 * speaker button (mute) with a vertical volume slider. Songs saved on the music page (go.fridge.run/music) join the
 * list on that site. Each site remembers its own choice in localStorage; nothing is sent anywhere.
 * window.FridgeMusic is the engine: { songs, instruments, start(song), stop(), setVolume(v), onStep(fn),
 *   songById(id), setLevel(x), noteName(song, degree) }.
 * Songs may span several bars (a part's pattern is 16 steps per bar; shorter patterns repeat), may name `layers`
 * (part -> the intensity it needs, 0..1.5, see setLevel) and `bpmRise` (extra BPM at full intensity), and may set
 * `bed: true` for a continuous drone, and `player: false` to stay off the little player (music page only). One engine for every fridge sound: fridge.run, go.fridge.run/music and the
 * Lucky Monkey game (its jungle music is the song `lucky-monkey-jungle`, driven by the game's threat level).
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
      pad: '1---------------', kalimba: '5.......3...2...', tom_lo: 'o...............', bass: '1.......5.......'}},
    // Lucky Monkey (the game): jungle at night. A drone and birds, growing into shaker, bongos, marimba over
    // Am-F-C-G, a cuica and a low tom as the threat rises. The game sets the intensity with setLevel (0..1.5).
    {id: 'lucky-monkey-jungle', title: 'Lucky Monkey: Jungle at Night', mood: 'the game: drone and birds into a groove', game: 'luckymonkey',
      // Note for note from the game: Am-F-C-G marimba (rows F4..G5, so F lydian = A minor's notes), straight time,
      // no variations (exact), the game's own voices (lm_*), a drone on A (bedRoot) at the game's loudness.
      bpm: 92, bpmRise: 20, root: 53, scale: 'lydian', seed: 5, bars: 4, bed: true, bedRoot: 57, bedGain: 3.5, exact: true,
      layers: {birds: 0.01, lm_shaker: 0.3, lm_bongo_lo: 0.45, lm_bongo_hi: 0.45, lm_marimba: 0.6, cuica: 0.7, lm_tom: 0.9}, parts: {
      birds: 'o...............o...............o...............o...............',
      lm_shaker: 'o.x.o.x.o.x.o.x.', lm_bongo_lo: 'x....x..x....x..', lm_bongo_hi: '...x..x...x...xx',
      lm_marimba: '3...7...5...7.3.1...5...3...5.1.5...9...7...9.5.2...6...4...6.2.',
      cuica: '......x.......o.', lm_tom: 'x.......x.......'}},
    // Kaon (Half-Life, Kelly Bailey): a cover, transcribed note for note from bars 2-9 of a fan MIDI (the main loop;
    // the bridge and the intro are left out). E phrygian, 180 BPM, straight. Only on the music page (player: false).
    {id: 'kaon', title: 'Kaon (Half-Life cover)', mood: 'industrial, fast', player: false,
      bpm: 180, root: 52, scale: 'phrygian', seed: 9, bars: 8, exact: true, parts: {
      tom_lo: 'x...x.........x.....x...........x...x.........x.....x...........x...x.........x.....x...........x...x.........x.....x...........',
      snare: 'o.o.o.o.x.o.o.o.o.o.o.o.x.o.o.o.o.o.o.o.x.o.o.o.o.o.o.o.x.o.o.o.o.o.o.o.x.o.o.o.o.o.o.o.x.o.o.o.o.o.o.o.x.o.o.x.xxx.o.x.xxx.o.x.',
      hat: 'x.x.x.x.x.x.x.x.',
      hat_open: 'x...x...x...x...x...x...x...x...x...x...x...x...x...x...x...x...x...x...x...x...x...x...x...x...x...x...x...x...x...x...x...x.x.',
      crash: 'o.......o.....o.....o...o.......',
      synth_bass: '1...1...1.....2.....1...2...1...1...1...1.....3.....1...4...1...1...1...1.....2.....1...2...1...3...3...3.....4.....2...4...2...',
      horn: '1...1.......1...2...1...2...1...1...2.......1...2...1...2...1...1...1.......1...2...1...2...1...1...2.......4...2...4...2...4...',
      brass: '1...1...1...1...2...1...2...1...1...1...2...1...2...1...2...1...1...1...1...1...2...1...2...1...1...1...2...1...4...2...4...2...',
      pad: '1-------------------------------------------------------------------------------------------------------------------------------'}},
    // Disrupted Distillation: an original industrial groove (C# phrygian, 99 BPM) on the industrial voices, written to the
    // measured feel of a Half-Life 2: Episode One combat cue (sub-heavy boom, metal crack, distorted lead, drone,
    // buzzing gulls); none of that cue's notes. Music page only.
    {id: 'disrupted-distillation', title: 'Disrupted Distillation', mood: 'industrial, heavy', player: false,
      bpm: 99, root: 49, scale: 'phrygian', seed: 17, bars: 8, exact: true, parts: {
      boom: 'x.....x...x.....x.....x.x...x...',
      crack: '....x.......x.......x.......x.o.',
      synth_bass: '1.....1.1...2...1.....1.5...4...1.....1.1...2...1...7...6...5...',
      didge: '1-------------------------------1---------------2---------------1-------------------------------5---------------2---------------',
      dist_lead: '................................5.....4.5...2...1...............5.....4.5...6...5...4...2.......8.......7.....5.4...2...1.......',
      gulls: '........................x.......................x.........................................x.........................x...........'}}
  ];
  var SCALES = {
    'minor-pent': [0, 3, 5, 7, 10], 'major-pent': [0, 2, 4, 7, 9], minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], lydian: [0, 2, 4, 6, 7, 9, 11]
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
  // A synth voice: detuned oscillators through a low-pass that closes from cut0 to cut1 (horn, brass, synth bass).
  function synth(t, freq, peak, len, type, cut0, cut1, detunes) {
    var f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'lowpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(cut0, t); f.frequency.exponentialRampToValueAtTime(cut1, t + len * 0.8);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    g.gain.setValueAtTime(peak, t + len * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    (detunes || [1]).forEach(function (r) { var o = ctx.createOscillator(); o.type = type; o.frequency.value = freq * r; o.connect(f); o.start(t); o.stop(t + len + 0.05); });
    f.connect(g); g.connect(master);
  }
  // A soft-clipping waveshaper (distortion), one curve per amount. Odd length and symmetric, so silence stays 0 (no DC offset).
  var curves = {};
  function shaper(k) {
    if (!curves[k]) { var n = 1025, c = new Float32Array(n); for (var i = 0; i < n; i++) { var x = i * 2 / (n - 1) - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); } curves[k] = c; }
    var w = ctx.createWaveShaper(); w.curve = curves[k]; w.oversample = '2x'; return w;
  }
  // Boom: a huge, muffled sub hit (pitch-dropping sine, a low thump of noise, gently driven, low-passed).
  function boom(t, peak) {
    var o = ctx.createOscillator(), g = ctx.createGain(), w = shaper(3), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
    o.frequency.setValueAtTime(82, t); o.frequency.exponentialRampToValueAtTime(36, t + 0.45);
    env(g, t, peak, 0.004, 0.75); o.connect(w); w.connect(lp); lp.connect(g); g.connect(master); o.start(t); o.stop(t + 0.85);
    noise(t, 380, peak * 0.35, 0.12, 'lowpass');
  }
  // Crack: industrial metal - a bright noise burst plus two clanging, inharmonic square partials.
  function crack(t, peak) {
    noise(t, 3200, peak, 0.16, 'bandpass');
    [540, 1187].forEach(function (f, i) { var o = ctx.createOscillator(), g = ctx.createGain(), bp = ctx.createBiquadFilter(); o.type = 'square'; o.frequency.value = f;
      bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 1.2; env(g, t, peak * (i ? 0.25 : 0.35), 0.002, 0.09);
      o.connect(bp); bp.connect(g); g.connect(master); o.start(t); o.stop(t + 0.12); });
  }
  // Distorted lead: two detuned saws driven hard into a waveshaper, then tamed with a low-pass.
  function distLead(t, freq, peak, len) {
    var w = shaper(40), lp = ctx.createBiquadFilter(), g = ctx.createGain(); lp.type = 'lowpass'; lp.frequency.value = 1500; lp.Q.value = 1;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.01); g.gain.setValueAtTime(peak, t + len * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    [1, 1.008].forEach(function (r) { var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq * r; o.connect(w); o.start(t); o.stop(t + len + 0.05); });
    w.connect(lp); lp.connect(g); g.connect(master);
  }
  // Didgeridoo-style drone: a low buzzy pulse through two vocal formants that sweep slowly (the "wah"), held.
  function didge(t, freq, peak, len) {
    var o = ctx.createOscillator(), g = ctx.createGain(), mix = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = freq; mix.gain.value = 1;
    var lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 1.6; lg.gain.value = 160; lfo.connect(lg);
    [[340, 7, 1], [1150, 9, 0.5]].forEach(function (fm) { var bp = ctx.createBiquadFilter(), bg = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = fm[0]; bp.Q.value = fm[1]; bg.gain.value = fm[2];
      lg.connect(bp.frequency); o.connect(bp); bp.connect(bg); bg.connect(mix); });
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.08); g.gain.setValueAtTime(peak, t + Math.max(0.1, len - 0.15)); g.gain.linearRampToValueAtTime(0.0001, t + len);
    mix.connect(g); g.connect(master); o.start(t); lfo.start(t); o.stop(t + len + 0.05); lfo.stop(t + len + 0.05);
  }
  // Gulls: a buzzing, distorted cry - a pitch that leaps up and sags, roughened by fast vibrato.
  function gulls(t, peak) {
    var base = 780 + Math.random() * 260, o = ctx.createOscillator(), g = ctx.createGain(), w = shaper(25), bp = ctx.createBiquadFilter(); o.type = 'sawtooth';
    var vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 34; vg.gain.value = base * 0.06; vib.connect(vg); vg.connect(o.frequency);
    o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * 1.7, t + 0.07); o.frequency.exponentialRampToValueAtTime(base * 0.8, t + 0.42);
    bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 1.5; env(g, t, peak, 0.02, 0.45);
    o.connect(w); w.connect(bp); bp.connect(g); g.connect(master); o.start(t); vib.start(t); o.stop(t + 0.5); vib.stop(t + 0.5);
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
    kalimba: {label: 'Kalimba', melodic: true, oct: 1, play: function (t, v, f) { tone(t, f * 2, 0.22 * v, 0.7, 'sine', 4.1); }},
    marimba: {label: 'Marimba', melodic: true, oct: 1, play: function (t, v, f) { tone(t, f * 2, 0.26 * v, 0.4, 'sine', 3.9); }},
    bass: {label: 'Bass', melodic: true, oct: -1, play: function (t, v, f) { tone(t, f / 2, 0.36 * v, 0.34, 'triangle'); }},
    pad: {label: 'Pad', melodic: true, held: true, play: function (t, v, f, len) { pad(t, f, 0.05 * v, len); }},
    snare: {label: 'Snare', play: function (t, v) { drum(t, 210, 150, 0.09, 0.35 * v, 'triangle'); noise(t, 1800, 0.3 * v, 0.14); }},
    hat: {label: 'Hi-hat', play: function (t, v) { noise(t, 8500, 0.1 * v, 0.03); }},
    hat_open: {label: 'Open hi-hat', play: function (t, v) { noise(t, 7500, 0.08 * v, 0.2); }},
    crash: {label: 'Crash', play: function (t, v) { noise(t, 5000, 0.12 * v, 0.9); }},
    synth_bass: {label: 'Synth bass', melodic: true, oct: -2, play: function (t, v, f) { synth(t, f / 4, 0.34 * v, 0.3, 'sawtooth', 900, 160, [1, 1.006]); }},
    horn: {label: 'Horn', melodic: true, play: function (t, v, f) { synth(t, f, 0.13 * v, 0.32, 'sawtooth', 2400, 600, [1, 1.004]); }},
    brass: {label: 'Brass', melodic: true, play: function (t, v, f) { synth(t, f, 0.1 * v, 0.3, 'square', 1800, 450, [0.997, 1.003]); }},
    boom: {label: 'Boom', play: function (t, v) { boom(t, 0.55 * v); }},
    crack: {label: 'Metal crack', play: function (t, v) { crack(t, 2 * v); }},
    dist_lead: {label: 'Distorted lead', melodic: true, play: function (t, v, f) { distLead(t, f, 0.1 * v, 0.34); }},
    didge: {label: 'Didgeridoo drone', melodic: true, held: true, oct: -1, play: function (t, v, f, len) { didge(t, f / 2, 0.22 * v, len); }},
    gulls: {label: 'Gulls', play: function (t, v) { gulls(t, 0.12 * v); }},
    cuica: {label: 'Cuica', play: function (t, v) { cuica(t, 0.17 * v); }},
    birds: {label: 'Birds', chance: 0.45, play: function (t, v) { birds(t, 0.09 * v); }},
    // Lucky Monkey's own voices, exactly as the game synthesized them (louder by the engine's master ratio):
    lm_bongo_hi: {label: 'Bongo high (Lucky Monkey)', play: function (t, v) { drum(t, 420, 300, 0.18, 0.31 * v, 'sine', [2500, 0.16 * v, 0.03]); }},
    lm_bongo_lo: {label: 'Bongo low (Lucky Monkey)', play: function (t, v) { drum(t, 280, 190, 0.18, 0.31 * v, 'sine', [1500, 0.16 * v, 0.03]); }},
    lm_marimba: {label: 'Marimba (Lucky Monkey)', melodic: true, oct: 1, play: function (t, v, f) { tone(t, f * 2, 0.17 * v, 0.5, 'sine'); tone(t, f * 8, 0.045 * v, 0.09, 'sine'); }},
    lm_tom: {label: 'Low tom (Lucky Monkey)', play: function (t, v) { drum(t, 110, 50, 0.35, 0.42 * v, 'sine'); }},
    lm_shaker: {label: 'Shaker (Lucky Monkey)', play: function (t, v) { noise(t, 6500, 0.07 * v, 0.05); }}
  };
  // Cuica: the friction drum's "whoop", a pitch glide up then down (Lucky Monkey).
  function cuica(t, peak) {
    var o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'triangle';
    f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 2;
    o.frequency.setValueAtTime(380, t); o.frequency.exponentialRampToValueAtTime(760, t + 0.09); o.frequency.exponentialRampToValueAtTime(420, t + 0.24);
    env(g, t, peak, 0.02, 0.24); o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + 0.32);
  }
  // Birds: a few chirps that slide up, or a quick trill (Lucky Monkey).
  function birds(t, peak) {
    var base = 1800 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 4), trill = Math.random() < 0.4;
    for (var k = 0; k < n; k++) {
      var at = t + k * (trill ? 0.06 : 0.14), o = ctx.createOscillator(), g = ctx.createGain(), d = trill ? 0.05 : 0.11;
      o.frequency.setValueAtTime(base * (trill ? 1 : 0.8), at); o.frequency.exponentialRampToValueAtTime(base * (trill ? 1.15 : 1.3), at + d * 0.85);
      env(g, at, peak, 0.004, d); o.connect(g); g.connect(master); o.start(at); o.stop(at + d + 0.05);
    }
  }
  // The bed: a warm low drone (two detuned saws + a soft fifth through a slowly breathing low-pass), for songs with
  // `bed: true`. Its loudness and brightness follow the intensity.
  var bed = null;
  function bedOn(s) {
    if (bed || !s.bed) return;
    var g = ctx.createGain(), lp = ctx.createBiquadFilter(), f0 = 440 * Math.pow(2, ((s.bedRoot || s.root || 57) - 69) / 12) / 4;
    g.gain.value = 0; lp.type = 'lowpass'; lp.frequency.value = 220; lp.Q.value = 0.7;
    var oscs = [[f0, 'sawtooth', 1], [f0 * 1.005, 'sawtooth', 1], [f0 * 1.498, 'sine', 0.4]].map(function (x) {
      var o = ctx.createOscillator(), og = ctx.createGain(); o.type = x[1]; o.frequency.value = x[0]; og.gain.value = x[2];
      o.connect(og); og.connect(lp); o.start(); return o; });
    var lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 60; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    lp.connect(g); g.connect(master); bed = {g: g, lp: lp, oscs: oscs.concat([lfo])};
  }
  function bedLevel() {
    if (!bed) return; var now = ctx.currentTime;
    bed.g.gain.setTargetAtTime(intensity > 0 ? (0.05 + intensity * 0.02) * ((song && song.bedGain) || 1) : 0, now, 1.2);
    bed.lp.frequency.setTargetAtTime(200 + intensity * 320, now, 1.5);
  }
  function bedOff() { if (!bed) return; var b = bed; bed = null; b.g.gain.setTargetAtTime(0, ctx.currentTime, 0.3); window.setTimeout(function () { b.oscs.forEach(function (o) { try { o.stop(); } catch (e) {} }); }, 1500); }

  // ---- the sequencer -------------------------------------------------------------------------------------------
  function rng(seed) { var x = seed >>> 0 || 1; return function () { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 10000) / 10000; }; }
  function freqOf(song, degree) { var sc = SCALES[song.scale] || SCALES.minor, d = degree - 1, oct = Math.floor(d / sc.length); return 440 * Math.pow(2, ((song.root || 57) + sc[((d % sc.length) + sc.length) % sc.length] + 12 * oct - 69) / 12); }
  var song = null, step = 0, nextAt = 0, timer = 0, rand = null, stepFns = [], vol = 0.4, muted = false, intensity = 1;
  function barsOf(s) { return Math.max(1, Math.min(8, +s.bars || 1)); }
  function noteName(s, degree, octShift) {   // octShift: the instrument's octave (marimba +1, bass -1)
    var NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'], sc = SCALES[s.scale] || SCALES.minor, d = degree - 1, oct = Math.floor(d / sc.length);
    var midi = (s.root || 57) + sc[((d % sc.length) + sc.length) % sc.length] + 12 * oct; midi += 12 * (octShift || 0); return NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
  }
  function level() { return muted ? 0 : vol * vol * 0.9; }
  function schedule() {
    var dur = 60 / ((song.bpm || 100) + (song.bpmRise || 0) * Math.min(intensity, 1.4) / 1.4) / 4, total = 16 * barsOf(song);
    while (nextAt < ctx.currentTime + 0.12) {
      var g = step % total, s = g % 16, bar = Math.floor(step / 16), fill = bar % 4 === 3 && s >= 12;
      Object.keys(song.parts).forEach(function (name) {
        var ins = INSTRUMENTS[name], pat = String(song.parts[name] || ''); if (!ins || !pat) return;
        if (song.layers && song.layers[name] != null && intensity < song.layers[name]) return;   // not loud enough yet
        var at0 = g % pat.length, c = pat.charAt(at0);
        if (ins.melodic) {
          if (!/[1-9]/.test(c)) return;
          var len = dur; if (ins.held) { for (var k = at0 + 1; k < pat.length && pat.charAt(k) === '-'; k++) len += dur; }
          var deg = +c + (!song.exact && rand() < 0.12 ? (rand() < 0.5 ? 1 : -1) : 0);   // a passing note now and then
          ins.play(nextAt, 0.85 + rand() * 0.15, freqOf(song, deg), len);
          return;
        }
        var v = c === 'x' ? 1 : c === 'o' ? 0.55 : 0;
        if (v && ins.chance && rand() > ins.chance) v = 0;                                  // birds call now and then
        if (!song.exact) {
        if (!v && fill && /tom|conga|djembe|bongo/.test(name) && rand() < 0.45) v = 0.6;   // fills at the end of every fourth bar
        if (!v && rand() < 0.03 && /bongo|conga|shaker/.test(name)) v = 0.3;               // ghost notes
        if (v && rand() < 0.04 && c !== 'x') v = 0;                                          // the odd drop
        }
        if (v) ins.play(nextAt + (rand() - 0.5) * 0.006, v);
      });
      var at = nextAt, st = s, gst = g;
      stepFns.forEach(function (fn) { try { fn(st, at, gst); } catch (e) {} });          // step in bar, time, step in song
      nextAt += song.exact ? dur : dur * (s % 2 ? 0.94 : 1.06);                              // a little swing (not for exact songs)
      step++;
    }
  }
  var Engine = {
    get songs() { return allSongs(); }, builtIn: BUILT_IN, instruments: INSTRUMENTS, scales: SCALES, customKey: SONGS_KEY,
    songById: songById, noteName: noteName, barsOf: barsOf,
    get level() { return intensity; },
    setLevel: function (x) { intensity = Math.max(0, Math.min(1.5, +x || 0)); if (ctx) bedLevel(); },
    get playing() { return !!timer; }, get song() { return song; },
    start: function (s) {
      if (!AC) return Promise.reject(new Error('No Web Audio here'));
      audio(); Engine.stop(true);
      song = s; step = 0; rand = rng(s.seed || 1); nextAt = ctx.currentTime + 0.08; bedOff(); bedOn(s);
      return (ctx.state === 'suspended' ? ctx.resume() : Promise.resolve()).then(function () {
        master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
        master.gain.linearRampToValueAtTime(level(), ctx.currentTime + 0.6);
        bedLevel(); timer = window.setInterval(schedule, 25); schedule();
      });
    },
    stop: function (quick) {
      if (!timer) return; window.clearInterval(timer); timer = 0; bedOff();
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

  function playerSongs() { return allSongs().filter(function (s) { return s.player !== false; }); }   // player: false = music page only
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
    R + ' .fm-eq{display:inline-flex;align-items:flex-end;gap:2px;height:12px}' + R + ' .fm-eq i{display:block;width:3px;height:12px;border-radius:1px;background:#fff;transform:scaleY(.33);transform-origin:50% 100%}' +
    R + '.fm-on .fm-eq i{animation:fm-eq 1.2s ease-in-out infinite}' + R + ' .fm-eq i:nth-child(2){animation-delay:-.4s}' + R + ' .fm-eq i:nth-child(3){animation-delay:-.8s}' +
    '@keyframes fm-eq{0%,100%{transform:scaleY(.25)}50%{transform:scaleY(1)}}@media (prefers-reduced-motion:reduce){' + R + ' .fm-eq i{animation:none!important;transform:scaleY(.66)}}' +
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
    select.innerHTML = playerSongs().map(function (s) { return '<option value="' + s.id + '">' + String(s.title).replace(/[<&]/g, '') + '</option>'; }).join('');
    if (!playerSongs().some(function (s) { return s.id === state.track; })) state.track = BUILT_IN[0].id;
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
  next.addEventListener('click', function () { var all = playerSongs(), i = all.findIndex(function (s) { return s.id === state.track; }); state.track = all[(i + 1) % all.length].id; select.value = state.track; save(); if (Engine.playing || wanted) start(); render(); });
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
