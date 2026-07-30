import { describe, expect, it } from "vitest";

import {
  BASS_PATTERNS,
  CHORD_PATTERNS,
  DRUM_PATTERNS,
  getChordPattern,
  renderDrums,
} from "../src/music/patterns";
import { buildArrangement, makeSlot, resolveChords, totalBars, type Song } from "../src/music/song";
import { DEFAULT_SONG, normalizeSong } from "../src/state";

function songWith(patch: Partial<Song>): Song {
  return { ...DEFAULT_SONG, ...patch };
}

describe("パターン展開", () => {
  const ctx = { notes: [60, 64, 67], start: 0, length: 4, beatsPerBar: 4 };

  it("すべてのパターンが区間内に音符を出す", () => {
    for (const p of CHORD_PATTERNS) {
      const notes = p.gen(ctx);
      expect(notes.length, p.id).toBeGreaterThan(0);
      for (const n of notes) {
        expect(n.start, p.id).toBeGreaterThanOrEqual(0);
        // 発音位置は区間内（音の伸びは区間を超えてよい）
        expect(n.start, p.id).toBeLessThan(ctx.length + 0.05);
        expect(n.dur, p.id).toBeGreaterThan(0);
        expect(n.vel, p.id).toBeGreaterThan(0);
        expect(n.vel, p.id).toBeLessThanOrEqual(1);
        expect(Number.isFinite(n.midi), p.id).toBe(true);
      }
    }
  });

  it("開始位置をずらすと全部の音符がその分ずれる", () => {
    for (const p of CHORD_PATTERNS) {
      const a = p.gen(ctx);
      const b = p.gen({ ...ctx, start: 8 });
      expect(b).toHaveLength(a.length);
      for (let i = 0; i < a.length; i++) {
        expect(b[i].start - a[i].start, p.id).toBeCloseTo(8, 6);
        expect(b[i].midi, p.id).toBe(a[i].midi);
      }
    }
  });

  it("同じ入力なら常に同じ結果になる（試聴と書き出しの一致）", () => {
    for (const p of CHORD_PATTERNS) {
      expect(p.gen(ctx)).toEqual(p.gen(ctx));
    }
  });

  it("白玉パターンは構成音を1回だけ鳴らす", () => {
    const notes = getChordPattern("whole").gen(ctx);
    expect(notes).toHaveLength(3);
    expect(notes.map((n) => n.midi)).toEqual([60, 64, 67]);
    expect(notes.every((n) => n.start === 0)).toBe(true);
  });

  it("アルペジオは構成音のどれかを鳴らす", () => {
    const allowed = new Set([60, 64, 67, 72, 76, 79]);
    for (const id of ["arpUp", "arpDown", "arpUpDown", "arp16"]) {
      for (const n of getChordPattern(id).gen(ctx)) {
        expect(allowed.has(n.midi), `${id}: ${n.midi}`).toBe(true);
      }
    }
  });

  it("3拍子でも小節をまたいで打点がずれない", () => {
    for (const id of ["strum", "bossa"]) {
      const notes = getChordPattern(id).gen({ ...ctx, length: 6, beatsPerBar: 3 });
      expect(notes.length).toBeGreaterThan(0);
      // 1小節=3拍なので、拍位置は必ず 3 未満の位置の繰り返しになる
      for (const n of notes) {
        expect(n.start % 3, `${id}`).toBeLessThan(3);
      }
    }
  });

  it("ベースパターンは指定の音域から外れない", () => {
    for (const p of BASS_PATTERNS) {
      const notes = p.gen({ root: 36, fifth: 43, start: 0, length: 4, beatsPerBar: 4 });
      expect(notes.length, p.id).toBeGreaterThan(0);
      for (const n of notes) {
        expect(n.midi, p.id).toBeGreaterThanOrEqual(36);
        expect(n.midi, p.id).toBeLessThanOrEqual(48);
      }
    }
  });
});

describe("ドラムの敷き詰め", () => {
  it("なしパターンは何も鳴らさない", () => {
    expect(renderDrums(DRUM_PATTERNS[0], 16, 4)).toHaveLength(0);
  });

  it("8ビートは小節数ぶん繰り返される", () => {
    const one = renderDrums(DRUM_PATTERNS[1], 4, 4);
    const four = renderDrums(DRUM_PATTERNS[1], 16, 4);
    expect(four).toHaveLength(one.length * 4);
    for (const d of four) {
      expect(d.start).toBeGreaterThanOrEqual(0);
      expect(d.start).toBeLessThan(16);
    }
  });

  it("小節の拍数を超える打点は落とされる", () => {
    // 8ビートは 3.5 拍目に打点があるが、3拍子なら鳴らない
    const three = renderDrums(DRUM_PATTERNS[1], 3, 3);
    for (const d of three) expect(d.start).toBeLessThan(3);
  });
});

