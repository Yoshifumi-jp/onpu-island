window.ONPU = window.ONPU || {};

// ごほうび（がっきずかんの楽器カード・スタンプちょうのスタンプ）を決める計算
// 画面や保存機能・音には直接触れず、ONPU.records.LEVEL_KEYS と引数から計算する
(function () {
  "use strict";

  // もらえる楽器の並び（もらえる順・10種）
  var INSTRUMENTS = [
    "castanet",
    "suzu",
    "triangle",
    "kenhamo",
    "recorder",
    "violin",
    "flute",
    "trumpet",
    "harp",
    "timpani"
  ];

  // 各楽器がもらえる★の合計のしきい値（はじめの3つは最初から持っている）
  var THRESHOLDS = [0, 0, 0, 5, 10, 15, 20, 25, 30, 35];

  // オブジェクト自身のプロパティを持っているか調べる
  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  // 0 以上の整数（number 型）かどうかを調べる
  function isNonNegativeInt(value) {
    return (
      typeof value === "number" &&
      isFinite(value) &&
      Math.floor(value) === value &&
      value >= 0
    );
  }

  // ★の合計を正規化する（0 以上の整数でないときは 0 とする）
  function normalizeTotal(total) {
    return isNonNegativeInt(total) ? (total === 0 ? 0 : total) : 0;
  }

  // 1〜3 の整数（スタンプが付く★の数）かどうかを調べる
  function isClearedStar(value) {
    return (
      typeof value === "number" &&
      isFinite(value) &&
      Math.floor(value) === value &&
      value >= 1 &&
      value <= 3
    );
  }

  // レベルキーの一覧を ONPU.records から取得する
  function getLevelKeys() {
    if (ONPU.records && Array.isArray(ONPU.records.LEVEL_KEYS)) {
      return ONPU.records.LEVEL_KEYS;
    }
    return [];
  }

  // ★の合計から、もらえた楽器の数（3〜10）を返す
  function ownedCount(total) {
    var t = normalizeTotal(total);
    var count = 0;
    for (var i = 0; i < THRESHOLDS.length; i++) {
      if (THRESHOLDS[i] <= t) {
        count++;
      }
    }
    return count;
  }

  // ★の合計で持っている楽器の名前を並べた新しい配列を返す
  function ownedInstruments(total) {
    return INSTRUMENTS.slice(0, ownedCount(total));
  }

  // 次の楽器まであといくつ★が必要かを返す（10個すべて持っているときは 0）
  function starsToNext(total) {
    var t = normalizeTotal(total);
    var count = ownedCount(t);
    if (count >= THRESHOLDS.length) {
      return 0;
    }
    return THRESHOLDS[count] - t;
  }

  // ★の合計が before から after に変わって新しくもらえた楽器の新しい配列を返す
  function newInstruments(before, after) {
    var from = ownedCount(before);
    var to = ownedCount(after);
    if (to <= from) {
      return [];
    }
    return INSTRUMENTS.slice(from, to);
  }

  // 指定したレベルのスタンプをその子が持っているかを返す
  function hasStamp(player, levelKey) {
    if (typeof levelKey !== "string") {
      return false;
    }
    var keys = getLevelKeys();
    if (keys.indexOf(levelKey) === -1) {
      return false;
    }
    if (!player || typeof player !== "object" || Array.isArray(player)) {
      return false;
    }
    if (!player.best || typeof player.best !== "object" || Array.isArray(player.best)) {
      return false;
    }
    if (!hasOwn(player.best, levelKey)) {
      return false;
    }
    return isClearedStar(player.best[levelKey]);
  }

  // その子が持っているスタンプの数（0〜15）を返す
  function stampCount(player) {
    var keys = getLevelKeys();
    var count = 0;
    for (var i = 0; i < keys.length; i++) {
      if (hasStamp(player, keys[i])) {
        count++;
      }
    }
    return count;
  }

  // クリアしたときに「あたらしい スタンプ」を出すかを返す
  function isNewStamp(prevStars, stars) {
    return isClearedStar(stars) && !isClearedStar(prevStars);
  }

  ONPU.rewards = {
    INSTRUMENTS: INSTRUMENTS,
    THRESHOLDS: THRESHOLDS,
    ownedCount: ownedCount,
    ownedInstruments: ownedInstruments,
    starsToNext: starsToNext,
    newInstruments: newInstruments,
    hasStamp: hasStamp,
    stampCount: stampCount,
    isNewStamp: isNewStamp
  };
})();
