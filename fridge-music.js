/*
 * fridge.run background music - songs played live, not recordings (Mail #15).
 *
 * Each song is a few step patterns (16 steps a bar) for synthesized instruments - bongos, congas, djembe and
 * jungle toms, shaker, clave, kalimba, marimba, bass, pad; a rock kit (snare, hats, crash) and synth bass, horn and
 * brass for darker songs; boom, crack, distorted lead, didgeridoo drone and gulls for industrial ones - and a seed. A small Web Audio sequencer plays them
 * with seeded variations and a fill every fourth bar; parts named smp_<id> play short samples (see 'samples' below) (song.mix sets a part's volume, song.echo sends parts to one shared tempo echo), so a song never repeats exactly. No audio files.
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
 * bar, e.g. [0, 0, 0, -5]) to move a bar's notes into another key, for breakdowns.
 * Wet sounds (all optional): `space` (part -> 0..0.6, a send to one dark reverb, built only when used), `glitch`
 * (sample part -> 0..1, a pitched-down, stuttered echo made from the sample itself), and the shared echo's
 * `echoTime` (steps, default 3: a dotted eighth), `echoFeedback` (0..0.8, default 0.38) and `echoTone` (Hz, default 2600). One engine for every fridge sound: fridge.run, go.fridge.run/music and the
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
    // A A', bars 5-6 lifted a 4th, a bongo build, a turnaround
    {id: 'jungle-run', title: 'Jungle Run', mood: 'bongos, quick', bpm: 112, root: 57, scale: 'minor-pent', seed: 11, bars: 8, shift: [0,0,0,0,5,5,0,0], echo: {kalimba: 0.22}, parts: {
      bongo_hi: 'x..o..x.x..o.x..x..o..x.x..o.x..x..o..x.x..o.x..x..o..x.x..o.x..x..o..x.x..o.x..x..o..x.x..o.x..x.xox.xox.xoxxxxx..o..x.x..o....',
      bongo_lo: '..x...x...x...xo..x...x...x...xo..x...x...x...xo..x...x...x...xo..x...x...x...xo..x...x...x...xo..x...x...x.x.xx..x...x.........',
      conga: 'x...o.x.x...o.x.x...o.x.x...o.x.x...o.x.x...o.x.x...o.x.x...o.x.x...o.x.x...o.x.x...o.x.x...o.x.x...o.x.x...o.x.x...o.x.x...oooo',
      shaker: 'oxoxoxoxoxoxoxox',
      kick: 'x.......x..x....x.......x..x....x.......x..x....x.......x..x....x.......x..x....x.......x..x....x...x...x...x...x.......x.x.x.x.',
      bass: '1...1.3.5...4.3.1...1.3.5...4.3.4...4.5.6...5.4.1...1.3.5...2.1.1...1.3.5...4.3.1...3...4...5...1.1.3.3.4.4.5.5.1.......5...4.2.',
      kalimba: '5.3.1...5.6.5...5.3.1...3.2.1...6.5.6.8.7...6.5.5.6.5.3.2...1...1.3.5...5.6.5...6.5.3...2.3.1...5.5.6.6.8.8.9...8...6...5...3.2.'}},
    // i-IV-i-v under the marimba, pad chords, kalimba sparkles, a djembe fill; canopy birds (samples, where the site has them)
    {id: 'canopy-drums', title: 'Canopy Drums', mood: 'congas and djembe', bpm: 98, root: 55, scale: 'dorian', seed: 23, bars: 8, mix: {smp_robin: 0.8, smp_cardinal: 0.75, smp_chickadee: 0.7, smp_song_sparrow: 0.7}, echo: {kalimba: 0.3, marimba: 0.12, smp_robin: 0.15, smp_cardinal: 0.15, smp_chickadee: 0.15, smp_song_sparrow: 0.15}, parts: {
      djembe: 'x..x..x...x.x...x..x..x...x.x...x..x..x...x.x...x..x..x...x.x...x..x..x...x.x...x..x..x...x.x...x..x..x...x.x...x.xxx.x.xxxxx.xx',
      conga: '.o..x..o.o..x..o',
      bongo_hi: '...o...o...o..oo...o...o...o..oo...o...o...o..oo...o...o...o..oo...o...o...o..oo...o...o...o..oo...o...o...o..oooooo...o...ooooo',
      shaker: 'o.o.o.o.o.o.o.o.',
      bass: '1.....1.4.....5.1.....1.4.....5.4.....4.6.....5.4.....4.3.....2.1.....1.4.....5.1.....1.4.....5.5.....5.7.....5.4.....4.5...7.5.',
      marimba: '1.3.5.3.2.4.6.4.1.3.5.3.2.4.6.4.4.6.8.6.3.5.7.5.4.6.8.6.5.4.3.2.1.3.5.8.5.3.2.4.6.5.4.3.2.4.6.4.5.7.9.7.5.7.9.7.8.7.6.5.4.3.2...',
      pad: '1-------------------------------4-------------------------------1-------------------------------5---------------4---------------',
      kalimba: '................................................................8.......9...............6...5...9.......8.......................',
      smp_robin: '......x...........................................................o.............................................................',
      smp_cardinal: '..........................................x.....................................................................................',
      smp_chickadee: '............................................................................................x...............o...................',
      smp_song_sparrow: '......................................................................................................................x.........'}},
    // storm, a breakdown (drone, marimba lament), a thunder build into the crash
    {id: 'rain-dance', title: 'Rain Dance', mood: 'heavy jungle drums', bpm: 120, root: 52, scale: 'phrygian', seed: 37, bars: 8, echo: {marimba: 0.3}, parts: {
      tom_lo: 'x..x..x.x..x..x.x..x..x.x..x..x.x..x..x.x..x..x.x..x..x.x..x..x.x...............x.......x.......x..x..x.x..x..x.x.x.x.x.dxdxdxdd',
      tom_hi: '..o...o...o.o.o...o...o...o.o.o...o...o...o.o.o...o...o...o.o.o.........................o...o.....o...o...o.o.o...o.o.o.o.o.dddd',
      djembe: 'x.x...x.x.x...x.x.x...x.x.x...x.x.x...x.x.x...x.x.x...x.x.x...x.........................x.x.x.x.x.x...x.x.x...x.x.x.x.x.x.x.xxxx',
      kick: 'x...x...x...x...x...x...x...x...x...x...x...x...x...x...x...x...x...............x.......x.......x...x...x...x...x...x...x...x...',
      shaker: 'ooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo.o.o.o.o.o.o.o.o.o.o.o.o.o.o.o.oooooooooooooooooooooooooooooooo',
      clave: 'x..x..x...x.x...x..x..x...x.x...x..x..x...x.x...x..x..x...x.x...................................x..x..x...x.x...x..x..x...x.x...',
      crash: '................................................................................................x...............................',
      bass: '1..1..1.1..2..1.1..1..1.1..2..1.1..1..1.1..2..3.2..2..2.2..3..2.1...............1.......2.......1..1..1.1..2..1.1.1.1.1.2.2.3.2.',
      pad: '................................................................1-------------------------------................................',
      marimba: '................................................................5...6...5...3...2...3...2...1...................................'}},
    // an 8-bar kalimba tune over pad chords; bongos join halfway
    {id: 'night-market', title: 'Night Market', mood: 'clave and kalimba', bpm: 92, root: 60, scale: 'major-pent', seed: 41, bars: 8, echo: {kalimba: 0.32}, parts: {
      clave: 'x..x..x...x.x...',
      bongo_lo: 'x.....x.x.......',
      shaker: '.o.o.o.o.o.o.o.o',
      bongo_hi: '....................................................................o.......o..o....o.......o..o....o.......o..oo.o.o..oo.o.oooo',
      kalimba: '1.3.5.6.5.3.2...1.3.5.6.8.6.5...5.6.8.9.8.6.5...3.5.3.2.1.......6.5.6.8.6.5.3...2.3.5.3.2.1.2...1.3.5.6.5.3.2...3.2.1.......1...',
      bass: '1...5...6...4...1...5...6...4...6...5...4...5...1...4...5.......6...4...5...1...2...4...5...4...1...5...6...4...4...5...1...5...',
      pad: '1-------4-------1-------4-------6-------4-------1-------5-------6-------4-------2-------5-------1-------4-------4-------5-------'}},
    // a marimba melody over pad chords, a soft bass, kalimba drops; a mourning dove and small birds (samples)
    {id: 'panda-trail', title: 'Panda Trail', mood: 'gentle toms', bpm: 78, root: 57, scale: 'minor', seed: 7, bars: 8, mix: {bass: 0.6, smp_mourning_dove: 0.5, smp_chickadee: 0.45, smp_song_sparrow: 0.45}, echo: {marimba: 0.2, kalimba: 0.4, smp_mourning_dove: 0.2, smp_chickadee: 0.25, smp_song_sparrow: 0.25}, parts: {
      tom_lo: 'x.......o.......',
      tom_hi: '....o.......o..o....o.......o..o....o.......o..o....o.......o..o....o.......o..o....o.......o..o....o.......o..o....o...o.o.o..o',
      shaker: 'o...o...o...o...',
      marimba: '5.....3.....1...5.....6.....5...3.....4.....5...6.....5.....3...8.....7.....5...6.....5.....3...4.....3.....2...5...............',
      pad: '1-------6-------1-------6-------4-------5-------6-------5-------1-------6-------4-------3-------4-------5-------5-------5-------',
      bass: '1.......6.......1.......6.......4.......5.......6.......5.......1.......6.......4.......3.......4.......5.......5.......5.......',
      kalimba: '....................................................................8.......9...........6...........4.......5...................',
      smp_mourning_dove: '....x...........................................................................................................................',
      smp_chickadee: '........................................x...............................................................o.......................',
      smp_song_sparrow: '......................................................................x.........................................................'}},
    // slow pad chords, sparse kalimba with a long echo
    {id: 'cellar-light', title: 'Cellar Light', mood: 'ambient', bpm: 68, root: 50, scale: 'dorian', seed: 3, bars: 8, echo: {kalimba: 0.45}, parts: {
      pad: '1-------------------------------4-------------------------------6---------------5---------------1-------------------------------',
      kalimba: '5.......3...2...........1.......6.......5...4...........2.......7.......6...5...4...........3...5.......3...2...1...............',
      tom_lo: 'o...............',
      bass: '1.......5.......1.......5.......4.......4.......4.......3.......6.......5.......5.......5.......1.......5.......1.......1.......'}},
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
    // the bridge and the intro are left out). E phrygian, 180 BPM, straight. 
    {id: 'kaon', title: 'Kaon (Half-Life cover)', mood: 'industrial, fast',
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
    // page's MIDI import (A minor, written as D dorian so the riff fits the note rows).
    {id: 'control-cover', title: 'Control (Metro Station cover)', mood: 'synth-pop, bright',
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
    // builds a pat-patapat crescendo into the pow (boom + crash) of bar 1.
    {id: 'disrupted-distillation', title: 'Disrupted Distillation', mood: 'industrial, didgeridoo',
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
    dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], lydian: [0, 2, 4, 6, 7, 9, 11],
    locrian: [0, 1, 3, 5, 6, 8, 10]   // a lowered 2nd and 5th: the darkest mode (metal riffs on the flat fifth)
  };
  function customSongs() { try { var a = JSON.parse(localStorage.getItem(SONGS_KEY) || '[]'); return Array.isArray(a) ? a.filter(function (s) { return s && s.id && s.parts; }) : []; } catch (e) { return []; } }
  // a site's own songs (go.fridge.run's music-songs.js sets window.FridgeMusicSongs): listed after the built-in ones
  function extraSongs() {
    var x = window.FridgeMusicSongs; if (!Array.isArray(x)) return [];
    return x.filter(function (s) { return s && s.id && s.parts && !BUILT_IN.some(function (b) { return b.id === s.id; }); });
  }
  function allSongs() { return BUILT_IN.concat(extraSongs(), customSongs()); }
  function songById(id) { return allSongs().find(function (s) { return s.id === id; }) || BUILT_IN[0]; }

  // ---- instruments: tiny synthesized voices -----------------------------------------------------------------------
  var ctx = null, master = null, noiseBuf = null, echo = null, send = 0, space = null, spaceSend = 0, glitchAmt = 0, stepDur = 0.12;
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
  // (and the space - a reverb - when it sends to that)
  function out() {
    if (!send && !spaceSend) return master;
    var dry = ctx.createGain(); dry.connect(master);
    if (send) { var wet = ctx.createGain(); wet.gain.value = send; dry.connect(wet); wet.connect(echo.inp); }
    if (spaceSend) { var sp = ctx.createGain(); sp.gain.value = spaceSend; dry.connect(sp); sp.connect(spaceBus().inp); }
    return dry;
  }
  // Space: one dark reverb (a convolver with a made-up 2.4 s room: noise that decays and darkens), built only when a
  // song sends to it (song.space[part], 0-0.6) - the wet, washed sound. One for the whole page.
  function spaceBus() {
    if (space) return space;
    var sr = ctx.sampleRate, n = Math.floor(sr * 2.4), ir = ctx.createBuffer(2, n, sr), pre = Math.floor(sr * 0.018);
    for (var c = 0; c < 2; c++) {
      var d = ir.getChannelData(c), lp = 0;
      for (var i = pre; i < n; i++) {
        var k = (i - pre) / sr, a = 0.55 - 0.42 * Math.min(1, k / 1.6);   // later reflections darker
        lp += a * ((Math.random() * 2 - 1) - lp); d[i] = lp * Math.exp(-k * 2.9);
      }
    }
    space = {inp: ctx.createGain(), hp: ctx.createBiquadFilter(), conv: ctx.createConvolver(), g: ctx.createGain()};
    space.hp.type = 'highpass'; space.hp.frequency.value = 140; space.conv.buffer = ir; space.g.gain.value = 0.9;
    space.inp.connect(space.hp); space.hp.connect(space.conv); space.conv.connect(space.g); space.g.connect(master);
    return space;
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
  // Deep kick: a click, then a sine that falls into the sub - tuned to the song's root (folded to 36-52 Hz) - and rings
  // for most of a second, lightly driven so its harmonics carry on small speakers. The very deep hit of bass house.
  function deepKick(t, peak) {
    var r = song && song.root ? 440 * Math.pow(2, (song.root - 69) / 12) : 41.2; while (r > 52) r /= 2; while (r < 36) r *= 2;
    var o = ctx.createOscillator(), g = ctx.createGain(), w = shaper(2), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
    o.frequency.setValueAtTime(155, t); o.frequency.exponentialRampToValueAtTime(r * 1.25, t + 0.05); o.frequency.exponentialRampToValueAtTime(r, t + 0.28);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.003); g.gain.setTargetAtTime(peak * 0.55, t + 0.05, 0.1); g.gain.setTargetAtTime(0.0001, t + 0.2, 0.13);
    o.connect(w); w.connect(lp); lp.connect(g); g.connect(out()); o.start(t); o.stop(t + 1.25);
    noise(t, 3000, peak * 0.22, 0.012);
  }
  // Pumping sub: a held sine sub (a touch driven, for its harmonics) that ducks on every beat and swells back on the
  // off-beat - the sidechain pump of house music, made with the note's own envelope (no compressor). Held.
  function subPump(t, freq, peak, len) {
    var o = ctx.createOscillator(), g = ctx.createGain(), w = shaper(1.5), beat = stepDur * 4, end = t + Math.max(0.1, len);
    o.frequency.value = freq; g.gain.setValueAtTime(0.0001, t);
    for (var b = t; b < end - 0.02; b += beat) {
      g.gain.setValueAtTime(0.0001, b); g.gain.linearRampToValueAtTime(peak * 0.35, b + beat * 0.3);
      g.gain.linearRampToValueAtTime(peak, b + beat * 0.62); g.gain.setValueAtTime(peak, Math.min(end, b + beat) - 0.012);
      g.gain.linearRampToValueAtTime(0.0001, Math.min(end, b + beat));
    }
    o.connect(w); w.connect(g); g.connect(out()); o.start(t); o.stop(end + 0.05);
  }
  // Distorted guitar: a power chord (root, fifth, octave) of detuned saws driven hard into a waveshaper, then a
  // speaker-cabinet curve (no fizz above ~3.4 kHz, no mud below ~90 Hz). Held: a note of one step is palm-muted
  // (darker, a quick choke - the chug); longer notes ring for their length.
  function distGuitar(t, freq, peak, len) {
    var mute = len < stepDur * 1.5, w = shaper(70), hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), mid = ctx.createBiquadFilter(), g = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.value = 90; lp.type = 'lowpass'; lp.Q.value = 0.8; mid.type = 'peaking'; mid.frequency.value = 900; mid.Q.value = 1; mid.gain.value = -5;
    lp.frequency.setValueAtTime(mute ? 1500 : 3400, t); if (mute) lp.frequency.exponentialRampToValueAtTime(700, t + 0.12);
    var end = t + Math.max(0.08, len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
    if (mute) g.gain.setTargetAtTime(0.0001, t + 0.03, 0.05);
    else { g.gain.setTargetAtTime(peak * 0.7, t + 0.05, 0.3); g.gain.setValueAtTime(peak * 0.6, Math.max(t + 0.06, end - 0.02)); g.gain.exponentialRampToValueAtTime(0.0001, end + 0.05); }
    var stop = mute ? t + 0.3 : end + 0.08;
    [[1, 1], [1.007, 0.8], [1.5, 0.75], [2, 0.5]].forEach(function (r) { var o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = freq * r[0]; og.gain.value = r[1]; o.connect(og); og.connect(w); o.start(t); o.stop(stop); });
    w.connect(hp); hp.connect(mid); mid.connect(lp); lp.connect(g); g.connect(out());
  }
  // Metal kick: tight and clicky for double-bass runs - a short, fast-falling thump with a hard beater click on top.
  function metalKick(t, peak) {
    var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.045);
    env(g, t, peak, 0.002, 0.15); o.connect(g); g.connect(out()); o.start(t); o.stop(t + 0.2);
    noise(t, 3500, peak * 0.45, 0.008, 'bandpass'); tone(t, 1100, peak * 0.12, 0.012, 'triangle');
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
    deep_kick: {label: 'Deep kick', play: function (t, v) { deepKick(t, 0.62 * v); }},
    metal_kick: {label: 'Metal kick', play: function (t, v) { metalKick(t, 0.8 * v); }},
    dist_guitar: {label: 'Distorted guitar', melodic: true, held: true, play: function (t, v, f, len) { distGuitar(t, f, 0.34 * v, len); }},
    sub_pump: {label: 'Sub (pumping)', melodic: true, held: true, oct: -1, play: function (t, v, f, len) { subPump(t, f / 2, 0.42 * v, len); }},
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
    cuica_wail: {label: 'Cuica wail', play: function (t, v) { cuicaWail(t, 1.3 * v); }},
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
  // the cuica as an effect: lower, longer and eerier than the drum - a moan that rises, wavers and falls away
  function cuicaWail(t, peak) {
    var o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), vib = ctx.createOscillator(), vg = ctx.createGain();
    o.type = 'triangle'; f.type = 'bandpass'; f.frequency.value = 620; f.Q.value = 1.4;
    o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(640, t + 0.16); o.frequency.exponentialRampToValueAtTime(230, t + 0.55);
    vib.frequency.value = 7; vg.gain.value = 14; vib.connect(vg); vg.connect(o.frequency);
    env(g, t, peak, 0.03, 0.55); o.connect(f); f.connect(g); g.connect(out()); o.start(t); vib.start(t); o.stop(t + 0.65); vib.stop(t + 0.65);
  }
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
    // a throttled tab (timers slowed) can fall behind: skip the missed time rather than play it all at once; while the
    // tab is hidden, plan further ahead so background timers (about once a second) keep the music unbroken
    if (nextAt < ctx.currentTime - 0.25) nextAt = ctx.currentTime + 0.05;
    var ahead = document.hidden ? 1.5 : 0.12;
    syncSamples();
    while (nextAt < ctx.currentTime + ahead) {
      var total = 16 * barsOf(song);
      if (step > 0 && step % total === 0) {
        var nx = nextOf(song);
        if (nx && nx !== song) {
          var sameBed = bed && nx.bed && (nx.bedRoot || nx.root) === (song.bedRoot || song.root);   // linked parts on one drone: it carries on
          song = nx; step = 0; total = 16 * barsOf(song); if (!sameBed) { bedOff(); bedOn(song); } bedLevel();
          prefetchSongSamples(nextOf(song));
          songFns.forEach(function (fn) { try { fn(nx); } catch (e) {} });
        }
      }
      var dur = 60 / ((song.bpm || 100) + (song.bpmRise || 0) * Math.min(intensity, 1.4) / 1.4) / 4;
      var g = step % total, s = g % 16, bar = Math.floor(step / 16), fill = bar % 4 === 3 && s >= 12;
      // the echo: a dotted eighth, unless the song sets its own (echoTime in steps 1-8, echoFeedback 0-0.8, echoTone Hz)
      var es = Math.max(1, Math.min(8, +song.echoTime || 3)), dt = Math.min(1.4, dur * es);
      var efb = song.echoFeedback != null ? Math.max(0, Math.min(0.8, +song.echoFeedback || 0)) : 0.38;
      var etn = song.echoTone ? Math.max(400, Math.min(6000, +song.echoTone)) : 2600;
      if (Math.abs(echo.d.delayTime.value - dt) > 0.002) echo.d.delayTime.setTargetAtTime(dt, ctx.currentTime, 0.05);
      if (Math.abs(echo.fb.gain.value - efb) > 0.005) echo.fb.gain.setTargetAtTime(efb, ctx.currentTime, 0.1);
      if (Math.abs(echo.lp.frequency.value - etn) > 5) echo.lp.frequency.setTargetAtTime(etn, ctx.currentTime, 0.1);
      stepDur = dur;
      Object.keys(song.parts).forEach(function (name) {
        var ins = INSTRUMENTS[name], pat = String(song.parts[name] || ''); if (!ins || !pat) return;
        send = song.echo ? Math.max(0, Math.min(0.6, +song.echo[name] || 0)) : 0;          // how much of this part echoes
        spaceSend = song.space ? Math.max(0, Math.min(0.6, +song.space[name] || 0)) : 0;    // and how much goes to the space
        glitchAmt = song.glitch ? Math.max(0, Math.min(1, +song.glitch[name] || 0)) : 0;    // a sample's glitch echo
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
      send = 0; spaceSend = 0; glitchAmt = 0;
      var at = nextAt, st = s, gst = g;
      stepFns.forEach(function (fn) { try { fn(st, at, gst); } catch (e) {} });          // step in bar, time, step in song
      nextAt += song.exact ? dur : dur * (s % 2 ? 0.94 : 1.06);                              // a little swing (not for exact songs)
      step++;
    }
  }
  // ---- samples: short compressed recordings (<= 5 s) as instruments --------------------------------------------
  // A sample is one more kind of instrument, never a kind of song: its part is named smp_<id> and plays on the same
  // step grid (x loud, o soft, d double), with the same volume (song.mix) and echo (song.echo). Songs reference samples
  // by id; the audio lives in a catalog, never in the song. Catalog entries come from window.FridgeMusicSamples (a
  // site's bundled manifest: id, name, category, src: [{src: '/assets/samples/x.opus', type}, ...]) and from samples
  // saved in this browser (IndexedDB 'fridge-music' / 'samples', added with Engine.addSample).
  // Rules: a sample is fetched and decoded once and reused; a hit whose sample is not ready yet is skipped (the clock
  // never waits); bounded voices, fetches and decoded memory; bad files are rejected, not trimmed; failures retry slowly.
  var SAMPLE = {seconds: 5, slack: 0.08 /* encoder padding (MP3 adds ~50 ms) */, encoded: 262144, decoded: 2621440,
    cache: 16 * 1048576, voices: 16, perSample: 4, fetches: 4, timeout: 10000, retryMs: 60000, tries: 3,
    embed: 32768, embedSong: 163840, embedCount: 8, importMax: 8388608};   // an import is compressed from a file of up to 8 MB   // samples carried inside a song (song.samples): per sample, per song
  // A song may carry its own samples: song.samples = {id: {name, data: 'data:audio/ogg;codecs=opus;base64,...'}}. They
  // are read only from the song itself (never a URL), checked like any other sample, and shown under "In this song".
  var DATA_URI = /^data:audio\/(ogg|webm|mpeg|mp4|wav)(;codecs=[a-z0-9.]+)?;base64,([A-Za-z0-9+\/]+={0,2})$/;
  function b64bytes(s) { var bin = atob(s), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
  function bytesB64(buf) { var u = new Uint8Array(buf), s = '', i; for (i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
  function songSamples(s) {    // register the samples a song carries; returns how many were usable
    if (!s || !s.samples || typeof s.samples !== 'object') return 0; var n = 0, total = 0;
    Object.keys(s.samples).slice(0, SAMPLE.embedCount).forEach(function (id) {
      var e = s.samples[id], m = e && typeof e.data === 'string' && DATA_URI.exec(e.data);
      if (!/^[a-z0-9_]{1,20}$/.test(id) || !m) return;
      var bytes = Math.floor(m[3].length * 3 / 4); total += bytes;
      if (bytes > SAMPLE.embed || total > SAMPLE.embedSong) return;
      var have = sampleCat[id]; if (have && !have.embedded) { n++; return; }          // the site's or this browser's copy
      if (have && have.data === e.data) { n++; return; }
      if (have && sbuf[id] && !sbuf[id].active) { if (sbuf[id].bytes) cacheBytes -= sbuf[id].bytes; delete sbuf[id]; }
      var c = addSample({id: id, name: e.name || id, category: 'song', credit: e.credit, load: function () { return b64bytes(m[3]); }});
      if (c) { c.embedded = true; c.data = e.data; c.local = false; INSTRUMENTS['smp_' + id].local = false; INSTRUMENTS['smp_' + id].embedded = true; n++; }
    });
    return n;
  }
  function sampleBytes(id) {   // a sample's encoded bytes and type: for embedding in a song
    syncSamples(); var c = sampleCat[id]; if (!c) return Promise.reject(new Error('No such sample.'));
    if (c.load) return Promise.resolve().then(c.load).then(function (b) { var m = c.data && DATA_URI.exec(c.data);
      return {bytes: b, type: m ? 'audio/' + m[1] + (m[2] || '') : guessType(b)}; });
    var src = c.src.filter(function (x) { return canPlay(x.type); })[0] || c.src[0];
    return fetchBytes(src.src).then(function (b) { return {bytes: b, type: src.type.replace(/\s+/g, '')}; });
  }
  function guessType(b) {
    var h = new Uint8Array(b.slice(0, 40)), t = String.fromCharCode.apply(null, h);
    return /^OggS/.test(t) ? (/OpusHead/.test(t) ? 'audio/ogg;codecs=opus' : 'audio/ogg') : h[0] === 0x1a && h[1] === 0x45 ? 'audio/webm;codecs=opus'
      : /^RIFF/.test(t) ? 'audio/wav' : /ftyp/.test(t) ? 'audio/mp4' : 'audio/mpeg';
  }
  function sampleDataUri(id) { return sampleBytes(id).then(function (r) {
    if (r.bytes.byteLength > SAMPLE.embed) throw new Error('It is ' + Math.round(r.bytes.byteLength / 1024) + ' KB; a sample kept in a song can be ' + (SAMPLE.embed >> 10) + ' KB.');
    return 'data:' + r.type + ';base64,' + bytesB64(r.bytes); }); }
  // play one sample now, on its own (the tracker's preview); resolves when it starts
  function previewSample(id, vol) {
    audio(); var go = function () {
      var e = sbuf[id]; if (!e || e.state !== 'ready') return false;
      var src = ctx.createBufferSource(), g = ctx.createGain(); src.buffer = e.buffer; g.gain.value = (vol == null ? 0.6 : vol) * 0.9;
      src.connect(g); g.connect(ctx.destination); src.start(); src.onended = function () { try { src.disconnect(); g.disconnect(); } catch (x) {} }; return true;
    };
    return (ctx.state === 'suspended' ? ctx.resume() : Promise.resolve()).then(function () {
      if (go()) return true; requestSample(id);
      return new Promise(function (ok, no) {
        var tries = 0, t = window.setInterval(function () { var e = sbuf[id];
          if (e && e.state === 'ready') { window.clearInterval(t); ok(go()); }
          else if ((e && e.state === 'failed') || ++tries > 100) { window.clearInterval(t); no(new Error(e && e.err || 'The sample did not load.')); } }, 50);
      });
    });
  }
  var SAMPLE_PATH = /^\/assets\/samples\/[a-z0-9_.-]+\.(opus|ogg|webm|mp3|m4a)$/;   // bundled samples: this site's own folder only
  var sampleCat = {}, sbuf = {}, voicesNow = [], fetchQ = [], fetching = 0, cacheBytes = 0, sampleFns = [], seenManifest = null;
  function sampleNote(id, state, msg) { sampleFns.forEach(function (fn) { try { fn(id, state, msg || ''); } catch (e) {} }); }
  function addSample(e) {
    if (!e || !/^[a-z0-9_]{1,20}$/.test(e.id || '')) return null;
    var src = (Array.isArray(e.src) ? e.src : []).filter(function (s) { return s && typeof s.src === 'string' && SAMPLE_PATH.test(s.src); }).slice(0, 4);
    if (!src.length && typeof e.load !== 'function') return null;
    var name = String(e.name || e.id).replace(/[<>&"]/g, '').slice(0, 40), clean = function (x, n) { return String(x || '').replace(/[<>"]/g, '').slice(0, n); };
    sampleCat[e.id] = {id: e.id, name: name, category: String(e.category || 'samples').slice(0, 20), src: src, load: e.load || null, local: !!e.load,
      credit: clean(e.credit, 200), license: clean(e.license, 40), url: /^https:\/\/[\w.\/%:()-]+$/.test(e.url || '') ? e.url : '', duration: +e.duration || 0};
    INSTRUMENTS['smp_' + e.id] = {label: name, sample: e.id, category: sampleCat[e.id].category, local: !!e.load, credit: sampleCat[e.id].credit,
      play: function (t, v) { playSample(e.id, t, v); }};
    return sampleCat[e.id];
  }
  function syncSamples() {    // the bundled manifest may load after the engine: pick it up whenever it appears
    loadLocalSamples();
    var m = window.FridgeMusicSamples; if (m === seenManifest || !Array.isArray(m)) return; seenManifest = m; m.forEach(addSample);
  }
  function canPlay(type) { try { return !type || !!document.createElement('audio').canPlayType(type); } catch (e) { return true; } }
  function decode(buf) {      // promise or callback decodeAudioData (older Safari)
    return new Promise(function (ok, no) { var p = ctx.decodeAudioData(buf, ok, no); if (p && p.then) p.then(ok, no); });
  }
  function checkSample(buf, maxBytes) { // the one gate every sample passes: size, decodes, length, memory
    var cap = maxBytes || SAMPLE.encoded;   // a file about to be compressed (an import) may start bigger
    if (!buf || !buf.byteLength) return Promise.reject(new Error('The file is empty.'));
    if (buf.byteLength > cap) return Promise.reject(new Error('The file is over ' + (cap >> 10) + ' KB.'));
    audio();
    return decode(buf.slice(0)).then(function (b) {
      if (!b || !b.length || !b.duration) throw new Error('No sound in that file.');
      if (b.duration > SAMPLE.seconds + SAMPLE.slack) throw new Error('It is ' + b.duration.toFixed(2) + ' s long; samples can be ' + SAMPLE.seconds + ' s at most.');
      var bytes = b.length * b.numberOfChannels * 4;
      if (bytes > SAMPLE.decoded) throw new Error('It decodes too large (' + (bytes / 1048576).toFixed(1) + ' MB).');
      return b;
    }, function (e) { throw new Error(e && /over|empty|long|large/.test(e.message) ? e.message : 'This browser cannot decode that file (corrupt or an unsupported format).'); });
  }
  function fetchBytes(url) {
    var ac = window.AbortController ? new AbortController() : null, tm = ac && window.setTimeout(function () { ac.abort(); }, SAMPLE.timeout);
    return fetch(url, {credentials: 'same-origin', signal: ac && ac.signal}).then(function (r) {
      if (!r.ok) throw new Error('Not found (' + r.status + ').');
      if (r.redirected || /^text\//.test(r.headers.get('content-type') || '')) throw new Error('Not found (the site answered with a page, not audio).');
      var n = +r.headers.get('content-length'); if (n > SAMPLE.encoded) throw new Error('The file is over ' + (SAMPLE.encoded >> 10) + ' KB.');
      return r.arrayBuffer();
    }).then(function (b) { if (tm) window.clearTimeout(tm); return b; }, function (e) { if (tm) window.clearTimeout(tm); throw e; });
  }
  function requestSample(id) {   // ask for a sample; never waits, never repeats a request in flight
    syncSamples(); var c = sampleCat[id], e = sbuf[id];
    if (!c || !ctx) return;
    if (e && (e.state === 'ready' || e.state === 'loading' || e.state === 'queued')) return;
    if (e && e.state === 'failed' && (e.tries >= SAMPLE.tries || Date.now() < e.retryAt)) return;
    sbuf[id] = {state: 'queued', tries: e ? e.tries : 0, active: 0, used: 0}; fetchQ.push(id); pumpSamples();
  }
  function pumpSamples() {
    while (fetching < SAMPLE.fetches && fetchQ.length) loadSample(fetchQ.shift());
  }
  function loadSample(id) {
    var c = sampleCat[id], e = sbuf[id]; if (!c || !e) return; e.state = 'loading'; fetching++;
    var srcs = c.load ? [null] : c.src.filter(function (s) { return canPlay(s.type); });
    if (!srcs.length) srcs = c.src.slice();                    // canPlayType is a hint: still try them all
    var attempt = function (i, lastErr) {
      if (i >= srcs.length) return Promise.reject(lastErr || new Error('No playable source.'));
      var get = c.load ? Promise.resolve().then(c.load) : fetchBytes(srcs[i].src);
      return get.then(checkSample).catch(function (err) { return attempt(i + 1, err); });
    };
    attempt(0).then(function (b) {
      var bytes = b.length * b.numberOfChannels * 4; evictSamples(bytes);
      if (cacheBytes + bytes > SAMPLE.cache) throw new Error('The sample memory is full; it will try again later.');
      e.state = 'ready'; e.buffer = b; e.bytes = bytes; e.used = ctx.currentTime; cacheBytes += bytes; sampleNote(id, 'ready');
    }).catch(function (err) {
      e.state = 'failed'; e.tries++; e.retryAt = Date.now() + SAMPLE.retryMs * e.tries; e.err = String(err && err.message || err);
      sampleNote(id, 'failed', e.err);
    }).then(function () { fetching--; pumpSamples(); });
  }
  function evictSamples(need) {  // least recently played first; never a sample that is sounding or in the song playing
    if (cacheBytes + need <= SAMPLE.cache) return;
    var inSong = song && song.parts ? song.parts : {};
    Object.keys(sbuf).filter(function (id) { var e = sbuf[id]; return e.state === 'ready' && !e.active && !inSong['smp_' + id]; })
      .sort(function (a, b) { return sbuf[a].used - sbuf[b].used; }).some(function (id) {
        cacheBytes -= sbuf[id].bytes; delete sbuf[id]; sampleNote(id, 'evicted'); return cacheBytes + need <= SAMPLE.cache;
      });
  }
  function releaseVoice(vo, at) {  // a short fade, not a click
    var i = voicesNow.indexOf(vo); if (i >= 0) voicesNow.splice(i, 1);
    try { vo.g.gain.cancelScheduledValues(at); vo.g.gain.setValueAtTime(vo.g.gain.value, at); vo.g.gain.setTargetAtTime(0, at, 0.006); vo.src.stop(at + 0.04); } catch (e) {}
    (vo.extra || []).forEach(function (x) { try { x.stop(at + 0.04); } catch (e) {} });
  }
  function playSample(id, t, v) {
    var e = sbuf[id];
    if (!e || e.state !== 'ready') { requestSample(id); return; }   // not ready: skip this hit, the song goes on
    var at = Math.max(t, ctx.currentTime); e.used = at;
    var mine = voicesNow.filter(function (x) { return x.id === id; });
    if (mine.length >= SAMPLE.perSample) releaseVoice(mine[0], at);
    if (voicesNow.length >= SAMPLE.voices) releaseVoice(voicesNow[0], at);
    var src = ctx.createBufferSource(), g = ctx.createGain(); src.buffer = e.buffer; g.gain.value = 0.4 * v;   // samples are full-scale files: sit them with the synth voices
    src.connect(g); g.connect(out()); src.start(at);
    var vo = {id: id, src: src, g: g}; voicesNow.push(vo); e.active++;
    var last = glitchAmt ? glitchEcho(vo, e.buffer, at, glitchAmt) : src;            // song.glitch: still one voice
    last.onended = function () { var i = voicesNow.indexOf(vo); if (i >= 0) voicesNow.splice(i, 1); e.active = Math.max(0, e.active - 1); try { src.disconnect(); g.disconnect(); } catch (x) {} };
  }
  // A glitch echo (song.glitch[part], 0-1): after the hit, a few echoes on the dotted-eighth grid, each a short slice of
  // the sample stuttered two to four times (thirty-second notes), each lower and darker than the last - a deep, broken
  // tail made from the sample itself. All its pieces belong to the hit's voice; returns the last piece to end.
  function glitchEcho(vo, buf, at, amt) {
    var reps = 2 + Math.round(amt * 3), gap = stepDur * 3, sl = Math.min(0.11, buf.duration / 3), lp = ctx.createBiquadFilter(), last = vo.src, end = at + buf.duration;
    lp.type = 'lowpass'; lp.frequency.value = 3200; lp.connect(vo.g); vo.extra = [];
    for (var k = 1; k <= reps; k++) {
      var off = Math.min(buf.duration - sl, (k * 0.37 % 1) * buf.duration * 0.7), rate = Math.max(0.42, 1 - 0.16 * k * (0.6 + amt * 0.5)), n = k === reps ? 4 : 2 + (k % 2);
      for (var j = 0; j < n; j++) {
        var s = ctx.createBufferSource(), sg = ctx.createGain(), t = at + k * gap + j * stepDur / 2, len = Math.min(sl, stepDur / 2) / rate;
        s.buffer = buf; s.playbackRate.value = rate; sg.gain.setValueAtTime(0.0001, t); sg.gain.exponentialRampToValueAtTime(Math.pow(0.62, k) * (1 - j * 0.12), t + 0.004);
        sg.gain.setValueAtTime(Math.pow(0.62, k) * (1 - j * 0.12), t + len * 0.8); sg.gain.exponentialRampToValueAtTime(0.0001, t + len);
        s.connect(sg); sg.connect(lp); s.start(t, off, len * rate + 0.01); s.stop(t + len + 0.02); vo.extra.push(s);
        if (t + len > end) { end = t + len; last = s; }
      }
    }
    lp.frequency.setValueAtTime(3200, at); lp.frequency.exponentialRampToValueAtTime(700, at + reps * gap + stepDur * 2);
    return last;
  }
  function prefetchSongSamples(s) {
    if (!s || !s.parts) return; syncSamples(); songSamples(s); if (!ctx) return;
    Object.keys(s.parts).forEach(function (k) { if (/^smp_/.test(k) && INSTRUMENTS[k]) requestSample(INSTRUMENTS[k].sample); });
  }
  function stopVoices(at) { voicesNow.slice().forEach(function (vo) { releaseVoice(vo, at); }); }
  // samples saved in this browser (the music page's sample import): listed at once, their bytes read only when played
  function idb() {
    return new Promise(function (ok, no) {
      if (!window.indexedDB) { no(new Error('No IndexedDB')); return; }
      var r = indexedDB.open('fridge-music', 1);   // 'samples': name and length (listed); 'audio': the bytes (read when played)
      r.onupgradeneeded = function () { r.result.createObjectStore('samples', {keyPath: 'id'}); r.result.createObjectStore('audio', {keyPath: 'id'}); };
      r.onsuccess = function () { ok(r.result); }; r.onerror = function () { no(r.error); };
    });
  }
  function localLoader(id) {
    return function () { return idb().then(function (db) { return new Promise(function (ok, no) {
      var q = db.transaction('audio').objectStore('audio').get(id);
      q.onsuccess = function () { if (q.result && q.result.bytes) ok(q.result.bytes); else no(new Error('That sample is not on this browser.')); };
      q.onerror = function () { no(q.error); };
    }); }); };
  }
  var localReady = null;
  function loadLocalSamples() {   // once, on first use of samples - not on every page load
    return localReady || (localReady = idb().then(function (db) { return new Promise(function (ok) {
      var q = db.transaction('samples').objectStore('samples').getAll();
      q.onsuccess = function () {
        (q.result || []).forEach(function (r) { addSample({id: r.id, name: r.name, category: 'yours', load: localLoader(r.id)}); });
        if ((q.result || []).length) sampleNote('*', 'catalog');   // the list grew: menus can redraw
        ok();
      };
      q.onerror = function () { ok(); };
    }); }).catch(function () {}));
  }
  // the music page's import: check a file, keep it in this browser, add it as an instrument
  function importSample(name, bytes) {
    return checkSample(bytes).then(function (b) {
      var id = 'u' + Math.random().toString(36).slice(2, 9).replace(/[^a-z0-9]/g, '0');
      return idb().then(function (db) { return new Promise(function (ok, no) {
        var tx = db.transaction(['samples', 'audio'], 'readwrite');
        tx.objectStore('samples').put({id: id, name: String(name).slice(0, 40), duration: b.duration, size: bytes.byteLength, added: Date.now()});
        tx.objectStore('audio').put({id: id, bytes: bytes});
        tx.oncomplete = function () { ok(); }; tx.onerror = function () { no(tx.error || new Error('This browser would not store it.')); };
      }); }).then(function () {
        addSample({id: id, name: name, category: 'yours', load: localLoader(id)});
        return {id: id, instrument: 'smp_' + id, duration: b.duration};
      });
    });
  }

  var Engine = {
    get songs() { return allSongs(); }, builtIn: BUILT_IN, get instruments() { syncSamples(); return INSTRUMENTS; }, scales: SCALES, customKey: SONGS_KEY,
    songById: songById, noteName: noteName, barsOf: barsOf,
    get level() { return intensity; },
    setLevel: function (x) { intensity = Math.max(0, Math.min(1.5, +x || 0)); if (ctx) bedLevel(); },
    get playing() { return !!timer; }, get song() { return song; },
    start: function (s) {
      if (!AC) return Promise.reject(new Error('No Web Audio here'));
      audio(); Engine.stop(true);
      song = s; step = 0; rand = rng(s.seed || 1); nextAt = ctx.currentTime + 0.08; bedOff(); bedOn(s);
      prefetchSongSamples(s); prefetchSongSamples(nextOf(s));
      return (ctx.state === 'suspended' ? ctx.resume() : Promise.resolve()).then(function () {
        master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
        master.gain.linearRampToValueAtTime(level(), ctx.currentTime + 0.6);
        bedLevel(); timer = window.setInterval(schedule, 25); schedule();
      });
    },
    stop: function (quick) {
      if (!timer) return; window.clearInterval(timer); timer = 0; bedOff();
      if (ctx) stopVoices(ctx.currentTime + (quick ? 0.08 : 0.5));
      if (ctx) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(master.gain.value, ctx.currentTime); master.gain.linearRampToValueAtTime(0, ctx.currentTime + (quick ? 0.08 : 0.5)); }
    },
    setVolume: function (v, m) { vol = Math.max(0, Math.min(1, v)); muted = !!m; if (ctx && timer) master.gain.linearRampToValueAtTime(level(), ctx.currentTime + 0.12); },
    onStep: function (fn) { stepFns.push(fn); },
    onSong: function (fn) { songFns.push(fn); },   // a linked song took over: fn(song)
    resolve: null,                                  // optional: function (id) -> the song object to play for `next`
    get running() { return !!(ctx && ctx.state === 'running'); },
    // samples: the catalog, loading on demand, the import check, and counts for tests and the music page
    samples: function () { syncSamples(); return Object.keys(sampleCat).map(function (id) { var c = sampleCat[id], e = sbuf[id];
      return {id: id, name: c.name, category: c.category, local: c.local, embedded: !!c.embedded, credit: c.credit, license: c.license, url: c.url,
        duration: e && e.buffer ? e.buffer.duration : c.duration, state: e ? e.state : 'idle', error: e && e.err || ''}; }); },
    songSamples: songSamples, sampleDataUri: sampleDataUri, previewSample: previewSample,
    loadSample: function (id) { audio(); requestSample(id); }, onSample: function (fn) { sampleFns.push(fn); },
    prefetch: function (s) { songSamples(s); if (!AC) return; audio(); prefetchSongSamples(s); },   // load a song's samples before it plays
    importSample: importSample, checkSample: checkSample, sampleLimits: SAMPLE, localSamples: function () { localReady = null; return loadLocalSamples(); },
    sampleStats: function () { return {voices: voicesNow.length, cacheBytes: cacheBytes, fetching: fetching, queued: fetchQ.length,
      loaded: Object.keys(sbuf).filter(function (id) { return sbuf[id].state === 'ready'; }).length}; }
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
    play.querySelector('.fm-sr').textContent = on ? 'Pause background music' : wanted ? 'Start background music' : 'Play background music';
    mute.setAttribute('aria-pressed', String(state.muted));
    mute.textContent = state.muted || state.vol === 0 ? '🔇' : '🔉';
    live.textContent = s.title;
  }
  function start() { var s = songById(state.track); Engine.setVolume(state.vol, state.muted); return Engine.start(s).then(function () { wanted = false; disarm(); save(); render(); if (chan) chan.postMessage('playing'); }, function () {}); }
  function stop() { wanted = false; disarm(); Engine.stop(); save(); render(); }

  // waiting to resume after a page change (wanted, not yet audible): pressing play is the gesture that starts it
  play.addEventListener('click', function () { if (Engine.playing) stop(); else start(); });
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
