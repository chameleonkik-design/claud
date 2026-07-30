/**
 * リズム / アルペジオパターン。コード1つ分の区間を音符イベント列に展開する。
 *
 * ここは完全に決定論的（乱数を使わない）。試聴とMP3書き出しで
 * 1サンプルも違わない結果を保証するため。
 */

export type DrumVoice = "kick" | "snare" | "hat" | "ride";

export interface NoteEvent {
  /** 曲頭からの位置（拍）。 */
  start: number;
  /** 長さ（拍）。 */
  dur: number;
  /** MIDI ノート番号。ドラムでは未使用。 */
  midi: number;
  /** 0..1 のベロシティ。 */
  vel: number;
}

export interface DrumEvent {
  start: number;
  voice: DrumVoice;
  vel: number;
}

export interface PatternContext {
  /** コードの構成音（MIDI、昇順）。 */
  notes: number[];
  /** 区間の開始位置（拍）。 */
  start: number;
  /** 区間の長さ（拍）。 */
  length: number;
  /** 1小節の拍数。 */
  beatsPerBar: number;
}

export interface ChordPattern {
  id: string;
  label: string;
  gen: (ctx: PatternContext) => NoteEvent[];
}

/** 和音を丸ごと1回鳴らす。 */
function block(notes: number[], start: number, dur: number, vel: number, spread = 0): NoteEvent[] {
  return notes.map((midi, i) => ({
    start: start + i * spread,
    dur: Math.max(0.05, dur - i * spread),
    midi,
    vel,
  }));
}

/** step 拍ごとの打点位置を列挙する。 */
function pulses(start: number, length: number, step: number): number[] {
  const out: number[] = [];
  for (let t = 0; t < length - 1e-9; t += step) out.push(start + t);
  return out;
}

/**
 * アルペジオ用に音域を広げた音のプール。
 * 構成音を上に1オクターブ重ねて、動きが出るようにしている。
 */
function arpPool(notes: number[]): number[] {
  const upper = notes.map((n) => n + 12);
  return [...notes, ...upper].sort((a, b) => a - b);
}

/** インデックス列に沿ってプールから音を取り出し、等間隔に並べる。 */
function sequence(
  pool: number[],
  order: (i: number) => number,
  start: number,
  length: number,
  step: number,
  vel: number,
  gate = 0.95,
): NoteEvent[] {
  return pulses(start, length, step).map((t, i) => ({
    start: t,
    dur: step * gate,
    midi: pool[((order(i) % pool.length) + pool.length) % pool.length],
    vel: vel * (i % 2 === 0 ? 1 : 0.86),
  }));
}

