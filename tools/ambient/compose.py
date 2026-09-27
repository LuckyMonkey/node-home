#!/usr/bin/env python3
"""
"Cellar Light" - the fridge.run ambient loop. Original, synthesised from scratch (numpy only; no samples, no
third-party audio). Re-render and re-encode:

    python3 tools/ambient/compose.py            # -> media/music/cellar-light.{ogg,m4a}  (AMBIENT_WAV=path keeps the WAV)

A slow wander through a strange, roomy place: a soft low frame drum, a muted higher hand drum, faint irregular
shakers and seed-pod rattles, a dark breathing pad in D dorian (Dm9 - Bbmaj7 - Gm9 - C6/9) and sparse
kalimba-like plucks with echo. 68 BPM, 32 bars, ~113 s.

Seamless by construction: every sound - including echoes and the reverb tail - is written into a circular buffer
exactly one loop long, so the end runs straight into the start. The encoded files hold one loop plus a few extra
seconds of the same (periodic) audio; the player loops between LOOP_START and LOOP_START + LOOP_LEN, which stays
seamless even if a decoder adds priming delay at the front (AAC does).
"""
import os
import subprocess
import wave

import numpy as np

SR = 48000
BPM = 68
BARS = 32
BEAT = 60 / BPM
BAR = 4 * BEAT
LOOP = BARS * BAR                      # seconds
N = int(round(LOOP * SR))
LOOP_START = 1.0                       # where the player's loop begins in the file (s)
PAD_AFTER = 3.0                        # extra periodic audio after the loop (s)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'media', 'music')
rng = np.random.default_rng(20260927)  # fixed seed: the same piece every render


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def place(buf, start, sig, pan=0.0):
    """Add a mono sound into the stereo circular buffer at sample `start`, wrapping round the loop end."""
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    n = len(sig)
    idx = (start + np.arange(n)) % N
    np.add.at(buf[0], idx, sig * gl)
    np.add.at(buf[1], idx, sig * gr)


def band(sig, lo, hi, soft=1.0):
    """Band-limit by shaping the spectrum (smooth edges, no ringing)."""
    spec = np.fft.rfft(sig, axis=-1)
    f = np.fft.rfftfreq(sig.shape[-1], 1 / SR)
    resp = np.ones_like(f)
    if lo:
        resp *= 1 / (1 + (lo / np.maximum(f, 1)) ** (2 * soft))
    if hi:
        resp *= 1 / (1 + (f / hi) ** (2 * soft))
    return np.fft.irfft(spec * resp, n=sig.shape[-1], axis=-1)


def env(n, attack, tau):
    t = np.arange(n) / SR
    a = np.clip(t / attack, 0, 1)
    a = a * a * (3 - 2 * a)                                 # smoothstep attack: rounded, no click
    return a * np.exp(-t / tau)


# ---- percussion -------------------------------------------------------------------------------------------
def frame_drum(f0, vel, length=1.2):
    n = int(length * SR)
    t = np.arange(n) / SR
    pitch = f0 * (1 + 0.32 * np.exp(-t / 0.045))            # the skin settles after the stroke
    phase = 2 * np.pi * np.cumsum(pitch) / SR
    body = np.sin(phase) * env(n, 0.006, 0.34)
    over = np.sin(2.31 * phase + 0.7) * env(n, 0.005, 0.11) * 0.18
    skin = band(rng.standard_normal(n), 40, 420) * env(n, 0.004, 0.05) * 0.22
    return (body + over + skin) * vel


def hand_drum(f0, vel):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    phase = 2 * np.pi * np.cumsum(f0 * (1 + 0.15 * np.exp(-t / 0.02))) / SR
    tone = np.sin(phase) * env(n, 0.004, 0.09) + 0.35 * np.sin(1.59 * phase) * env(n, 0.004, 0.05)
    slap = band(rng.standard_normal(n), 200, 1800) * env(n, 0.003, 0.025) * 0.25
    return (tone + slap) * vel


def shaker(vel, length=None):
    length = length or rng.uniform(0.07, 0.14)
    n = int(length * SR)
    g = band(rng.standard_normal(n), 2600, 8000) * env(n, rng.uniform(0.012, 0.03), length / 2.6)
    return g * vel


def seed_rattle(vel):
    """A pod shaken once: a burst of tiny seed clicks that thins out."""
    n = int(0.45 * SR)
    out = np.zeros(n)
    k = rng.integers(7, 16)
    times = np.sort(rng.uniform(0, 0.28, k))
    for i, t0 in enumerate(times):
        m = int(rng.uniform(0.002, 0.005) * SR)
        g = rng.standard_normal(m) * env(m, 0.0008, 0.0015) * np.exp(-i * 0.18) * rng.uniform(0.5, 1)
        s = int(t0 * SR)
        out[s:s + m] += g[:max(0, min(m, n - s))]
    return band(out, 1400, 5200) * vel


