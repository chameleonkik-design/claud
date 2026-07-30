/**
 * スケール定義と、そこから導かれるダイアトニックコード / 借用コードの生成。
 *
 * 進行データはキーに対する相対度数（主音からの半音数 = offset）で保持するので、
 * ここで生成するコードもすべて offset ベースで返す。
 * こうしておくとキーを変えるだけで全体が移調される。
 */

import { findQualityByIntervals, getQuality } from "./chords";
import { mod12 } from "./notes";

export interface Scale {
  id: string;
  /** 表示名（日本語）。 */
  label: string;
  /** 主音からの半音数（7音）。 */
  degrees: number[];
  /** 短調系のスケールか（ローマ数字表記やベース進行の判断に使う）。 */
  minorish: boolean;
}

export const SCALES: Scale[] = [
  { id: "major", label: "メジャー（Ionian）", degrees: [0, 2, 4, 5, 7, 9, 11], minorish: false },
  { id: "minor", label: "ナチュラルマイナー（Aeolian）", degrees: [0, 2, 3, 5, 7, 8, 10], minorish: true },
  { id: "harmonicMinor", label: "ハーモニックマイナー", degrees: [0, 2, 3, 5, 7, 8, 11], minorish: true },
  { id: "melodicMinor", label: "メロディックマイナー", degrees: [0, 2, 3, 5, 7, 9, 11], minorish: true },
  { id: "dorian", label: "ドリアン", degrees: [0, 2, 3, 5, 7, 9, 10], minorish: true },
  { id: "phrygian", label: "フリジアン", degrees: [0, 1, 3, 5, 7, 8, 10], minorish: true },
  { id: "lydian", label: "リディアン", degrees: [0, 2, 4, 6, 7, 9, 11], minorish: false },
  { id: "mixolydian", label: "ミクソリディアン", degrees: [0, 2, 4, 5, 7, 9, 10], minorish: false },
];

const SCALE_BY_ID = new Map(SCALES.map((s) => [s.id, s]));

export function getScale(id: string): Scale {
  const s = SCALE_BY_ID.get(id);
  if (!s) throw new Error(`未知のスケール: ${id}`);
  return s;
}

/** ローマ数字（大文字）。index は 0 始まり。 */
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

/**
 * 主音からの半音数を度数表記にしたもの。ダイアトニック外のコードの表記に使う。
 * 慣習どおり、bII / bIII / bVI / bVII は♭、#IV は♯で書く。
 */
export const DEGREE_LABEL = [
  "I",
  "bII",
  "II",
  "bIII",
  "III",
  "IV",
  "#IV",
  "V",
  "bVI",
  "VI",
  "bVII",
  "VII",
];

/**
 * その度数のコードのルートを♭表記で書くべきか。
 *
 * 度数表記が♭を持つ音（bIII など）を D♯ ではなく E♭ と書くための判定。
 * 度数に臨時記号が無ければキー本来の表記に従う。
 */
export function useFlatsForDegree(offset: number, keyUseFlats: boolean): boolean {
  const label = DEGREE_LABEL[mod12(offset)];
  if (label.startsWith("b")) return true;
  if (label.startsWith("#")) return false;
  return keyUseFlats;
}

export interface DerivedChord {
  /** 主音からの半音数（0..11）。 */
  offset: number;
  /** コードクオリティID。 */
  quality: string;
  /** "IVmaj7" のようなローマ数字表記。 */
  roman: string;
  /** ダイアトニック内の度数（1..7）。借用コードでは undefined。 */
  degree?: number;
}

/**
 * スケール音を1つ飛ばしで size 個積んでコードを作る。
 * size=3 で三和音、size=4 で七の和音。
 */
function stackChord(scale: Scale, degreeIndex: number, size: number): number[] {
  const notes: number[] = [];
  for (let i = 0; i < size; i++) {
    const idx = degreeIndex + i * 2;
    const octaves = Math.floor(idx / scale.degrees.length);
    notes.push(scale.degrees[idx % scale.degrees.length] + octaves * 12);
  }
  return notes;
}

