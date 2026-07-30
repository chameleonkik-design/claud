/**
 * タッチでの長押しを検出する。
 *
 * iOS Safari は長押しで contextmenu を発火しない（独自の選択メニューを出す）ので、
 * 「長押しで試聴」のような操作を右クリック頼みにすると iPhone では動かない。
 * pointer イベントから自前で判定する。
 *
 * 長押しが成立したあとは、続けて飛んでくる click を無視できるよう
 * didLongPress() で確認できるようにしている。
 */

import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from "react";

/** 長押しと判定するまでの時間（ミリ秒）。 */
const HOLD_MS = 350;
/** これ以上動いたら長押しではないとみなす距離（px）。 */
const MOVE_TOLERANCE = 10;

export interface LongPress {
  handlers: (id: string) => {
    onPointerDown: (e: ReactPointerEvent) => void;
    onPointerMove: (e: ReactPointerEvent) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
  };
  /** 直前の操作が長押しだったか（click を無視すべきか）。 */
  didLongPress: () => boolean;
}

export function useLongPress(onLongPress: (id: string) => void, holdMs = HOLD_MS): LongPress {
  const fired = useRef(false);
  const timer = useRef(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const callback = useRef(onLongPress);
  callback.current = onLongPress;

  const cancel = useCallback(() => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = 0;
    }
    start.current = null;
  }, []);

  const handlers = useCallback(
    (id: string) => ({
      onPointerDown: (e: ReactPointerEvent) => {
        // マウスは右クリックで試聴できるので、長押しはタッチ/ペンだけにする
        if (e.pointerType === "mouse") return;
        fired.current = false;
        start.current = { x: e.clientX, y: e.clientY };
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          timer.current = 0;
          fired.current = true;
          navigator.vibrate?.(12);
          callback.current(id);
        }, holdMs);
      },
      onPointerMove: (e: ReactPointerEvent) => {
        const s = start.current;
        if (!s) return;
        if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > MOVE_TOLERANCE) cancel();
      },
      // 指を離しても fired は残す。直後の click を無視する判断に使うため。
      onPointerUp: () => cancel(),
      onPointerCancel: () => {
        cancel();
        fired.current = false;
      },
    }),
    [cancel, holdMs],
  );

  return { handlers, didLongPress: () => fired.current };
}
