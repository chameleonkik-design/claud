/**
 * 押さえている音を可視化する簡易鍵盤。
 * highlight は MIDI ノート番号、root は強調表示するピッチクラス。
 */

import { mod12 } from "../music/notes";

interface Props {
  /** 表示する最低音（MIDI）。 */
  from?: number;
  /** 表示するオクターブ数。 */
  octaves?: number;
  /** 光らせる MIDI ノート。 */
  highlight: number[];
  /** ルート音のピッチクラス。 */
  rootPc?: number;
}

/** 1オクターブ内の白鍵/黒鍵の並び。 */
const WHITE_OFFSETS = [0, 2, 4, 5, 7, 9, 11];
/** 黒鍵は「左隣の白鍵の何番目か」で位置を決める。 */
const BLACK_OFFSETS: Array<{ semitone: number; afterWhite: number }> = [
  { semitone: 1, afterWhite: 0 },
  { semitone: 3, afterWhite: 1 },
  { semitone: 6, afterWhite: 3 },
  { semitone: 8, afterWhite: 4 },
  { semitone: 10, afterWhite: 5 },
];

export function Keyboard({ from = 48, octaves = 3, highlight, rootPc }: Props) {
  const lit = new Set(highlight);
  const whiteCount = WHITE_OFFSETS.length * octaves;

  const whites: Array<{ midi: number }> = [];
  for (let o = 0; o < octaves; o++) {
    for (const off of WHITE_OFFSETS) whites.push({ midi: from + o * 12 + off });
  }

  // 白鍵1枚ぶんの幅（％）。黒鍵はこれを基準に置くので、
  // オクターブ数を変えても比率が崩れない。
  const whiteWidthPercent = 100 / whiteCount;
  const blackWidthPercent = whiteWidthPercent * 0.62;

  const blacks: Array<{ midi: number; leftPercent: number }> = [];
  for (let o = 0; o < octaves; o++) {
    for (const b of BLACK_OFFSETS) {
      const whiteIndex = o * WHITE_OFFSETS.length + b.afterWhite;
      blacks.push({
        midi: from + o * 12 + b.semitone,
        // 隣り合う白鍵の境界に重ねる
        leftPercent: (whiteIndex + 1) * whiteWidthPercent,
      });
    }
  }

  const cls = (midi: number, base: string) => {
    if (!lit.has(midi)) return base;
    const isRoot = rootPc !== undefined && mod12(midi) === mod12(rootPc);
    return `${base} on${isRoot ? " root" : ""}`;
  };

  return (
    <div className="keyboard" aria-hidden="true">
      {whites.map((w) => (
        <div key={w.midi} className={cls(w.midi, "key-white")} />
      ))}
      {blacks.map((b) => (
        <div
          key={b.midi}
          className={cls(b.midi, "key-black")}
          style={{ left: `${b.leftPercent}%`, width: `${blackWidthPercent}%` }}
        />
      ))}
    </div>
  );
}
