/**
 * スクロールしても画面下に残る操作バー。
 *
 * 上部の再生パネルが画面外に出たときだけ現れる。進行を編集しながら
 * すぐ聴き直せるように、再生ボタンと今鳴っているコードを常に手元に置く。
 */

import { useEffect, useRef, useState } from "react";

interface Props {
  /** 監視対象（上部の再生パネル）。これが見えている間はバーを出さない。 */
  watch: React.RefObject<HTMLElement | null>;
  playing: boolean;
  disabled: boolean;
  /** 今鳴っているコード名。停止中は null。 */
  nowPlaying: string | null;
  /** 進行の何番目か（1始まり）と全体数。 */
  position: { index: number; total: number } | null;
  onToggle: () => void;
  onExport: () => void;
  exportBusy: boolean;
}

export function FloatingTransport({
  watch,
  playing,
  disabled,
  nowPlaying,
  position,
  onToggle,
  onExport,
  exportBusy,
}: Props) {
  const [visible, setVisible] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = watch.current;
    if (!target) return;
    // IntersectionObserver が無い環境（古いブラウザ）では常に表示しておく
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { rootMargin: "-8px 0px 0px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [watch]);

  return (
    <div
      ref={barRef}
      className={`floating-transport${visible ? " visible" : ""}`}
      // 隠れている間はキーボード操作や読み上げの対象から外す
      aria-hidden={!visible}
      inert={!visible}
    >
      <button
        className={`fab${playing ? " playing" : ""}`}
        onClick={onToggle}
        disabled={disabled}
        aria-label={playing ? "停止" : "試聴"}
        title={playing ? "停止" : "試聴"}
      >
        {playing ? "■" : "▶"}
      </button>

      <div className="fab-now">
        <div className="fab-chord">{nowPlaying ?? "コード進行"}</div>
        <div className="fab-sub">
          {position ? `${position.index} / ${position.total}` : "タップして再生"}
        </div>
      </div>

      <button className="btn accent small" onClick={onExport} disabled={exportBusy || disabled}>
        {exportBusy ? "書き出し中…" : "MP3"}
      </button>
    </div>
  );
}