/**
 * ローマ数字表記を作る。三度が短三度なら数字を小文字にする、という一般的な流儀。
 * dim / m7b5 には °/ø を付ける。
 *
 * numeral には "IV" のようなローマ数字、または "bVI" のように臨時記号つきの
 * 相対度数を渡せる（ダイアトニック外のコード表記で使う）。
 */
export function romanFromNumeral(numeral: string, qualityId: string): string {
  const q = getQuality(qualityId);
  const isMinorThird = mod12(q.intervals[1] ?? 4) === 3;
  // 小文字にするのは数字部分だけ。"bVI" の b は臨時記号なので触らない。
  if (isMinorThird) numeral = numeral.replace(/[IV]+/, (m) => m.toLowerCase());

  switch (qualityId) {
    case "maj":
    case "min":
      return numeral;
    case "dim":
      return `${numeral}°`;
    case "dim7":
      return `${numeral}°7`;
    case "m7b5":
      return `${numeral}ø7`;
    case "aug":
      return `${numeral}+`;
    case "maj7#5":
      return `${numeral}+maj7`;
    case "maj7":
      return `${numeral}maj7`;
    case "m7":
      return `${numeral}7`;
    case "mMaj7":
      return `${numeral}maj7`;
    case "7":
      return `${numeral}7`;
    default:
      return numeral + q.suffix;
  }
}

/**
 * スケールのダイアトニックコードを7つ返す。
 * seventh=true で七の和音、false で三和音。
 */
export function diatonicChords(scale: Scale, seventh: boolean): DerivedChord[] {
  const size = seventh ? 4 : 3;
  return scale.degrees.map((rootOffset, i) => {
    const stacked = stackChord(scale, i, size);
    const intervals = stacked.map((n) => n - stacked[0]);
    const quality = findQualityByIntervals(intervals);
    // 7音スケールから積んだ和音は上記テーブルで必ず同定できるが、
    // 想定外のスケールを足したときに落ちないようフォールバックを置く。
    const qualityId = quality?.id ?? (intervals[1] === 3 ? "min" : "maj");
    return {
      offset: mod12(rootOffset),
      quality: qualityId,
      roman: romanFromNumeral(ROMAN[i], qualityId),
      degree: i + 1,
    };
  });
}

/**
 * よく使う借用コード / セカンダリードミナントを返す。
 *
 * - 各ダイアトニック度数へのセカンダリードミナント（V/x）
 * - 同主調からの借用（メジャーなら bIII / bVI / bVII / iv、マイナーなら IV / V）
 * - サブスティチュートドミナント（裏コード bII7）
 */
export function borrowedChords(scale: Scale): DerivedChord[] {
  const out: DerivedChord[] = [];
  const seen = new Set<string>();
  const push = (c: DerivedChord) => {
    const key = `${c.offset}:${c.quality}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(c);
  };

  const diatonic = diatonicChords(scale, false);
  const diatonicOffsets = new Set(diatonic.map((d) => d.offset));

  // セカンダリードミナント: 各度数の5度上を root にした 7th コード。
  // トニック自身へのドミナント（= 本来のV7）は重複するので除く。
  diatonic.forEach((d, i) => {
    if (i === 0) return;
    const domOffset = mod12(d.offset + 7);
    push({
      offset: domOffset,
      quality: "7",
      roman: `V7/${ROMAN[i]}`,
    });
  });

  // 同主調からの借用（モーダルインターチェンジ）
  const modal: Array<[number, string, string]> = scale.minorish
    ? [
        [5, "maj", "IV"],
        [7, "maj", "V"],
        [7, "7", "V7"],
        [9, "min", "vi"],
        [2, "m7", "ii7"],
      ]
    : [
        [3, "maj", "bIII"],
        [8, "maj", "bVI"],
        [10, "maj", "bVII"],
        [5, "min", "iv"],
        [2, "m7b5", "iiø7"],
      ];
  for (const [offset, quality, roman] of modal) {
    if (diatonicOffsets.has(offset) && quality === "maj") continue;
    push({ offset: mod12(offset), quality, roman });
  }

  // 裏コード（トライトーンサブスティチュート）
  push({ offset: 1, quality: "7", roman: "bII7（裏コード）" });

  return out;
}
