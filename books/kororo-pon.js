/*
 * books/kororo-pon.js — サンプル絵本『ころころ ぽーん』(0〜3歳)
 *
 * ねらい：
 *  - 「ころころ」「ぽーん」のくりかえしで、めくるリズムをつくる
 *  - 1ページ 1 行。オノマトペと呼びかけだけで進む
 *  - くさはら → うみ → そら → よぞら と場面が移り、最後は おやすみ で閉じる
 */
(function (root, factory) {
  var data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  else if (root.Ehon && root.Ehon.book) root.Ehon.book.registerSample('kororo-pon', data);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RED = '#ff6b6b';

  return {
    version: 1,
    title: 'ころころ ぽーん',
    author: '',
    age: '0-3',
    cover: {
      scene: {
        background: 'meadow',
        items: [
          { shape: 'flower', x: 91, y: 80, size: 22 },
          { shape: 'cat', x: 25, y: 64, size: 42 },
          { shape: 'ball', x: 50, y: 76, size: 30, color: RED },
          { shape: 'dog', x: 75, y: 64, size: 42, flip: true }
        ]
      }
    },
    pages: [
      {
        text: 'ころころ ころころ',
        scene: {
          background: 'meadow',
          items: [
            { shape: 'sun', x: 80, y: 17, size: 28 },
            { shape: 'ball', x: 26, y: 54, size: 26, color: RED }
          ]
        }
      },
      {
        text: 'あっ　ねこさん',
        scene: {
          background: 'meadow',
          items: [
            { shape: 'cat', x: 66, y: 43, size: 44, flip: true },
            { shape: 'ball', x: 24, y: 54, size: 26, color: RED }
          ]
        }
      },
      {
        text: 'にゃあ にゃあ　ぽーん！',
        scene: {
          background: 'meadow',
          items: [
            { shape: 'sun', x: 14, y: 15, size: 24 },
            { shape: 'cat', x: 34, y: 43, size: 44 },
            { shape: 'ball', x: 74, y: 20, size: 24, color: RED }
          ]
        }
      },
      {
        text: 'ころころ ころころ',
        scene: {
          background: 'meadow',
          items: [
            { shape: 'tree', x: 76, y: 42, size: 46 },
            { shape: 'ball', x: 28, y: 54, size: 26, color: RED }
          ]
        }
      },
      {
        text: 'あっ　いぬさん',
        scene: {
          background: 'meadow',
          items: [
            { shape: 'dog', x: 66, y: 43, size: 44, flip: true },
            { shape: 'ball', x: 24, y: 54, size: 26, color: RED }
          ]
        }
      },
      {
        text: 'わん わん　ぽーん！',
        scene: {
          background: 'meadow',
          items: [
            { shape: 'cloud', x: 18, y: 18, size: 34 },
            { shape: 'dog', x: 34, y: 43, size: 44 },
            { shape: 'ball', x: 76, y: 18, size: 24, color: RED }
          ]
        }
      },
      {
        text: 'ころころ　ぽちゃん',
        scene: {
          background: 'sea',
          items: [
            { shape: 'ball', x: 56, y: 26, size: 24, color: RED },
            { shape: 'fish', x: 26, y: 50, size: 32 }
          ]
        }
      },
      {
        text: 'おさかなさん　すいすい',
        scene: {
          background: 'sea',
          items: [
            { shape: 'ball', x: 58, y: 18, size: 22, color: RED },
            { shape: 'fish', x: 28, y: 44, size: 34 },
            { shape: 'fish', x: 68, y: 56, size: 28, color: '#ffd24a', flip: true }
          ]
        }
      },
      {
        text: 'ふわり ふわり　そらへ',
        scene: {
          background: 'sky',
          items: [
            { shape: 'cloud', x: 76, y: 48, size: 36 },
            { shape: 'bird', x: 22, y: 46, size: 32 },
            { shape: 'ball', x: 52, y: 24, size: 24, color: RED }
          ]
        }
      },
      {
        text: 'おつきさま　こんばんは',
        scene: {
          background: 'night',
          items: [
            { shape: 'star', x: 14, y: 20, size: 16 },
            { shape: 'star', x: 48, y: 12, size: 12 },
            { shape: 'moon', x: 72, y: 24, size: 36 },
            { shape: 'ball', x: 28, y: 38, size: 22, color: RED }
          ]
        }
      },
      {
        text: 'ころころ…　ころ…',
        scene: {
          background: 'night',
          items: [
            { shape: 'moon', x: 84, y: 16, size: 24 },
            { shape: 'cat', x: 32, y: 45, size: 40 },
            { shape: 'dog', x: 68, y: 45, size: 40, flip: true },
            { shape: 'ball', x: 50, y: 58, size: 18, color: RED }
          ]
        }
      },
      {
        text: 'みんな おやすみ　ぽーん',
        scene: {
          background: 'night',
          items: [
            { shape: 'star', x: 18, y: 18, size: 16 },
            { shape: 'star', x: 82, y: 20, size: 14 },
            { shape: 'moon', x: 50, y: 30, size: 38 },
            { shape: 'ball', x: 50, y: 56, size: 18, color: RED }
          ]
        }
      }
    ]
  };
});
