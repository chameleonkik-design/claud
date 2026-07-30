/**
 * 音名 / ピッチクラス / MIDIノート番号 まわりの基本ユーティリティ。
 *
 * ピッチクラス(pc)は C=0 の 0..11。MIDI ノート番号は C4=60（いわゆる中央ド）。
 */

export const SHARP_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

export const FLAT_NAMES = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
] as const;

/** 12音を必ず 0..11 に収める（負の数にも対応）。 */
export function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

/**
 * キーの主音を「フラット系で表記すべきか」判定する。
 * F / Bb / Eb / Ab / Db / Gb のキーはフラット表記が自然。
 */
export function prefersFlats(tonicPc: number): boolean {
  return [5, 10, 3, 8, 1, 6].includes(mod12(tonicPc));
}

/** ピッチクラスを音名に。useFlats で ♭表記 / ♯表記 を切り替える。 */
export function pcName(pc: number, useFlats = false): string {
  const table = useFlats ? FLAT_NAMES : SHARP_NAMES;
  return table[mod12(pc)];
}

/** MIDI ノート番号を "C4" のような表記に。 */
export function midiName(midi: number, useFlats = false): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${pcName(midi, useFlats)}${octave}`;
}

/** MIDI ノート番号 → 周波数(Hz)。A4=440Hz 基準。 */
export function midiToFreq(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

/** 音名("C", "Eb", "F#", "Gb"...) → ピッチクラス。未知の文字列は null。 */
export function nameToPc(name: string): number | null {
  const m = /^([A-Ga-g])([#b♯♭]*)$/.exec(name.trim());
  if (!m) return null;
  const base: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let pc = base[m[1].toUpperCase()];
  for (const ch of m[2]) {
    if (ch === "#" || ch === "♯") pc += 1;
    else pc -= 1;
  }
  return mod12(pc);
}

/**
 * 表示用に ♯/♭ を綺麗な記号へ。
 * 音名の後ろの b（Bb → B♭）と、度数の前の b（b5 → ♭5）だけを変換する。
 * "sub" のような単語中の b を壊さないため、置換対象を限定している。
 */
export function prettyAccidentals(s: string): string {
  return s
    .replace(/#/g, "♯")
    .replace(/([A-G])b/g, "$1♭")
    .replace(/b(\d)/g, "♭$1");
}
