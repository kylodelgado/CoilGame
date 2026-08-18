#!/usr/bin/env python3
"""Procedural audio generator for Coil.

Synthesizes every SFX and the ambient theme loop as 16-bit 44.1kHz mono WAVs
into assets/audio/. Deterministic (fixed seed) so re-running the script
reproduces byte-identical assets.

Design language: chunky 80s-arcade synth — dark and juicy, not chiptune-harsh.
Soft-edged pulse/saw tones, short attacks, everything normalized to -3 dBFS
with a 5 ms fade-out tail so nothing clicks.

Usage: /opt/anaconda3/bin/python3 tools/audio_gen.py
"""

from __future__ import annotations

import os
import wave

import numpy as np

SR = 44100
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "audio")

rng = np.random.default_rng(0xC011)  # deterministic assets

# ---------------------------------------------------------------------------
# Note helpers (A4 = 440 Hz equal temperament)
# ---------------------------------------------------------------------------


def hz(semitones_from_a4: float) -> float:
    return 440.0 * 2.0 ** (semitones_from_a4 / 12.0)


# A minor-ish palette used across the kit so everything feels related.
# Semitone offsets from A4.
NOTE = {
    "A2": -24, "C3": -21, "D3": -19, "E3": -17, "G3": -14,
    "A3": -12, "C4": -9, "D4": -7, "E4": -5, "G4": -2,
    "A4": 0, "B4": 2, "C5": 3, "D5": 5, "E5": 7, "G5": 10,
    "A5": 12, "C6": 15, "E6": 19,
}


def t_axis(dur: float) -> np.ndarray:
    return np.arange(int(SR * dur)) / SR


# ---------------------------------------------------------------------------
# Oscillators — soft-edged so they read "synthwave", not "harsh chiptune"
# ---------------------------------------------------------------------------


def _phase(freq, t: np.ndarray) -> np.ndarray:
    """Integrate frequency (scalar or array) into phase 0..1."""
    f = np.broadcast_to(np.asarray(freq, dtype=np.float64), t.shape)
    return np.cumsum(f) / SR % 1.0


def soft_square(freq, t: np.ndarray, duty: float = 0.5, edge: float = 8.0) -> np.ndarray:
    """Pulse wave with tanh-rounded edges (a warm, chunky square)."""
    ph = _phase(freq, t)
    raw = np.where(ph < duty, 1.0, -1.0)
    # Round the edges by low-passing lightly: blend with a sine of the same phase.
    sine = np.sin(2 * np.pi * ph)
    return np.tanh(edge * 0.25 * (0.7 * raw + 0.5 * sine)) / np.tanh(edge * 0.25)


def saw(freq, t: np.ndarray) -> np.ndarray:
    ph = _phase(freq, t)
    return 2.0 * ph - 1.0


def triangle(freq, t: np.ndarray) -> np.ndarray:
    ph = _phase(freq, t)
    return 2.0 * np.abs(2.0 * ph - 1.0) - 1.0


def sine(freq, t: np.ndarray) -> np.ndarray:
    return np.sin(2 * np.pi * _phase(freq, t))


def noise(n: int) -> np.ndarray:
    return rng.uniform(-1.0, 1.0, n)


# ---------------------------------------------------------------------------
# Filters / envelopes / utilities
# ---------------------------------------------------------------------------


def one_pole_lp(x: np.ndarray, cutoff) -> np.ndarray:
    """Simple one-pole low-pass; cutoff may be a scalar or per-sample array."""
    c = np.broadcast_to(np.asarray(cutoff, dtype=np.float64), x.shape)
    alpha = 1.0 - np.exp(-2.0 * np.pi * np.clip(c, 10.0, SR * 0.45) / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += alpha[i] * (x[i] - acc)
        y[i] = acc
    return y


def env_ar(n: int, attack: float, release: float, curve: float = 3.0) -> np.ndarray:
    """Attack/release envelope with an exponential-ish release."""
    a = max(1, int(SR * attack))
    e = np.ones(n)
    e[:a] = np.linspace(0.0, 1.0, a)
    r = n - a
    if r > 0:
        e[a:] = np.exp(-curve * np.linspace(0.0, 1.0, r))
    return e


def fade_tail(x: np.ndarray, ms: float = 5.0) -> np.ndarray:
    """Linear fade on the last `ms` milliseconds to kill clicks."""
    n = min(len(x), int(SR * ms / 1000.0))
    if n > 0:
        x[-n:] *= np.linspace(1.0, 0.0, n)
    return x


def normalize(x: np.ndarray, db: float = -3.0) -> np.ndarray:
    peak = np.max(np.abs(x))
    if peak > 0:
        x = x * (10.0 ** (db / 20.0) / peak)
    return x


def write_wav(name: str, x: np.ndarray, db: float = -3.0, fade: bool = True) -> None:
    x = normalize(np.asarray(x, dtype=np.float64), db)
    if fade:  # skip for seamless loops — their tail must flow into their head
        x = fade_tail(x)
    pcm = np.clip(np.round(x * 32767.0), -32768, 32767).astype("<i2")
    path = os.path.join(OUT_DIR, name)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"  {name:16s} {len(x) / SR:6.3f}s  {os.path.getsize(path) / 1024:8.1f} KB")


