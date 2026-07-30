import { describe, expect, it } from "vitest";

import {
  chordPitchClasses,
  chordName,
  findQualityByIntervals,
  getQuality,
  QUALITIES,
} from "../src/music/chords";
import { midiName, midiToFreq, nameToPc, pcName, prettyAccidentals } from "../src/music/notes";
import { PRESETS, presetToSlots } from "../src/music/presets";
import { borrowedChords, diatonicChords, getScale, SCALES } from "../src/music/scales";
import { buildVoicing } from "../src/music/voicing";

describe("音名とピッチクラス", () => {
  it("シャープ/フラットを切り替えて表記できる", () => {
    expect(pcName(1)).toBe("C#");
    expect(pcName(1, true)).toBe("Db");
    expect(pcName(-1)).toBe("B");
    expect(pcName(13)).toBe("C#");
  });

  it("音名からピッチクラスへ戻せる", () => {
    expect(nameToPc("C")).toBe(0);
    expect(nameToPc("Eb")).toBe(3);
    expect(nameToPc("F#")).toBe(6);
    expect(nameToPc("Cb")).toBe(11);
    expect(nameToPc("H")).toBeNull();
  });

  it("MIDI番号とオクターブ表記が対応する", () => {
    expect(midiName(60)).toBe("C4");
    expect(midiName(69)).toBe("A4");
    expect(midiToFreq(69)).toBeCloseTo(440, 6);
    expect(midiToFreq(81)).toBeCloseTo(880, 6);
    expect(midiToFreq(57)).toBeCloseTo(220, 6);
  });

  it("表示用の臨時記号だけを置き換える", () => {
    expect(prettyAccidentals("Bb")).toBe("B♭");
    expect(prettyAccidentals("C#m7b5")).toBe("C♯m7♭5");
    expect(prettyAccidentals("sus4")).toBe("sus4");
    expect(prettyAccidentals("add9")).toBe("add9");
  });
});

