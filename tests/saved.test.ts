import { beforeEach, describe, expect, it } from "vitest";

import { makeSlot, type Song } from "../src/music/song";
import {
  DEFAULT_SONG,
  deleteSavedSong,
  listSavedSongs,
  saveNamedSong,
  suggestSongName,
} from "../src/state";

/** Node には localStorage が無いので、必要な部分だけ用意する。 */
class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, String(v));
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  clear() {
    this.data.clear();
  }
}

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
});

function songWith(patch: Partial<Song>): Song {
  return { ...DEFAULT_SONG, ...patch };
}

describe("マイ進行の保存と呼び出し", () => {
  it("最初は空", () => {
    expect(listSavedSongs()).toEqual([]);
  });

  it("保存して読み出せる", () => {
    const song = songWith({ bpm: 128, chords: [makeSlot(0, "maj"), makeSlot(5, "min")] });
    const list = saveNamedSong("テスト進行", song);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("テスト進行");
    expect(list[0].song.bpm).toBe(128);
    expect(list[0].song.chords).toHaveLength(2);

    // 別の呼び出しでも読める（localStorage に入っている）
    const again = listSavedSongs();
    expect(again).toHaveLength(1);
    expect(again[0].name).toBe("テスト進行");
  });

  it("複数保存すると新しい順に並ぶ", async () => {
    saveNamedSong("ひとつめ", songWith({ bpm: 100 }));
    await new Promise((r) => setTimeout(r, 5));
    saveNamedSong("ふたつめ", songWith({ bpm: 110 }));
    const list = listSavedSongs();
    expect(list.map((e) => e.name)).toEqual(["ふたつめ", "ひとつめ"]);
  });

  it("同じ名前で保存すると上書きされる（増えない）", () => {
    saveNamedSong("同名", songWith({ bpm: 100 }));
    const list = saveNamedSong("同名", songWith({ bpm: 140 }));
    expect(list).toHaveLength(1);
    expect(list[0].song.bpm).toBe(140);
  });

  it("削除できる", () => {
    saveNamedSong("消す", songWith({}));
    saveNamedSong("残す", songWith({}));
    const target = listSavedSongs().find((e) => e.name === "消す")!;
    const list = deleteSavedSong(target.id);
    expect(list.map((e) => e.name)).toEqual(["残す"]);
  });

  it("名前の前後の空白は整理され、長すぎる名前は切り詰められる", () => {
    const list = saveNamedSong(`  ${"あ".repeat(60)}  `, songWith({}));
    expect(list[0].name).toHaveLength(40);
  });

  it("空の名前は「無題」になる", () => {
    expect(saveNamedSong("   ", songWith({}))[0].name).toBe("無題");
  });

  it("保存データが壊れていても落ちない", () => {
    localStorage.setItem("chord-studio:saved:v1", "{壊れたJSON");
    expect(listSavedSongs()).toEqual([]);

    localStorage.setItem("chord-studio:saved:v1", JSON.stringify([null, 42, { name: "x" }]));
    // id を持たない要素は捨てられる
    expect(listSavedSongs()).toEqual([]);
  });

  it("保存された曲データも検証されてから使われる", () => {
    localStorage.setItem(
      "chord-studio:saved:v1",
      JSON.stringify([
        { id: "a", name: "壊れた曲", savedAt: 1, song: { bpm: -999, tonic: 99, chords: "x" } },
      ]),
    );
    const list = listSavedSongs();
    expect(list).toHaveLength(1);
    expect(list[0].song.bpm).toBeGreaterThanOrEqual(30);
    expect(list[0].song.tonic).toBeLessThan(12);
    expect(list[0].song.chords.length).toBeGreaterThan(0);
  });

  it("localStorage が使えなくても例外にならない", () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    };
    expect(() => listSavedSongs()).not.toThrow();
    expect(() => saveNamedSong("x", songWith({}))).not.toThrow();
  });
});

describe("保存名の初期候補", () => {
  it("先頭のコード名から作る", () => {
    expect(suggestSongName(songWith({}), ["Fmaj7", "G7", "Em7", "Am7", "C"])).toBe(
      "Fmaj7–G7–Em7–Am7",
    );
  });

  it("コードが無ければテンポから作る", () => {
    expect(suggestSongName(songWith({ bpm: 96 }), [])).toBe("96BPM の進行");
  });
});
