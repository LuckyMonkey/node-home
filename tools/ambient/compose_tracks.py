#!/usr/bin/env python3
"""Render small original background loops and their tracker/MIDI sources.

The browser player only decodes one short Ogg/AAC loop. The musical source is
kept as plain JSON step patterns plus a tiny Standard MIDI file so the tracks
can be regenerated or rearranged without a DAW, samples, or a large runtime.

Run from the node-home checkout:

    python3 tools/ambient/compose_tracks.py

The generated audio is deliberately restrained: soft transients, headroom,
short loops, and no borrowed samples or recognizable melodies.
"""
from __future__ import annotations

import json
import os
import struct
import subprocess
import wave
from pathlib import Path
from typing import Iterable

import numpy as np

SR = 24_000
LOOP_START = 0.5
PAD_AFTER = 1.0
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "media" / "music"
TRACKER = OUT / "tracker"


def hz(note: int | float) -> float:
    return 440.0 * 2 ** ((float(note) - 69) / 12)


def env(n: int, attack: float, decay: float) -> np.ndarray:
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    a = a * a * (3 - 2 * a)
    return a * np.exp(-t / max(decay, 1e-4))


def place(buf: np.ndarray, start: int, sig: np.ndarray, pan: float = 0.0) -> None:
    """Add a mono signal to a stereo loop, wrapping tails over the seam."""
    left = float(np.cos((pan + 1) * np.pi / 4))
    right = float(np.sin((pan + 1) * np.pi / 4))
    n = len(sig)
    for channel, gain in ((0, left), (1, right)):
        end = min(n, len(buf[channel]) - start)
        if end > 0:
            buf[channel, start:start + end] += sig[:end] * gain
        if end < n:
            buf[channel, :n - end] += sig[end:] * gain


def soft_noise(rng: np.random.Generator, n: int, decay: float, low: float = 0.0, high: float = 1.0) -> np.ndarray:
    raw = rng.standard_normal(n)
    if low > 0 or high < 1:
        spec = np.fft.rfft(raw)
        freqs = np.fft.rfftfreq(n, 1 / SR)
        mask = np.ones_like(freqs)
        if low > 0:
            mask *= 1 / (1 + (low / np.maximum(freqs, 1)) ** 4)
        if high < 1:
            mask *= 1 / (1 + (freqs / (SR / 2 * high)) ** 4)
        raw = np.fft.irfft(spec * mask, n=n)
    return raw * env(n, 0.002, decay)


def frame_drum(rng: np.random.Generator, vel: float, low: float = 58.0) -> np.ndarray:
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    pitch = low * (1 + 0.32 * np.exp(-t / 0.045))
    phase = 2 * np.pi * np.cumsum(pitch) / SR
    body = np.sin(phase) * env(n, 0.006, 0.32)
    skin = soft_noise(rng, n, 0.045, 0.03, 0.32) * 0.24
    return (body + skin) * vel


def hand_drum(rng: np.random.Generator, vel: float, high: float = 125.0) -> np.ndarray:
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    phase = 2 * np.pi * np.cumsum(high * (1 + 0.14 * np.exp(-t / 0.02))) / SR
    tone = (np.sin(phase) + 0.35 * np.sin(phase * 1.59)) * env(n, 0.004, 0.09)
    slap = soft_noise(rng, n, 0.028, 0.08, 0.5) * 0.3
    return (tone + slap) * vel


def low_pulse(vel: float, note: int = 36) -> np.ndarray:
    n = int(0.55 * SR)
    t = np.arange(n) / SR
    pitch = hz(note) * (1.8 - 0.8 * np.clip(t / 0.16, 0, 1))
    phase = 2 * np.pi * np.cumsum(pitch) / SR
    return np.sin(phase) * env(n, 0.002, 0.21) * vel


def shaker(rng: np.random.Generator, vel: float) -> np.ndarray:
    n = int(rng.uniform(0.06, 0.13) * SR)
    return soft_noise(rng, n, n / SR / 2.4, 0.45, 0.98) * vel


def wood_click(rng: np.random.Generator, vel: float) -> np.ndarray:
    n = int(0.18 * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * rng.uniform(700, 1100) * t) * env(n, 0.001, 0.055)
    return (tone + soft_noise(rng, n, 0.025, 0.2, 0.8) * 0.15) * vel


def pluck(note: int, vel: float) -> np.ndarray:
    n = int(1.45 * SR)
    t = np.arange(n) / SR
    f = hz(note)
    sig = (
        np.sin(2 * np.pi * f * t)
        + 0.28 * np.sin(2 * np.pi * f * 2.76 * t)
        + 0.10 * np.sin(2 * np.pi * f * 5.4 * t)
    )
    return sig * env(n, 0.006, 0.5) * vel


