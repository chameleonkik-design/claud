/**
 * 支援（投げ銭・買い切り）リンクの設定。
 *
 * ここに URL を入れると、アプリの下部に支援カードが出る。
 * 空のままなら何も表示しないので、準備ができるまで置いておいて構わない。
 *
 * 使えるサービスの例（どれもアカウントを作ってリンクを貼るだけ）:
 *   - Ko-fi              https://ko-fi.com/       手数料 0%（Ko-fi側）+ 決済手数料
 *   - Buy Me a Coffee    https://buymeacoffee.com/
 *   - Stripe Payment Link  Stripe ダッシュボードで発行
 *   - GitHub Sponsors    https://github.com/sponsors
 *   - PayPal.Me          https://paypal.me/
 */

export interface SupportConfig {
  /** 支援ページの URL。https:// で始まること。空なら機能ごと非表示。 */
  url: string;
  /** ボタンの文言。 */
  label: string;
  /** ボタンの上に出る一言。 */
  message: string;
}

/**
 * ▼▼▼ ここを書き換えれば支援ボタンが出ます ▼▼▼
 *
 * 例:
 *   url: "https://ko-fi.com/yourname",
 */
export const SUPPORT: SupportConfig = {
  url: "",
  label: "☕ 開発を応援する",
  message: "このアプリは無料で、広告もありません。気に入ったら開発の支援をお願いします。",
};

/**
 * 設定を検証して返す。使えない設定なら null。
 *
 * URL は画面に出すリンクになるので、http(s) 以外のスキーム（javascript: など）は
 * 弾いておく。設定ミスがそのまま危険なリンクにならないようにするため。
 */
export function resolveSupport(config: SupportConfig = SUPPORT): SupportConfig | null {
  const url = config.url.trim();
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;

  return {
    url: parsed.href,
    label: config.label.trim() || "開発を応援する",
    message: config.message.trim(),
  };
}
