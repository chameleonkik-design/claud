/**
 * 曲データの初期値・保存・共有リンク。
 *
 * URL の #s=... に曲データを埋め込めるので、リンクを送るだけで進行を共有できる。
 * 外部から来た文字列なので、読み込み時は必ず値を検証してから使う。
 */

import { hasQuality } from "./music/chords";
import { CHORD_PATTERNS, BASS_PATTERNS, DRUM_PATTERNS } from "./music/patterns";
import { SCALES } from "./music/scales";
import { makeSlot, type ChordSlot, type Song } from "./music/song";
import { INSTRUMENTS } from "./audio/instruments";

const STORAGE_KEY = "chord-studio:song:v1";

export const DEFAULT_SONG: Song = {
  tonic: 0,
  scale: "major",
  bpm: 96,
  beatsPerBar: 4,
  chords: [
    makeSlot(5, "maj7"),
    makeSlot(7, "7"),
    makeSlot(4, "m7"),
    makeSlot(9, "m7"),
  ],
  chordPattern: "quarters",
  bassPattern: "octave",
  drumPattern: "rock8",
  instrument: "epiano",
  bassEnabled: true,
  smoothVoicing: true,
  repeats: 2,
  reverb: 0.35,
  volume: 0.85,
  tail: true,
};

function clamp(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return Math.min(max, Math.max(min, v));
}

function pickId(value: unknown, allowed: string[], fallback: string): string {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}

/** 任意の入力を安全な Song に正規化する。 */
export function normalizeSong(raw: unknown): Song {
  const o = (raw ?? {}) as Record<string, unknown>;
  const rawChords = Array.isArray(o.chords) ? o.chords : [];

  const chords: ChordSlot[] = rawChords
    .slice(0, 64)
    .map((c) => {
      const s = (c ?? {}) as Record<string, unknown>;
      const quality = typeof s.quality === "string" && hasQuality(s.quality) ? s.quality : "maj";
      const slot = makeSlot(clamp(s.offset, 0, 11, 0), quality, clamp(s.beats, 0.5, 32, 4));
      const inv = clamp(s.inversion, 0, 5, 0);
      if (inv > 0) slot.inversion = Math.round(inv);
      return slot;
    });

  return {
    tonic: Math.round(clamp(o.tonic, 0, 11, DEFAULT_SONG.tonic)),
    scale: pickId(o.scale, SCALES.map((s) => s.id), DEFAULT_SONG.scale),
    bpm: Math.round(clamp(o.bpm, 30, 300, DEFAULT_SONG.bpm)),
    beatsPerBar: Math.round(clamp(o.beatsPerBar, 2, 7, DEFAULT_SONG.beatsPerBar)),
    chords:
      chords.length > 0
        ? chords
        : DEFAULT_SONG.chords.map((c) => makeSlot(c.offset, c.quality, c.beats)),
    chordPattern: pickId(o.chordPattern, CHORD_PATTERNS.map((p) => p.id), DEFAULT_SONG.chordPattern),
    bassPattern: pickId(o.bassPattern, BASS_PATTERNS.map((p) => p.id), DEFAULT_SONG.bassPattern),
    drumPattern: pickId(o.drumPattern, DRUM_PATTERNS.map((p) => p.id), DEFAULT_SONG.drumPattern),
    instrument: pickId(o.instrument, INSTRUMENTS.map((i) => i.id), DEFAULT_SONG.instrument),
    bassEnabled: typeof o.bassEnabled === "boolean" ? o.bassEnabled : DEFAULT_SONG.bassEnabled,
    smoothVoicing:
      typeof o.smoothVoicing === "boolean" ? o.smoothVoicing : DEFAULT_SONG.smoothVoicing,
    repeats: Math.round(clamp(o.repeats, 1, 16, DEFAULT_SONG.repeats)),
    reverb: clamp(o.reverb, 0, 1, DEFAULT_SONG.reverb),
    volume: clamp(o.volume, 0, 1, DEFAULT_SONG.volume),
    tail: typeof o.tail === "boolean" ? o.tail : DEFAULT_SONG.tail,
  };
}

/** URL に載せるための最小限のオブジェクト（id は復元時に振り直す）。 */
function toPlain(song: Song): unknown {
  return {
    ...song,
    chords: song.chords.map((c) => ({
      offset: c.offset,
      quality: c.quality,
      beats: c.beats,
      ...(c.inversion ? { inversion: c.inversion } : {}),
    })),
  };
}

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeSongToHash(song: Song): string {
  return toBase64Url(JSON.stringify(toPlain(song)));
}

export function decodeSongFromHash(hash: string): Song | null {
  try {
    return normalizeSong(JSON.parse(fromBase64Url(hash)));
  } catch {
    return null;
  }
}

/** 共有用の URL を作る。 */
export function shareUrl(song: Song): string {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#s=${encodeSongToHash(song)}`;
}

/** URL ハッシュ → localStorage → 初期値 の順に読み込む。 */
export function loadSong(): Song {
  const m = /[#&]s=([A-Za-z0-9\-_]+)/.exec(location.hash);
  if (m) {
    const fromUrl = decodeSongFromHash(m[1]);
    if (fromUrl) return fromUrl;
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return normalizeSong(JSON.parse(stored));
  } catch {
    // localStorage が使えない環境でも起動できるように黙って初期値へ
  }
  return normalizeSong(DEFAULT_SONG);
}

export function saveSong(song: Song): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toPlain(song)));
  } catch {
    /* 保存できなくても動作は続ける */
  }
}
