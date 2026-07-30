/**
 * 支援（投げ銭）へのリンク。
 *
 * 設定されていなければ何も描画しない。うるさくしないよう、
 * 進行を作る邪魔にならない画面の下部に一枚だけ置く。
 */

import { resolveSupport } from "../support";

export function Support() {
  const support = resolveSupport();
  if (!support) return null;

  return (
    <section className="panel support">
      <div className="support-body">
        {support.message && <p className="support-message">{support.message}</p>}
        <a
          className="btn primary support-link"
          href={support.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {support.label}
        </a>
      </div>
    </section>
  );
}
