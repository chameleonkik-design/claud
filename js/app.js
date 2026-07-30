/*
 * app.js — 画面の立ち上げとツールバー
 */
(function (root) {
  'use strict';
  var Ehon = root.Ehon = root.Ehon || {};
  var doc = root.document;

  function init() {
    var mount = doc.getElementById('app');

    /* 前回の下書きがあれば続きから、なければサンプルを開く */
    var start = Ehon.book.load() || Ehon.book.getSample('kororo-pon') || Ehon.book.create();
    Ehon.editor.mount(mount, start, function (book) {
      Ehon.book.save(book);
      doc.getElementById('toolbarTitle').textContent = book.title;
    });
    doc.getElementById('toolbarTitle').textContent = Ehon.editor.getBook().title;

    doc.getElementById('toolbar').addEventListener('click', function (e) {
      var el = e.target.closest('[data-tool]');
      if (!el) return;
      var tool = el.getAttribute('data-tool');
      var book = Ehon.editor.getBook();

      if (tool === 'read') {
        Ehon.reader.open(book, Ehon.editor.getPageIndex() + 1);
      } else if (tool === 'new') {
        if (root.confirm('あたらしい絵本をはじめます。いまの絵本は消えます。よろしいですか？')) {
          Ehon.editor.setBook(Ehon.book.create());
        }
      } else if (tool === 'sample') {
        if (root.confirm('サンプル『ころころ ぽーん』を開きます。いまの絵本は消えます。よろしいですか？')) {
          Ehon.editor.setBook(Ehon.book.getSample('kororo-pon'));
        }
      } else if (tool === 'save') {
        Ehon.exporter.saveJson(book);
      } else if (tool === 'open') {
        doc.getElementById('fileInput').click();
      } else if (tool === 'html') {
        Ehon.exporter.saveHtml(book);
      } else if (tool === 'print') {
        Ehon.exporter.print(book);
      }
    });

    doc.getElementById('fileInput').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new root.FileReader();
      reader.onload = function () {
        try {
          Ehon.editor.setBook(Ehon.book.parse(String(reader.result)));
        } catch (err) {
          root.alert('この絵本ファイルは読めませんでした。\n' + err.message);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof self !== 'undefined' ? self : this);
