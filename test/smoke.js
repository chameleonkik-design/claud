/*
 * test/smoke.js — 依存なしの動作確認（node test/smoke.js）
 *
 * DOM を使わない層（shapes / illustrate / book / autolayout）を通して、
 * SVG が壊れずに出てくるか、絵本データが正規化されるかを見る。
 */
'use strict';

var shapes = require('../js/shapes.js');
var illustrate = require('../js/illustrate.js');
var bookLib = require('../js/book.js');
var autolayout = require('../js/autolayout.js');
var sample = require('../books/kororo-pon.js');

var failures = [];
var checks = 0;

function ok(cond, label) {
  checks++;
  if (!cond) failures.push(label);
}

/* SVG のタグが開いた分だけ閉じているかをざっくり見る */
function tagsBalanced(svg) {
  var stack = [];
  var re = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g, m;
  while ((m = re.exec(svg))) {
    var closing = m[1] === '/', name = m[2], selfClose = m[4] === '/';
    if (selfClose) continue;
    if (closing) {
      if (stack.pop() !== name) return false;
    } else {
      stack.push(name);
    }
  }
  return stack.length === 0;
}

function noNaN(svg) {
  return !/NaN|undefined|Infinity/.test(svg);
}

/* --- 1. すべての図形が描けるか --- */
shapes.ids.forEach(function (id) {
  var def = shapes.get(id);
  var svg = '<svg>' + def.draw(def.color) + '</svg>';
  ok(def.label && def.category && def.size > 0, 'shape meta: ' + id);
  ok(shapes.categories.indexOf(def.category) >= 0, 'shape category known: ' + id);
  ok(tagsBalanced(svg), 'shape tags balanced: ' + id);
  ok(noNaN(svg), 'shape has no NaN: ' + id);
  ok(svg.length > 60, 'shape draws something: ' + id);
});
ok(shapes.ids.length >= 20, 'shape count >= 20 (got ' + shapes.ids.length + ')');
shapes.ids.forEach(function (id) {
  var def = shapes.get(id);
  ok(def.bottom > 50 && def.bottom <= 100, 'shape bottom in range: ' + id);
  ok(['sky', 'ground', 'any'].indexOf(def.zone) >= 0, 'shape zone known: ' + id);
});
ok(shapes.bottomOf('cat', 40, 40) === 40 + 40 * 0.47, 'bottomOf: uses the shape extent');

/* --- 2. すべての背景が描けるか --- */
shapes.backgroundIds.forEach(function (id) {
  var svg = '<svg>' + shapes.background(id).draw() + '</svg>';
  ok(tagsBalanced(svg), 'bg tags balanced: ' + id);
  ok(noNaN(svg), 'bg has no NaN: ' + id);
});
ok(shapes.backgroundIds.length >= 5, 'background count >= 5');

/* --- 3. 文字の折り返しと詰め込み --- */
ok(illustrate.wrap('あいうえお', 100).length === 1, 'wrap: short text stays on one line');
ok(illustrate.wrap('あ\nい', 100).length === 2, 'wrap: keeps explicit line breaks');
var wrapped = illustrate.wrap('あいうえおかきくけこさしすせそ', 5);
ok(wrapped.length >= 3, 'wrap: long text splits');
ok(wrapped.join('') === 'あいうえおかきくけこさしすせそ', 'wrap: no characters lost');
ok(illustrate.wrap('ねこ、いぬ', 3)[0].indexOf('、') >= 0, 'wrap: 、 does not start a line');
var fitLong = illustrate.fitText('あ'.repeat(80));
ok(fitLong.size <= 6.2, 'fitText: shrinks long text');
ok(illustrate.fitText('ぽーん').size >= 11, 'fitText: short text stays big');
var fit2 = illustrate.fitText('みんな おやすみ　ぽーん');
ok(fit2.lines.length === 2 && fit2.lines[0] === 'みんな おやすみ', 'fitText: 空白で 2 行に割る');
ok(fit2.lines.length * fit2.size * 1.34 <= 27.1, 'fitText: 帯の高さに収まる');

/* --- 4. ページとサンプル絵本のレンダリング --- */
var book = bookLib.normalize(sample);
ok(book.title === 'ころころ ぽーん', 'sample title');
ok(book.pages.length === 12, 'sample has 12 pages (got ' + book.pages.length + ')');
ok(book.cover.scene.items.length > 0, 'sample cover has art');

var coverSvg = illustrate.renderCover(book);
ok(tagsBalanced(coverSvg), 'cover tags balanced');
ok(noNaN(coverSvg), 'cover has no NaN');
ok(coverSvg.indexOf('ころころ') >= 0 && coverSvg.indexOf('ぽーん') >= 0, 'cover shows the title');
ok(illustrate.wrap('ころころ ぽーん', 6.6).join('|') === 'ころころ|ぽーん', 'wrap: 空白で折る');