# ---- tones ------------------------------------------------------------------------------------------------
def pluck(f, vel):
    n = int(2.2 * SR)
    t = np.arange(n) / SR
    s = (np.sin(2 * np.pi * f * t) * env(n, 0.007, 0.75)
         + 0.28 * np.sin(2 * np.pi * f * 2.76 * t) * env(n, 0.006, 0.22)
         + 0.10 * np.sin(2 * np.pi * f * 5.4 * t) * env(n, 0.005, 0.09))
    return band(s, 60, 3200) * vel


CHORDS = [  # 8 bars each, circular: C6/9 flows back into Dm9
    [38, 45, 53, 60, 64],      # Dm9      D2 A2 F3 C4 E4
    [34, 41, 50, 57, 64],      # Bbmaj7#11-ish  Bb1 F2 D3 A3 E4
    [31, 38, 46, 53, 57],      # Gm9      G1 D2 Bb2 F3 A3
    [36, 43, 52, 57, 62],      # C6/9     C2 G2 E3 A3 D4
]
PENTA = [62, 65, 67, 69, 72, 74, 77, 79]   # D minor pentatonic, D4..G5, for the plucks


def pad():
    t = np.arange(N) / SR
    out = np.zeros((2, N))
    sec = 8 * BAR
    bright = 0.55 + 0.45 * np.sin(2 * np.pi * t / LOOP * 3 + 1.0)       # slow opening and closing, 3 per loop
    breathe = 0.8 + 0.2 * np.sin(2 * np.pi * t / LOOP * 5)
    for ci, chord in enumerate(CHORDS):
        # raised-cosine window centred on the chord's section, 4 s crossfades, circular - the windows sum to one
        c = (ci + 0.5) * sec
        d = ((t - c + LOOP / 2) % LOOP) - LOOP / 2
        half, fade = sec / 2, 2.0
        w = np.clip((half + fade - np.abs(d)) / (2 * fade), 0, 1)
        w = w * w * (3 - 2 * w)
        for k, m in enumerate(chord):
            f = hz(m)
            for ch, det in ((0, -3), (1, 3)):                           # detuned per side: slow, wide chorus
                ff = f * 2 ** (det / 1200)
                sig = np.zeros(N)
                for p in range(1, 9):
                    if ff * p > 5000:
                        break
                    amp = (1 / p ** 1.25) * (bright ** (p - 1))
                    sig += amp * np.sin(2 * np.pi * ff * p * t + rng.uniform(0, 2 * np.pi))
                out[ch] += sig * w * (0.35 if k == 0 else 0.75) * breathe
    air = band(rng.standard_normal((2, N)), 250, 2400) * (0.5 + 0.5 * np.sin(2 * np.pi * t / LOOP * 2)) * 0.05
    return out * 0.028 + air


def reverb(buf, rt60=3.4, predelay=0.022, damp=4200):
    """Circular convolution with a synthetic room: decorrelated decaying noise, darker as it decays."""
    n = int(rt60 * 1.4 * SR)
    t = np.arange(n) / SR
    ir = np.zeros((2, N))
    for ch in range(2):
        noise = rng.standard_normal(n) * np.exp(-6.9 * t / rt60)
        early = band(noise[: int(0.3 * SR)], 150, damp * 1.4)
        late = band(noise, 150, damp)
        tail = np.concatenate([early, late[len(early):]])
        p = int(predelay * SR)
        ir[ch, p:p + n] = tail[: N - p]
    ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    return np.fft.irfft(np.fft.rfft(buf, axis=1) * np.fft.rfft(ir, axis=1), n=N, axis=1)


def echo(buf, delay, feedback, taps=6, spread=0.35):
    out = np.zeros_like(buf)
    d = int(delay * SR)
    for i in range(1, taps + 1):
        g = feedback ** i
        side = 0 if i % 2 else 1                                        # ping-pong
        mix = np.roll(buf, d * i, axis=1) * g
        out[side] += mix[side] * (1 - spread) + mix[1 - side] * spread
        out[1 - side] += mix[1 - side] * spread
    return band(out, 180, 2600)


