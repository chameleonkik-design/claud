import { describe, expect, it } from "vitest";

import {
  COALESCE_MS,
  initialSnapshot,
  pushSnapshot,
  redoSnapshot,
  shouldCoalesce,
  undoSnapshot,
  type Snapshot,
} from "../src/history";

const LIMIT = 60;

/**
 * useHistory と同じ手順で操作を再現する小さなドライバ。
 * 時刻を明示的に渡せるので、連続操作のまとめ判定も確かめられる。
 */
function driver<T>(initial: T, limit = LIMIT) {
  let snap: Snapshot<T> = initialSnapshot(initial);
  let last: { label: string; at: number } | null = null;

  return {
    get present() {
      return snap.present;
    },
    get canUndo() {
      return snap.past.length > 0;
    },
    get canRedo() {
      return snap.future.length > 0;
    },
    get depth() {
      return snap.past.length;
    },
    set(next: T | ((p: T) => T), label = "edit", at = 0) {
      const coalesce = shouldCoalesce(last, label, at);
      last = { label, at };
      const value = typeof next === "function" ? (next as (p: T) => T)(snap.present) : next;
      snap = pushSnapshot(snap, value, coalesce, limit);
    },
    undo() {
      last = null;
      snap = undoSnapshot(snap, limit);
    },
    redo() {
      last = null;
      snap = redoSnapshot(snap, limit);
    },
  };
}

describe("履歴の遷移", () => {
  it("初期状態では戻せない・やり直せない", () => {
    const h = driver(1);
    expect(h.present).toBe(1);
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
  });

  it("変更してから元に戻せる", () => {
    const h = driver(1);
    h.set(2, "a", 0);
    expect(h.present).toBe(2);
    expect(h.canUndo).toBe(true);

    h.undo();
    expect(h.present).toBe(1);
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(true);
  });

  it("やり直せる", () => {
    const h = driver(1);
    h.set(2, "a", 0);
    h.undo();
    h.redo();
    expect(h.present).toBe(2);
    expect(h.canRedo).toBe(false);
  });

  it("戻したあとに別の変更をすると、やり直し履歴は捨てられる", () => {
    const h = driver(1);
    h.set(2, "a", 0);
    h.undo();
    h.set(3, "b", 5000);
    expect(h.present).toBe(3);
    expect(h.canRedo).toBe(false);
  });

  it("複数の操作を1つずつ遡れる", () => {
    const h = driver(0);
    h.set(1, "a", 0);
    h.set(2, "b", 2000);
    h.set(3, "c", 4000);
    expect(h.depth).toBe(3);

    h.undo();
    expect(h.present).toBe(2);
    h.undo();
    expect(h.present).toBe(1);
    h.undo();
    expect(h.present).toBe(0);
    expect(h.canUndo).toBe(false);
  });

  it("関数で更新できる", () => {
    const h = driver(10);
    h.set((p) => p + 5, "a", 0);
    expect(h.present).toBe(15);
  });

  it("値が変わらない更新は履歴に積まない", () => {
    const h = driver(5);
    h.set(5, "a", 0);
    expect(h.canUndo).toBe(false);
    expect(h.depth).toBe(0);
  });

  it("上限を超えると古い履歴から捨てられる", () => {
    const h = driver(0, 3);
    for (let v = 1; v <= 10; v++) h.set(v, `step${v}`, v * 1000);
    expect(h.depth).toBe(3);

    let count = 0;
    while (h.canUndo) {
      h.undo();
      count++;
    }
    expect(count).toBe(3);
  });
});

describe("連続操作のまとめ（スライダー対策）", () => {
  it("同じラベルで短時間に連続した更新は1件にまとまる", () => {
    const h = driver(0);
    // スライダーを一気に動かしたときのように、同じラベルで何度も更新する
    for (let v = 1; v <= 30; v++) h.set(v, "reverb", v * 10);
    expect(h.present).toBe(30);
    expect(h.depth).toBe(1);

    // 1回戻すだけで操作前に戻る
    h.undo();
    expect(h.present).toBe(0);
    expect(h.canUndo).toBe(false);
  });

  it("間隔が空けば別の操作として積まれる", () => {
    const h = driver(0);
    h.set(1, "reverb", 0);
    h.set(2, "reverb", COALESCE_MS + 100);
    expect(h.depth).toBe(2);
  });

  it("ラベルが違えばまとまらない", () => {
    const h = driver(0);
    h.set(1, "reverb", 0);
    h.set(2, "volume", 10);
    expect(h.depth).toBe(2);
  });

  it("まとめ判定の境界", () => {
    const last = { label: "reverb", at: 1000 };
    expect(shouldCoalesce(last, "reverb", 1000 + COALESCE_MS - 1)).toBe(true);
    expect(shouldCoalesce(last, "reverb", 1000 + COALESCE_MS)).toBe(false);
    expect(shouldCoalesce(last, "volume", 1001)).toBe(false);
    expect(shouldCoalesce(null, "reverb", 1001)).toBe(false);
  });

  it("元に戻したあとは、直前と同じラベルでもまとめない", () => {
    const h = driver(0);
    h.set(1, "reverb", 0);
    h.undo();
    // undo で直前の操作の記憶が消えるので、次は必ず新しい履歴になる
    h.set(9, "reverb", 10);
    expect(h.present).toBe(9);
    expect(h.canUndo).toBe(true);
    h.undo();
    expect(h.present).toBe(0);
  });
});

describe("プリセット読み込みを取り消せる", () => {
  interface Song {
    chords: string[];
    scale: string;
  }

  it("手で作った進行に戻せる", () => {
    const mine: Song = { chords: ["C", "Am", "F", "G"], scale: "major" };
    const h = driver<Song>(mine);

    // プリセットを読み込む（進行が丸ごと置き換わる）
    h.set({ chords: ["Fmaj7", "G7", "Em7", "Am7"], scale: "major" }, "preset:royalroad", 1000);
    expect(h.present.chords).toEqual(["Fmaj7", "G7", "Em7", "Am7"]);

    // 元に戻すと自分の進行が復活する
    h.undo();
    expect(h.present).toBe(mine);
    expect(h.present.chords).toEqual(["C", "Am", "F", "G"]);
  });

  it("違うプリセットを続けて読んでも1つずつ遡れる", () => {
    const h = driver<Song>({ chords: ["C"], scale: "major" });
    h.set({ chords: ["A"], scale: "minor" }, "preset:komuro", 1000);
    h.set({ chords: ["B"], scale: "major" }, "preset:canon", 2000);
    // 同じ「プリセット読み込み」でも id が違えばラベルが変わるのでまとまらない
    expect(h.depth).toBe(2);
    h.undo();
    expect(h.present.chords).toEqual(["A"]);
    h.undo();
    expect(h.present.chords).toEqual(["C"]);
  });
});
