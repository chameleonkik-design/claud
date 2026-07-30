/**
 * コード（root + クオリティ）を実際に鳴らす MIDI ノートへ変換する。
 *
 * 単純に root から積むだけだと和音が飛び回って聴きづらいので、
 * 直前の和音に近い転回形を選ぶ「ボイスリーディング」を入れている。
 */

import { getQuality } from "./chords";
import { mod12 } from "./notes";

export interface Voicing {
  /** 和音として鳴らす MIDI ノート（昇順）。 */
  notes: number[];
  /** ベースパートが鳴らす MIDI ノート。 */
  bass: number;
  /** ベース音のピッチクラス（分数コード表示に使う）。 */
  bassPc: number;
}

export interface VoicingOptions {
  /** 和音を置きたい音域の中心（MIDI）。既定は C4 の少し上。 */
  center?: number;
  /** 直前の和音の構成音。渡すと滑らかに繋がる転回形を選ぶ。 */
  prev?: number[];
  /** 転回指定（0=基本形, 1=第1転回…）。指定するとボイスリーディングより優先。 */
  inversion?: number;
  /** ボイスリーディングを行うか。 */
  smooth?: boolean;
  /** ベース音のオクターブ（MIDI の C を基準、2 なら C2=36）。 */
  bassOctave?: number;
}

/** 転回形を作る: 下から k 個の音を 1 オクターブ上げる。 */
function invert(notes: number[], k: number): number[] {
  const out = [...notes];
  for (let i = 0; i < k; i++) {
    out[i % out.length] += 12;
  }
  return out.sort((a, b) => a - b);
}

/** 和音同士の距離。各声部が最も近い相手までの移動量の合計。 */
function voicingDistance(a: number[], b: number[]): number {
  let total = 0;
  for (const n of a) {
    let best = Infinity;
    for (const m of b) best = Math.min(best, Math.abs(n - m));
    total += best;
  }
  return total / a.length;
}

export function buildVoicing(
  rootPc: number,
  qualityId: string,
  opts: VoicingOptions = {},
): Voicing {
  const { center = 63, prev, inversion, smooth = true, bassOctave = 2 } = opts;
  const intervals = getQuality(qualityId).intervals;

  // root を center の少し下に配置してから積む。
  const baseRootTarget = center - 6;
  const baseRoot =
    baseRootTarget + mod12(mod12(rootPc) - mod12(baseRootTarget));
  const base = intervals.map((i) => baseRoot + i);

  let chosen: number[];
  let bassPc = mod12(rootPc);

  if (inversion !== undefined && inversion > 0) {
    chosen = invert(base, inversion % intervals.length);
    bassPc = mod12(chosen[0]);
  } else if (smooth && prev && prev.length > 0) {
    // 転回形 × オクターブシフトの候補から、直前の和音に最も近いものを選ぶ。
    let best: number[] = base;
    let bestScore = Infinity;
    for (let k = 0; k < intervals.length; k++) {
      for (const shift of [-12, 0, 12]) {
        const cand = invert(base, k).map((n) => n + shift);
        const mean = cand.reduce((s, n) => s + n, 0) / cand.length;
        // 直前の和音への近さを主に見つつ、音域が上下に流れていかないよう
        // center からのズレも軽くペナルティにする。
        const score = voicingDistance(cand, prev) + Math.abs(mean - center) * 0.35;
        if (score < bestScore) {
          bestScore = score;
          best = cand;
        }
      }
    }
    chosen = best;
  } else {
    chosen = base;
  }

  // 転回を明示した場合は分数コードとして扱い、ベースも転回後の最低音を弾く。
  const bass = 12 * (bassOctave + 1) + bassPc;
  return { notes: chosen, bass, bassPc };
}