describe("アレンジの組み立て", () => {
  it("拍数とテンポから正しい長さになる", () => {
    const song = songWith({
      bpm: 120,
      repeats: 1,
      chordPattern: "whole",
      bassPattern: "whole",
      drumPattern: "none",
      chords: [makeSlot(0, "maj", 4), makeSlot(5, "maj", 4)],
    });
    const arr = buildArrangement(song);
    expect(arr.beatsPerLoop).toBe(8);
    expect(arr.totalBeats).toBe(8);
    expect(arr.secondsPerBeat).toBeCloseTo(0.5, 6);
    // 120BPM の 8 拍 = 4 秒
    expect(arr.durationSeconds).toBeCloseTo(4, 2);
  });

  it("くり返し回数ぶん音符が増える", () => {
    const base = songWith({ repeats: 1, drumPattern: "none" });
    const twice = songWith({ repeats: 2, drumPattern: "none" });
    const a = buildArrangement(base);
    const b = buildArrangement(twice);
    expect(b.chordNotes).toHaveLength(a.chordNotes.length * 2);
    expect(b.bassNotes).toHaveLength(a.bassNotes.length * 2);
    expect(b.totalBeats).toBe(a.totalBeats * 2);
  });

  it("ベースを切ればベースの音符が消える", () => {
    const arr = buildArrangement(songWith({ bassEnabled: false }));
    expect(arr.bassNotes).toHaveLength(0);
    expect(arr.chordNotes.length).toBeGreaterThan(0);
  });

  it("コード長の合計が小節数と一致する", () => {
    const song = songWith({
      beatsPerBar: 4,
      chords: [makeSlot(0, "maj", 4), makeSlot(5, "maj", 2), makeSlot(7, "maj", 2)],
    });
    expect(totalBars(song)).toBe(2);
  });

  it("同じ曲からは同じアレンジが出る", () => {
    const song = songWith({});
    const a = buildArrangement(song);
    const b = buildArrangement(song);
    expect(a.chordNotes).toEqual(b.chordNotes);
    expect(a.bassNotes).toEqual(b.bassNotes);
    expect(a.drums).toEqual(b.drums);
  });

  it("キーを変えると全体が移調される", () => {
    const inC = resolveChords(songWith({ tonic: 0 }));
    const inD = resolveChords(songWith({ tonic: 2 }));
    expect(inD).toHaveLength(inC.length);
    for (let i = 0; i < inC.length; i++) {
      expect((inD[i].rootPc - inC[i].rootPc + 12) % 12).toBe(2);
      // ローマ数字表記は変わらない
      expect(inD[i].roman).toBe(inC[i].roman);
    }
  });

  it("ダイアトニックコードにはローマ数字が付く", () => {
    const chords = resolveChords(
      songWith({
        tonic: 0,
        scale: "major",
        chords: [makeSlot(0, "maj"), makeSlot(7, "7"), makeSlot(9, "min")],
      }),
    );
    expect(chords.map((c) => c.roman)).toEqual(["I", "V7", "vi"]);
    expect(chords.map((c) => c.name)).toEqual(["C", "G7", "Am"]);
  });

  it("ダイアトニック外のコードは相対度数で表記される", () => {
    const chords = resolveChords(
      songWith({ tonic: 0, scale: "major", chords: [makeSlot(10, "maj"), makeSlot(3, "min")] }),
    );
    expect(chords[0].roman).toBe("bVII");
    expect(chords[1].roman).toBe("biii");
  });
});

describe("保存データの正規化", () => {
  it("壊れた入力でも安全な曲になる", () => {
    const song = normalizeSong({
      tonic: 999,
      scale: "not-a-scale",
      bpm: -5,
      beatsPerBar: 99,
      repeats: 1000,
      reverb: 5,
      volume: -1,
      instrument: "<script>",
      chordPattern: "nope",
      chords: [{ offset: 40, quality: "bogus", beats: -3 }, null, "x"],
    });
    expect(song.tonic).toBeGreaterThanOrEqual(0);
    expect(song.tonic).toBeLessThan(12);
    expect(song.bpm).toBeGreaterThanOrEqual(30);
    expect(song.beatsPerBar).toBeLessThanOrEqual(7);
    expect(song.repeats).toBeLessThanOrEqual(16);
    expect(song.reverb).toBeLessThanOrEqual(1);
    expect(song.volume).toBeGreaterThanOrEqual(0);
    expect(song.scale).toBe(DEFAULT_SONG.scale);
    expect(song.instrument).toBe(DEFAULT_SONG.instrument);
    expect(song.chordPattern).toBe(DEFAULT_SONG.chordPattern);
    for (const c of song.chords) {
      expect(c.offset).toBeGreaterThanOrEqual(0);
      expect(c.offset).toBeLessThan(12);
      expect(c.beats).toBeGreaterThan(0);
    }
    // 正規化した曲はそのままアレンジできる
    expect(() => buildArrangement(song)).not.toThrow();
  });

  it("空のコード列は初期進行で埋められる", () => {
    expect(normalizeSong({ chords: [] }).chords.length).toBeGreaterThan(0);
  });

  it("正常なデータはそのまま通る", () => {
    const song = normalizeSong(DEFAULT_SONG);
    expect(song.tonic).toBe(DEFAULT_SONG.tonic);
    expect(song.bpm).toBe(DEFAULT_SONG.bpm);
    expect(song.chords.map((c) => c.quality)).toEqual(DEFAULT_SONG.chords.map((c) => c.quality));
  });

  it("コード数が多すぎる入力は打ち切られる", () => {
    const many = Array.from({ length: 200 }, () => ({ offset: 0, quality: "maj", beats: 4 }));
    expect(normalizeSong({ chords: many }).chords).toHaveLength(64);
  });
});
