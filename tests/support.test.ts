import { describe, expect, it } from "vitest";

import { resolveSupport, SUPPORT, type SupportConfig } from "../src/support";

function config(patch: Partial<SupportConfig>): SupportConfig {
  return { url: "", label: "応援する", message: "よろしくお願いします", ...patch };
}

describe("支援リンクの設定", () => {
  it("URL が空なら機能ごと非表示（null）", () => {
    expect(resolveSupport(config({ url: "" }))).toBeNull();
    expect(resolveSupport(config({ url: "   " }))).toBeNull();
  });

  it("出荷時の設定が壊れていない", () => {
    // 未設定なら非表示、設定済みなら https のリンクとして解決できること。
    // どちらでもない（設定したのに無効）状態で公開されないよう見張る。
    const resolved = resolveSupport(SUPPORT);
    if (SUPPORT.url.trim() === "") {
      expect(resolved).toBeNull();
    } else {
      expect(resolved).not.toBeNull();
      expect(resolved!.url.startsWith("https://")).toBe(true);
      expect(resolved!.label).not.toBe("");
    }
  });

  it("https の URL を受け付ける", () => {
    const r = resolveSupport(config({ url: "https://ko-fi.com/example" }));
    expect(r).not.toBeNull();
    expect(r!.url).toBe("https://ko-fi.com/example");
    expect(r!.label).toBe("応援する");
  });

  it("前後の空白は取り除かれる", () => {
    const r = resolveSupport(config({ url: "  https://buymeacoffee.com/example  " }));
    expect(r!.url).toBe("https://buymeacoffee.com/example");
  });

  it("http は受け付けない（盗聴・改ざんを避けるため）", () => {
    expect(resolveSupport(config({ url: "http://ko-fi.com/example" }))).toBeNull();
  });

  it("危険なスキームを弾く", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox",
      "file:///etc/passwd",
    ]) {
      expect(resolveSupport(config({ url })), url).toBeNull();
    }
  });

  it("URL として解釈できない文字列を弾く", () => {
    for (const url of ["ko-fi.com/example", "とりあえずあとで", "//example.com", "https://"]) {
      expect(resolveSupport(config({ url })), url).toBeNull();
    }
  });

  it("ラベルが空なら既定の文言を使う", () => {
    const r = resolveSupport(config({ url: "https://example.com/tip", label: "  " }));
    expect(r!.label).toBe("開発を応援する");
  });

  it("メッセージは空でもよい", () => {
    const r = resolveSupport(config({ url: "https://example.com/tip", message: "" }));
    expect(r!.message).toBe("");
  });

  it("クエリやパスを保つ", () => {
    const r = resolveSupport(
      config({ url: "https://buy.stripe.com/test_abc123?prefilled_email=x%40y.z" }),
    );
    expect(r!.url).toContain("test_abc123");
    expect(r!.url).toContain("prefilled_email");
  });
});