def pad(loop_n: int, chords: list[list[int]], bars: int, bar_seconds: float, phase: float = 0.0) -> np.ndarray:
    out = np.zeros((2, loop_n))
    section = bars / len(chords)
    for section_i, chord in enumerate(chords):
        start = int(section_i * section * bar_seconds * SR)
        end = int((section_i + 1) * section * bar_seconds * SR)
        length = max(1, end - start)
        t = np.arange(length) / SR
        fade = min(int(1.2 * SR), length // 3)
        window = np.ones(length)
        if fade:
            ramp = np.sin(np.linspace(0, np.pi / 2, fade)) ** 2
            window[:fade] *= ramp
            window[-fade:] *= ramp[::-1]
        for side, detune in ((0, -3.0), (1, 3.0)):
            sig = np.zeros(length)
            for voice, note in enumerate(chord):
                f = hz(note) * 2 ** (detune / 1200)
                sig += np.sin(2 * np.pi * f * t + phase + voice * 0.8) / (1.2 + voice * 0.32)
            out[side, start:end] += sig * window * 0.035
    return out


def add_midi_event(events: list[tuple[int, int, bytes]], tick: int, message: bytes) -> None:
    events.append((max(0, tick), len(events), message))


def varlen(value: int) -> bytes:
    value = max(0, int(value))
    out = [value & 0x7F]
    while value := value >> 7:
        out.insert(0, (value & 0x7F) | 0x80)
    return bytes(out)


def write_midi(path: Path, spec: dict) -> None:
    division = 480
    ticks_per_step = division // 4
    tempo = round(60_000_000 / spec["bpm"])
    events: list[tuple[int, int, bytes]] = []
    name = spec["title"].encode("ascii", "replace")
    add_midi_event(events, 0, b"\xff\x03" + varlen(len(name)) + name)
    add_midi_event(events, 0, b"\xff\x51\x03" + tempo.to_bytes(3, "big"))
    add_midi_event(events, 0, b"\xff\x58\x04\x04\x02\x18\x08")
    tracks = spec["tracker"]
    for bar in range(spec["bars"]):
        for step, value in enumerate(tracks["frame"]):
            if value:
                tick = (bar * 16 + step) * ticks_per_step
                add_midi_event(events, tick, bytes((0x99, 36, int(70 + value * 50))))
                add_midi_event(events, tick + ticks_per_step // 2, bytes((0x89, 36, 0)))
        for step, value in enumerate(tracks["hand"]):
            if value:
                tick = (bar * 16 + step) * ticks_per_step
                add_midi_event(events, tick, bytes((0x99, 60, int(55 + value * 55))))
                add_midi_event(events, tick + ticks_per_step // 2, bytes((0x89, 60, 0)))
        for step, value in enumerate(tracks["air"]):
            if value:
                tick = (bar * 16 + step) * ticks_per_step
                add_midi_event(events, tick, bytes((0x99, 42, int(35 + value * 45))))
                add_midi_event(events, tick + ticks_per_step // 3, bytes((0x89, 42, 0)))
    for section, chord in enumerate(spec["chords"]):
        start = section * (spec["bars"] // len(spec["chords"])) * 16 * ticks_per_step
        length = (spec["bars"] // len(spec["chords"])) * 16 * ticks_per_step
        for note in chord:
            add_midi_event(events, start, bytes((0x90, note, 35)))
            add_midi_event(events, start + length - 1, bytes((0x80, note, 0)))
    events.sort(key=lambda event: (event[0], event[1]))
    track = bytearray()
    previous = 0
    for tick, _, message in events:
        track.extend(varlen(tick - previous))
        track.extend(message)
        previous = tick
    track.extend(b"\x00\xff\x2f\x00")
    data = b"MThd" + struct.pack(">IHHH", 6, 0, 1, division)
    data += b"MTrk" + struct.pack(">I", len(track)) + track
    path.write_bytes(data)


def render_audio(spec: dict) -> tuple[float, float]:
    rng = np.random.default_rng(spec["seed"])
    bar_seconds = 60.0 / spec["bpm"] * 4
    loop_seconds = spec["bars"] * bar_seconds
    loop_n = int(round(loop_seconds * SR))
    step_seconds = bar_seconds / 16
    mix = np.zeros((2, loop_n))
    for bar in range(spec["bars"]):
        for step, value in enumerate(spec["tracker"]["frame"]):
            if value:
                sig = frame_drum(rng, value * 0.55, spec.get("frame_note", 58))
                place(mix, int((bar * 16 + step) * step_seconds * SR), sig, -0.08)
        for step, value in enumerate(spec["tracker"]["hand"]):
            if value:
                sig = hand_drum(rng, value * 0.25, spec.get("hand_note", 125))
                place(mix, int((bar * 16 + step) * step_seconds * SR), sig, 0.22)
        for step, value in enumerate(spec["tracker"]["air"]):
            if value:
                place(mix, int((bar * 16 + step) * step_seconds * SR), shaker(rng, value * 0.07), rng.uniform(-0.65, 0.65))
        for step, value in enumerate(spec["tracker"]["wood"]):
            if value:
                place(mix, int((bar * 16 + step) * step_seconds * SR), wood_click(rng, value * 0.12), rng.uniform(-0.45, 0.45))
        for step, note in enumerate(spec.get("bass", [])):
            if note is not None:
                place(mix, int((bar * 16 + step) * step_seconds * SR), low_pulse(0.18, note), -0.1)
        for step, note in enumerate(spec.get("plucks", [])):
            if note is not None and (bar + step) % spec.get("pluck_every", 3) == 0:
                place(mix, int((bar * 16 + step) * step_seconds * SR), pluck(note, 0.11), rng.uniform(-0.5, 0.5))
    mix += pad(loop_n, spec["chords"], spec["bars"], bar_seconds, spec["seed"] / 1000) * 0.85
    # A small circular echo gives the dry tracker pattern a room without needing
    # a convolution impulse response or a browser-side effect graph.
    echo = np.roll(mix, int(step_seconds * 3 * SR), axis=1) * 0.13
    mix += echo
    mix -= mix.mean(axis=1, keepdims=True)
    peak = float(np.abs(mix).max() or 1.0)
    mix *= 10 ** (-12 / 20) / peak
    total_n = int(round((LOOP_START + loop_seconds + PAD_AFTER) * SR))
    indices = (np.arange(total_n) - int(LOOP_START * SR)) % loop_n
    out = mix[:, indices]
    wav = OUT / f"{spec['id']}.wav.tmp"
    with wave.open(str(wav), "wb") as handle:
        handle.setnchannels(2)
        handle.setsampwidth(2)
        handle.setframerate(SR)
        handle.writeframes((np.clip(out.T, -1, 1) * 32767).astype("<i2").tobytes())
    meta = [
        "-metadata", f"title={spec['title']}",
        "-metadata", "artist=fridge.run",
        "-metadata", "comment=Original deterministic tracker synthesis; no samples",
    ]
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-c:a", "libopus", "-b:a", "56k", "-application", "audio", *meta, str(OUT / f"{spec['id']}.ogg")], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart", *meta, str(OUT / f"{spec['id']}.m4a")], check=True)
    wav.unlink()
    rms = float(20 * np.log10(np.sqrt((mix ** 2).mean()) + 1e-12))
    return loop_seconds, rms


def pattern(values: Iterable[float]) -> list[float]:
    values = list(values)
    if len(values) != 16:
        raise ValueError("tracker rows must have 16 steps")
    return [round(float(v), 3) for v in values]


TRACKS = [
    {
        "id": "canopy-pulse", "title": "Canopy Pulse", "mode": "D dorian / soft jungle",
        "bpm": 86, "bars": 16, "seed": 8614, "frame_note": 58, "hand_note": 130,
        "tracker": {
            "frame": pattern([1, 0, 0, .18, 0, 0, .35, 0, .65, 0, 0, .18, 0, 0, .25, 0]),
            "hand": pattern([0, 0, .35, 0, 0, .3, 0, .15, 0, 0, .4, 0, 0, .22, 0, .28]),
            "air": pattern([.25, 0, .18, 0, .3, 0, .18, 0, .22, 0, .3, 0, .18, 0, .26, 0]),
            "wood": pattern([0, 0, 0, 0, 0, 0, .12, 0, 0, 0, 0, .1, 0, 0, .12, 0]),
        },
        "bass": [50, None, None, None, 50, None, None, None, 53, None, None, None, 48, None, None, None],
        "plucks": [62, None, None, None, None, 65, None, None, 69, None, None, None, None, 67, None, None],
        "pluck_every": 4,
        "chords": [[50, 57, 62, 65], [55, 62, 65, 69], [48, 55, 60, 64], [53, 60, 64, 67]],
        "description": "A low, mysterious canopy groove: hand drums and leaf-like shakers keep motion without taking over.",
    },
    {
        "id": "panda-drum-trail", "title": "Panda Drum Trail", "mode": "A minor / gentle toms",
        "bpm": 78, "bars": 16, "seed": 7821, "frame_note": 53, "hand_note": 116,
        "tracker": {
            "frame": pattern([.8, 0, 0, 0, 0, .16, 0, 0, .52, 0, 0, .14, 0, 0, .2, 0]),
            "hand": pattern([0, .25, 0, .2, 0, 0, .32, 0, 0, .24, 0, .18, 0, 0, .3, 0]),
            "air": pattern([.18, 0, .26, 0, .16, 0, .24, 0, .16, 0, .3, 0, .18, 0, .25, 0]),
            "wood": pattern([0, 0, .14, 0, 0, 0, 0, .12, 0, 0, .15, 0, 0, 0, 0, .1]),
        },
        "bass": [45, None, None, None, None, 45, None, None, 48, None, None, None, None, 43, None, None],
        "plucks": [69, None, 72, None, None, 67, None, None, 64, None, None, 60, None, None, 67, None],
        "pluck_every": 5,
        "chords": [[45, 52, 57, 60], [48, 55, 60, 64], [43, 50, 55, 59], [45, 52, 57, 62]],
        "description": "A soft panda-drum trail: rounded toms, bamboo-like clicks, and a patient pulse for wandering pages.",
    },
    {
        "id": "moss-signal", "title": "Moss Signal", "mode": "E minor / night air",
        "bpm": 64, "bars": 16, "seed": 6407, "frame_note": 46, "hand_note": 104,
        "tracker": {
            "frame": pattern([.65, 0, 0, 0, 0, 0, .18, 0, .42, 0, 0, 0, 0, .12, 0, 0]),
            "hand": pattern([0, 0, 0, .18, 0, 0, .24, 0, 0, 0, .18, 0, 0, .2, 0, 0]),
            "air": pattern([.15, 0, 0, .12, .18, 0, .12, 0, .14, 0, 0, .15, .16, 0, .12, 0]),
            "wood": pattern([0, 0, 0, 0, 0, 0, 0, 0, 0, .1, 0, 0, 0, 0, .1, 0]),
        },
        "bass": [40, None, None, None, None, None, None, None, 43, None, None, None, None, None, None, None],
        "plucks": [64, None, None, 67, None, None, 71, None, None, 67, None, None, 64, None, None, 59],
        "pluck_every": 6,
        "chords": [[40, 47, 52, 55], [43, 50, 55, 59], [45, 52, 55, 60], [40, 47, 52, 59]],
        "description": "The quietest mode: dark pad, damp frame drum, and small signals that keep the page alive.",
    },
]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    TRACKER.mkdir(parents=True, exist_ok=True)
    catalog = [{
        "id": "cellar-light", "title": "Cellar Light", "mode": "D dorian / ambient",
        "bpm": 68, "bars": 32, "loop_start": 1.0, "loop_length": 112.941176,
        "audio": "cellar-light.ogg", "fallback": "cellar-light.m4a",
        "source": "tools/ambient/compose.py",
        "description": "The original roomy ambient loop: soft frame drum, breathy pad, and sparse plucks.",
    }]
    for spec in TRACKS:
        loop_seconds, rms = render_audio(spec)
        write_midi(TRACKER / f"{spec['id']}.mid", spec)
        pattern_data = {
            "format": "fridge.tracker.v1", "id": spec["id"], "title": spec["title"],
            "bpm": spec["bpm"], "bars": spec["bars"], "steps_per_bar": 16,
            "mode": spec["mode"], "seed": spec["seed"], "tracker": spec["tracker"],
            "description": spec["description"],
        }
        (TRACKER / f"{spec['id']}.json").write_text(json.dumps(pattern_data, indent=2) + "\n", encoding="utf-8")
        catalog.append({
            "id": spec["id"], "title": spec["title"], "mode": spec["mode"],
            "bpm": spec["bpm"], "bars": spec["bars"], "loop_start": LOOP_START,
            "loop_length": round(loop_seconds, 6), "audio": f"{spec['id']}.ogg",
            "fallback": f"{spec['id']}.m4a", "midi": f"tracker/{spec['id']}.mid",
            "pattern": f"tracker/{spec['id']}.json", "rms_db": round(rms, 2),
            "description": spec["description"],
        })
        print(f"{spec['id']}: {loop_seconds:.3f}s, rms {rms:.1f} dBFS")
    (OUT / "catalog.json").write_text(json.dumps({"format": "fridge.music.catalog.v1", "tracks": catalog}, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
