/*
 * book.js — 絵本データの型と入れ物
 *
 * {
 *   version: 1,
 *   title: "ころころ ぽーん",
 *   author: "",
 *   age: "0-3",
 *   cover: { scene: { background, items:[] } },
 *   pages: [ { text, scene: { background, items:[] } } ]
 * }
 */
(function (root, factory) {
  var shapes = (typeof module === 'object' && module.exports)
    ? require('./shapes.js')
    : (root.Ehon && root.Ehon.shapes);
  var api = factory(shapes);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.Ehon = root.Ehon || {}).book = api;
})(typeof self !== 'undefined' ? self : this, function (shapes) {
  'use strict';

  var STORAGE_KEY = 'ehon:draft';
  var samples = {};

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function normalizeItem(raw) {
    var def = shapes.get(raw && raw.shape);
    if (!def) return null;
    return {
      shape: raw.shape,
      x: clamp(numOr(raw.x, 50), -20, 120),
      y: clamp(numOr(raw.y, 55), -20, 120),
      size: clamp(numOr(raw.size, def.size), 4, 200),
      color: typeof raw.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(raw.color) ? raw.color : def.color,
      flip: !!raw.flip,
      rotate: clamp(numOr(raw.rotate, 0), -180, 180)
    };
  }

  function numOr(v, fallback) {
    var n = typeof v === 'number' ? v : parseFloat(v);
    return isFinite(n) ? n : fallback;
  }

  function normalizeScene(raw) {
    raw = raw || {};
    var bg = shapes.backgrounds[raw.background] ? raw.background : 'meadow';
    var items = (Array.isArray(raw.items) ? raw.items : []).map(normalizeItem).filter(Boolean);
    return { background: bg, items: items };
  }

  function normalizePage(raw) {
    raw = raw || {};
    return { text: typeof raw.text === 'string' ? raw.text : '', scene: normalizeScene(raw.scene) };
  }

  /* 何が来ても壊れない絵本オブジェクトにして返す */
  function normalize(raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    var pages = (Array.isArray(raw.pages) ? raw.pages : []).map(normalizePage);
    if (!pages.length) pages = [normalizePage({})];
    return {
      version: 1,
      title: typeof raw.title === 'string' && raw.title ? raw.title : 'なまえのないえほん',
      author: typeof raw.author === 'string' ? raw.author : '',
      age: typeof raw.age === 'string' ? raw.age : '0-3',
      cover: { scene: normalizeScene(raw.cover && raw.cover.scene) },
      pages: pages
    };
  }

  function create() {
    return normalize({
      title: 'あたらしいえほん',
      cover: { scene: { background: 'sky', items: [{ shape: 'sun', x: 50, y: 44, size: 40 }] } },
      pages: [{ text: 'ここに ことばを かこう', scene: { background: 'meadow', items: [{ shape: 'cat', x: 50, y: 52, size: 44 }] } }]
    });
  }

  function emptyPage(background) {
    return normalizePage({ text: '', scene: { background: background || 'meadow', items: [] } });
  }

  function clone(book) {
    return JSON.parse(JSON.stringify(book));
  }

  /* --- 保存 / 読み込み（localStorage が使えない環境でも落ちない） --- */
  function save(book) {
    try {
      root_localStorage().setItem(STORAGE_KEY, JSON.stringify(book));
      return true;
    } catch (e) { return false; }
  }
  function load() {
    try {
      var raw = root_localStorage().getItem(STORAGE_KEY);
      return raw ? normalize(JSON.parse(raw)) : null;
    } catch (e) { return null; }
  }
  function root_localStorage() {
    /* eslint-disable-next-line no-undef */
    return (typeof localStorage !== 'undefined') ? localStorage : { getItem: function () { return null; }, setItem: function () {} };
  }

  function parse(json) {
    var data = JSON.parse(json);
    return normalize(data);
  }

  function stringify(book) {
    return JSON.stringify(book, null, 2);
  }

  function registerSample(id, book) { samples[id] = book; }
  function getSample(id) { return samples[id] ? normalize(samples[id]) : null; }
  function sampleIds() { return Object.keys(samples); }

  /* ファイル名に使える文字だけ残す */
  function slug(title) {
    var s = String(title || 'ehon').replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '');
    return s || 'ehon';
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    normalize: normalize,
    normalizeItem: normalizeItem,
    normalizeScene: normalizeScene,
    normalizePage: normalizePage,
    create: create,
    emptyPage: emptyPage,
    clone: clone,
    save: save,
    load: load,
    parse: parse,
    stringify: stringify,
    registerSample: registerSample,
    getSample: getSample,
    sampleIds: sampleIds,
    slug: slug
  };
});
