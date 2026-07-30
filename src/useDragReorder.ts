/**
 * 長押し → ドラッグでカードを並べ替えるための処理。
 *
 * iOS で難しいのは「押した瞬間はまだページをスクロールしたいかもしれない」点。
 * 先に touch-action を切ってしまうとカードの上でスクロールできなくなるので、
 * 長押しが成立してからスクロールを止める必要がある。
 *
 *   1. 押した位置を覚えて長押しタイマーを開始
 *   2. タイマーが鳴る前に指が動いたらスクロール操作とみなして中止
 *   3. タイマーが鳴ったらドラッグ開始。以降 touchmove を打ち消してスクロールを止める
 *
 * 並べ替えは指を離すまで画面上の見た目だけを入れ替え、離したときに一度だけ
 * 本体へ反映する。ドラッグ中の細かい移動で履歴が埋まらないようにするため。
 */

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

/** 長押しと判定するまでの時間（ミリ秒）。 */
const HOLD_MS = 300;
/** これ以上動いたらスクロール操作とみなす距離（px）。 */
const MOVE_TOLERANCE = 10;

export interface DragReorder {
  /** ドラッグ中の要素のID。していなければ null。 */
  draggingId: string | null;
  /** 表示に使う並び順。ドラッグ中だけ仮の順序が入る。 */
  order: string[] | null;
  /** 並べ替え対象のカードに付けるハンドラ。 */
  handlers: (id: string) => { onPointerDown: (e: ReactPointerEvent) => void };
}

interface Options {
  /** 並べ替え対象のID列（現在の並び）。 */
  ids: string[];
  /** ID から対応する DOM 要素を引く。 */
  getElement: (id: string) => HTMLElement | null;
  /** 指を離したときに呼ばれる。並びが変わったときだけ。 */
  onCommit: (nextIds: string[]) => void;
}

export function useDragReorder({ ids, getElement, onCommit }: Options): DragReorder {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);

  // イベントハンドラから同期的に読みたい値は ref に持つ
  const dragging = useRef(false);
  const draggingIdRef = useRef<string | null>(null);
  const orderRef = useRef<string[] | null>(null);
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  const holdTimer = useRef(0);
  const idsRef = useRef(ids);
  idsRef.current = ids;
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  const getElementRef = useRef(getElement);
  getElementRef.current = getElement;

  const cancelHold = useCallback(() => {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = 0;
    }
  }, []);

  useEffect(() => {
    /**
     * 指の位置にあるカードを探して、必要なら並びを入れ替える。
     * カードは折り返して複数行に並ぶので、矩形に含まれるかどうかで判定する。
     */
    const moveTo = (id: string, x: number, y: number) => {
      const current = orderRef.current;
      if (!current) return;
      const from = current.indexOf(id);
      if (from < 0) return;

      let to = -1;
      for (let i = 0; i < current.length; i++) {
        if (current[i] === id) continue;
        const el = getElementRef.current(current[i]);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          to = i;
          break;
        }
      }
      if (to < 0 || to === from) return;

      const next = [...current];
      next.splice(to, 0, next.splice(from, 1)[0]);
      orderRef.current = next;
      setOrder(next);
    };

    const onMove = (e: PointerEvent) => {
      const start = startPoint.current;
      if (!start) return;

      if (!dragging.current) {
        // 長押しが成立する前に動いた = スクロールしたいのだと解釈して中止
        const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
        if (moved > MOVE_TOLERANCE) {
          cancelHold();
          startPoint.current = null;
        }
        return;
      }
      const id = draggingIdRef.current;
      if (id) moveTo(id, e.clientX, e.clientY);
    };

    const onUp = () => {
      cancelHold();
      startPoint.current = null;
      if (!dragging.current) return;

      dragging.current = false;
      draggingIdRef.current = null;
      const next = orderRef.current;
      orderRef.current = null;
      setDraggingId(null);
      setOrder(null);
      if (next && next.join() !== idsRef.current.join()) commitRef.current(next);
    };

    // ドラッグ中はページのスクロールを止める。
    // passive: false でないと preventDefault が効かない。
    const blockScroll = (e: TouchEvent) => {
      if (dragging.current) e.preventDefault();
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    document.addEventListener("touchmove", blockScroll, { passive: false });
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      document.removeEventListener("touchmove", blockScroll);
    };
  }, [cancelHold]);

  const handlers = useCallback(
    (id: string) => ({
      onPointerDown: (e: ReactPointerEvent) => {
        // ボタンや入力欄の操作は邪魔しない
        const target = e.target as HTMLElement;
        if (target.closest("button, select, input, a")) return;
        if (e.button !== 0) return;

        startPoint.current = { x: e.clientX, y: e.clientY };
        cancelHold();
        holdTimer.current = window.setTimeout(() => {
          dragging.current = true;
          draggingIdRef.current = id;
          orderRef.current = [...idsRef.current];
          setDraggingId(id);
          setOrder([...idsRef.current]);
          // 掴んだ感触を返す（対応端末のみ）
          navigator.vibrate?.(15);
        }, HOLD_MS);
      },
    }),
    [cancelHold],
  );

  return { draggingId, order, handlers };
}
