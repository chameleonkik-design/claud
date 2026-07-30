/**
 * 元に戻す / やり直し のための履歴。
 *
 * 曲データのスナップショットを積むだけの素朴な作りだが、ひとつ工夫がある。
 * スライダーを動かすと1操作で何十回も更新が飛ぶので、そのまま積むと履歴が
 * 埋まって「元に戻す」が使い物にならない。同じラベルの更新が短時間に続いた
 * ときは履歴を増やさず直近を置き換えることで、1回の操作を1件にまとめている。
 *
 * 履歴の遷移そのものは下の純粋関数に切り出してあり、React に依存しない。
 */

import { useCallback, useRef, useState } from "react";

/** 同じ操作の続きとみなす時間（ミリ秒）。 */
export const COALESCE_MS = 600;

export interface Snapshot<T> {
  present: T;
  /** 古い順。末尾が直前の状態。 */
  past: T[];
  /** 新しい順。先頭が次にやり直す状態。 */
  future: T[];
}

export function initialSnapshot<T>(present: T): Snapshot<T> {
  return { present, past: [], future: [] };
}

/**
 * 新しい値を積む。
 * coalesce が true なら履歴を増やさず現在の値だけ差し替える（連続操作のまとめ）。
 */
export function pushSnapshot<T>(
  s: Snapshot<T>,
  next: T,
  coalesce: boolean,
  limit: number,
): Snapshot<T> {
  if (next === s.present) return s;
  return {
    present: next,
    past: coalesce ? s.past : [...s.past, s.present].slice(-limit),
    // 新しい変更をしたら、やり直しの履歴は意味を失うので捨てる
    future: [],
  };
}

export function undoSnapshot<T>(s: Snapshot<T>, limit: number): Snapshot<T> {
  if (s.past.length === 0) return s;
  return {
    present: s.past[s.past.length - 1],
    past: s.past.slice(0, -1),
    future: [s.present, ...s.future].slice(0, limit),
  };
}

export function redoSnapshot<T>(s: Snapshot<T>, limit: number): Snapshot<T> {
  if (s.future.length === 0) return s;
  return {
    present: s.future[0],
    past: [...s.past, s.present].slice(-limit),
    future: s.future.slice(1),
  };
}

/**
 * 直近の操作と同じ操作の続きか（=履歴をまとめるべきか）を判定する。
 */
export function shouldCoalesce(
  last: { label: string; at: number } | null,
  label: string,
  now: number,
  windowMs = COALESCE_MS,
): boolean {
  return last !== null && last.label === label && now - last.at < windowMs;
}

export interface History<T> {
  /** 現在の値。 */
  present: T;
  /**
   * 値を更新する。
   * label は「どの操作か」の識別子。同じ label が連続すると1件にまとまる。
   */
  set: (updater: T | ((prev: T) => T), label?: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useHistory<T>(initial: T | (() => T), limit = 60): History<T> {
  // useState と同じく、関数を渡せば初回だけ評価する
  const [snap, setSnap] = useState<Snapshot<T>>(() =>
    initialSnapshot(typeof initial === "function" ? (initial as () => T)() : initial),
  );
  /** 直前の更新のラベルと時刻。まとめ判定に使う。 */
  const last = useRef<{ label: string; at: number } | null>(null);

  const set = useCallback(
    (updater: T | ((prev: T) => T), label = "edit") => {
      // まとめ判定は更新関数の外で行う（更新関数は副作用なしに保つ）
      const now = Date.now();
      const coalesce = shouldCoalesce(last.current, label, now);
      last.current = { label, at: now };

      setSnap((s) => {
        const next =
          typeof updater === "function" ? (updater as (p: T) => T)(s.present) : updater;
        return pushSnapshot(s, next, coalesce, limit);
      });
    },
    [limit],
  );

  const undo = useCallback(() => {
    last.current = null;
    setSnap((s) => undoSnapshot(s, limit));
  }, [limit]);

  const redo = useCallback(() => {
    last.current = null;
    setSnap((s) => redoSnapshot(s, limit));
  }, [limit]);

  return {
    present: snap.present,
    set,
    undo,
    redo,
    canUndo: snap.past.length > 0,
    canRedo: snap.future.length > 0,
  };
}
