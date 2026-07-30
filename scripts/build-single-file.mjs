/**
 * dist/ のビルド結果を、1枚の HTML ファイルにまとめる。
 *
 * CSS と JS をインライン化するので、外部ファイルを一切読み込まない。
 * ダブルクリックでブラウザで開けるし、どんな静的ホスティングにも置ける。
 *
 *   npm run build && node scripts/build-single-file.mjs
 *   → dist-single/chord-progression-studio.html
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";
const OUT_DIR = "dist-single";
const OUT_FILE = "chord-progression-studio.html";

/**
 * インライン化した JS を壊さないための処理。
 *
 * - `</script` があると HTML パーサが script 要素を終わらせてしまうので分割する。
 *   JS の文字列リテラルとしては `<\/script` と等価なので意味は変わらない。
 * - sourceMappingURL は参照先の .map を同梱しないため、404 になる前に消す。
 */
function inlineSafeJs(code) {
  return code
    .replace(/<\/script/gi, "<\\/script")
    .replace(/^\/\/# sourceMappingURL=.*$/gm, "")
    .trimEnd();
}

/** CSS 内の `</style` も同様に無効化しておく。 */
function inlineSafeCss(code) {
  return code.replace(/<\/style/gi, "<\\/style").trimEnd();
}

function findAsset(extension) {
  const dir = join(DIST, "assets");
  const hit = readdirSync(dir).find((f) => f.endsWith(extension));
  if (!hit) {
    throw new Error(
      `${DIST}/assets に ${extension} が見つかりません。先に \`npm run build\` を実行してください。`,
    );
  }
  return readFileSync(join(dir, hit), "utf8");
}

const css = inlineSafeCss(findAsset(".css"));
const js = inlineSafeJs(findAsset(".js"));

const html = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Chord Progression Studio — コード進行メーカー</title>
    <meta
      name="description"
      content="コード進行を作って、その場で試聴して、MP3としてダウンロードできるアプリ。"
    />
    <style>
${css}
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
${js}
    </script>
  </body>
</html>
`;

mkdirSync(OUT_DIR, { recursive: true });
const outPath = join(OUT_DIR, OUT_FILE);
writeFileSync(outPath, html, "utf8");

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
console.log(`${outPath} を書き出しました（${kb(Buffer.byteLength(html))}）`);
console.log(`  CSS ${kb(Buffer.byteLength(css))} / JS ${kb(Buffer.byteLength(js))} をインライン化`);
