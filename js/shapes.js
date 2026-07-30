/*
 * shapes.js — 絵本の絵を組み立てる図形ライブラリ
 *
 * 各シェイプは 100x100 のローカル座標に、中心 (50,50) あたりを基準に描く。
 * bottom は絵の下端（ローカル y）。地面に立たせる位置を計算するのに使う。
 * 返り値は SVG 文字列。DOM に依存しないので Node からも読める。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.Ehon = root.Ehon || {}).shapes = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var INK = '#43362a';

  function toRgb(hex) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function toHex(rgb) {
    return '#' + rgb.map(function (v) {
      var s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return s.length === 1 ? '0' + s : s;
    }).join('');
  }
  function mix(hex, target, amt) {
    var a = toRgb(hex);
    return toHex([0, 1, 2].map(function (i) { return a[i] + (target[i] - a[i]) * amt; }));
  }
  function darken(hex, amt) { return mix(hex, [0, 0, 0], amt); }
  function lighten(hex, amt) { return mix(hex, [255, 255, 255], amt); }

  /* --- 顔のパーツ（どの動物でも同じ表情になるように共通化） --- */
  function eyes(cx, cy, gap, r) {
    return '<circle cx="' + (cx - gap) + '" cy="' + cy + '" r="' + r + '" fill="' + INK + '"/>' +
      '<circle cx="' + (cx + gap) + '" cy="' + cy + '" r="' + r + '" fill="' + INK + '"/>' +
      '<circle cx="' + (cx - gap + r * 0.35) + '" cy="' + (cy - r * 0.38) + '" r="' + (r * 0.32) + '" fill="#fff" opacity=".9"/>' +
      '<circle cx="' + (cx + gap + r * 0.35) + '" cy="' + (cy - r * 0.38) + '" r="' + (r * 0.32) + '" fill="#fff" opacity=".9"/>';
  }
  function smile(cx, cy, w, depth) {
    return '<path d="M' + (cx - w) + ' ' + cy + ' q' + w + ' ' + depth + ' ' + (w * 2) + ' 0" fill="none" stroke="' +
      INK + '" stroke-width="2" stroke-linecap="round"/>';
  }
  function blush(cx, cy, gap, rx) {
    var e = function (x) {
      return '<ellipse cx="' + x + '" cy="' + cy + '" rx="' + rx + '" ry="' + (rx * 0.6) + '" fill="#ff8fa0" opacity=".45"/>';
    };
    return e(cx - gap) + e(cx + gap);
  }
  var S = {};

  /* ============================ どうぶつ ============================ */

  S.cat = {
    label: 'ねこ', category: 'どうぶつ', zone: 'ground', color: '#f2a65a', size: 42, bottom: 97,
    draw: function (c) {
      var d = darken(c, 0.16);
      return '<path d="M72 84 q23 1 19 -22 q-2 -8 -9 -6 q6 17 -12 19 z" fill="' + d + '"/>' +
        '<ellipse cx="50" cy="76" rx="27" ry="21" fill="' + c + '"/>' +
        '<path d="M30 28 L25 8 L43 17 Z" fill="' + c + '"/><path d="M70 28 L75 8 L57 17 Z" fill="' + c + '"/>' +
        '<path d="M31 25 L29 14 L39 19 Z" fill="#ffb7bf"/><path d="M69 25 L71 14 L61 19 Z" fill="#ffb7bf"/>' +
        '<circle cx="50" cy="40" r="25" fill="' + c + '"/>' +
        blush(50, 47, 17, 5) +
        eyes(50, 37, 9, 4) +
        '<path d="M46 45 L54 45 L50 49 Z" fill="#e0707f"/>' +
        smile(50, 50, 5, 5) +
        '<g stroke="' + d + '" stroke-width="1.2" stroke-linecap="round">' +
        '<path d="M24 42 H14"/><path d="M25 47 L15 50"/><path d="M76 42 H86"/><path d="M75 47 L85 50"/></g>';
    }
  };

  S.dog = {
    label: 'いぬ', category: 'どうぶつ', zone: 'ground', color: '#d9a05b', size: 42, bottom: 97,
    draw: function (c) {
      var d = darken(c, 0.2), l = lighten(c, 0.5);
      return '<path d="M76 74 q16 -4 10 -20 q-2 -6 -7 -3 q4 11 -7 14 z" fill="' + d + '"/>' +
        '<ellipse cx="50" cy="77" rx="27" ry="20" fill="' + c + '"/>' +
        '<ellipse cx="26" cy="40" rx="8" ry="15" fill="' + d + '" transform="rotate(-14 26 40)"/>' +
        '<ellipse cx="74" cy="40" rx="8" ry="15" fill="' + d + '" transform="rotate(14 74 40)"/>' +
        '<circle cx="50" cy="41" r="24" fill="' + c + '"/>' +
        '<circle cx="63" cy="33" r="10" fill="' + d + '" opacity=".55"/>' +
        '<ellipse cx="50" cy="52" rx="13" ry="10" fill="' + l + '"/>' +
        eyes(50, 39, 9, 4) +
        '<ellipse cx="50" cy="48" rx="4" ry="3.2" fill="' + INK + '"/>' +
        '<path d="M50 51 v4" stroke="' + INK + '" stroke-width="1.6" stroke-linecap="round"/>' +
        smile(50, 55, 5, 5);
    }
  };

  S.rabbit = {
    label: 'うさぎ', category: 'どうぶつ', zone: 'ground', color: '#f6f1ea', size: 40, bottom: 97,
    draw: function (c) {
      var d = darken(c, 0.1), rim = darken(c, 0.12);
      /* 白い体が背景に溶けないよう、ひとまわり大きい影を先に敷く */
      var body = function (col, k) {
        return '<ellipse cx="50" cy="78" rx="' + (23 + k) + '" ry="' + (19 + k) + '" fill="' + col + '"/>' +
          '<ellipse cx="40" cy="18" rx="' + (6.5 + k) + '" ry="' + (18 + k) + '" fill="' + col + '" transform="rotate(-9 40 18)"/>' +
          '<ellipse cx="60" cy="18" rx="' + (6.5 + k) + '" ry="' + (18 + k) + '" fill="' + col + '" transform="rotate(9 60 18)"/>' +
          '<circle cx="50" cy="45" r="' + (22 + k) + '" fill="' + col + '"/>';
      };
      return '<circle cx="76" cy="80" r="7.6" fill="' + rim + '"/>' +
        '<circle cx="76" cy="80" r="6.2" fill="' + lighten(c, 0.3) + '"/>' +
        body(rim, 1.7) + body(c, 0) +
        '<ellipse cx="40" cy="19" rx="3" ry="12" fill="#ffb7bf" transform="rotate(-9 40 19)"/>' +
        '<ellipse cx="60" cy="19" rx="3" ry="12" fill="#ffb7bf" transform="rotate(9 60 19)"/>' +
        blush(50, 51, 15, 4.5) +
        eyes(50, 43, 8, 3.6) +
        '<path d="M47 50 L53 50 L50 53 Z" fill="#e0707f"/>' +
        smile(50, 54, 4.5, 4.5) +
        '<g stroke="' + d + '" stroke-width="1" stroke-linecap="round"><path d="M27 48 H18"/><path d="M73 48 H82"/></g>';
    }
  };

  S.bear = {
    label: 'くま', category: 'どうぶつ', zone: 'ground', color: '#c08552', size: 44, bottom: 97,
    draw: function (c) {
      var d = darken(c, 0.18), l = lighten(c, 0.45);
      return '<ellipse cx="50" cy="76" rx="28" ry="21" fill="' + c + '"/>' +
        '<ellipse cx="50" cy="80" rx="15" ry="13" fill="' + l + '"/>' +
        '<circle cx="29" cy="24" r="10" fill="' + c + '"/><circle cx="71" cy="24" r="10" fill="' + c + '"/>' +
        '<circle cx="29" cy="24" r="5" fill="' + d + '"/><circle cx="71" cy="24" r="5" fill="' + d + '"/>' +
        '<circle cx="50" cy="43" r="25" fill="' + c + '"/>' +
        '<ellipse cx="50" cy="53" rx="13" ry="10" fill="' + l + '"/>' +
        blush(50, 50, 19, 5) +
        eyes(50, 40, 9, 4) +
        '<ellipse cx="50" cy="49" rx="4.2" ry="3.2" fill="' + INK + '"/>' +
        smile(50, 56, 5, 5);
    }
  };

  S.elephant = {
    label: 'ぞう', category: 'どうぶつ', zone: 'ground', color: '#9fb4c7', size: 50, bottom: 96,
    draw: function (c) {
      var d = darken(c, 0.16);
      return '<path d="M14 62 q-10 -4 -10 -14 q0 -4 4 -3 q0 9 8 11 z" fill="' + d + '"/>' +
        '<ellipse cx="38" cy="62" rx="30" ry="23" fill="' + c + '"/>' +
        '<rect x="20" y="78" width="14" height="18" rx="7" fill="' + d + '"/>' +
        '<rect x="46" y="78" width="14" height="18" rx="7" fill="' + d + '"/>' +
        '<circle cx="68" cy="46" r="24" fill="' + c + '"/>' +
        '<ellipse cx="55" cy="40" rx="14" ry="17" fill="' + d + '" transform="rotate(-12 55 40)"/>' +
        '<path d="M78 58 q11 11 6 24 q-2 8 5 10" fill="none" stroke="' + c + '" stroke-width="12" stroke-linecap="round"/>' +
        blush(70, 54, 14, 4.5) +
        eyes(70, 44, 9, 3.8);
    }
  };

  S.bird = {
    label: 'ことり', category: 'どうぶつ', zone: 'any', color: '#7ec8e3', size: 30, bottom: 86,
    draw: function (c) {
      var d = darken(c, 0.2);
      return '<g stroke="' + INK + '" stroke-width="2" stroke-linecap="round"><path d="M44 74 v10"/><path d="M56 74 v10"/></g>' +
        '<path d="M32 50 L4 34 L12 60 Z" fill="' + d + '"/>' +
        '<ellipse cx="48" cy="56" rx="24" ry="20" fill="' + c + '"/>' +
        '<ellipse cx="46" cy="60" rx="13" ry="10" fill="' + d + '" transform="rotate(-16 46 60)"/>' +
        '<circle cx="66" cy="38" r="15" fill="' + c + '"/>' +
        '<path d="M79 34 L93 40 L79 45 Z" fill="#f5a623"/>' +
        '<circle cx="69" cy="35" r="3.2" fill="' + INK + '"/>' +
        '<circle cx="70" cy="34" r="1.1" fill="#fff"/>' +
        blush(69, 42, 0, 3.5);
    }
  };

  S.fish = {
    label: 'さかな', category: 'どうぶつ', zone: 'any', color: '#ff9f6b', size: 38, bottom: 72,
    draw: function (c) {
      var d = darken(c, 0.18);
      return '<path d="M64 52 L97 28 Q88 52 97 76 Z" fill="' + d + '"/>' +
        '<ellipse cx="46" cy="52" rx="28" ry="20" fill="' + c + '"/>' +
        '<path d="M38 34 Q48 16 60 33 Z" fill="' + d + '"/>' +
        '<path d="M44 71 Q52 84 60 70 Z" fill="' + d + '"/>' +
        '<ellipse cx="52" cy="58" rx="12" ry="8" fill="' + lighten(c, 0.35) + '"/>' +
        '<circle cx="32" cy="46" r="5.5" fill="#fff"/><circle cx="31" cy="46" r="2.8" fill="' + INK + '"/>' +
        smile(30, 56, 4, 4);
    }
  };

  S.frog = {
    label: 'かえる', category: 'どうぶつ', zone: 'ground', color: '#8ecf6b', size: 40, bottom: 88,
    draw: function (c) {
      var d = darken(c, 0.2);
      return '<ellipse cx="24" cy="80" rx="12" ry="7" fill="' + d + '"/><ellipse cx="76" cy="80" rx="12" ry="7" fill="' + d + '"/>' +
        '<ellipse cx="50" cy="66" rx="28" ry="23" fill="' + c + '"/>' +
        '<ellipse cx="50" cy="72" rx="17" ry="14" fill="' + lighten(c, 0.45) + '"/>' +
        '<ellipse cx="50" cy="44" rx="26" ry="20" fill="' + c + '"/>' +
        '<circle cx="35" cy="30" r="9" fill="' + c + '"/><circle cx="65" cy="30" r="9" fill="' + c + '"/>' +
        '<circle cx="35" cy="30" r="6" fill="#fff"/><circle cx="65" cy="30" r="6" fill="#fff"/>' +
        '<circle cx="35" cy="31" r="3" fill="' + INK + '"/><circle cx="65" cy="31" r="3" fill="' + INK + '"/>' +
        blush(50, 46, 19, 5) +
        smile(50, 46, 12, 8);
    }
  };

  S.sheep = {
    label: 'ひつじ', category: 'どうぶつ', zone: 'ground', color: '#fbf6ee', size: 44, bottom: 94,
    draw: function (c) {
      var rim = darken(c, 0.14);
      var pts = [[28, 58], [42, 50], [56, 50], [68, 58], [34, 72], [50, 75], [64, 72]];
      var puff = function (col, k) {
        var out = '';
        for (var i = 0; i < pts.length; i++) {
          out += '<circle cx="' + pts[i][0] + '" cy="' + pts[i][1] + '" r="' + (15 + k) + '" fill="' + col + '"/>';
        }
        return out;
      };
      return '<g stroke="#6b5b52" stroke-width="5" stroke-linecap="round"><path d="M38 84 v10"/><path d="M62 84 v10"/></g>' +
        puff(rim, 1.8) + puff(c, 0) +
        '<ellipse cx="76" cy="42" rx="15" ry="16" fill="#7a675d"/>' +
        '<ellipse cx="62" cy="34" rx="7" ry="5" fill="#63534b" transform="rotate(-25 62 34)"/>' +
        '<circle cx="72" cy="39" r="3" fill="#fff"/><circle cx="72" cy="39" r="1.5" fill="' + INK + '"/>' +
        '<circle cx="83" cy="39" r="3" fill="#fff"/><circle cx="83" cy="39" r="1.5" fill="' + INK + '"/>' +
        '<path d="M73 49 q5 4 9 0" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>' +
        '<circle cx="76" cy="26" r="11" fill="' + c + '"/>';
    }
  };

  S.pig = {
    label: 'ぶた', category: 'どうぶつ', zone: 'ground', color: '#f7b0c0', size: 42, bottom: 97,
    draw: function (c) {
      var d = darken(c, 0.16);
      return '<path d="M78 74 q12 0 10 -10 q-1 -5 -5 -3 q3 7 -6 7 z" fill="' + d + '"/>' +
        '<ellipse cx="50" cy="76" rx="28" ry="21" fill="' + c + '"/>' +
        '<path d="M31 26 L28 12 L44 20 Z" fill="' + d + '"/><path d="M69 26 L72 12 L56 20 Z" fill="' + d + '"/>' +
        '<circle cx="50" cy="44" r="24" fill="' + c + '"/>' +
        blush(50, 50, 18, 5) +
        eyes(50, 40, 9, 3.8) +
        '<ellipse cx="50" cy="52" rx="10" ry="7.5" fill="' + d + '"/>' +
        '<circle cx="46.5" cy="52" r="1.7" fill="' + INK + '"/><circle cx="53.5" cy="52" r="1.7" fill="' + INK + '"/>';
    }
  };

  /* ============================ しぜん ============================ */

  S.sun = {
    label: 'おひさま', category: 'しぜん', zone: 'sky', color: '#ffd24a', size: 34, bottom: 94,
    draw: function (c) {
      var rays = '';
      for (var i = 0; i < 12; i++) {
        var a = i * Math.PI / 6;
        rays += '<path d="M' + (50 + Math.cos(a) * 29) + ' ' + (50 + Math.sin(a) * 29) +
          ' L' + (50 + Math.cos(a) * 44) + ' ' + (50 + Math.sin(a) * 44) +
          '" stroke="' + c + '" stroke-width="6" stroke-linecap="round"/>';
      }
      return rays + '<circle cx="50" cy="50" r="29" fill="' + c + '"/>' +
        blush(50, 56, 15, 5) + eyes(50, 46, 9, 3.6) + smile(50, 56, 6, 6);
    }
  };

  S.moon = {
    label: 'おつきさま', category: 'しぜん', zone: 'sky', color: '#ffe9a8', size: 34, bottom: 92,
    draw: function (c) {
      return '<path d="M64 8 C10 12 10 88 64 92 C30 74 30 26 64 8 Z" fill="' + c + '"/>' +
        '<circle cx="34" cy="42" r="3.6" fill="' + INK + '"/>' +
        '<circle cx="35" cy="41" r="1.2" fill="#fff"/>' +
        '<path d="M30 54 q6 6 12 1" fill="none" stroke="' + INK + '" stroke-width="2.2" stroke-linecap="round"/>' +
        '<ellipse cx="26" cy="50" rx="5" ry="3.2" fill="#ff8fa0" opacity=".45"/>';
    }
  };

  S.star = {
    label: 'ほし', category: 'しぜん', zone: 'sky', color: '#ffe066', size: 20, bottom: 90,
    draw: function (c) {
      var p = '';
      for (var i = 0; i < 10; i++) {
        var r = i % 2 ? 17 : 40, a = -Math.PI / 2 + i * Math.PI / 5;
        p += (i ? ' L' : 'M') + (50 + Math.cos(a) * r).toFixed(1) + ' ' + (50 + Math.sin(a) * r).toFixed(1);
      }
      return '<path d="' + p + ' Z" fill="' + c + '"/>';
    }
  };

  S.cloud = {
    label: 'くも', category: 'しぜん', zone: 'sky', color: '#ffffff', size: 40, bottom: 72,
    draw: function (c) {
      return '<g fill="' + c + '"><circle cx="34" cy="56" r="16"/><circle cx="52" cy="46" r="21"/>' +
        '<circle cx="70" cy="57" r="15"/><rect x="18" y="56" width="64" height="16" rx="8"/></g>';
    }
  };

  S.tree = {
    label: 'き', category: 'しぜん', zone: 'ground', color: '#6cc069', size: 46, bottom: 94,
    draw: function (c) {
      var d = darken(c, 0.18);
      return '<rect x="45" y="56" width="10" height="38" rx="5" fill="#a9784a"/>' +
        '<circle cx="32" cy="48" r="16" fill="' + d + '"/><circle cx="68" cy="48" r="16" fill="' + d + '"/>' +
        '<circle cx="50" cy="36" r="23" fill="' + c + '"/>' +
        '<circle cx="38" cy="34" r="3.5" fill="#ff6b6b"/><circle cx="60" cy="43" r="3.5" fill="#ff6b6b"/>';
    }
  };

  S.flower = {
    label: 'おはな', category: 'しぜん', zone: 'ground', color: '#ff8fb1', size: 26, bottom: 90,
    draw: function (c) {
      var petals = '';
      for (var i = 0; i < 6; i++) {
        var a = i * Math.PI / 3;
        petals += '<circle cx="' + (50 + Math.cos(a) * 15).toFixed(1) + '" cy="' + (36 + Math.sin(a) * 15).toFixed(1) + '" r="10" fill="' + c + '"/>';
      }
      return '<path d="M50 40 v50" stroke="#5aa85a" stroke-width="5" stroke-linecap="round"/>' +
        '<ellipse cx="64" cy="66" rx="11" ry="6" fill="#5aa85a" transform="rotate(20 64 66)"/>' +
        petals + '<circle cx="50" cy="36" r="9" fill="#ffd54a"/>';
    }
  };

  S.butterfly = {
    label: 'ちょうちょ', category: 'しぜん', zone: 'any', color: '#c39bf0', size: 28, bottom: 76,
    draw: function (c) {
      var d = darken(c, 0.16);
      return '<g stroke="' + INK + '" stroke-width="1.6" stroke-linecap="round" fill="none">' +
        '<path d="M48 34 q-8 -10 -14 -12"/><path d="M52 34 q8 -10 14 -12"/></g>' +
        '<ellipse cx="30" cy="42" rx="19" ry="15" fill="' + c + '" transform="rotate(-18 30 42)"/>' +
        '<ellipse cx="70" cy="42" rx="19" ry="15" fill="' + c + '" transform="rotate(18 70 42)"/>' +
        '<ellipse cx="34" cy="66" rx="14" ry="12" fill="' + d + '"/><ellipse cx="66" cy="66" rx="14" ry="12" fill="' + d + '"/>' +
        '<rect x="46" y="32" width="8" height="42" rx="4" fill="' + INK + '"/>';
    }
  };

  S.apple = {
    label: 'りんご', category: 'たべもの', zone: 'ground', color: '#f4614f', size: 24, bottom: 88,
    draw: function (c) {
      return '<path d="M50 26 q-4 -12 -14 -14" stroke="#8a5a3b" stroke-width="4" fill="none" stroke-linecap="round"/>' +
        '<ellipse cx="64" cy="20" rx="12" ry="7" fill="#6cc069" transform="rotate(-20 64 20)"/>' +
        '<path d="M50 30 q26 -6 30 24 q3 30 -30 34 q-33 -4 -30 -34 q4 -30 30 -24 z" fill="' + c + '"/>' +
        '<ellipse cx="38" cy="48" rx="7" ry="10" fill="#fff" opacity=".35" transform="rotate(-20 38 48)"/>';
    }
  };

  S.cake = {
    label: 'ケーキ', category: 'たべもの', zone: 'ground', color: '#ffd9e4', size: 34, bottom: 95,
    draw: function (c) {
      return '<ellipse cx="50" cy="88" rx="38" ry="7" fill="#e8e0d5"/>' +
        '<rect x="18" y="58" width="64" height="28" rx="6" fill="#f6c98e"/>' +
        '<rect x="18" y="52" width="64" height="12" rx="6" fill="' + c + '"/>' +
        '<rect x="28" y="34" width="44" height="22" rx="6" fill="#f6c98e"/>' +
        '<rect x="28" y="30" width="44" height="10" rx="5" fill="' + c + '"/>' +
        '<rect x="47" y="12" width="6" height="18" rx="3" fill="#7ec8e3"/>' +
        '<path d="M50 4 q6 6 0 10 q-6 -4 0 -10 z" fill="#ffb03a"/>' +
        '<g fill="#ff6b8a"><circle cx="34" cy="70" r="2.6"/><circle cx="50" cy="76" r="2.6"/><circle cx="66" cy="70" r="2.6"/></g>';
    }
  };

  /* ============================ もの ============================ */

  S.ball = {
    label: 'ボール', category: 'もの', zone: 'ground', color: '#ff6b6b', size: 30, bottom: 84,
    draw: function (c) {
      return '<circle cx="50" cy="50" r="34" fill="' + c + '"/>' +
        '<ellipse cx="50" cy="50" rx="34" ry="12" fill="#fff" opacity=".6"/>' +
        '<ellipse cx="50" cy="50" rx="12" ry="34" fill="#fff" opacity=".6"/>' +
        '<circle cx="38" cy="36" r="6" fill="#fff" opacity=".5"/>';
    }
  };

  S.balloon = {
    label: 'ふうせん', category: 'もの', zone: 'any', color: '#ff8fb1', size: 26, bottom: 96,
    draw: function (c) {
      return '<path d="M50 56 q-4 18 4 40" stroke="' + INK + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
        '<ellipse cx="50" cy="34" rx="26" ry="30" fill="' + c + '"/>' +
        '<path d="M44 62 L56 62 L50 70 Z" fill="' + darken(c, 0.2) + '"/>' +
        '<ellipse cx="40" cy="24" rx="6" ry="9" fill="#fff" opacity=".4" transform="rotate(-20 40 24)"/>';
    }
  };

  S.house = {
    label: 'おうち', category: 'もの', zone: 'ground', color: '#ffd08a', size: 44, bottom: 88,
    draw: function (c) {
      return '<rect x="24" y="46" width="52" height="42" rx="4" fill="' + c + '"/>' +
        '<path d="M14 50 L50 16 L86 50 Z" fill="#e07a5f"/>' +
        '<rect x="64" y="20" width="9" height="16" rx="3" fill="#c9614a"/>' +
        '<rect x="42" y="62" width="16" height="26" rx="3" fill="#a9784a"/>' +
        '<circle cx="54" cy="75" r="1.8" fill="#ffe9a8"/>' +
        '<rect x="28" y="54" width="12" height="12" rx="2" fill="#bfe6f5"/>' +
        '<rect x="60" y="54" width="12" height="12" rx="2" fill="#bfe6f5"/>';
    }
  };

  S.car = {
    label: 'くるま', category: 'もの', zone: 'ground', color: '#5bb8e8', size: 42, bottom: 89,
    draw: function (c) {
      return '<rect x="10" y="52" width="80" height="24" rx="11" fill="' + c + '"/>' +
        '<path d="M28 52 L36 34 h28 l10 18 z" fill="' + lighten(c, 0.2) + '"/>' +
        '<rect x="38" y="37" width="22" height="13" rx="3" fill="#dff3fb"/>' +
        '<circle cx="30" cy="78" r="11" fill="' + INK + '"/><circle cx="70" cy="78" r="11" fill="' + INK + '"/>' +
        '<circle cx="30" cy="78" r="4.5" fill="#e8e0d5"/><circle cx="70" cy="78" r="4.5" fill="#e8e0d5"/>' +
        '<circle cx="86" cy="60" r="3.4" fill="#ffe066"/>';
    }
  };

  S.train = {
    label: 'でんしゃ', category: 'もの', zone: 'ground', color: '#6fbf73', size: 46, bottom: 91,
    draw: function (c) {
      return '<g fill="#fff" opacity=".85"><circle cx="24" cy="16" r="7"/><circle cx="36" cy="9" r="5"/></g>' +
        '<rect x="12" y="36" width="76" height="40" rx="8" fill="' + c + '"/>' +
        '<rect x="16" y="24" width="16" height="14" rx="4" fill="' + darken(c, 0.15) + '"/>' +
        '<rect x="20" y="44" width="20" height="16" rx="3" fill="#dff3fb"/>' +
        '<rect x="48" y="44" width="16" height="16" rx="3" fill="#dff3fb"/>' +
        '<rect x="68" y="44" width="14" height="16" rx="3" fill="#dff3fb"/>' +
        '<rect x="8" y="72" width="84" height="6" rx="3" fill="' + darken(c, 0.3) + '"/>' +
        '<circle cx="28" cy="82" r="9" fill="' + INK + '"/><circle cx="52" cy="82" r="9" fill="' + INK + '"/><circle cx="76" cy="82" r="9" fill="' + INK + '"/>' +
        '<g fill="#e8e0d5"><circle cx="28" cy="82" r="3.6"/><circle cx="52" cy="82" r="3.6"/><circle cx="76" cy="82" r="3.6"/></g>';
    }
  };

  /* ============================ はいけい ============================ */

  var BG = {};

  BG.meadow = {
    label: 'くさはら',
    draw: function () {
      return '<rect width="100" height="100" fill="#daf0fb"/>' +
        '<circle cx="14" cy="50" r="22" fill="#b7e2a8"/><circle cx="86" cy="48" r="26" fill="#b7e2a8"/>' +
        '<rect y="54" width="100" height="46" fill="#9ad884"/>' +
        '<g fill="#fff" opacity=".85"><circle cx="20" cy="18" r="7"/><circle cx="30" cy="15" r="9"/><circle cx="40" cy="19" r="6"/></g>' +
        '<g fill="#ffe066"><circle cx="8" cy="60" r="1.8"/><circle cx="26" cy="64" r="1.8"/><circle cx="76" cy="61" r="1.8"/><circle cx="94" cy="65" r="1.8"/></g>';
    }
  };

  BG.sky = {
    label: 'そら',
    draw: function () {
      return '<rect width="100" height="100" fill="#bfe4fa"/>' +
        '<g fill="#fff" opacity=".9">' +
        '<circle cx="16" cy="24" r="8"/><circle cx="27" cy="20" r="11"/><circle cx="38" cy="25" r="7"/>' +
        '<circle cx="66" cy="50" r="7"/><circle cx="77" cy="46" r="10"/><circle cx="88" cy="51" r="6"/>' +
        '<circle cx="30" cy="60" r="6"/><circle cx="40" cy="57" r="8"/><circle cx="50" cy="61" r="5"/></g>';
    }
  };

  BG.sea = {
    label: 'うみ',
    draw: function () {
      return '<rect width="100" height="100" fill="#cdeefb"/>' +
        '<rect y="34" width="100" height="66" fill="#79c6e8"/>' +
        '<path d="M0 36 q12 -6 25 0 t25 0 t25 0 t25 0 v6 H0 z" fill="#a8ddf2"/>' +
        '<g fill="#fff" opacity=".45"><circle cx="18" cy="54" r="3"/><circle cx="24" cy="46" r="2"/><circle cx="86" cy="58" r="3.5"/><circle cx="92" cy="48" r="2"/></g>';
    }
  };

  BG.night = {
    label: 'よぞら',
    draw: function () {
      var st = '', pts = [[10, 14], [24, 26], [38, 12], [56, 20], [72, 10], [86, 24], [18, 40], [90, 44], [64, 36]];
      for (var i = 0; i < pts.length; i++) {
        st += '<circle cx="' + pts[i][0] + '" cy="' + pts[i][1] + '" r="' + (1 + (i % 3) * 0.6) + '" fill="#fff8d6"/>';
      }
      return '<rect width="100" height="100" fill="#2f3f72"/>' +
        '<rect y="54" width="100" height="46" fill="#3b4d86"/>' +
        '<circle cx="16" cy="52" r="20" fill="#46598f"/><circle cx="84" cy="54" r="22" fill="#46598f"/>' +
        st;
    }
  };

  BG.room = {
    label: 'おへや',
    draw: function () {
      return '<rect width="100" height="100" fill="#fdeacb"/>' +
        '<rect y="56" width="100" height="44" fill="#e3bf93"/>' +
        '<rect y="54" width="100" height="4" fill="#c99f74"/>' +
        '<rect x="62" y="12" width="28" height="28" rx="3" fill="#bfe4fa" stroke="#fff" stroke-width="4"/>' +
        '<path d="M76 12 v28 M62 26 h28" stroke="#fff" stroke-width="3"/>' +
        '<circle cx="81" cy="21" r="5" fill="#ffe9a8"/>' +
        '<rect x="8" y="36" width="24" height="20" rx="4" fill="#f3c9c2"/>' +
        '<rect x="12" y="40" width="16" height="7" rx="3.5" fill="#fff" opacity=".7"/>';
    }
  };

  BG.snow = {
    label: 'ゆき',
    draw: function () {
      var f = '', pts = [[14, 20], [30, 34], [48, 16], [64, 30], [80, 18], [92, 38], [22, 50], [70, 52]];
      for (var i = 0; i < pts.length; i++) f += '<circle cx="' + pts[i][0] + '" cy="' + pts[i][1] + '" r="' + (1.4 + (i % 2)) + '" fill="#fff"/>';
      return '<rect width="100" height="100" fill="#dceefc"/>' + f +
        '<circle cx="16" cy="56" r="22" fill="#fff"/><circle cx="84" cy="58" r="24" fill="#fff"/>' +
        '<rect y="60" width="100" height="40" fill="#fff"/>';
    }
  };

  var order = ['どうぶつ', 'しぜん', 'たべもの', 'もの'];

  return {
    INK: INK,
    items: S,
    backgrounds: BG,
    categories: order,
    ids: Object.keys(S),
    backgroundIds: Object.keys(BG),
    get: function (id) { return S[id] || null; },
    /* 絵の下端がページ上のどこに来るか（y と size から） */
    bottomOf: function (id, y, size) {
      var def = S[id];
      return y + size * (((def && def.bottom) || 95) - 50) / 100;
    },
    background: function (id) { return BG[id] || BG.meadow; },
    byCategory: function () {
      return order.map(function (cat) {
        return {
          name: cat,
          ids: Object.keys(S).filter(function (id) { return S[id].category === cat; })
        };
      });
    },
    darken: darken,
    lighten: lighten
  };
});