describe("コードの構成音", () => {
  it("代表的なコードの構成音が正しい", () => {
    expect(chordPitchClasses(0, "maj")).toEqual([0, 4, 7]);
    expect(chordPitchClasses(0, "min")).toEqual([0, 3, 7]);
    expect(chordPitchClasses(0, "maj7")).toEqual([0, 4, 7, 11]);
    expect(chordPitchClasses(0, "7")).toEqual([0, 4, 7, 10]);
    expect(chordPitchClasses(0, "m7b5")).toEqual([0, 3, 6, 10]);
    // G7 = G B D F
    expect(chordPitchClasses(7, "7")).toEqual([7, 11, 2, 5]);
  });

  it("コードクオリティのIDが重複していない", () => {
    const ids = QUALITIES.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("すべてのクオリティが root(0) を含む", () => {
    for (const q of QUALITIES) {
      expect(q.intervals[0]).toBe(0);
      expect(q.intervals.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("ダイアトニックなクオリティはインターバルから逆引きできる", () => {
    expect(findQualityByIntervals([0, 4, 7])?.id).toBe("maj");
    expect(findQualityByIntervals([0, 3, 7, 10])?.id).toBe("m7");
    expect(findQualityByIntervals([0, 4, 7, 11])?.id).toBe("maj7");
    // オクターブ上に積まれていても同じ和音として認識する
    expect(findQualityByIntervals([0, 16, 19])?.id).toBe("maj");
  });

  it("分数コードの名前を作れる", () => {
    expect(chordName(0, "maj")).toBe("C");
    expect(chordName(0, "maj7")).toBe("Cmaj7");
    expect(chordName(0, "maj", false, 7)).toBe("C/G");
    // ベースがルートと同じなら分数表記にしない
    expect(chordName(0, "maj", false, 0)).toBe("C");
  });

  it("未知のクオリティIDは例外になる", () => {
    expect(() => getQuality("nope")).toThrow();
  });
});

describe("ダイアトニックコードの導出", () => {
  it("Cメジャーの三和音が I ii iii IV V vi vii° になる", () => {
    const chords = diatonicChords(getScale("major"), false);
    expect(chords.map((c) => c.quality)).toEqual([
      "maj",
      "min",
      "min",
      "maj",
      "maj",
      "min",
      "dim",
    ]);
    expect(chords.map((c) => c.roman)).toEqual(["I", "ii", "iii", "IV", "V", "vi", "vii°"]);
    expect(chords.map((c) => c.offset)).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  it("メジャーの七の和音は V が dominant 7th になる", () => {
    const chords = diatonicChords(getScale("major"), true);
    expect(chords.map((c) => c.quality)).toEqual([
      "maj7",
      "m7",
      "m7",
      "maj7",
      "7",
      "m7",
      "m7b5",
    ]);
  });

  it("ナチュラルマイナーの七の和音", () => {
    const chords = diatonicChords(getScale("minor"), true);
    expect(chords.map((c) => c.quality)).toEqual([
      "m7",
      "m7b5",
      "maj7",
      "m7",
      "m7",
      "maj7",
      "7",
    ]);
  });

  it("ハーモニックマイナーは V7 と vii°7 を持つ", () => {
    const chords = diatonicChords(getScale("harmonicMinor"), true);
    expect(chords[4].quality).toBe("7");
    expect(chords[6].quality).toBe("dim7");
    expect(chords[0].quality).toBe("mMaj7");
  });

  it("すべてのスケールで7つのコードが同定できる", () => {
    for (const scale of SCALES) {
      for (const seventh of [false, true]) {
        const chords = diatonicChords(scale, seventh);
        expect(chords).toHaveLength(7);
        for (const c of chords) {
          expect(c.offset).toBeGreaterThanOrEqual(0);
          expect(c.offset).toBeLessThan(12);
          // フォールバックに落ちず、テーブルから同定できていること
          const stacked = chordPitchClasses(c.offset, c.quality);
          expect(stacked).toHaveLength(seventh ? 4 : 3);
        }
      }
    }
  });

  it("借用コードにセカンダリードミナントと裏コードが含まれる", () => {
    const borrowed = borrowedChords(getScale("major"));
    // V7/ii は A7（Cメジャーなら offset 9）
    expect(borrowed.some((c) => c.offset === 9 && c.quality === "7")).toBe(true);
    // 裏コード bII7 = Db7
    expect(borrowed.some((c) => c.offset === 1 && c.quality === "7")).toBe(true);
    // 同主調からの借用 bVII
    expect(borrowed.some((c) => c.offset === 10)).toBe(true);
    // 重複がない
    const keys = borrowed.map((c) => `${c.offset}:${c.quality}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("ボイシング", () => {
  it("基本形は下からルート・3度・5度の順に並ぶ", () => {
    const v = buildVoicing(0, "maj", { smooth: false });
    expect(v.notes).toHaveLength(3);
    expect(v.notes[0] % 12).toBe(0);
    expect(v.notes[1] - v.notes[0]).toBe(4);
    expect(v.notes[2] - v.notes[0]).toBe(7);
  });

  it("構成音のピッチクラスは転回しても変わらない", () => {
    for (const inv of [0, 1, 2]) {
      const v = buildVoicing(5, "maj7", { inversion: inv, smooth: false });
      expect(new Set(v.notes.map((n) => n % 12))).toEqual(new Set([5, 9, 0, 4]));
    }
  });

  it("転回を指定するとベースがその音になる", () => {
    // C/G は第2転回（ルートと3度を上げる）
    const v = buildVoicing(0, "maj", { inversion: 2, smooth: false });
    expect(v.bassPc).toBe(7);
    expect(v.bass % 12).toBe(7);
    expect(v.notes[0] % 12).toBe(7);
  });

  it("ボイスリーディングで和音の移動量が小さくなる", () => {
    const c = buildVoicing(0, "maj", { smooth: false });
    const naiveF = buildVoicing(5, "maj", { smooth: false });
    const smoothF = buildVoicing(5, "maj", { smooth: true, prev: c.notes });

    const spread = (a: number[], b: number[]) =>
      a.reduce((sum, n) => sum + Math.min(...b.map((m) => Math.abs(n - m))), 0);

    expect(spread(smoothF.notes, c.notes)).toBeLessThanOrEqual(spread(naiveF.notes, c.notes));
    // 構成音は保たれる
    expect(new Set(smoothF.notes.map((n) => n % 12))).toEqual(new Set([5, 9, 0]));
  });

  it("和音が極端な音域に飛ばない", () => {
    let prev: number[] | undefined;
    for (const offset of [0, 7, 9, 5, 2, 10, 3, 8, 1, 6, 11, 4]) {
      const v = buildVoicing(offset, "maj7", { smooth: true, prev });
      prev = v.notes;
      for (const n of v.notes) {
        expect(n).toBeGreaterThan(40);
        expect(n).toBeLessThan(90);
      }
    }
  });
});

describe("プリセット", () => {
  it("IDが重複していない", () => {
    const ids = PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("すべてのプリセットが有効なコードに展開できる", () => {
    for (const p of PRESETS) {
      expect(() => getScale(p.scale)).not.toThrow();
      const slots = presetToSlots(p);
      expect(slots.length).toBeGreaterThan(0);
      for (const s of slots) {
        expect(() => getQuality(s.quality)).not.toThrow();
        expect(s.offset).toBeGreaterThanOrEqual(0);
        expect(s.offset).toBeLessThan(12);
        expect(s.beats).toBeGreaterThan(0);
      }
      // スロットのIDは一意
      expect(new Set(slots.map((s) => s.id)).size).toBe(slots.length);
    }
  });

  it("12小節ブルースが12コードある", () => {
    const blues = PRESETS.find((p) => p.id === "blues12");
    expect(blues).toBeDefined();
    expect(presetToSlots(blues!)).toHaveLength(12);
  });
});
