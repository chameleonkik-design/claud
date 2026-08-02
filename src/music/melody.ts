/**
 * メロディ（単音の旋律）の扱い。
 *
 * 音の高さは主音からの半音数で持つ。コードと同じ方式なので、キーを変えると
 * メロディも一緒に移調される。
 *
 * 時間はステップ（拍を等分したマス）で持つ。ステップの配列そのものが
 * ピアノロールの見た目と一対一に対応するので、UI との受け渡しが単純になる。
 */

import { mod12, pcName } from "./notes";
import type { NoteEvent } from "./patterns";
import { getScale, type Scale } from "./scales";

/** 休符を表す。 */
export const REST = null;

/** メロディの1ステップ。主音からの半音数、または休符。 */
export type Step = number | null;

/** ピアノロールの1行。 */
export interface PitchRow {
  /** 主音からの半音数。 */
  offset: number;
  /** 表示する音名。 */
  name: string;
  /** スケールの主音か（行の強調に使う）。 */
  isTonic: boolean;
  /** スケール内の音か。半音表示のときだけ false がありうる。 */
  inScale: boolean;
}

/** メロディが鳴る音域の下端（MIDI）。ここに主音が来る。 */
export const MELODY_BASE_MIDI = 60;

/** 主音からの半音数を実際の MIDI ノート番号にする。 */
export function melodyMidi(tonic: number, offset: number, octaveShift = 0): number {
  return MELODY_BASE_MIDI + mod12(tonic) + offset + octaveShift * 12;
}

/**
 * ピアノロールの行を作る。高い音が先（画面の上）に来る順で返す。
 *
 * chromatic=false ならスケール音だけ。行数が減って画面に収まりやすく、
 * 外れた音を置きにくくなる。
 */
export function pitchRows(scale: Scale, tonic: number, octaves: number, chromatic: boolean): PitchRow[] {
  const useFlats = shouldUseFlats(scale, tonic);
  const rows: PitchRow[] = [];
  const top = octaves * 12;

  for (let offset = 0; offset <= top; offset++) {
    const inScale = scale.degrees.includes(mod12(offset));
    if (!chromatic && !inScale) continue;
    rows.push({
      offset,
      name: pcName(mod12(tonic) + offset, useFlats),
      isTonic: mod12(offset) === 0,
      inScale,
    });
  }
  // 画面では高い音を上に並べる
  return rows.reverse();
}

/** メロディの音名表記をフラット寄りにすべきか。キーの見た目に合わせる。 */
function shouldUseFlats(scale: Scale, tonic: number): boolean {
  // 主音がフラット系のキーなら♭表記。ここはコード名と同じ判断に揃えている。
  const flatTonics = [5, 10, 3, 8, 1, 6];
  return flatTonics.includes(mod12(tonic)) || (scale.minorish && flatTonics.includes(mod12(tonic)));
}

/** 進行の長さから、必要なステップ数を求める。 */
export function stepCount(totalBeats: number, stepsPerBeat: number): number {
  return Math.max(0, Math.round(totalBeats * stepsPerBeat));
}

/**
 * ステップ配列を必要な長さに合わせる。
 * 進行を伸ばしたら休符で埋め、縮めたら余りを捨てる。
 */
export function fitSteps(steps: Step[], length: number): Step[] {
  if (steps.length === length) return steps;
  if (steps.length > length) return steps.slice(0, length);
  return [...steps, ...Array<Step>(length - steps.length).fill(REST)];
}

/**
 * ステップ配列を音符イベントに変換する。
 *
 * 同じ高さが隣り合っていれば1つの長い音にまとめる。これで「タップを続ける」
 * だけで音符の長さを指定できる。
 */
export function melodyToNotes(
  steps: Step[],
  tonic: number,
  stepsPerBeat: number,
  octaveShift: number,
  velocity = 0.8,
): NoteEvent[] {
  const out: NoteEvent[] = [];
  const stepBeats = 1 / stepsPerBeat;

  let runStart = -1;
  let runOffset: number | null = null;

  const flush = (endIndex: number) => {
    if (runOffset === null || runStart < 0) return;
    out.push({
      start: runStart * stepBeats,
      dur: (endIndex - runStart) * stepBeats * 0.98,
      midi: melodyMidi(tonic, runOffset, octaveShift),
      vel: velocity,
    });
    runStart = -1;
    runOffset = null;
  };

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (s === runOffset) continue; // 同じ音が続いている
    flush(i);
    if (s !== REST) {
      runStart = i;
      runOffset = s;
    }
  }
  flush(steps.length);

  return out;
}

/** メロディが1音でも入っているか。 */
export function hasMelody(steps: Step[]): boolean {
  return steps.some((s) => s !== REST);
}

/**
 * そのステップが今どのコードの上にあるか。
 * 「今のコードに合う音」を画面で示すのに使う。
 */
export function chordIndexAtStep(
  step: number,
  stepsPerBeat: number,
  chordStarts: Array<{ startBeat: number; beats: number }>,
): number {
  const beat = step / stepsPerBeat;
  for (let i = 0; i < chordStarts.length; i++) {
    const c = chordStarts[i];
    if (beat >= c.startBeat - 1e-9 && beat < c.startBeat + c.beats - 1e-9) return i;
  }
  return chordStarts.length - 1;
}

/** スケールIDから行を作る簡便版。 */
export function pitchRowsFor(
  scaleId: string,
  tonic: number,
  octaves: number,
  chromatic: boolean,
): PitchRow[] {
  return pitchRows(getScale(scaleId), tonic, octaves, chromatic);
}
