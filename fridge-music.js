/*
 * fridge.run background music - songs played live, not recordings (Mail #15).
 *
 * Each song is a few step patterns (16 steps a bar) for synthesized instruments - bongos, congas, djembe and
 * jungle toms, shaker, clave, kalimba, marimba, bass, pad; a rock kit (snare, hats, crash) and synth bass, horn and
 * brass for darker songs; boom, crack, distorted lead, didgeridoo drone and gulls for industrial ones - and a seed. A small Web Audio sequencer plays them
 * with seeded variations and a fill every fourth bar (song.mix sets a part's volume, song.echo sends parts to one shared tempo echo), so a song never repeats exactly. No audio files.
 *
 *   <script src="https://fridge.run/fridge-music.js" defer></script>        off until you turn it on (go.fridge.run)
 *   <script src="/fridge-music.js" data-autostart defer></script>           on unless you turned it off (fridge.run)
 *   <script src="..." data-engine-only defer></script>                      the engine without the player (the music page)
 *
 * The player is a small round button while you browse; it opens on hover or tap: play, the song list, next, and one
 * speaker button (mute) with a vertical volume slider. Songs saved on the music page (go.fridge.run/music) join the
 * list on that site. Each site remembers its own choice in localStorage; nothing is sent anywhere.
 * window.FridgeMusic is the engine: { songs, instruments, start(song), stop(), setVolume(v), onStep(fn), onSong(fn), resolve,
 *   songById(id), setLevel(x), noteName(song, degree) }.
 * Songs may span several bars (a part's pattern is 16 steps per bar; shorter patterns repeat), may name `layers`
 * (part -> the intensity it needs, 0..1.5, see setLevel) and `bpmRise` (extra BPM at full intensity), and may set
 * `bed: true` for a continuous drone, `player: false` to stay off the little player (music page only), and
 * `next` (a song id) to play on into that song when it ends - songs linked into parts - and `shift` (semitones per
 * bar, e.g. [0, 0, 0, -5]) to move a bar's notes into another key, for breakdowns. One engine for every fridge sound: fridge.run, go.fridge.run/music and the
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

  // ---- songs: x = accent, o = soft, d = double (a hit, then another half a step later), . = rest; melodic lines use scale degrees 1-9, - holds, . rests ---------------
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
    // Control (Metro Station cover): an 8-bar loop - the keyboard riff (an E pedal under A-C-E, then the E-F rock), the
    // chorus power-chord line and Am-C-F-E roots, from fan tabs, with Kalimba doubling the riff an octave up; written as a MIDI file and brought in with the music
    // page's MIDI import (A minor, written as D dorian so the riff fits the note rows). Music page only.
    {id: 'control-cover', title: 'Control (Metro Station cover)', mood: 'synth-pop, bright', player: false,
      bpm: 95, root: 62, scale: 'dorian', seed: 3, bars: 8, exact: true, parts: {
      kick: 'x.......x.x.....x.......x.x.....x.......x.x.....x.......x.x.....x...x...x...x...x...x...x...x...x...x...x...x...x.......x.x.....',
      snare: '....x.......x.......x.......x.......x.......x.......x.......x.......x.......x.......x.......x.......x.......x.......x.......xodo',
      hat: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x...x...x...x...x...x...x...x...x...x...x...x...x.x.x.x.x.x.x.x.',
      hat_open: '..................................................................o...o...o...o...o...o...o...o...o...o...o...o.................',
      crash: 'x...............................................................x...............................................................',
      horn: '25252729232323272525272924242523252527292323232725252729242425237.7.4.4.3.3.2.2.1.2.1.2.6.7.6.7.7.7.4.4.3.3.2.2.2525272923232327',
      kalimba: '2525272923232327252527292424252325252729232323272525272924242523................................................2525272923232327',
      synth_bass: '5.5.5.5.5.5.5.5.7.7.7.7.7.7.7.7.3.3.3.3.3.3.3.3.2.2.2.9.2.2.2.9.7.7.4.4.3.3.2.2.1.2.1.2.6.7.6.7.7.7.4.4.3.3.2.2.2.2.2.2.2.2.2.2.',
      pad: '7---------------9---------------5---------------6---------------9-------8-------7-------6-------9-------8-------6---------------'}},
    // Disrupted Distillation: an original industrial piece (C# phrygian, 99 BPM) led by a didgeridoo solo over buzz
    // pads, hard booms and metal, written to the measured feel of a Half-Life 2: Episode One combat cue; none of that
    // cue's notes. Bar 4 breaks down low (sub drop, deep didgeridoo), pound toms add off-beat half beats, and bar 8
    // builds a pat-patapat crescendo into the pow (boom + crash) of bar 1. Music page only.
    {id: 'disrupted-distillation', title: 'Disrupted Distillation', mood: 'industrial, didgeridoo', player: false,
      bpm: 99, root: 49, scale: 'phrygian', seed: 17, bars: 8, exact: true, parts: {
      boom: 'x.......x.x.....x.....x...x.x...x.......x.x.....x...............x.......x.x.....x.....x...x.x...x.......x.x.....x.......x...x.x.',
      crack: '....x.......x.......x.......x.......x.......x...........x...........x.......x.......x.......x.......x.......x.......x...x.d.dxdx',
      pound: '......o...............o..d....................o.......................o...............d..o...x....o.......o..o..o...o...o.o.dxdd',
      clank: '..o...x....o.x....o...x..o...x.o..o...x....o.x........x...........o...x....o.x....o...x..o...x.o..o...x....o.x....o...x...o.x.xx',
      crash: 'x...............................................................o...............................................................',
      drop: '................................................x...............................................................................',
      steam: '........................................................x.......................................................................',
      didge: '1---------------1-------1---1---1-----1-----1---................1---------------1-------1-1-1-1-1-----1-----1-1-1---1---1-1-1111',
      didge_deep: '................................................1---------------................................................................',
      didge_toot: '............................5.............................................................5.........5.........6...5.............',
      buzz_pad: '1-------------------------------2---------------................1-------------------------------2---------------4---------------',
      gulls: '........................................o...............................................................o.......................'}}
  ];
  var SCALES = {
    'minor-pent': [0, 3, 5, 7, 10], 'major-pent': [0, 2, 4, 7, 9], minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], lydian: [0, 2, 4, 6, 7, 9, 11]
  };
  function customSongs() { try { var a = JSON.parse(localStorage.getItem(SONGS_KEY) || '[]'); return Array.isArray(a) ? a.filter(function (s) { return s && s.id && s.parts; }) : []; } catch (e) { return []; } }
  function allSongs() { return BUILT_IN.concat(customSongs()); }
  function songById(id) { return allSongs().find(function (s) { return s.id === id; }) || BUILT_IN[0]; }

  // ---- instruments: tiny synthesized voices -----------------------------------------------------------------------
  var ctx = null, master = null, noiseBuf = null, echo = null, send = 0;
  function audio() {
    if (!ctx) {
      ctx = new AC(); master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
      // one shared echo: a dotted-eighth delay (it follows the tempo), each repeat darker and thinner; parts send to it
      // by song.echo[part] (0-0.6). One delay line for the whole song, so it costs next to nothing.
      echo = {inp: ctx.createGain(), hp: ctx.createBiquadFilter(), d: ctx.createDelay(1.5), lp: ctx.createBiquadFilter(), fb: ctx.createGain()};
      echo.hp.type = 'highpass'; echo.hp.frequency.value = 180; echo.lp.type = 'lowpass'; echo.lp.frequency.value = 2600; echo.fb.gain.value = 0.38;
      echo.inp.connect(echo.hp); echo.hp.connect(echo.d); echo.d.connect(echo.lp); echo.lp.connect(echo.fb); echo.fb.connect(echo.d); echo.lp.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return ctx;
  }
  // where a voice plays into: the master, plus the echo when the part being played sends to it
  function out() {
    if (!send) return master;
    var dry = ctx.createGain(), wet = ctx.createGain(); wet.gain.value = send; dry.connect(master); dry.connect(wet); wet.connect(echo.inp); return dry;
  }
  // a raw square wave: the plain electronic buzz (an alarm, an IV pump), a fast attack, held for the note, no distortion
  function square(t, freq, peak, len) {
    var o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), end = t + Math.max(0.05, len);
    o.type = 'square'; o.frequency.value = freq; lp.type = 'lowpass'; lp.frequency.value = 5200; lp.Q.value = 0.5;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
    g.gain.setValueAtTime(peak, Math.max(t + 0.005, end - 0.015)); g.gain.exponentialRampToValueAtTime(0.0001, end + 0.025);
    o.connect(lp); lp.connect(g); g.connect(out()); o.start(t); o.stop(end + 0.05);
  }
  function env(g, t, peak, a, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function drum(t, f0, f1, decay, peak, type, slap) {
    var o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + decay * 0.6);
    env(g, t, peak, 0.003, decay); o.connect(g); g.connect(out()); o.start(t); o.stop(t + decay + 0.05);
    if (slap) noise(t, slap[0], slap[1], slap[2], 'bandpass');
  }
  function noise(t, freq, peak, decay, type) {
    var n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); n.buffer = noiseBuf;
    f.type = type || 'highpass'; f.frequency.value = freq; env(g, t, peak, 0.002, decay);
    n.connect(f); f.connect(g); g.connect(out()); n.start(t, Math.random() * 0.5); n.stop(t + decay + 0.05);
  }
  function tone(t, freq, peak, decay, type, partial) {
    var o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'sine'; o.frequency.value = freq;
    env(g, t, peak, 0.004, decay); o.connect(g); g.connect(out()); o.start(t); o.stop(t + decay + 0.05);
    if (partial) { var p = ctx.createOscillator(), pg = ctx.createGain(); p.frequency.value = freq * partial; env(pg, t, peak * 0.3, 0.002, decay * 0.25); p.connect(pg); pg.connect(out()); p.start(t); p.stop(t + decay); }
  }
  function pad(t, freq, peak, len) {
    var f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'lowpass'; f.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + Math.min(1.2, len * 0.4)); g.gain.linearRampToValueAtTime(0.0001, t + len);
    [1, 1.005, 1.5].forEach(function (r) { var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq * r; o.connect(f); o.start(t); o.stop(t + len + 0.1); });
    f.connect(g); g.connect(out());
  }
  // A synth voice: detuned oscillators through a low-pass that closes from cut0 to cut1 (horn, brass, synth bass).
  function synth(t, freq, peak, len, type, cut0, cut1, detunes) {
    var f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'lowpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(cut0, t); f.frequency.exponentialRampToValueAtTime(cut1, t + len * 0.8);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    g.gain.setValueAtTime(peak, t + len * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    (detunes || [1]).forEach(function (r) { var o = ctx.createOscillator(); o.type = type; o.frequency.value = freq * r; o.connect(f); o.start(t); o.stop(t + len + 0.05); });
    f.connect(g); g.connect(out());
  }
  // A soft-clipping waveshaper (distortion), one curve per amount. Odd length and symmetric, so silence stays 0 (no DC offset).
  var curves = {};
  function shaper(k) {
    if (!curves[k]) { var n = 1025, c = new Float32Array(n); for (var i = 0; i < n; i++) { var x = i * 2 / (n - 1) - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); } curves[k] = c; }
    var w = ctx.createWaveShaper(); w.curve = curves[k]; w.oversample = '2x'; return w;
  }
  // Metal: noise ringing through a few narrow, inharmonic band-passes, slightly driven - struck sheet metal, pipes.
  function metal(t, peak, freqs, decay) {
    var g = ctx.createGain(), w = shaper(4); env(g, t, peak, 0.001, decay); w.connect(g); g.connect(out());
    freqs.forEach(function (f, i) { var n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), bg = ctx.createGain(); n.buffer = noiseBuf;
      bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 28; bg.gain.value = 6 / (i + 1);
      n.connect(bp); bp.connect(bg); bg.connect(w); n.start(t, Math.random() * 0.5); n.stop(t + decay + 0.05); });
  }
  // Boom: a hard industrial hit - a fast pitch-dropping sine driven into distortion, a click on top, short tail.
  function boom(t, peak) {
    var o = ctx.createOscillator(), g = ctx.createGain(), w = shaper(9), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.16);
    env(g, t, peak, 0.002, 0.34); o.connect(w); w.connect(lp); lp.connect(g); g.connect(out()); o.start(t); o.stop(t + 0.42);
    noise(t, 2500, peak * 0.5, 0.015);
  }
  // Crack: a snapping noise burst with a short metallic ring (no tones).
  function crack(t, peak) { noise(t, 2800, peak, 0.14, 'bandpass'); metal(t, peak * 0.5, [1830, 2970, 4130], 0.09); }
  // Distorted lead: two detuned saws driven hard into a waveshaper, then tamed with a low-pass.
  function distLead(t, freq, peak, len) {
    var w = shaper(40), lp = ctx.createBiquadFilter(), g = ctx.createGain(); lp.type = 'lowpass'; lp.frequency.value = 1500; lp.Q.value = 1;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.01); g.gain.setValueAtTime(peak, t + len * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    [1, 1.008].forEach(function (r) { var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq * r; o.connect(w); o.start(t); o.stop(t + len + 0.05); });
    w.connect(lp); lp.connect(g); g.connect(out());
  }
  // Didgeridoo: buzzing lips (a lightly driven saw that scoops up into pitch), a growl (fast wobble in loudness),
  // breath, and two mouth formants the tongue moves about three times a second - the "wah-wah" of a solo. Held.
  function didge(t, freq, peak, len, toot, deep) {
    var o = ctx.createOscillator(), w = shaper(5), mix = ctx.createGain(), g = ctx.createGain(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq * (toot ? 0.85 : 0.94), t); o.frequency.exponentialRampToValueAtTime(freq, t + (toot ? 0.06 : 0.11));
    var mouth = ctx.createOscillator(), mg = ctx.createGain(); mouth.type = 'triangle'; mouth.frequency.value = toot ? 7 : 3.3; mg.gain.value = 1; mouth.connect(mg);
    [[420, 6, 1, 230], [1450, 8, 0.6, 520], [2600, 10, 0.25, 300]].forEach(function (fm) { var bp = ctx.createBiquadFilter(), bg = ctx.createGain(), depth = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = fm[0]; bp.Q.value = fm[1]; bg.gain.value = fm[2]; depth.gain.value = fm[3];
      mg.connect(depth); depth.connect(bp.frequency); w.connect(bp); bp.connect(bg); bg.connect(mix); });
    var growl = ctx.createOscillator(), gg = ctx.createGain(), am = ctx.createGain(); growl.frequency.value = 27; gg.gain.value = 0.3; am.gain.value = 0.75;
    var body = ctx.createBiquadFilter(), bdg = ctx.createGain(); body.type = 'lowpass'; body.frequency.value = toot ? 400 : deep ? 130 : 180; bdg.gain.value = deep ? 0.4 : 0.1;   // the drone's own low body
    growl.connect(gg); gg.connect(am.gain); o.connect(w); w.connect(body); body.connect(bdg); bdg.connect(mix); mix.connect(am);
    var br = ctx.createBufferSource(), bf = ctx.createBiquadFilter(), bgn = ctx.createGain(); br.buffer = noiseBuf; br.loop = true; bf.type = 'bandpass'; bf.frequency.value = 900; bgn.gain.value = 0.05;
    br.connect(bf); bf.connect(bgn); bgn.connect(am);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.04); g.gain.setValueAtTime(peak, t + Math.max(0.06, len - 0.08)); g.gain.linearRampToValueAtTime(0.0001, t + len);
    am.connect(g); g.connect(out());
    [o, mouth, growl, br].forEach(function (n) { n.start(t); n.stop(t + len + 0.05); });
  }
  // Buzz pad: a hard, buzzy chord - detuned saws on the root, fifth and octave, distorted, low end cut, upper mids lifted.
  function buzzPad(t, freq, peak, len) {
    var w = shaper(7), hp = ctx.createBiquadFilter(), pk = ctx.createBiquadFilter(), g = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.value = 160; pk.type = 'peaking'; pk.frequency.value = 2200; pk.gain.value = 7; pk.Q.value = 0.8;
    [[1, 0], [1.007, 0], [1.498, 0], [2.003, 0], [0.996, 0]].forEach(function (r) { var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq * r[0]; o.connect(w); o.start(t); o.stop(t + len + 0.1); });
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + Math.min(0.35, len * 0.3)); g.gain.setValueAtTime(peak, t + len * 0.85); g.gain.linearRampToValueAtTime(0.0001, t + len);
    w.connect(hp); hp.connect(pk); pk.connect(g); g.connect(out());
  }
  // Pound: a hard industrial tom - a driven, pitch-dropping body, a slap of noise and a short metal ring.
  function pound(t, peak) {
    var o = ctx.createOscillator(), g = ctx.createGain(), w = shaper(6); o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(88, t + 0.14);
    env(g, t, peak, 0.002, 0.24); o.connect(w); w.connect(g); g.connect(out()); o.start(t); o.stop(t + 0.3);
    noise(t, 1400, peak * 0.45, 0.05, 'bandpass'); metal(t, peak * 0.12, [740, 1630], 0.1);
  }
  // Drop: a long sub fall that opens up a break (the floor gives way).
  function drop(t, peak) {
    var o = ctx.createOscillator(), g = ctx.createGain(), w = shaper(3), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    o.frequency.setValueAtTime(100, t); o.frequency.exponentialRampToValueAtTime(29, t + 1.5);
    env(g, t, peak, 0.01, 1.7); o.connect(w); w.connect(lp); lp.connect(g); g.connect(out()); o.start(t); o.stop(t + 1.8);
  }
  // Steam: a hiss that swells and cuts (a pressure valve).
  function steam(t, peak) {
    var n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); n.buffer = noiseBuf; n.loop = true; f.type = 'highpass'; f.frequency.value = 3500;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.35); g.gain.setValueAtTime(peak, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.48);
    n.connect(f); f.connect(g); g.connect(out()); n.start(t); n.stop(t + 0.55);
  }
  // Gulls: a buzzing, distorted cry - a pitch that leaps up and sags, roughened by fast vibrato.
  function gulls(t, peak) {
    var base = 780 + Math.random() * 260, o = ctx.createOscillator(), g = ctx.createGain(), w = shaper(25), bp = ctx.createBiquadFilter(); o.type = 'sawtooth';
    var vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 34; vg.gain.value = base * 0.06; vib.connect(vg); vg.connect(o.frequency);
    o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * 1.7, t + 0.07); o.frequency.exponentialRampToValueAtTime(base * 0.8, t + 0.42);
    bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 1.5; env(g, t, peak, 0.02, 0.45);
    o.connect(w); w.connect(bp); bp.connect(g); g.connect(out()); o.start(t); vib.start(t); o.stop(t + 0.5); vib.stop(t + 0.5);
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
    boom: {label: 'Boom', play: function (t, v) { boom(t, 0.36 * v); }},
    crack: {label: 'Metal crack', play: function (t, v) { crack(t, 1.4 * v); }},
    clank: {label: 'Clank', play: function (t, v) { metal(t, 0.5 * v, [523, 1311, 2207, 3460], 0.26); }},
    pound: {label: 'Pound (industrial tom)', play: function (t, v) { pound(t, 0.5 * v); }},
    drop: {label: 'Sub drop', play: function (t, v) { drop(t, 0.3 * v); }},
    steam: {label: 'Steam', play: function (t, v) { steam(t, 0.07 * v); }},
    dist_lead: {label: 'Distorted lead', melodic: true, play: function (t, v, f) { distLead(t, f, 0.1 * v, 0.34); }},
    didge: {label: 'Didgeridoo', melodic: true, held: true, oct: -1, play: function (t, v, f, len) { didge(t, f / 2, 0.7 * v, len); }},
    didge_deep: {label: 'Didgeridoo (deep)', melodic: true, held: true, oct: -2, play: function (t, v, f, len) { didge(t, f / 4, 0.42 * v, len, false, true); }},
    didge_toot: {label: 'Didgeridoo toot', melodic: true, play: function (t, v, f) { didge(t, f, 0.45 * v, 0.2, true); }},
    square_bass: {label: 'Square buzz', melodic: true, held: true, oct: -1, play: function (t, v, f, len) { square(t, f / 2, 0.17 * v, len * 0.92); }},
    square_beep: {label: 'Square beep', melodic: true, play: function (t, v, f) { square(t, f * 2, 0.035 * v, 0.09); }},
    buzz_pad: {label: 'Buzz pad', melodic: true, held: true, play: function (t, v, f, len) { buzzPad(t, f, 0.035 * v, len); }},
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
    env(g, t, peak, 0.02, 0.24); o.connect(f); f.connect(g); g.connect(out()); o.start(t); o.stop(t + 0.32);
  }
  // Birds: a few chirps that slide up, or a quick trill (Lucky Monkey).
  function birds(t, peak) {
    var base = 1800 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 4), trill = Math.random() < 0.4;
    for (var k = 0; k < n; k++) {
      var at = t + k * (trill ? 0.06 : 0.14), o = ctx.createOscillator(), g = ctx.createGain(), d = trill ? 0.05 : 0.11;
      o.frequency.setValueAtTime(base * (trill ? 1 : 0.8), at); o.frequency.exponentialRampToValueAtTime(base * (trill ? 1.15 : 1.3), at + d * 0.85);
      env(g, at, peak, 0.004, d); o.connect(g); g.connect(out()); o.start(at); o.stop(at + d + 0.05);
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
  function noteName(s, degree, octShift, semis) {   // octShift: the instrument's octave (marimba +1, bass -1); semis: the bar's key change
    var NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'], sc = SCALES[s.scale] || SCALES.minor, d = degree - 1, oct = Math.floor(d / sc.length);
    var midi = (s.root || 57) + sc[((d % sc.length) + sc.length) % sc.length] + 12 * oct; midi += 12 * (octShift || 0) + (+semis || 0); return NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
  }
  function level() { return muted ? 0 : vol * vol * 0.9; }
  // Linked songs: a song may name `next` (a song id); when it ends, the engine plays on into that song.
  // Engine.resolve(id) can supply the song object (the music page hands over the copy it is editing).
  var songFns = [];
  function nextOf(s) {
    if (!s || !s.next) return null;
    var n = (Engine.resolve && Engine.resolve(s.next)) || allSongs().find(function (x) { return x.id === s.next; });
    return n && n.parts ? n : null;
  }
  function schedule() {
    while (nextAt < ctx.currentTime + 0.12) {
      var total = 16 * barsOf(song);
      if (step > 0 && step % total === 0) {
        var nx = nextOf(song);
        if (nx && nx !== song) {
          song = nx; step = 0; total = 16 * barsOf(song); bedOff(); bedOn(song); bedLevel();
          songFns.forEach(function (fn) { try { fn(nx); } catch (e) {} });
        }
      }
      var dur = 60 / ((song.bpm || 100) + (song.bpmRise || 0) * Math.min(intensity, 1.4) / 1.4) / 4;
      var g = step % total, s = g % 16, bar = Math.floor(step / 16), fill = bar % 4 === 3 && s >= 12;
      var dt = Math.min(1.4, dur * 3);                                                       // the echo: a dotted eighth
      if (Math.abs(echo.d.delayTime.value - dt) > 0.002) echo.d.delayTime.setTargetAtTime(dt, ctx.currentTime, 0.05);
      Object.keys(song.parts).forEach(function (name) {
        var ins = INSTRUMENTS[name], pat = String(song.parts[name] || ''); if (!ins || !pat) return;
        send = song.echo ? Math.max(0, Math.min(0.6, +song.echo[name] || 0)) : 0;          // how much of this part echoes
        var mix = song.mix && song.mix[name] != null ? Math.max(0, Math.min(1.5, +song.mix[name])) : 1;   // this part's volume
        if (!mix) return;
        if (song.layers && song.layers[name] != null && intensity < song.layers[name]) return;   // not loud enough yet
        var at0 = g % pat.length, c = pat.charAt(at0);
        if (ins.melodic) {
          if (!/[1-9]/.test(c)) return;
          var len = dur; if (ins.held) { for (var k = at0 + 1; k < pat.length && pat.charAt(k) === '-'; k++) len += dur; }
          var deg = +c + (!song.exact && rand() < 0.12 ? (rand() < 0.5 ? 1 : -1) : 0);   // a passing note now and then
          var semis = song.shift ? (+song.shift[Math.floor(g / 16)] || 0) : 0;            // this bar's key change
          ins.play(nextAt, (0.85 + rand() * 0.15) * mix, freqOf(song, deg) * Math.pow(2, semis / 12), len);
          return;
        }
        var v = c === 'x' || c === 'd' ? 1 : c === 'o' ? 0.55 : 0;
        if (v && ins.chance && rand() > ins.chance) v = 0;                                  // birds call now and then
        if (!song.exact) {
        if (!v && fill && /tom|conga|djembe|bongo/.test(name) && rand() < 0.45) v = 0.6;   // fills at the end of every fourth bar
        if (!v && rand() < 0.03 && /bongo|conga|shaker/.test(name)) v = 0.3;               // ghost notes
        if (v && rand() < 0.04 && c !== 'x') v = 0;                                          // the odd drop
        }
        v *= mix;
        if (v) ins.play(nextAt + (rand() - 0.5) * 0.006, v);
        if (v && c === 'd') ins.play(nextAt + (song.exact ? dur : dur * (s % 2 ? 0.94 : 1.06)) / 2, v * 0.8);   // the half beat
      });
      send = 0;
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
    onSong: function (fn) { songFns.push(fn); },   // a linked song took over: fn(song)
    resolve: null,                                  // optional: function (id) -> the song object to play for `next`
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
