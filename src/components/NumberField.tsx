/**
 * 数値入力。
 *
 * 素の <input type="number"> を値に直結させると、全消ししたときに
 * 空文字が 0 や最小値に化けて、消せない数字が残ってしまう。
 * ここでは入力中の文字列を自前で持ち、確定はフォーカスが外れたときに行う。
 * だから「全部消して打ち直す」が普通にできる。
 */

import { useEffect, useRef, useState } from "react";

interface Props {
  id?: string;
  value: number;
  min: number;
  max: number;
  /** 増減ボタンの刻み幅。 */
  step?: number;
  onChange: (value: number) => void;
  ariaLabel?: string;
  title?: string;
  className?: string;
  /** −/＋ ボタンを出すか（スマホで数字を打たずに調整できる）。 */
  steppers?: boolean;
  /** 入力欄の幅（px）。 */
  width?: number;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** 小数の刻みで生じる誤差（0.30000000000000004 など）を丸める。 */
function tidy(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function NumberField({
  id,
  value,
  min,
  max,
  step = 1,
  onChange,
  ariaLabel,
  title,
  className,
  steppers = false,
  width,
}: Props) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);

  // 外から値が変わったとき（プリセット読み込みなど）は表示を追従させる。
  // 入力中は上書きしない — 打っている途中の文字列を消さないため。
  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  const commit = (n: number) => {
    const next = tidy(clamp(n, min, max));
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  const handleChange = (raw: string) => {
    setDraft(raw);
    // 入力中でも、範囲内の有効な数値になった時点で反映する。
    // 範囲外や空文字のときは何もしない（確定はフォーカスが外れたとき）。
    const n = Number(raw);
    if (raw.trim() !== "" && Number.isFinite(n) && n >= min && n <= max) {
      const next = tidy(n);
      if (next !== value) onChange(next);
    }
  };

  const handleBlur = () => {
    focused.current = false;
    const n = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(n)) {
      // 空のまま離れたら元の値に戻す
      setDraft(String(value));
      return;
    }
    commit(n);
  };

  const input = (
    <input
      id={id}
      type="text"
      inputMode={step < 1 ? "decimal" : "numeric"}
      // iOS のキーボードで数字が出るようにしつつ、全消しできるよう text にしている
      pattern="[0-9]*[.,]?[0-9]*"
      value={draft}
      aria-label={ariaLabel}
      title={title}
      className={className}
      style={width ? { width } : undefined}
      onFocus={(e) => {
        focused.current = true;
        // タップしたらすぐ打ち直せるように全選択する
        e.target.select();
      }}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          commit(value + step);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          commit(value - step);
        }
      }}
    />
  );

  if (!steppers) return input;

  return (
    <div className="number-field">
      <button
        type="button"
        className="step"
        onClick={() => commit(value - step)}
        disabled={value <= min}
        aria-label={`${ariaLabel ?? "値"}を減らす`}
        tabIndex={-1}
      >
        −
      </button>
      {input}
      <button
        type="button"
        className="step"
        onClick={() => commit(value + step)}
        disabled={value >= max}
        aria-label={`${ariaLabel ?? "値"}を増やす`}
        tabIndex={-1}
      >
        ＋
      </button>
    </div>
  );
}
