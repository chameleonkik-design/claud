/*
 * reader.js — できた絵本を読むビュー
 *
 * 表紙 → 1ページ → … → おしまい。
 * クリック / ←→キー / スワイプでめくる。読み上げボタンつき。
 */
(function (root) {
  'use strict';
  var Ehon = root.Ehon = root.Ehon || {};

  var el = null, book = null, index = 0, speaking = false;

  function spreadCount() { return book.pages.length + 2; }

  function html() {
    return '' +
      '<div class="reader__stage">' +
      '  <div class="reader__page" id="readerPage"></div>' +
      '  <button class="reader__nav reader__nav--prev" id="readerPrev" aria-label="まえのページ">‹</button>' +
      '  <button class="reader__nav reader__nav--next" id="readerNext" aria-label="つぎのページ">›</button>' +
      '</div>' +
      '<div class="reader__bar">' +
      '  <button class="btn btn--ghost" id="readerClose">✕ とじる</button>' +
      '  <div class="reader__dots" id="readerDots"></div>' +
      '  <button class="btn btn--ghost" id="readerSpeak">🔊 よみあげ</button>' +
      '</div>';
  }

  function currentText() {
    if (index === 0) return book.title;
    if (index === spreadCount() - 1) return 'おしまい';
    return book.pages[index - 1].text;
  }

  function draw(direction) {
    var host = el.querySelector('#readerPage');
    var svg;
    if (index === 0) {
      svg = Ehon.illustrate.renderCover(book);
    } else if (index === spreadCount() - 1) {
      svg = Ehon.illustrate.renderPage({ text: 'おしまい', scene: { background: 'sky', items: [] } });
    } else {
      svg = Ehon.illustrate.renderPage(book.pages[index - 1]);
    }
    host.innerHTML = svg;
    var page = host.firstChild;
    if (page && page.classList) {
      page.classList.add(direction === 'prev' ? 'is-turn-back' : 'is-turn');
    }
    el.querySelector('#readerPrev').disabled = index === 0;
    el.querySelector('#readerNext').disabled = index === spreadCount() - 1;
    drawDots();
  }

  function drawDots() {
    var out = '';
    for (var i = 0; i < spreadCount(); i++) {
      out += '<button class="reader__dot' + (i === index ? ' is-on' : '') + '" data-go="' + i + '" aria-label="' + (i + 1) + 'ページ"></button>';
    }
    el.querySelector('#readerDots').innerHTML = out;
  }

  function go(next, direction) {
    var target = Math.max(0, Math.min(spreadCount() - 1, next));
    if (target === index) return;
    var dir = direction || (target > index ? 'next' : 'prev');
    index = target;
    draw(dir);
    if (speaking) speak();
  }

  function speak() {
    if (!root.speechSynthesis) return;
    root.speechSynthesis.cancel();
    var text = currentText();
    if (!text) return;
    var u = new root.SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = 0.85;
    u.pitch = 1.15;
    root.speechSynthesis.speak(u);
  }

  function onKey(e) {
    if (!el) return;
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); go(index + 1, 'next'); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1, 'prev'); }
    else if (e.key === 'Escape') close();
  }

  function bindSwipe(stage) {
    var x0 = null;
    stage.addEventListener('pointerdown', function (e) { x0 = e.clientX; });
    stage.addEventListener('pointerup', function (e) {
      if (x0 == null) return;
      var dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1), dx < 0 ? 'next' : 'prev');
    });
    stage.addEventListener('pointercancel', function () { x0 = null; });
  }

  function open(b, startIndex) {
    if (el) close();
    book = Ehon.book.normalize(b);
    index = Math.max(0, Math.min(book.pages.length + 1, startIndex || 0));
    el = root.document.createElement('div');
    el.className = 'reader';
    el.innerHTML = html();
    root.document.body.appendChild(el);
    root.document.body.classList.add('is-reading');

    el.querySelector('#readerPrev').addEventListener('click', function () { go(index - 1, 'prev'); });
    el.querySelector('#readerNext').addEventListener('click', function () { go(index + 1, 'next'); });
    el.querySelector('#readerClose').addEventListener('click', close);
    el.querySelector('#readerSpeak').addEventListener('click', function () {
      speaking = !speaking;
      this.classList.toggle('is-on', speaking);
      if (speaking) speak();
      else if (root.speechSynthesis) root.speechSynthesis.cancel();
    });
    el.querySelector('#readerDots').addEventListener('click', function (e) {
      var go2 = e.target.getAttribute && e.target.getAttribute('data-go');
      if (go2 != null) go(parseInt(go2, 10));
    });
    bindSwipe(el.querySelector('#readerPage'));
    root.addEventListener('keydown', onKey);
    draw('next');
  }

  function close() {
    if (!el) return;
    if (root.speechSynthesis) root.speechSynthesis.cancel();
    speaking = false;
    root.removeEventListener('keydown', onKey);
    root.document.body.classList.remove('is-reading');
    el.parentNode.removeChild(el);
    el = null;
  }

  Ehon.reader = { open: open, close: close };
})(typeof self !== 'undefined' ? self : this);