def place(canvas: np.ndarray, clip: np.ndarray, at: float, gain: float = 1.0) -> None:
    i = int(at * SR)
    j = min(len(canvas), i + len(clip))
    canvas[i:j] += clip[: j - i] * gain


# ---------------------------------------------------------------------------
# SFX voices
# ---------------------------------------------------------------------------


def blip(freq: float, dur: float, detune_cents: float = 9.0, duty: float = 0.45,
         attack: float = 0.004, release_curve: float = 5.0, lp: float = 5200.0) -> np.ndarray:
    """Two detuned soft squares — the kit's basic juicy blip voice."""
    t = t_axis(dur)
    d = 2.0 ** (detune_cents / 1200.0)
    x = soft_square(freq, t, duty) + soft_square(freq * d, t, duty * 0.92)
    x = one_pole_lp(x, lp)
    return x * env_ar(len(t), attack, dur - attack, release_curve)


def eat() -> np.ndarray:
    """Quick two-note blip up. Layered detuned squares give it wobble/variance."""
    out = np.zeros(int(SR * 0.16))
    place(out, blip(hz(NOTE["A4"]), 0.07, detune_cents=11), 0.0)
    place(out, blip(hz(NOTE["D5"]), 0.10, detune_cents=7), 0.055, gain=0.9)
    return out


def bonus() -> np.ndarray:
    """Sparkle arp — 4 fast rising notes with a shimmery top layer."""
    seq = ["A4", "C5", "E5", "A5"]
    out = np.zeros(int(SR * 0.34))
    for k, name in enumerate(seq):
        f = hz(NOTE[name])
        n = blip(f, 0.11, detune_cents=6, duty=0.38, lp=6800)
        t = t_axis(0.11)
        n += 0.25 * sine(f * 2.0, t) * env_ar(len(t), 0.002, 0.1, 6.0)
        place(out, n, k * 0.062, gain=0.9 - 0.05 * k)
    return out


def powerup() -> np.ndarray:
    """Rising filtered sweep + a major third landing on top."""
    dur = 0.42
    t = t_axis(dur)
    f = hz(NOTE["A3"]) * 2.0 ** (t / dur * 1.0)  # sweep up one octave
    cutoff = 500.0 + 5200.0 * (t / dur) ** 1.5
    x = one_pole_lp(saw(f, t) + 0.6 * soft_square(f * 0.5, t, 0.4), cutoff)
    x *= env_ar(len(t), 0.008, dur * 0.9, 2.2)
    # The third (C#5 over A4 — borrowed brightness) stabs in near the top.
    third = blip(hz(NOTE["A4"]) * 2 ** (4 / 12), 0.16, detune_cents=8, lp=6000)
    out = np.zeros(int(SR * 0.52))
    place(out, x, 0.0)
    place(out, third, 0.30, gain=0.65)
    return out


def expire() -> np.ndarray:
    """Soft descending minor blip — polite 'your buff is gone'."""
    out = np.zeros(int(SR * 0.24))
    place(out, blip(hz(NOTE["E4"]), 0.10, detune_cents=6, duty=0.5, lp=3400), 0.0, 0.8)
    place(out, blip(hz(NOTE["C4"]), 0.15, detune_cents=6, duty=0.5, lp=3000), 0.085, 0.7)
    return out