book.pages.forEach(function (p, i) {
  var svg = illustrate.renderPage(p);
  ok(tagsBalanced(svg), 'page ' + (i + 1) + ' tags balanced');
  ok(noNaN(svg), 'page ' + (i + 1) + ' has no NaN');
  ok(svg.indexOf('<text') > 0, 'page ' + (i + 1) + ' has text');
  ok(p.scene.items.length > 0, 'page ' + (i + 1) + ' has art');
  p.scene.items.forEach(function (it) {
    ok(!!shapes.get(it.shape), 'page ' + (i + 1) + ' uses a known shape: ' + it.shape);
    /* 絵が文字の帯（y=66 から下）に埋もれていないか */
    ok(shapes.bottomOf(it.shape, it.y, it.size) <= illustrate.ART_BOTTOM + 0.5,
      'page ' + (i + 1) + ' item stays above the text band: ' + it.shape);
  });
});

/* --- 5. 壊れた入力でも落ちないか --- */
var junk = bookLib.normalize({ pages: [{ text: 42, scene: { background: 'nope', items: [{ shape: 'ゆにこーん' }, null, { shape: 'cat', x: 'あ', size: -5 }] } }] });
ok(junk.pages.length === 1, 'junk: one page survives');
ok(junk.pages[0].scene.background === 'meadow', 'junk: unknown background falls back');
ok(junk.pages[0].scene.items.length === 1, 'junk: unknown shapes dropped');
ok(junk.pages[0].scene.items[0].x === 50, 'junk: bad x falls back to 50');
ok(junk.pages[0].scene.items[0].size >= 4, 'junk: bad size clamped');
ok(junk.pages[0].text === '', 'junk: non-string text becomes empty');
ok(tagsBalanced(illustrate.renderPage(junk.pages[0])), 'junk: still renders');
ok(bookLib.normalize({}).pages.length === 1, 'empty book gets one page');
ok(bookLib.normalize(null).title.length > 0, 'null book gets a title');
ok(illustrate.renderPage(undefined).indexOf('<svg') === 0, 'undefined page still renders');

/* --- 6. ことば拾いと背景えらび --- */
ok(autolayout.findWords('ねこが ボールで あそぶ').join(',') === 'cat,ball', 'findWords: ねこ→cat, ボール→ball');
ok(autolayout.findWords('わんわん').indexOf('dog') >= 0, 'findWords: 鳴きごえも拾う');
ok(autolayout.findWords('').length === 0, 'findWords: 空文字は何も拾わない');
ok(autolayout.pickBackground('うみで およぐ') === 'sea', 'pickBackground: うみ→sea');
ok(autolayout.pickBackground('よぞらの おつきさま') === 'night', 'pickBackground: よぞら→night');
ok(autolayout.pickBackground('ぽんぽん', 'meadow') === 'meadow', 'pickBackground: 手がかりなしは前の背景');

/* --- 7. 文章から絵本を組み立てる --- */
var built = autolayout.build(
  'ころころ ころころ\nあっ ねこさん\nにゃあ にゃあ ぽーん！\nうみに ぽちゃん\nおつきさま こんばんは',
  { mode: 'line' }
);
ok(built.pages.length === 5, 'autobuild: 1行=1ページ (got ' + built.pages.length + ')');
ok(built.pages[1].scene.items.some(function (i) { return i.shape === 'cat'; }), 'autobuild: ねこの行に cat が入る');
ok(built.pages[3].scene.background === 'sea', 'autobuild: うみの行は sea');
ok(built.pages[4].scene.background === 'night', 'autobuild: おつきさまの行は night');
built.pages.forEach(function (p, i) {
  ok(p.scene.items.length > 0, 'autobuild: page ' + (i + 1) + ' has art');
  ok(tagsBalanced(illustrate.renderPage(p)), 'autobuild: page ' + (i + 1) + ' renders');
  p.scene.items.forEach(function (it) {
    ok(shapes.bottomOf(it.shape, it.y, it.size) <= illustrate.ART_BOTTOM + 1,
      'autobuild: page ' + (i + 1) + ' art stays above the text band: ' + it.shape);
  });
});
var blocks = autolayout.build('いちぎょうめ\nにぎょうめ\n\nつぎの ページ', {});
ok(blocks.pages.length === 2, 'autobuild: 空行でページを分ける (got ' + blocks.pages.length + ')');
ok(autolayout.build('', {}).pages.length === 1, 'autobuild: 空入力でも 1 ページ');

/* --- 8. 保存文字列の往復 --- */
var round = bookLib.parse(bookLib.stringify(book));
ok(round.pages.length === book.pages.length, 'json round-trip: page count');
ok(round.pages[2].text === book.pages[2].text, 'json round-trip: text');
ok(bookLib.slug('ころころ ぽーん').indexOf(' ') < 0, 'slug: 空白を消す');
ok(bookLib.slug('a/b:c') === 'a-b-c', 'slug: 記号を置きかえる');

/* --- 結果 --- */
if (failures.length) {
  console.error('✗ ' + failures.length + ' / ' + checks + ' failed:');
  failures.forEach(function (f) { console.error('  - ' + f); });
  process.exit(1);
}
console.log('✓ all ' + checks + ' checks passed');
