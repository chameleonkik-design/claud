/*
 * illustrate.js — ページ 1 枚を SVG に組み上げる
 *
 * ページは常に正方形 (viewBox 0 0 100 100)。絵は全面、文字は下の白い帯にのせる。
 * 0〜3歳向けなので文字は大きく、1ページ 3 行までに収まるよう自動で縮める。
 */
(function (root, factory) {
  var shapes = (typeof module === 'object' && module.exports)
    ? require('./shapes.js')
    : (root.Ehon && root.Ehon.shapes);
  var api = factory(shapes);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.Ehon = root.Ehon || {}).illustrate = api;
})(typeof self !== 'undefined' ? self : this, function (shapes) {
  'use strict';

  var FONT = '"Hiragino Maru Gothic ProN","ヒラギノ丸ゴ ProN W4","Yu Gothic","YuGothic","Meiryo","M PLUS Rounded 1c",sans-serif';
  /* 行頭に置かない文字（かんたんな禁則処理） */
  var NO_LINE_START = '、。，．・：；？！ー〜）］｝」』ゃゅょっゎぁぃぅぇぉャュョッァィゥェォ,.!?)]}';
  var TEXT_LEFT = 7, TEXT_RIGHT = 93, TEXT_WIDTH = TEXT_RIGHT - TEXT_LEFT;
  /*
   * 文字の帯は毎ページ同じ位置・同じ高さに置く（板紙絵本のように誌面がそろう）。
   * したがって絵をおく場所は上の y=0〜66。この境目は editor / autolayout と共有する。
   */
  var BAND_TOP = 66, BAND_BOTTOM = 97, BAND_PAD = 2;
  var BAND_H = BAND_BOTTOM - BAND_TOP;
  var TEXT_SPACE = BAND_H - BAND_PAD * 2;
  var LINE_RATIO = 1.34;
  var MAX_LINES = 3;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* 全角を 1.0、半角を 0.55 として文字幅を数える */
  function charWidth(ch) {
    return /[\x20-\x7e]/.test(ch) ? 0.55 : 1;
  }

  function measure(s) {
    var w = 0;
    for (var i = 0; i < s.length; i++) w += charWidth(s[i]);
    return w;
  }

  function wrap(text, maxUnits) {
    var out = [];
    var trimEnd = function (s) { return s.replace(/[ 　]+$/, ''); };
    String(text == null ? '' : text).split('\n').forEach(function (para) {
      var line = '', width = 0;
      for (var i = 0; i < para.length; i++) {
        var ch = para[i], w = charWidth(ch);
        if (width + w > maxUnits && line !== '') {
          /* 日本語の絵本は空白がことばの区切りなので、あればまずそこで折る */
          var sp = Math.max(line.lastIndexOf(' '), line.lastIndexOf('　'));
          if (sp > 0) {
            out.push(trimEnd(line.slice(0, sp)));
            line = line.slice(sp + 1) + ch;
            width = measure(line);
            continue;
          }
          /* 次の文字が行頭禁則なら、もう 1 文字だけ現在の行に押し込む */
          if (NO_LINE_START.indexOf(ch) >= 0) {
            out.push(trimEnd(line + ch));
            line = '';
            width = 0;
            continue;
          }
          out.push(line);
          line = ch;
          width = w;
        } else {
          line += ch;
          width += w;
        }
      }
      out.push(trimEnd(line));
    });
    /* 末尾の空行だけ落とす（段落間の空行は活かす） */
    while (out.length > 1 && out[out.length - 1] === '') out.pop();
    return out;
  }

  /* 決まった高さの帯に収まる、いちばん大きい文字サイズを選ぶ */
  function fitText(text, opts) {
    opts = opts || {};
    var sizes = opts.sizes || [12, 11, 10, 9, 8, 7, 6.2, 5.5, 4.8, 4.2];
    var maxLines = opts.maxLines || MAX_LINES;
    var space = opts.space || TEXT_SPACE;
    var width = opts.width || TEXT_WIDTH;
    var last = null;
    for (var i = 0; i < sizes.length; i++) {
      var size = sizes[i], lines = wrap(text, width / size);
      last = { size: size, lines: lines };
      if (lines.length <= maxLines && lines.length * size * LINE_RATIO <= space) return last;
    }
    return last;
  }

  function itemTransform(it) {
    var size = num(it.size, 40), k = size / 100;
    var t = 'translate(' + num(it.x, 50) + ' ' + num(it.y, 55) + ') scale(' + k + ')';
    if (it.rotate) t += ' rotate(' + num(it.rotate, 0) + ')';
    if (it.flip) t += ' scale(-1 1)';
    return t + ' translate(-50 -50)';
  }

  function num(v, fallback) {
    var n = typeof v === 'number' ? v : parseFloat(v);
    return isFinite(n) ? n : fallback;
  }

  function drawItem(it, index, opts) {
    var def = shapes.get(it.shape);
    if (!def) return '';
    var attrs = ' transform="' + itemTransform(it) + '"';
    if (opts && opts.interactive) {
      attrs += ' data-item="' + index + '" class="ehon-item' + (opts.selected === index ? ' is-selected' : '') + '"';
    }
    return '<g' + attrs + '>' + def.draw(it.color || def.color) + '</g>';
  }

  function lines2tspans(lines, size, firstBaseline) {
    var lineHeight = size * LINE_RATIO;
    return lines.map(function (l, i) {
      return '<tspan x="50" ' +
        (i === 0 ? 'y="' + firstBaseline.toFixed(2) + '"' : 'dy="' + lineHeight.toFixed(2) + '"') + '>' +
        (l === '' ? ' ' : esc(l)) + '</tspan>';
    }).join('');
  }

  /* ページ下の文字の帯。位置と高さは固定で、中身を縦中央にそろえる */
  function drawText(text) {
    var fit = fitText(text);
    if (!fit.lines.length || (fit.lines.length === 1 && fit.lines[0] === '')) return '';
    var lineHeight = fit.size * LINE_RATIO;
    var totalH = fit.lines.length * lineHeight;
    var top = BAND_TOP + (BAND_H - totalH) / 2;
    var baseline = top + lineHeight / 2 + fit.size * 0.35;
    return '<rect x="4" y="' + BAND_TOP + '" width="92" height="' + BAND_H +
      '" rx="6" fill="#fffdf7" opacity=".92"/>' +
      '<text text-anchor="middle" font-family=\'' + FONT + '\' font-size="' + fit.size +
      '" font-weight="700" fill="' + shapes.INK + '" letter-spacing="0.4">' +
      lines2tspans(fit.lines, fit.size, baseline) + '</text>';
  }

  /* 表紙のタイトルは上に置き、絵は下に大きく見せる */
  function drawTitle(title, author) {
    var fit = fitText(title || '', { sizes: [15, 13, 12, 11, 10, 9, 8, 7, 6], maxLines: 3, space: 34, width: 76 });
    var lineHeight = fit.size * LINE_RATIO;
    var totalH = fit.lines.length * lineHeight;
    var boxH = totalH + fit.size * 0.7;
    var boxY = 6;
    var baseline = boxY + (boxH - totalH) / 2 + lineHeight / 2 + fit.size * 0.35;
    var out = '<rect x="8" y="' + boxY + '" width="84" height="' + boxH.toFixed(2) +
      '" rx="8" fill="#fffdf7" opacity=".93"/>' +
      '<text text-anchor="middle" font-family=\'' + FONT + '\' font-size="' + fit.size +
      '" font-weight="800" fill="' + shapes.INK + '" letter-spacing="1">' +
      lines2tspans(fit.lines, fit.size, baseline) + '</text>';
    if (author) {
      out += '<rect x="26" y="' + (boxY + boxH + 2.5).toFixed(2) + '" width="48" height="9" rx="4.5" fill="#fffdf7" opacity=".8"/>' +
        '<text x="50" y="' + (boxY + boxH + 8.9).toFixed(2) + '" text-anchor="middle" font-family=\'' + FONT +
        '\' font-size="5" fill="' + shapes.INK + '" font-weight="700">' + esc(author) + '</text>';
    }
    return out;
  }

  /*
   * page:  { text, scene:{ background, items:[] } }
   * opts:  { interactive, selected, showText, cover:{title,author} }
   */
  function renderPage(page, opts) {
    opts = opts || {};
    page = page || {};
    var scene = page.scene || {};
    var items = Array.isArray(scene.items) ? scene.items : [];
    var svg = '<svg class="ehon-page" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">';
    svg += '<g class="ehon-bg">' + shapes.background(scene.background).draw() + '</g>';
    for (var i = 0; i < items.length; i++) svg += drawItem(items[i], i, opts);
    if (opts.cover) svg += drawTitle(opts.cover.title, opts.cover.author);
    else if (opts.showText !== false) svg += drawText(page.text);
    return svg + '</svg>';
  }

  function renderCover(book, opts) {
    opts = opts || {};
    opts.cover = { title: book.title, author: book.author };
    return renderPage(book.cover || { scene: { background: 'sky', items: [] } }, opts);
  }

  return {
    FONT: FONT,
    /* 絵をおける範囲の下端。ここより下は文字の帯にかくれる */
    ART_BOTTOM: BAND_TOP,
    renderPage: renderPage,
    renderCover: renderCover,
    wrap: wrap,
    fitText: fitText,
    escape: esc
  };
});