def death() -> np.ndarray:
    """Downward pitch crush + low thud."""
    dur = 0.55
    t = t_axis(dur)
    # Pitch dive: A3 falling ~1.5 octaves with a crushed, decimated texture.
    f = hz(NOTE["A3"]) * 2.0 ** (-2.2 * (t / dur) ** 0.8)
    x = soft_square(f, t, 0.5, edge=14.0)
    # Bit-ish crush: sample-and-hold decimation that coarsens as it falls.
    hold = np.maximum(1, (1 + 14 * (t / dur) ** 2).astype(int))
    idx = np.arange(len(x))
    x = x[(idx // hold) * hold % len(x)]
    x = one_pole_lp(x, 2800.0 - 2200.0 * (t / dur))
    x *= env_ar(len(t), 0.003, dur * 0.95, 2.0)
    # Low thud on impact.
    t2 = t_axis(0.30)
    thud_f = 95.0 * 2.0 ** (-1.2 * t2 / 0.30)
    thud = sine(thud_f, t2) * env_ar(len(t2), 0.002, 0.28, 4.5)
    thud += 0.18 * one_pole_lp(noise(len(t2)), 900) * env_ar(len(t2), 0.001, 0.06, 9.0)
    out = np.zeros(int(SR * 0.6))
    place(out, x, 0.0, gain=0.8)
    place(out, thud, 0.10, gain=1.0)
    return out


def win() -> np.ndarray:
    """Triumphant 5-note fanfare over a warm saw pad. (Fanfare gets ~1.1s;
    the brief keeps SFX <=0.6s but a win is terminal — kept tight anyway? No:
    win is the one ceremony moment, still kept to 0.6s to honor the brief.)"""
    total = 0.6
    out = np.zeros(int(SR * total))
    seq = [("A4", 0.00), ("C5", 0.08), ("D5", 0.16), ("E5", 0.24), ("A5", 0.34)]
    for name, at in seq:
        gain = 0.75 if name != "A5" else 1.0
        durn = 0.12 if name != "A5" else 0.26
        place(out, blip(hz(NOTE[name]), durn, detune_cents=9, duty=0.42, lp=6400), at, gain)
    # Warm saw pad underneath (A major chord for the victory lift).
    t = t_axis(total)
    pad = np.zeros(len(t))
    for semi, g in ((NOTE["A3"], 1.0), (NOTE["A3"] + 4, 0.8), (NOTE["E4"], 0.7)):
        f = hz(semi)
        pad += g * (saw(f * 0.997, t) + saw(f * 1.003, t))
    pad = one_pole_lp(pad, 1500)
    pad *= env_ar(len(t), 0.05, total * 0.9, 2.0)
    out += 0.28 * pad
    return out


def tap() -> np.ndarray:
    """Soft UI click, ~40ms."""
    t = t_axis(0.04)
    x = one_pole_lp(noise(len(t)), 2600) * env_ar(len(t), 0.001, 0.035, 8.0)
    x += 0.7 * sine(hz(NOTE["A5"]), t) * env_ar(len(t), 0.001, 0.03, 9.0)
    return x


def tick() -> np.ndarray:
    """Muted woodblock-ish square blip for the countdown."""
    t = t_axis(0.09)
    x = soft_square(hz(NOTE["E5"]), t, 0.3, edge=6.0)
    x = one_pole_lp(x, 2200)
    x *= env_ar(len(t), 0.001, 0.08, 8.0)
    x += 0.2 * one_pole_lp(noise(len(t)), 1400) * env_ar(len(t), 0.001, 0.02, 12.0)
    return x


def go() -> np.ndarray:
    """Bright stab — countdown resolves."""
    t = t_axis(0.28)
    x = np.zeros(len(t))
    for semi, g in ((NOTE["A4"], 1.0), (NOTE["E5"], 0.8), (NOTE["A5"], 0.6)):
        x += g * blip(hz(semi), 0.28, detune_cents=10, duty=0.44, lp=7200)[: len(t)]
    return x * env_ar(len(t), 0.003, 0.26, 4.0)


def revive() -> np.ndarray:
    """Shimmering rebuild arp with a reverse-envelope feel (swell in, snap out)."""
    seq = ["A3", "E4", "A4", "C5", "E5", "A5"]
    out = np.zeros(int(SR * 0.58))
    step = 0.075
    for k, name in enumerate(seq):
        f = hz(NOTE[name])
        dur = 0.16
        t = t_axis(dur)
        v = soft_square(f, t, 0.4) + 0.5 * sine(f * 2.0, t)
        v = one_pole_lp(v, 5600)
        # Reverse envelope: swell up then cut — sounds like assembling.
        n = len(t)
        env = np.linspace(0.0, 1.0, n) ** 1.6
        cut = max(1, int(0.02 * SR))
        env[-cut:] *= np.linspace(1.0, 0.0, cut)
        place(out, v * env, k * step, gain=0.55 + 0.07 * k)
    return out


# ---------------------------------------------------------------------------
# Theme loop — dark synthwave pad + slow arpeggio in A minor, seamless loop
# ---------------------------------------------------------------------------


def theme_loop() -> np.ndarray:
    """~28.8s loop: Am -> F -> C -> Em pad, slow 8th arp, soft pulse bass.

    Built at 100 BPM: bar = 2.4s, 12 bars = 28.8s. The final second is
    crossfaded into the head inside the generator so the loop point is
    click-free.
    """
    bpm = 100.0
    bar = 4 * 60.0 / bpm  # 2.4 s
    bars = 12
    total = bar * bars  # 28.8 s
    n_total = int(SR * total)

    # Chord progression (semitone offsets from A4), repeated 3x over 12 bars.
    A_min = [NOTE["A2"], NOTE["A3"], NOTE["C4"], NOTE["E4"]]
    F_maj = [NOTE["A2"] - 4, NOTE["A3"] - 4, NOTE["C4"], NOTE["A3"]]          # F2 F3 C4 A3
    C_maj = [NOTE["C3"], NOTE["G3"], NOTE["C4"], NOTE["E4"]]
    E_min = [NOTE["E3"] - 12, NOTE["E3"], NOTE["G3"] + 12, NOTE["B4"] - 12]   # E2 E3 G4 B3
    prog = [A_min, F_maj, C_maj, E_min] * (bars // 4)

    out = np.zeros(n_total)

    # --- Pad: detuned saws per chord, slow filter breathing --------------------
    for b, chord in enumerate(prog):
        t = t_axis(bar * 1.06)  # small overlap between chords
        seg = np.zeros(len(t))
        for semi in chord:
            f = hz(semi)
            seg += saw(f * 0.996, t) + saw(f * 1.004, t) + 0.5 * triangle(f, t)
        breathe = 700.0 + 500.0 * np.sin(2 * np.pi * (b / len(prog)) + 2 * np.pi * 0.1 * t)
        seg = one_pole_lp(seg, breathe)
        n = len(t)
        env = np.ones(n)
        edge = int(0.30 * SR)
        env[:edge] = np.linspace(0, 1, edge) ** 0.7
        env[-edge:] *= np.linspace(1, 0, edge) ** 0.7
        place(out, seg * env, b * bar, gain=0.30)

    # --- Slow arpeggio: 8th notes over each chord, soft square ---------------
    eighth = bar / 8.0
    for b, chord in enumerate(prog):
        # Arp pattern over the chord's upper voices, up-down.
        voices = [chord[1] + 12, chord[2] + 12, chord[3] + 12, chord[2] + 12]
        for s in range(8):
            semi = voices[s % len(voices)]
            t = t_axis(eighth * 1.6)
            v = soft_square(hz(semi), t, 0.35) + 0.4 * sine(hz(semi) * 2, t)
            v = one_pole_lp(v, 2600)
            v *= env_ar(len(t), 0.006, eighth * 1.5, 3.0)
            # Gentle velocity contour so the arp undulates instead of ticking.
            vel = 0.55 + 0.45 * np.sin(np.pi * s / 8.0)
            place(out, v, b * bar + s * eighth, gain=0.16 * vel)

    # --- Bass: root pulse on beats 1 and 3 -----------------------------------
    for b, chord in enumerate(prog):
        for beat in (0, 2):
            root = chord[0]
            t = t_axis(bar / 2.5)
            v = soft_square(hz(root), t, 0.5, edge=5.0) + 0.6 * sine(hz(root), t)
            v = one_pole_lp(v, 380)
            v *= env_ar(len(t), 0.01, bar / 2.8, 2.5)
            place(out, v, b * bar + beat * bar / 4.0, gain=0.5)

    # --- Air: a whisper of filtered noise so the space never goes dead -------
    air = one_pole_lp(noise(n_total), 900.0)
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * np.arange(n_total) / SR / (bar * 2))
    out += 0.015 * air * lfo

    # --- Seamless loop: crossfade the last second into the head --------------
    xf = int(SR * 1.0)
    head = out[:xf].copy()
    tail = out[-xf:].copy()
    fade_in = np.linspace(0.0, 1.0, xf)
    out[:xf] = head * fade_in + tail * (1.0 - fade_in)
    looped = out[:-xf]  # drop the tail that was folded into the head

    # Mixed quiet: normalize to a low peak so it sits under the SFX (-14 LUFS
    # feel — peak around -6 dBFS with this crest factor lands close enough).
    return looped


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    print("Coil audio kit -> assets/audio/")
    write_wav("eat.wav", eat())
    write_wav("bonus.wav", bonus())
    write_wav("powerup.wav", powerup())
    write_wav("expire.wav", expire())
    write_wav("death.wav", death())
    write_wav("win.wav", win())
    write_wav("tap.wav", tap())
    write_wav("tick.wav", tick())
    write_wav("go.wav", go())
    write_wav("revive.wav", revive())
    write_wav("theme_loop.wav", theme_loop(), db=-6.0, fade=False)
    print("done.")


if __name__ == "__main__":
    main()
