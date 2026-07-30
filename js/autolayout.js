/*
 * autolayout.js — 文章から絵本を組み立てる
 *
 * 1) 空行、または改行でページに分ける
 * 2) 各ページの文から「ねこ」「ボール」などのことばを拾って絵を選ぶ
 * 3) 場面のことば（うみ・よる・おへや…）から背景を決める
 * 4) 拾った絵を、空・地面のどちらに置くかを見ながら配置する
 */
(function (root, factory) {
  var deps = (typeof module === 'object' && module.exports)
    ? { shapes: require('./shapes.js'), book: require('./book.js') }
    : { shapes: root.Ehon.shapes, book: root.Ehon.book };
  var api = factory(deps.shapes, deps.book);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.Ehon = root.Ehon || {}).autolayout = api;
})(typeof self !== 'undefined' ? self : this, function (shapes, bookLib) {
  'use strict';

  /* ことば → 絵。ひらがな・カタカナ・漢字・鳴きごえを拾う */
  var WORDS = [
    ['cat', ['ねこ', 'ネコ', '猫', 'にゃ', 'こねこ', 'キャット']],
    ['dog', ['いぬ', 'イヌ', '犬', 'わん', 'こいぬ', 'ワンワン']],
    ['rabbit', ['うさぎ', 'ウサギ', '兎', 'ぴょん', 'みみ']],
    ['bear', ['くま', 'クマ', '熊', 'ぐるる']],
    ['elephant', ['ぞう', 'ゾウ', '象', 'ぱおーん', 'パオーン']],
    ['bird', ['とり', 'トリ', '鳥', 'ことり', 'ぴよ', 'ちゅん', 'ぴちゅ']],
    ['fish', ['さかな', 'サカナ', '魚', 'おさかな']],
    ['frog', ['かえる', 'カエル', '蛙', 'けろ', 'げろ']],
    ['sheep', ['ひつじ', 'ヒツジ', '羊', 'めえ', 'メエ']],
    ['pig', ['ぶた', 'ブタ', '豚', 'ぶうぶう']],
    ['sun', ['おひさま', 'たいよう', '太陽', 'ひざし', 'あさ', '朝', 'にっこり']],
    ['moon', ['つき', 'ツキ', '月', 'おつきさま', 'みかづき']],
    ['star', ['ほし', 'ホシ', '星', 'きらきら', 'キラキラ']],
    ['cloud', ['くも', 'クモ', '雲', 'ふわふわ']],
    ['tree', ['き', '木', 'もり', '森', 'きのした', 'は', '葉']],
    ['flower', ['はな', 'ハナ', '花', 'おはな', 'チューリップ', 'たんぽぽ']],
    ['butterfly', ['ちょう', 'ちょうちょ', '蝶', 'ひらひら']],
    ['apple', ['りんご', 'リンゴ', '林檎']],
    ['cake', ['ケーキ', 'けーき', 'おやつ', 'たんじょうび', '誕生日']],
    ['ball', ['ボール', 'ぼーる', 'まりつき', 'ころころ', 'ぽーん']],
    ['balloon', ['ふうせん', 'フウセン', '風船']],
    ['house', ['おうち', 'いえ', '家', 'おへや']],
    ['car', ['くるま', 'クルマ', '車', 'ぶーぶー', 'ブーブー']],
    ['train', ['でんしゃ', 'デンシャ', '電車', 'がたんごとん', 'しゅっぱつ']]
  ];

  /* ことば → 背景。先に書いたものが強い */
  var SCENES = [
    ['night', ['よぞら', 'よる', '夜', 'おやすみ', 'ねむ', 'ゆめ', '夢', 'おつきさま', 'ほしぞら']],
    ['sea', ['うみ', '海', 'なみ', '波', 'おさかな', 'さかな', 'すいすい', 'ぷかぷか']],
    ['room', ['おへや', 'へや', '部屋', 'ベッド', 'おうち', 'いえ', '家', 'まど', 'ごはん']],
    ['snow', ['ゆき', '雪', 'さむい', '寒い', 'しろい', 'ふゆ', '冬']],
    ['sky', ['そら', '空', 'とんだ', 'とぶ', '飛', 'ひらひら', 'くも', '雲', 'ふうせん']],
    ['meadow', ['くさ', '草', 'のはら', 'こうえん', '公園', 'はな', '花', 'そと', '外']]
  ];

  /* 0〜3歳向けに、はっきりした色だけ選ぶ */
  var PALETTE = ['#f2a65a', '#ff6b6b', '#5bb8e8', '#8ecf6b', '#f7b0c0', '#c39bf0', '#ffd24a', '#7ec8e3', '#d9a05b'];

  function findWords(text, table) {
    var hits = [];
    for (var i = 0; i < table.length; i++) {
      var id = table[i][0], keys = table[i][1];
      for (var j = 0; j < keys.length; j++) {
        var at = text.indexOf(keys[j]);
        /* 1 文字のひらがなキーは誤検出しやすいので、漢字以外は 2 文字以上を要求 */
        if (at >= 0 && (keys[j].length > 1 || !/^[ぁ-んァ-ヶ]$/.test(keys[j]))) {
          hits.push({ id: id, at: at });
          break;
        }
      }
    }
    hits.sort(function (a, b) { return a.at - b.at; });
    return hits.map(function (h) { return h.id; });
  }

  function pickBackground(text, fallback) {
    for (var i = 0; i < SCENES.length; i++) {
      var keys = SCENES[i][1];
      for (var j = 0; j < keys.length; j++) {
        if (text.indexOf(keys[j]) >= 0) return SCENES[i][0];
      }
    }
    return fallback || 'meadow';
  }

  /*
   * 主役を大きく、脇は少し小さく。空のものは上、地面のものは下に置く。
   * 地面のものは shapes の bottom を見て、足もとが同じ高さにそろうようにする。
   * 本文ページは足もと 63（文字の帯は 66 から）、表紙は帯がないぶん下げて 84。
   */
  function composeItems(ids, seed, opts) {
    opts = opts || {};
    var groundLine = opts.cover ? 84 : 63;
    var skyLine = opts.cover ? 58 : 18;

    var ground = [], sky = [];
    ids.forEach(function (id) {
      var def = shapes.get(id);
      if (!def) return;
      (def.zone === 'sky' ? sky : ground).push(id);
    });
    ground = ground.slice(0, 3);
    sky = sky.slice(0, 2);

    var items = [];
    sky.forEach(function (id, i) {
      var def = shapes.get(id);
      var xs = sky.length === 1 ? [26] : [22, 74];
      items.push({
        shape: id, x: xs[i], y: skyLine + (i % 2) * 4,
        size: Math.round(def.size * 0.85), color: def.color, flip: false
      });
    });

    /* [ x, 大きさの倍率, 足もとのずらし ] */
    var layouts = {
      1: [[50, 1.15, 0]],
      2: [[31, 1.0, 0], [68, 0.92, 2]],
      3: [[24, 0.82, 2], [50, 1.0, 0], [77, 0.8, 3]]
    };
    var plan = layouts[ground.length] || [];
    ground.forEach(function (id, i) {
      var def = shapes.get(id), p = plan[i];
      var size = Math.round(def.size * p[1]);
      var color = def.color;
      /* 同じ絵が続くページで色が変わらないよう、種と絵の名前から決める */
      if (def.category === 'もの') color = PALETTE[(seed + i + id.length) % PALETTE.length];
      items.push({
        shape: id,
        x: p[0],
        y: Math.round((groundLine + p[2] - size * (def.bottom - 50) / 100) * 10) / 10,
        size: size,
        color: color,
        flip: ground.length > 1 && i === ground.length - 1
      });
    });
    return items;
  }

  /* 空行 → ページ区切り。1 行だけの塊はそのまま 1 ページ */
  function splitPages(text) {
    var blocks = String(text || '').replace(/\r\n?/g, '\n').split(/\n{2,}/);
    var pages = [];
    blocks.forEach(function (block) {
      var body = block.replace(/^\n+|\n+$/g, '');
      if (!body.trim()) return;
      var lines = body.split('\n').filter(function (l) { return l.trim(); });
      if (lines.length === 1) pages.push(lines[0].trim());
      else pages.push(lines.join('\n'));
    });
    return pages;
  }

  /* 1 行 = 1 ページで割る場合 */
  function splitLines(text) {
    return String(text || '').replace(/\r\n?/g, '\n').split('\n')
      .map(function (l) { return l.trim(); })
      .filter(function (l) { return l; });
  }

  /*
   * build(text, opts) -> book
   * opts: { title, author, mode:'block'|'line', keepBackground:true }
   */
  function build(text, opts) {
    opts = opts || {};
    var texts = opts.mode === 'line' ? splitLines(text) : splitPages(text);
    if (!texts.length) texts = [''];

    var lastBg = 'meadow';
    var tally = {};
    var pages = texts.map(function (t, i) {
      var ids = findWords(t, WORDS);
      ids.forEach(function (id) { tally[id] = (tally[id] || 0) + 1; });
      var bg = pickBackground(t, opts.keepBackground === false ? 'meadow' : lastBg);
      lastBg = bg;
      /* 絵の手がかりが無いページは、前に出てきた主役を置いて間を持たせる */
      if (!ids.length) {
        var main = Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; })[0];
        if (main) ids = [main];
      }
      return { text: t, scene: { background: bg, items: composeItems(ids, i) } };
    });

    var title = opts.title || (texts[0] || 'あたらしいえほん').split('\n')[0].slice(0, 20);
    var hero = Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; }).slice(0, 2);
    var coverBg = pickBackground(texts.join(''), 'sky');

    return bookLib.normalize({
      title: title,
      author: opts.author || '',
      age: '0-3',
      cover: { scene: { background: coverBg, items: composeItems(hero, 0, { cover: true }) } },
      pages: pages
    });
  }

  return {
    build: build,
    splitPages: splitPages,
    splitLines: splitLines,
    findWords: function (text) { return findWords(text, WORDS); },
    pickBackground: pickBackground,
    composeItems: composeItems,
    words: WORDS,
    palette: PALETTE
  };
});
