import { describe, expect, it } from "vitest";

import {
  isAbortError,
  isIosLike,
  needsManualSaveTap,
  pickSaveStrategy,
} from "../src/audio/compat";

/** 実際に出回っている userAgent の抜粋。 */
const UA = {
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  ipadOld:
    "Mozilla/5.0 (iPad; CPU OS 12_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1",
  // iPadOS 13 以降は Mac を名乗る
  ipadDesktopMode:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  mac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  windows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  android:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
};

describe("iOS 判定", () => {
  it("iPhone / 旧iPad を判定できる", () => {
    expect(isIosLike({ userAgent: UA.iphone, maxTouchPoints: 5 })).toBe(true);
    expect(isIosLike({ userAgent: UA.ipadOld, maxTouchPoints: 5 })).toBe(true);
  });

  it("Mac を名乗る iPadOS もタッチ数で判定できる", () => {
    expect(isIosLike({ userAgent: UA.ipadDesktopMode, maxTouchPoints: 5 })).toBe(true);
  });

  it("本物の Mac は iOS 扱いしない", () => {
    expect(isIosLike({ userAgent: UA.mac, maxTouchPoints: 0 })).toBe(false);
    expect(isIosLike({ userAgent: UA.macSafari, maxTouchPoints: 0 })).toBe(false);
    // トラックパッドでも maxTouchPoints は 0/1 なので誤判定しない
    expect(isIosLike({ userAgent: UA.macSafari, maxTouchPoints: 1 })).toBe(false);
  });

  it("Windows / Android は iOS 扱いしない", () => {
    expect(isIosLike({ userAgent: UA.windows, maxTouchPoints: 10 })).toBe(false);
    expect(isIosLike({ userAgent: UA.android, maxTouchPoints: 5 })).toBe(false);
  });

  it("maxTouchPoints が無い環境でも落ちない", () => {
    expect(isIosLike({ userAgent: UA.iphone })).toBe(true);
    expect(isIosLike({ userAgent: UA.macSafari })).toBe(false);
    expect(isIosLike({ userAgent: "" })).toBe(false);
  });
});

describe("保存方法の選択", () => {
  it("iOS で共有できるなら共有シートを使う", () => {
    expect(pickSaveStrategy({ ios: true, canShareFiles: true })).toBe("share");
  });

  it("iOS でも共有できなければダウンロードにフォールバックする", () => {
    expect(pickSaveStrategy({ ios: true, canShareFiles: false })).toBe("download");
  });

  it("iOS 以外では共有できてもダウンロードを優先する", () => {
    // デスクトップで共有シートが開くとユーザーの期待から外れる
    expect(pickSaveStrategy({ ios: false, canShareFiles: true })).toBe("download");
    expect(pickSaveStrategy({ ios: false, canShareFiles: false })).toBe("download");
  });

  it("共有経路のときだけ、書き出し後の再タップが必要になる", () => {
    // Web Share API はユーザー操作の直後しか呼べない
    expect(needsManualSaveTap("share")).toBe(true);
    expect(needsManualSaveTap("download")).toBe(false);
  });
});

describe("共有シートのキャンセル判定", () => {
  it("AbortError はキャンセルとして扱う", () => {
    const err = new Error("share canceled");
    err.name = "AbortError";
    expect(isAbortError(err)).toBe(true);
  });

  it("メッセージに abort/cancel を含むものもキャンセル扱い", () => {
    expect(isAbortError(new Error("The operation was aborted."))).toBe(true);
    expect(isAbortError(new Error("Share canceled by the user"))).toBe(true);
  });

  it("本当の失敗はキャンセル扱いしない", () => {
    expect(isAbortError(new Error("NotAllowedError: permission denied"))).toBe(false);
    expect(isAbortError(new TypeError("files is not shareable"))).toBe(false);
    expect(isAbortError("文字列")).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });
});
