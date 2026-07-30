/**
 * 長押しして掴み、決められた場所に落とす操作。
 *
 * useDragReorder は「並んでいるものの順序を入れ替える」ためのもので、
 * こちらは「離れた場所へ持っていく」ためのもの。プリセットを掴んで
 * 進行に追加する用途に使う。
 *
 * 指の位置を追う印（ゴースト）は React の再描画を挟まず DOM を直接動かす。
 * pointermove ごとに全体を描き直すと重くなるため。
 */

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

/** 長押しと判定するまでの時間（ミリ秒）。 */
const HOLD_MS = 300;
/** これ以上動いたらスクロール操作とみなす距離（px）。 */
const MOVE_TOLERANCE = 10;

export interface LongPressDrag {
  /** 掴んでいるもののID。掴んでいなければ null。 */
  activeId: string | null;
  /** 今、落とせる場所の上にいるか。 */
  overTarget: boolean;
  /** 指を追う印に付ける ref。 */
  ghostRef: (el: HTMLElement | null) => void;
  handlers: (id: string) => { onPointerDown: (e: ReactPointerEvent) => void };
}

interface Options {
  /** その座標が「落とせる場所」かどうか。 */
  isOverTarget: (x: number, y: number) => boolean;
  /** 落とせる場所で離したときに呼ばれる。 */
  onDrop: (id: string) => void;
}

export function useLongPressDrag({ isOverTarget, onDrop }: Options): LongPressDrag {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overTarget, setOverTarget] = useState(false);

  const dragging = useRef(false);
  const activeIdRef = useRef<string | null>(null);
  const overRef = useRef(false);
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  const holdTimer = useRef(0);
  const ghost = useRef<HTMLElement | null>(null);

  const isOverRef = useRef(isOverTarget);
  isOverRef.current = isOverTarget;
  const dropRef = useRef(onDrop);
  dropRef.current = onDrop;

  const cancelHold = useCallback(() => {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = 0;
    }
  }, []);

  /** ゴーストを指の位置へ移す。 */
  const placeGhost = (x: number, y: number) => {
    const el = ghost.current;
    if (el) el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -140%)`;
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const start = startPoint.current;
      if (!start) return;

      if (!dragging.current) {
        // 長押しが成立する前に動いた = スクロールしたいのだと解釈して中止
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_TOLERANCE) {
          cancelHold();
          startPoint.current = null;
        }
        return;
      }

      placeGhost(e.clientX, e.clientY);
      const over = isOverRef.current(e.clientX, e.clientY);
      if (over !== overRef.current) {
        overRef.current = over;
        setOverTarget(over);
      }
    };

    const onUp = (e: PointerEvent) => {
      cancelHold();
      startPoint.current = null;
      if (!dragging.current) return;

      dragging.current = false;
      const id = activeIdRef.current;
      const dropped = id !== null && isOverRef.current(e.clientX, e.clientY);
      activeIdRef.current = null;
      overRef.current = false;
      setActiveId(null);
      setOverTarget(false);
      if (dropped && id) dropRef.current(id);
    };

    // ドラッグ中はページのスクロールを止める
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
        if (e.button !== 0) return;
        const point = { x: e.clientX, y: e.clientY };
        startPoint.current = point;
        cancelHold();
        holdTimer.current = window.setTimeout(() => {
          dragging.current = true;
          activeIdRef.current = id;
          setActiveId(id);
          // 掴んだ瞬間からゴーストを指の位置に置く
          requestAnimationFrame(() => placeGhost(point.x, point.y));
          navigator.vibrate?.(15);
        }, HOLD_MS);
      },
    }),
    [cancelHold],
  );

  const ghostRef = useCallback((el: HTMLElement | null) => {
    ghost.current = el;
  }, []);

  return { activeId, overTarget, ghostRef, handlers };
}