export const CHORD_PATTERNS: ChordPattern[] = [
  {
    id: "whole",
    label: "白玉（伸ばし）",
    gen: ({ notes, start, length }) => block(notes, start, length, 0.72),
  },
  {
    id: "halves",
    label: "2拍打ち",
    gen: ({ notes, start, length }) =>
      pulses(start, length, 2).flatMap((t, i) =>
        block(notes, t, Math.min(2, start + length - t), i === 0 ? 0.75 : 0.65),
      ),
  },
  {
    id: "quarters",
    label: "4分打ち",
    gen: ({ notes, start, length }) =>
      pulses(start, length, 1).flatMap((t, i) =>
        block(notes, t, 0.92, i % 2 === 0 ? 0.72 : 0.6),
      ),
  },
  {
    id: "eighths",
    label: "8分刻み",
    gen: ({ notes, start, length }) =>
      pulses(start, length, 0.5).flatMap((t, i) =>
        block(notes, t, 0.45, i % 2 === 0 ? 0.68 : 0.52),
      ),
  },
  {
    id: "arpUp",
    label: "アルペジオ（上昇）",
    gen: ({ notes, start, length }) =>
      sequence(arpPool(notes), (i) => i, start, length, 0.5, 0.7),
  },
  {
    id: "arpDown",
    label: "アルペジオ（下降）",
    gen: ({ notes, start, length }) => {
      const pool = arpPool(notes);
      return sequence(pool, (i) => pool.length - 1 - i, start, length, 0.5, 0.7);
    },
  },
  {
    id: "arpUpDown",
    label: "アルペジオ（往復）",
    gen: ({ notes, start, length }) => {
      const pool = arpPool(notes);
      const period = Math.max(2, (pool.length - 1) * 2);
      return sequence(
        pool,
        (i) => {
          const p = i % period;
          return p < pool.length ? p : period - p;
        },
        start,
        length,
        0.5,
        0.7,
      );
    },
  },
  {
    id: "arp16",
    label: "アルペジオ（16分）",
    gen: ({ notes, start, length }) =>
      sequence(arpPool(notes), (i) => i, start, length, 0.25, 0.6, 0.9),
  },
  {
    id: "alberti",
    label: "アルベルティ・バス",
    gen: ({ notes, start, length }) => {
      const pool = notes;
      const order = [0, pool.length - 1, Math.floor(pool.length / 2), pool.length - 1];
      return pulses(start, length, 0.5).map((t, i) => ({
        start: t,
        dur: 0.48,
        midi: pool[order[i % order.length]],
        vel: i % 2 === 0 ? 0.68 : 0.55,
      }));
    },
  },
  {
    id: "strum",
    label: "ストラム（8ビート）",
    gen: ({ notes, start, length, beatsPerBar }) => {
      // 1小節分の「ジャカジャン」の型。offset は拍、up はアップストローク。
      const shape: Array<{ at: number; up: boolean; vel: number }> = [
        { at: 0, up: false, vel: 0.8 },
        { at: 0.5, up: true, vel: 0.5 },
        { at: 1.5, up: true, vel: 0.55 },
        { at: 2, up: false, vel: 0.72 },
        { at: 2.5, up: true, vel: 0.5 },
        { at: 3, up: false, vel: 0.62 },
        { at: 3.5, up: true, vel: 0.55 },
      ];
      const out: NoteEvent[] = [];
      for (let bar = 0; bar * beatsPerBar < length - 1e-9; bar++) {
        for (const s of shape) {
          if (s.at >= beatsPerBar - 1e-9) break;
          const t = bar * beatsPerBar + s.at;
          if (t >= length - 1e-9) break;
          const ordered = s.up ? [...notes].reverse() : notes;
          ordered.forEach((midi, i) => {
            out.push({
              start: start + t + i * 0.012,
              dur: Math.min(0.5, length - t),
              midi,
              vel: s.vel,
            });
          });
        }
      }
      return out;
    },
  },
  {
    id: "bossa",
    label: "ボサノヴァ",
    gen: ({ notes, start, length, beatsPerBar }) => {
      // 3+3+2 の16分シンコペーション
      const shape = [0, 0.75, 1.5, 2.5, 3.25];
      const out: NoteEvent[] = [];
      for (let bar = 0; bar * beatsPerBar < length - 1e-9; bar++) {
        shape.forEach((at, i) => {
          if (at >= beatsPerBar - 1e-9) return;
          const t = bar * beatsPerBar + at;
          if (t >= length - 1e-9) return;
          out.push(...block(notes, start + t, 0.7, i === 0 ? 0.7 : 0.56, 0.008));
        });
      }
      return out;
    },
  },
  {
    id: "ballad",
    label: "バラード（分散和音）",
    gen: ({ notes, start, length }) => {
      const pool = arpPool(notes);
      const order = [0, 2, 1, 3, 2, 4, 3, 5];
      return pulses(start, length, 0.5).map((t, i) => ({
        start: t,
        dur: 1.4,
        midi: pool[order[i % order.length] % pool.length],
        vel: i % 4 === 0 ? 0.66 : 0.5,
      }));
    },
  },
];

const CHORD_PATTERN_BY_ID = new Map(CHORD_PATTERNS.map((p) => [p.id, p]));

export function getChordPattern(id: string): ChordPattern {
  const p = CHORD_PATTERN_BY_ID.get(id);
  if (!p) throw new Error(`未知のコードパターン: ${id}`);
  return p;
}

// --- ベースパターン ---

export interface BassPattern {
  id: string;
  label: string;
  /** root/fifth は MIDI 実音で渡す。 */
  gen: (ctx: {
    root: number;
    fifth: number;
    start: number;
    length: number;
    beatsPerBar: number;
  }) => NoteEvent[];
}

export const BASS_PATTERNS: BassPattern[] = [
  {
    id: "whole",
    label: "白玉",
    gen: ({ root, start, length }) => [{ start, dur: length * 0.98, midi: root, vel: 0.85 }],
  },
  {
    id: "quarters",
    label: "4分",
    gen: ({ root, start, length }) =>
      pulses(start, length, 1).map((t, i) => ({
        start: t,
        dur: 0.9,
        midi: root,
        vel: i % 2 === 0 ? 0.85 : 0.7,
      })),
  },
  {
    id: "eighths",
    label: "8分（ドライブ）",
    gen: ({ root, start, length }) =>
      pulses(start, length, 0.5).map((t, i) => ({
        start: t,
        dur: 0.42,
        midi: root,
        vel: i % 2 === 0 ? 0.85 : 0.65,
      })),
  },
  {
    id: "octave",
    label: "オクターブ",
    gen: ({ root, start, length }) =>
      pulses(start, length, 0.5).map((t, i) => ({
        start: t,
        dur: 0.42,
        midi: i % 2 === 0 ? root : root + 12,
        vel: i % 2 === 0 ? 0.85 : 0.68,
      })),
  },
  {
    id: "walk",
    label: "ルート＋5度",
    gen: ({ root, fifth, start, length }) =>
      pulses(start, length, 1).map((t, i) => ({
        start: t,
        dur: 0.9,
        midi: [root, root, fifth, root + 12][i % 4],
        vel: i === 0 ? 0.88 : 0.72,
      })),
  },
  {
    id: "bossa",
    label: "ボサノヴァ",
    gen: ({ root, fifth, start, length, beatsPerBar }) => {
      const out: NoteEvent[] = [];
      for (let bar = 0; bar * beatsPerBar < length - 1e-9; bar++) {
        const hits: Array<[number, number]> = [
          [0, root],
          [1.5, fifth],
          [2, root],
          [3.5, fifth],
        ];
        for (const [at, midi] of hits) {
          if (at >= beatsPerBar - 1e-9) break;
          const t = bar * beatsPerBar + at;
          if (t >= length - 1e-9) break;
          out.push({ start: start + t, dur: 0.8, midi, vel: at === 0 ? 0.88 : 0.72 });
        }
      }
      return out;
    },
  },
];

