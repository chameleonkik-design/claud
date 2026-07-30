/*
 * editor.js — 絵本をつくる画面
 *
 * 左：ページの一覧 / 中央：いま編集しているページ（ドラッグで絵を動かせる）
 * 右：ことば・背景・絵のパーツ
 *
 * クリック系はすべて data-action の委譲でさばくので、描き直しても配線が切れない。
 */
(function (root) {
  'use strict';
  var Ehon = root.Ehon = root.Ehon || {};
  var doc = root.document;

  var state = {
    book: null,
    page: 0,      // -1 = 表紙
    item: -1,     // 選択中の絵。-1 = 未選択
    mount: null,
    onChange: null
  };

  var SWATCHES = ['#ff6b6b', '#f2a65a', '#ffd24a', '#8ecf6b', '#5bb8e8', '#7ec8e3',
    '#c39bf0', '#f7b0c0', '#d9a05b', '#c08552', '#9fb4c7', '#fbf6ee', '#43362a'];

  /* ---------- 状態のヘルパー ---------- */

  function currentScene() {
    return state.page === -1 ? state.book.cover.scene : state.book.pages[state.page].scene;
  }
  function currentPage() {
    return state.page === -1 ? state.book.cover : state.book.pages[state.page];
  }
  function currentItem() {
    var items = currentScene().items;
    return state.item >= 0 && state.item < items.length ? items[state.item] : null;
  }
  function changed() {
    render();
    if (state.onChange) state.onChange(state.book);
  }

  /* ---------- 描画 ---------- */

  function shell() {
    return '' +
      '<div class="editor">' +
      '  <aside class="pane pane--pages"><h2 class="pane__title">ページ</h2>' +
      '    <div class="pagelist" id="pagelist"></div>' +
      '    <div class="pane__foot">' +
      '      <button class="btn btn--block" data-action="add-page">＋ ページをふやす</button>' +
      '    </div>' +
      '  </aside>' +
      '  <main class="pane pane--canvas">' +
      '    <div class="canvas__head" id="canvasHead"></div>' +
      '    <div class="canvas" id="canvas"></div>' +
      '    <p class="hint">絵をドラッグして動かせます。大きさや色は右側で変えられます。</p>' +
      '  </main>' +
      '  <aside class="pane pane--inspect" id="inspect"></aside>' +
      '</div>';
  }

  function drawPageList() {
    var out = '';
    out += pageCard(-1, '表紙', Ehon.illustrate.renderCover(state.book, {}));
    state.book.pages.forEach(function (p, i) {
      out += pageCard(i, String(i + 1), Ehon.illustrate.renderPage(p, {}));
    });
    doc.getElementById('pagelist').innerHTML = out;
  }

  function pageCard(i, label, svg) {
    var on = state.page === i;
    return '<div class="pagecard' + (on ? ' is-on' : '') + '" data-action="select-page" data-page="' + i + '">' +
      '<span class="pagecard__no">' + label + '</span>' +
      '<div class="pagecard__thumb">' + svg + '</div>' +
      '</div>';
  }

  function drawCanvas() {
    var head = state.page === -1
      ? '<strong>表紙</strong><span class="canvas__sub">タイトルが大きくのります</span>'
      : '<strong>' + (state.page + 1) + ' ページ</strong>' +
        '<span class="canvas__sub">ぜんぶで ' + state.book.pages.length + ' ページ</span>' +
        '<span class="spacer"></span>' +
        '<button class="btn btn--sm" data-action="move-page" data-dir="-1" ' + (state.page === 0 ? 'disabled' : '') + '>↑ まえへ</button>' +
        '<button class="btn btn--sm" data-action="move-page" data-dir="1" ' + (state.page === state.book.pages.length - 1 ? 'disabled' : '') + '>↓ あとへ</button>' +
        '<button class="btn btn--sm" data-action="dup-page">コピー</button>' +
        '<button class="btn btn--sm btn--danger" data-action="del-page" ' + (state.book.pages.length < 2 ? 'disabled' : '') + '>けす</button>';
    doc.getElementById('canvasHead').innerHTML = head;

    var opts = { interactive: true, selected: state.item };
    var svg = state.page === -1
      ? Ehon.illustrate.renderCover(state.book, opts)
      : Ehon.illustrate.renderPage(state.book.pages[state.page], opts);
    doc.getElementById('canvas').innerHTML = svg;
  }

  function drawInspector() {
    var scene = currentScene();
    var out = '';

    /* ことば */
    if (state.page === -1) {
      out += '<section class="box"><h2 class="pane__title">タイトル</h2>' +
        '<input class="input" id="bookTitle" data-input="title" value="' + Ehon.illustrate.escape(state.book.title) + '" placeholder="えほんの なまえ">' +
        '<input class="input" id="bookAuthor" data-input="author" value="' + Ehon.illustrate.escape(state.book.author) + '" placeholder="つくった ひと">' +
        '</section>';
    } else {
      var t = state.book.pages[state.page].text;
      out += '<section class="box"><h2 class="pane__title">ことば</h2>' +
        '<textarea class="input input--area" data-input="text" rows="3" placeholder="ころころ ぽーん">' + Ehon.illustrate.escape(t) + '</textarea>' +
        '<p class="hint hint--tight">' + t.replace(/\n/g, '').length + ' もじ' +
        '（0〜3歳なら 1ページ 15 もじくらいまで）</p>' +
        '</section>';
    }

    /* 背景 */
    out += '<section class="box"><h2 class="pane__title">はいけい</h2><div class="chips">';
    Ehon.shapes.backgroundIds.forEach(function (id) {
      out += '<button class="chip' + (scene.background === id ? ' is-on' : '') + '" data-action="set-bg" data-bg="' + id + '">' +
        '<span class="chip__art">' + miniBg(id) + '</span>' + Ehon.shapes.backgrounds[id].label + '</button>';
    });
    out += '</div></section>';

    /* 絵をふやす */
    out += '<section class="box"><h2 class="pane__title">えを おく</h2>';
    Ehon.shapes.byCategory().forEach(function (cat) {
      out += '<p class="box__label">' + cat.name + '</p><div class="palette">';
      cat.ids.forEach(function (id) {
        out += '<button class="palette__btn" data-action="add-shape" data-shape="' + id + '" title="' + Ehon.shapes.get(id).label + '">' +
          miniShape(id) + '<span>' + Ehon.shapes.get(id).label + '</span></button>';
      });
      out += '</div>';
    });
    out += '</section>';

    /* このページの絵 */
    out += '<section class="box"><h2 class="pane__title">このページの え</h2>';
    if (!scene.items.length) {
      out += '<p class="hint hint--tight">まだ ありません。上から えらんでね。</p>';
    } else {
      out += '<div class="layers">';
      scene.items.slice().reverse().forEach(function (it, revIdx) {
        var i = scene.items.length - 1 - revIdx;
        out += '<button class="layer' + (state.item === i ? ' is-on' : '') + '" data-action="select-item" data-item="' + i + '">' +
          miniShape(it.shape, it.color) + '<span>' + Ehon.shapes.get(it.shape).label + '</span></button>';
      });
      out += '</div>';
    }
    var it2 = currentItem();
    if (it2) {
      out += '<div class="props">' +
        '<label class="prop"><span>おおきさ</span>' +
        '<input type="range" min="6" max="130" step="1" value="' + it2.size + '" data-input="size"></label>' +
        '<label class="prop"><span>かたむき</span>' +
        '<input type="range" min="-45" max="45" step="1" value="' + it2.rotate + '" data-input="rotate"></label>' +
        '<div class="prop"><span>いろ</span><div class="swatches">';
      SWATCHES.forEach(function (c) {
        out += '<button class="swatch' + (it2.color.toLowerCase() === c.toLowerCase() ? ' is-on' : '') +
          '" style="background:' + c + '" data-action="set-color" data-color="' + c + '" aria-label="' + c + '"></button>';
      });
      out += '<input type="color" class="swatch swatch--pick" value="' + it2.color + '" data-input="color"></div></div>' +
        '<div class="prop prop--row">' +
        '<button class="btn btn--sm" data-action="flip-item">↔ むきをかえる</button>' +
        '<button class="btn btn--sm" data-action="item-layer" data-dir="1">まえへ</button>' +
        '<button class="btn btn--sm" data-action="item-layer" data-dir="-1">うしろへ</button>' +
        '<button class="btn btn--sm btn--danger" data-action="del-item">けす</button>' +
        '</div></div>';
    }
    out += '</section>';

    /* 文章から組み立てる */
    out += '<section class="box box--accent"><h2 class="pane__title">文から くみたてる</h2>' +
      '<textarea class="input input--area" id="autoText" rows="6" placeholder="ころころ ころころ&#10;あっ ねこさん&#10;にゃあ にゃあ ぽーん！"></textarea>' +
      '<label class="prop prop--check"><input type="checkbox" id="autoLine" checked><span>1行を 1ページにする</span></label>' +
      '<button class="btn btn--primary btn--block" data-action="autobuild">えほんに くみたてる</button>' +
      '<p class="hint hint--tight">「ねこ」「ボール」「うみ」などのことばを見つけて、絵と背景を選びます。タイトルは1行目からつきます。いまの絵本は置きかわります。</p>' +
      '</section>';

    doc.getElementById('inspect').innerHTML = out;
  }

  function miniShape(id, color) {
    var def = Ehon.shapes.get(id);
    if (!def) return '';
    return '<svg viewBox="0 0 100 100" class="mini">' + def.draw(color || def.color) + '</svg>';
  }
  function miniBg(id) {
    return '<svg viewBox="0 0 100 100" class="mini">' + Ehon.shapes.background(id).draw() + '</svg>';
  }

  function render() {
    drawPageList();
    drawCanvas();
    drawInspector();
    bindDrag();
  }

  /* ---------- ドラッグで絵を動かす ---------- */

  function toPageCoords(svg, clientX, clientY) {
    var r = svg.getBoundingClientRect();
    var s = Math.min(r.width, r.height);
    var ox = r.left + (r.width - s) / 2, oy = r.top + (r.height - s) / 2;
    return { x: (clientX - ox) / s * 100, y: (clientY - oy) / s * 100 };
  }

  function bindDrag() {
    var canvas = doc.getElementById('canvas');
    var svg = canvas.querySelector('svg');
    if (!svg) return;
    var drag = null;

    svg.addEventListener('pointerdown', function (e) {
      var g = e.target.closest ? e.target.closest('[data-item]') : null;
      if (!g) { state.item = -1; drawCanvas(); drawInspector(); bindDrag(); return; }
      var idx = parseInt(g.getAttribute('data-item'), 10);
      state.item = idx;
      var it = currentScene().items[idx];
      var p = toPageCoords(svg, e.clientX, e.clientY);
      drag = { idx: idx, dx: it.x - p.x, dy: it.y - p.y, moved: false };
      svg.setPointerCapture(e.pointerId);
      drawCanvas();
      drawInspector();
      bindDrag();
      e.preventDefault();
    });

    svg.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var p = toPageCoords(svg, e.clientX, e.clientY);
      var it = currentScene().items[drag.idx];
      if (!it) return;
      it.x = Math.round(Math.max(-10, Math.min(110, p.x + drag.dx)) * 10) / 10;
      it.y = Math.round(Math.max(-10, Math.min(110, p.y + drag.dy)) * 10) / 10;
      drag.moved = true;
      drawCanvas();
    });

    var end = function () {
      if (drag && drag.moved) changed();
      drag = null;
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
  }

  /* ---------- 操作 ---------- */

  var actions = {
    'select-page': function (el) {
      state.page = parseInt(el.getAttribute('data-page'), 10);
      state.item = -1;
      render();
    },
    'add-page': function () {
      var bg = currentScene().background;
      var at = state.page === -1 ? 0 : state.page + 1;
      state.book.pages.splice(at, 0, Ehon.book.emptyPage(bg));
      state.page = at;
      state.item = -1;
      changed();
    },
    'dup-page': function () {
      if (state.page === -1) return;
      var copy = JSON.parse(JSON.stringify(state.book.pages[state.page]));
      state.book.pages.splice(state.page + 1, 0, copy);
      state.page += 1;
      changed();
    },
    'del-page': function () {
      if (state.page === -1 || state.book.pages.length < 2) return;
      state.book.pages.splice(state.page, 1);
      state.page = Math.min(state.page, state.book.pages.length - 1);
      state.item = -1;
      changed();
    },
    'move-page': function (el) {
      if (state.page === -1) return;
      var dir = parseInt(el.getAttribute('data-dir'), 10);
      var to = state.page + dir;
      if (to < 0 || to >= state.book.pages.length) return;
      var pages = state.book.pages;
      var tmp = pages[to];
      pages[to] = pages[state.page];
      pages[state.page] = tmp;
      state.page = to;
      changed();
    },
    'set-bg': function (el) {
      currentScene().background = el.getAttribute('data-bg');
      changed();
    },
    'add-shape': function (el) {
      var id = el.getAttribute('data-shape');
      var def = Ehon.shapes.get(id);
      if (!def) return;
      /* 地面のものは足もとが文字の帯の少し上に来るように置く */
      var y = def.zone === 'sky'
        ? 20
        : Math.max(20, Ehon.illustrate.ART_BOTTOM - 2 - def.size * (def.bottom - 50) / 100);
      currentScene().items.push(Ehon.book.normalizeItem({ shape: id, x: 50, y: y, size: def.size }));
      state.item = currentScene().items.length - 1;
      changed();
    },
    'select-item': function (el) {
      state.item = parseInt(el.getAttribute('data-item'), 10);
      render();
    },
    'del-item': function () {
      if (state.item < 0) return;
      currentScene().items.splice(state.item, 1);
      state.item = -1;
      changed();
    },
    'flip-item': function () {
      var it = currentItem();
      if (!it) return;
      it.flip = !it.flip;
      changed();
    },
    'item-layer': function (el) {
      var it = currentItem();
      if (!it) return;
      var items = currentScene().items;
      var to = state.item + parseInt(el.getAttribute('data-dir'), 10);
      if (to < 0 || to >= items.length) return;
      items.splice(state.item, 1);
      items.splice(to, 0, it);
      state.item = to;
      changed();
    },
    'set-color': function (el) {
      var it = currentItem();
      if (!it) return;
      it.color = el.getAttribute('data-color');
      changed();
    },
    'autobuild': function () {
      var text = doc.getElementById('autoText').value;
      if (!text.trim()) {
        root.alert('お話の文を入れてください。');
        return;
      }
      var mode = doc.getElementById('autoLine').checked ? 'line' : 'block';
      if (!root.confirm('いまの絵本を、この文から組みなおします。よろしいですか？')) return;
      state.book = Ehon.autolayout.build(text, { mode: mode, author: state.book.author });
      state.page = 0;
      state.item = -1;
      changed();
    }
  };

  var inputs = {
    title: function (v) { state.book.title = v; },
    author: function (v) { state.book.author = v; },
    text: function (v) { if (state.page >= 0) state.book.pages[state.page].text = v; },
    size: function (v) { var it = currentItem(); if (it) it.size = parseFloat(v); },
    rotate: function (v) { var it = currentItem(); if (it) it.rotate = parseFloat(v); },
    color: function (v) { var it = currentItem(); if (it) it.color = v; }
  };

  /* 入力中は右側を描き直さない（フォーカスが飛ぶので） */
  function onInput(e) {
    var key = e.target.getAttribute && e.target.getAttribute('data-input');
    if (!key || !inputs[key]) return;
    inputs[key](e.target.value);
    drawCanvas();
    drawPageList();
    bindDrag();
    if (state.onChange) state.onChange(state.book);
  }

  function onClick(e) {
    var el = e.target.closest ? e.target.closest('[data-action]') : null;
    if (!el || el.disabled) return;
    var name = el.getAttribute('data-action');
    if (actions[name]) {
      e.preventDefault();
      actions[name](el);
    }
  }

  /* ---------- 公開 ---------- */

  function mount(mountEl, book, onChange) {
    state.mount = mountEl;
    state.book = Ehon.book.normalize(book);
    state.page = 0;
    state.item = -1;
    state.onChange = onChange || null;
    mountEl.innerHTML = shell();
    mountEl.addEventListener('click', onClick);
    mountEl.addEventListener('input', onInput);
    mountEl.addEventListener('change', onInput);
    render();
  }

  function setBook(book, keepPage) {
    state.book = Ehon.book.normalize(book);
    if (!keepPage) state.page = 0;
    state.page = Math.min(state.page, state.book.pages.length - 1);
    state.item = -1;
    changed();
  }

  Ehon.editor = {
    mount: mount,
    setBook: setBook,
    getBook: function () { return state.book; },
    getPageIndex: function () { return state.page; }
  };
})(typeof self !== 'undefined' ? self : this);
