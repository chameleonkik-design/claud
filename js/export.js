/*
 * export.js — 書き出し（JSON / 1枚のHTML / 印刷）
 *
 * HTML 書き出しは全ページを SVG に描いたうえで埋め込むので、
 * 書き出したファイルだけで（このツールなしで）読める。
 */
(function (root) {
  'use strict';
  var Ehon = root.Ehon = root.Ehon || {};
  var doc = root.document;

  function download(filename, text, mime) {
    var blob = new root.Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
    var url = root.URL.createObjectURL(blob);
    var a = doc.createElement('a');
    a.href = url;
    a.download = filename;
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
    root.setTimeout(function () { root.URL.revokeObjectURL(url); }, 1000);
  }

  function saveJson(book) {
    download(Ehon.book.slug(book.title) + '.ehon.json', Ehon.book.stringify(book), 'application/json');
  }

  function allSpreads(book) {
    var out = [Ehon.illustrate.renderCover(book)];
    book.pages.forEach(function (p) { out.push(Ehon.illustrate.renderPage(p)); });
    out.push(Ehon.illustrate.renderPage({ text: 'おしまい', scene: { background: 'sky', items: [] } }));
    return out;
  }

  function esc(s) { return Ehon.illustrate.escape(s); }

  /* 単体で読める HTML を組み立てる */
  function buildHtml(book) {
    var spreads = allSpreads(book);
    var pages = spreads.map(function (svg, i) {
      return '<div class="p' + (i === 0 ? ' on' : '') + '">' + svg + '</div>';
    }).join('\n');

    return '<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
      '<title>' + esc(book.title) + '</title>\n<style>\n' +
      '*{box-sizing:border-box}html,body{margin:0;height:100%}\n' +
      'body{background:#2a2622;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'font-family:' + Ehon.illustrate.FONT + ';color:#fffdf7;overflow:hidden;touch-action:pan-y}\n' +
      '#stage{position:relative;width:min(94vw,94vh - 90px);aspect-ratio:1/1;max-width:760px;' +
      'border-radius:20px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.45);background:#fffdf7}\n' +
      '.p{position:absolute;inset:0;display:none}.p.on{display:block;animation:in .35s ease}\n' +
      '.p svg{width:100%;height:100%;display:block}\n' +
      '@keyframes in{from{opacity:0;transform:translateX(14px) scale(.99)}to{opacity:1;transform:none}}\n' +
      '#bar{display:flex;gap:14px;align-items:center;margin-top:16px}\n' +
      'button{font:inherit;font-size:17px;font-weight:700;color:#2a2622;background:#fffdf7;border:0;' +
      'border-radius:999px;padding:10px 20px;cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.25)}\n' +
      'button:disabled{opacity:.35;cursor:default}\n' +
      '#count{min-width:5em;text-align:center;font-weight:700;letter-spacing:1px}\n' +
      '@media print{body{background:#fff;display:block;overflow:visible}#bar{display:none}\n' +
      '#stage{width:100%;max-width:none;border-radius:0;box-shadow:none;position:static;aspect-ratio:auto}\n' +
      '.p,.p.on{display:block;position:static;page-break-after:always;animation:none}}\n' +
      '</style>\n</head>\n<body>\n' +
      '<div id="stage">\n' + pages + '\n</div>\n' +
      '<div id="bar"><button id="prev">‹ まえ</button><span id="count"></span><button id="next">つぎ ›</button></div>\n' +
      '<script>\n' +
      '(function(){var ps=[].slice.call(document.querySelectorAll(".p")),i=0;\n' +
      'var prev=document.getElementById("prev"),next=document.getElementById("next"),count=document.getElementById("count");\n' +
      'function show(n){i=Math.max(0,Math.min(ps.length-1,n));ps.forEach(function(p,k){p.className="p"+(k===i?" on":"")});\n' +
      'prev.disabled=i===0;next.disabled=i===ps.length-1;count.textContent=(i+1)+" / "+ps.length;}\n' +
      'prev.onclick=function(){show(i-1)};next.onclick=function(){show(i+1)};\n' +
      'document.addEventListener("keydown",function(e){if(e.key==="ArrowRight"||e.key===" ")show(i+1);if(e.key==="ArrowLeft")show(i-1)});\n' +
      'var x0=null,st=document.getElementById("stage");\n' +
      'st.addEventListener("pointerdown",function(e){x0=e.clientX});\n' +
      'st.addEventListener("pointerup",function(e){if(x0===null)return;var d=e.clientX-x0;x0=null;if(Math.abs(d)>40)show(i+(d<0?1:-1));else show(i+1)});\n' +
      'show(0);})();\n' +
      '<\/script>\n</body>\n</html>\n';
  }

  function saveHtml(book) {
    download(Ehon.book.slug(book.title) + '.html', buildHtml(book), 'text/html');
  }

  /* 印刷用の DOM を差し込んでから print する（1ページ 1 枚） */
  function print(book) {
    var old = doc.getElementById('printArea');
    if (old) old.parentNode.removeChild(old);
    var area = doc.createElement('div');
    area.id = 'printArea';
    area.innerHTML = allSpreads(book).map(function (svg) {
      return '<div class="print-sheet">' + svg + '</div>';
    }).join('');
    doc.body.appendChild(area);
    root.setTimeout(function () { root.print(); }, 80);
  }

  Ehon.exporter = {
    download: download,
    saveJson: saveJson,
    saveHtml: saveHtml,
    buildHtml: buildHtml,
    print: print
  };
})(typeof self !== 'undefined' ? self : this);