const BASS_PATTERN_BY_ID = new Map(BASS_PATTERNS.map((p) => [p.id, p]));

export function getBassPattern(id: string): BassPattern {
  const p = BASS_PATTERN_BY_ID.get(id);
  if (!p) throw new Error(`未知のベースパターン: ${id}`);
  return p;
}

// --- ドラムパターン ---

export interface DrumPattern {
  id: string;
  label: string;
  /** 1小節分の打点（拍位置は 0 始まり）。 */
  bar: Array<{ at: number; voice: DrumVoice; vel: number }>;
}

export const DRUM_PATTERNS: DrumPattern[] = [
  { id: "none", label: "なし", bar: [] },
  {
    id: "rock8",
    label: "8ビート",
    bar: [
      { at: 0, voice: "kick", vel: 0.95 },
      { at: 1, voice: "snare", vel: 0.8 },
      { at: 2, voice: "kick", vel: 0.85 },
      { at: 2.5, voice: "kick", vel: 0.6 },
      { at: 3, voice: "snare", vel: 0.82 },
      ...[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((at) => ({
        at,
        voice: "hat" as DrumVoice,
        vel: at % 1 === 0 ? 0.42 : 0.28,
      })),
    ],
  },
  {
    id: "four",
    label: "4つ打ち",
    bar: [
      ...[0, 1, 2, 3].map((at) => ({ at, voice: "kick" as DrumVoice, vel: 0.92 })),
      { at: 1, voice: "snare", vel: 0.6 },
      { at: 3, voice: "snare", vel: 0.6 },
      ...[0.5, 1.5, 2.5, 3.5].map((at) => ({ at, voice: "hat" as DrumVoice, vel: 0.4 })),
    ],
  },
  {
    id: "ballad",
    label: "バラード",
    bar: [
      { at: 0, voice: "kick", vel: 0.85 },
      { at: 2, voice: "snare", vel: 0.62 },
      ...[0, 1, 2, 3].map((at) => ({ at, voice: "ride" as DrumVoice, vel: 0.3 })),
      ...[0.5, 1.5, 2.5, 3.5].map((at) => ({ at, voice: "ride" as DrumVoice, vel: 0.18 })),
    ],
  },
  {
    id: "bossa",
    label: "ボサノヴァ",
    bar: [
      { at: 0, voice: "kick", vel: 0.7 },
      { at: 1.5, voice: "kick", vel: 0.6 },
      { at: 2, voice: "kick", vel: 0.65 },
      { at: 3.5, voice: "kick", vel: 0.6 },
      ...[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((at) => ({
        at,
        voice: "ride" as DrumVoice,
        vel: at % 1 === 0 ? 0.32 : 0.22,
      })),
      { at: 0.75, voice: "snare", vel: 0.3 },
      { at: 2.75, voice: "snare", vel: 0.3 },
    ],
  },
  {
    id: "metronome",
    label: "メトロノームのみ",
    bar: [
      { at: 0, voice: "hat", vel: 0.6 },
      { at: 1, voice: "hat", vel: 0.3 },
      { at: 2, voice: "hat", vel: 0.35 },
      { at: 3, voice: "hat", vel: 0.3 },
    ],
  },
];

const DRUM_PATTERN_BY_ID = new Map(DRUM_PATTERNS.map((p) => [p.id, p]));

export function getDrumPattern(id: string): DrumPattern {
  const p = DRUM_PATTERN_BY_ID.get(id);
  if (!p) throw new Error(`未知のドラムパターン: ${id}`);
  return p;
}

/** ドラムパターンを曲全体（totalBeats）に敷き詰める。 */
export function renderDrums(
  pattern: DrumPattern,
  totalBeats: number,
  beatsPerBar: number,
): DrumEvent[] {
  if (pattern.bar.length === 0) return [];
  const out: DrumEvent[] = [];
  for (let bar = 0; bar * beatsPerBar < totalBeats - 1e-9; bar++) {
    for (const hit of pattern.bar) {
      if (hit.at >= beatsPerBar - 1e-9) continue;
      const t = bar * beatsPerBar + hit.at;
      if (t >= totalBeats - 1e-9) continue;
      out.push({ start: t, voice: hit.voice, vel: hit.vel });
    }
  }
  return out;
}
