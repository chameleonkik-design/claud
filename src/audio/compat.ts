/**
 * ブラウザ差異の吸収。
 *
 * iOS Safari は Web Audio とファイル保存の両方に癖があるので、
 * 判定ロジックはここにまとめてテストできる形にしてある。
 */

/** userAgent 判定に必要な最小限の情報。テストから差し替えられるようにしている。 */
export interface NavigatorLike {
  userAgent: string;
  maxTouchPoints?: number;
  platform?: string;
}

/**
 * iPhone / iPad かどうか。
 *
 * iPadOS 13 以降は userAgent で "Macintosh" を名乗るため、
 * タッチポイント数も併せて見ないと Mac と区別できない。
 */
export function isIosLike(nav: NavigatorLike): boolean {
  const ua = nav.userAgent ?? "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS: Mac を名乗るがマルチタッチを持つ
  return /Macintosh|Mac OS X/.test(ua) && (nav.maxTouchPoints ?? 0) > 1;
}

/** この端末が iPhone / iPad か。 */
export function isIosDevice(): boolean {
  return typeof navigator !== "undefined" && isIosLike(navigator);
}

export type SaveStrategy = "share" | "download";

/**
 * ファイルの保存方法を選ぶ。
 *
 * iOS Safari では blob URL に対する `<a download>` が無視されるので、
 * 共有シート（Web Share API）に file を渡すのが唯一の確実な保存経路になる。
 * それ以外の環境では、ユーザーの期待どおり黙ってダウンロードさせる。
 */
export function pickSaveStrategy(env: { ios: boolean; canShareFiles: boolean }): SaveStrategy {
  if (env.ios && env.canShareFiles) return "share";
  return "download";
}

/**
 * 保存に「もう一度タップ」が必要な環境か。
 *
 * iOS では保存経路が「共有シート」か「別タブで開く」しかなく、どちらも
 * ユーザー操作の直後（transient activation 有効中）でないと実行できない。
 * レンダリングとエンコードの数秒でその権利は切れてしまうので、書き出しが
 * 終わったあとに改めてタップしてもらう必要がある。
 *
 * 共有 API の有無では判断しない。共有が使えない iOS でも、黙って無視される
 * ダウンロードを自動実行してしまうと「押しても何も起きない」ことになるため。
 */
export function needsManualSaveTap(env: { ios: boolean }): boolean {
  return env.ios;
}

interface WebkitWindow {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
  OfflineAudioContext?: typeof OfflineAudioContext;
  webkitOfflineAudioContext?: typeof OfflineAudioContext;
}

/** 再生用の AudioContext を作る（古い Safari の webkit 接頭辞にも対応）。 */
export function createAudioContext(): AudioContext {
  const w = window as unknown as WebkitWindow;
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) {
    throw new Error("このブラウザは Web Audio API に対応していません。");
  }
  return new Ctor();
}

/** 書き出し用の OfflineAudioContext を作る。 */
export function createOfflineAudioContext(
  channels: number,
  length: number,
  sampleRate: number,
): OfflineAudioContext {
  const w = window as unknown as WebkitWindow;
  const Ctor = w.OfflineAudioContext ?? w.webkitOfflineAudioContext;
  if (!Ctor) {
    throw new Error("このブラウザは音声の書き出し（OfflineAudioContext）に対応していません。");
  }
  return new Ctor(channels, length, sampleRate);
}

/** ユーザーが共有シートを閉じただけ（失敗ではない）かどうか。 */
export function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === "AbortError" || /abort|cancel/i.test(err.message));
}

/**
 * 他ページに埋め込まれて動いているか。
 *
 * iframe の中では Permissions Policy により共有シート（web-share）が使えず、
 * iOS では保存経路が塞がれてしまう。その場合は「別タブで開く」よう促す。
 */
export function isEmbedded(): boolean {
  try {
    return window.top !== window.self;
  } catch {
    // クロスオリジンで window.top を触れない = 埋め込まれている
    return true;
  }
}