def main():
    step = BEAT / 4                                                      # sixteenth
    at = lambda bar, s, jit=0.0: int(((bar * BAR + s * step + rng.normal(0, jit)) % LOOP) * SR)   # noqa: E731
    drums, shakers, plucks = (np.zeros((2, N)) for _ in range(3))

    for bar in range(BARS):
        phrase = bar % 8
        thin = phrase in (6, 7)                                          # every 8 bars the drums step back and breathe
        # low frame drum: one, sometimes the "and" of two, soft three
        place(drums, at(bar, 0, 0.006), frame_drum(62, 0.9 if not thin else 0.55), -0.05)
        if rng.random() < (0.55 if not thin else 0.2):
            place(drums, at(bar, 6, 0.01), frame_drum(62, rng.uniform(0.35, 0.5)), -0.05)
        if not thin and rng.random() < 0.8:
            place(drums, at(bar, 8, 0.008), frame_drum(58, rng.uniform(0.5, 0.65)), 0.0)
        if rng.random() < 0.3:
            place(drums, at(bar, 14, 0.012), frame_drum(62, 0.28), -0.05)
        # muted higher hand drum answering, off the beat
        for s in (3, 11, 13):
            if rng.random() < (0.35 if not thin else 0.12):
                place(drums, at(bar, s, 0.012), hand_drum(rng.choice([118, 131]), rng.uniform(0.12, 0.24)), 0.22)
        # shakers: irregular, set back, drifting in the stereo field
        for s in range(0, 16, 2):
            if rng.random() < 0.42:
                place(shakers, at(bar, s + rng.choice([0, 1]), 0.022), shaker(rng.uniform(0.05, 0.13)), rng.uniform(-0.6, 0.6))
        if rng.random() < 0.38:
            place(shakers, at(bar, rng.integers(0, 16), 0.03), seed_rattle(rng.uniform(0.25, 0.45)), rng.uniform(-0.7, 0.7))
        # plucks: rare, never busy
        if rng.random() < (0.55 if phrase in (1, 2, 4, 5) else 0.25):
            s = rng.choice([2, 5, 9, 12])
            place(plucks, at(bar, s, 0.015), pluck(hz(rng.choice(PENTA)), rng.uniform(0.12, 0.2)), rng.uniform(-0.5, 0.5))

    pads = pad()
    drums = band(drums, 48, 5000) * 0.45
    plucks = plucks + echo(plucks, 3 * step, 0.38)
    dry = drums * 1.0 + shakers * 1.8 + plucks * 1.6 + pads
    wet = reverb(drums * 0.28 + shakers * 1.1 + plucks * 1.1 + pads * 0.35)
    mix = band(dry + wet * 0.7, 45, 9000, soft=0.8)
    mix -= mix.mean(axis=1, keepdims=True)
    # a slow, gentle leveller: 2:1 above the running level, ~300 ms, circular - lifts the hush between strokes and
    # keeps any single moment from standing out
    lvl = np.sqrt(np.fft.irfft(np.fft.rfft((mix ** 2).mean(axis=0)) * np.fft.rfft(np.roll(np.pad(np.hanning(int(0.3 * SR)), (0, N - int(0.3 * SR))), -int(0.15 * SR)) / (0.15 * SR)), n=N).clip(1e-12))
    thr = np.median(lvl)
    mix *= np.where(lvl > thr, (thr / lvl) ** 0.5, (thr / lvl) ** 0.25)[None, :].clip(0.5, 2.0)
    peak = np.abs(mix).max()
    mix *= 10 ** (-9 / 20) / peak                                        # peak at -9 dBFS: lots of headroom
    rms = 20 * np.log10(np.sqrt((mix ** 2).mean()))

    # file = [one loop, rotated to start LOOP_START in] + PAD_AFTER more: periodic all the way through
    s0 = int(((LOOP - LOOP_START + 2.5 * BEAT) % LOOP) * SR)          # the loop point falls on a quiet off-beat, not on a stroke
    total = int((LOOP_START + LOOP + PAD_AFTER) * SR)
    idx = (s0 + np.arange(total)) % N
    out = mix[:, idx]
    os.makedirs(OUT, exist_ok=True)
    wav = os.environ.get('AMBIENT_WAV', os.path.join(OUT, 'cellar-light.wav.tmp'))
    with wave.open(wav, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(out.T, -1, 1) * 32767).astype('<i2').tobytes())
    meta = ['-metadata', 'title=Cellar Light', '-metadata', 'artist=fridge.run', '-metadata', 'comment=Original synthesis; see README']
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-c:a', 'libopus', '-b:a', '72k', '-application', 'audio', *meta,
                    os.path.join(OUT, 'cellar-light.ogg')], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', *meta,
                    os.path.join(OUT, 'cellar-light.m4a')], check=True)
    if 'AMBIENT_WAV' not in os.environ:
        os.remove(wav)
    print(f'loop {LOOP:.3f} s ({BARS} bars at {BPM} BPM), file {total / SR:.2f} s, loop start {LOOP_START} s, '
          f'peak -9.0 dBFS, rms {rms:.1f} dBFS; wav {wav}')
    print('player constants: LOOP_START =', LOOP_START, ' LOOP_LEN =', round(LOOP, 6))


if __name__ == '__main__':
    main()
