window.ONPU = window.ONPU || {};

// パズルの谷の「拍の合計とはめ込みの決まり」の計算（画面や音の処理は含めない）
(function () {
  "use strict";

  // 拍子ごとの1小節の半拍の数（1拍＝2半拍）
  var METERS = {
    "4/4": 8,
    "3/4": 6,
    "2/4": 4
  };

  // ピースの定義（units は半拍、hits はピースの頭からの鳴らす位置の半拍）
  var PIECES = {
    ta: { units: 2, hits: [0], rest: false },
    titi: { units: 2, hits: [0, 1], rest: false },
    un: { units: 2, hits: [], rest: true },
    taan: { units: 4, hits: [0], rest: false },
    dotted_half: { units: 6, hits: [0], rest: false },
    whole: { units: 8, hits: [0], rest: false },
    eighth: { units: 1, hits: [0], rest: false },
    half_rest: { units: 4, hits: [], rest: true },
    dotted_quarter: { units: 3, hits: [0], rest: false }
  };

  // 1回の問題数
  var QUESTION_COUNT = 5;

  // レベルごとの問題の並び
  var LEVELS = [
    {
      level: 1,
      textId: "puzzle.level1",
      color: "#FF9A8F",
      pool: [
        { meter: "4/4", given: ["ta"], choices: ["ta", "un"] },
        { meter: "4/4", given: ["ta"], choices: ["ta", "un", "taan"] },
        { meter: "4/4", given: ["taan"], choices: ["ta", "un", "taan"] },
        { meter: "4/4", given: [], choices: ["ta", "taan"] },
        { meter: "4/4", given: ["ta"], choices: ["un", "taan"] },
        { meter: "4/4", given: ["taan"], choices: ["ta", "un"] },
        { meter: "4/4", given: ["taan"], choices: ["un", "taan"] },
        { meter: "4/4", given: ["ta"], choices: ["ta", "taan"] }
      ]
    },
    {
      level: 2,
      textId: "puzzle.level2",
      color: "#FFE27A",
      pool: [
        { meter: "4/4", given: [], choices: ["ta", "titi", "taan", "whole"] },
        { meter: "4/4", given: ["titi"], choices: ["titi", "un", "taan"] },
        { meter: "4/4", given: ["ta"], choices: ["ta", "titi", "un", "taan"] },
        { meter: "4/4", given: ["taan"], choices: ["titi", "un", "taan"] },
        { meter: "4/4", given: [], choices: ["titi", "taan", "whole"] },
        { meter: "4/4", given: ["ta"], choices: ["titi", "taan"] },
        { meter: "4/4", given: ["titi"], choices: ["ta", "un", "taan"] },
        { meter: "4/4", given: ["ta"], choices: ["ta", "titi", "un"] }
      ]
    },
    {
      level: 3,
      textId: "puzzle.level3",
      color: "#8FDCEB",
      pool: [
        { meter: "3/4", given: [], choices: ["ta", "taan", "dotted_half"] },
        { meter: "3/4", given: ["ta"], choices: ["ta", "un", "taan"] },
        { meter: "3/4", given: ["dotted_quarter"], choices: ["eighth", "ta", "dotted_quarter"] },
        { meter: "3/4", given: ["ta"], choices: ["un", "taan"] },
        { meter: "3/4", given: ["eighth"], choices: ["eighth", "ta", "dotted_quarter", "taan"] },
        { meter: "4/4", given: ["dotted_quarter"], choices: ["eighth", "ta", "un", "taan"] },
        { meter: "4/4", given: [], choices: ["eighth", "dotted_quarter", "taan", "dotted_half"] },
        { meter: "4/4", given: ["ta"], choices: ["ta", "taan", "dotted_half"] },
        { meter: "4/4", given: ["eighth"], choices: ["eighth", "ta", "dotted_quarter", "taan"] },
        { meter: "4/4", given: ["taan"], choices: ["eighth", "ta", "dotted_quarter"] },
        { meter: "4/4", given: [], choices: ["eighth", "titi", "dotted_quarter", "whole"] }
      ]
    },
    {
      level: 4,
      textId: "puzzle.level4",
      color: "#DAB4F7",
      pool: [
        { meter: "2/4", given: ["ta"], choices: ["ta", "un"] },
        { meter: "2/4", given: ["ta"], choices: ["eighth", "ta", "un"] },
        { meter: "2/4", given: ["eighth"], choices: ["eighth", "ta", "dotted_quarter"] },
        { meter: "2/4", given: [], choices: ["eighth", "titi", "dotted_quarter", "taan"] },
        { meter: "3/4", given: ["ta"], choices: ["un", "taan", "half_rest"] },
        { meter: "3/4", given: [], choices: ["ta", "half_rest", "dotted_half"] },
        { meter: "4/4", given: ["taan"], choices: ["eighth", "un", "dotted_quarter", "half_rest"] },
        { meter: "4/4", given: ["ta"], choices: ["ta", "half_rest", "dotted_half"] },
        { meter: "4/4", given: ["dotted_quarter"], choices: ["eighth", "ta", "un", "half_rest"] },
        { meter: "4/4", given: ["ta"], choices: ["eighth", "titi", "dotted_quarter", "half_rest"] }
      ]
    }
  ];

  // 0より大きい有限の数かどうかを判定する
  function isPositiveNumber(n) {
    return typeof n === "number" && isFinite(n) && n > 0;
  }

  // 1小節の半拍の数を返す。知らない拍子・文字列でないときは 0 を返す
  function measureUnits(meter) {
    if (typeof meter !== "string" || !Object.prototype.hasOwnProperty.call(METERS, meter)) {
      return 0;
    }
    return METERS[meter];
  }

  // ピースの半拍の数を返す。知らない id・文字列でないときは 0 を返す
  function pieceUnits(id) {
    if (typeof id !== "string" || !Object.prototype.hasOwnProperty.call(PIECES, id)) {
      return 0;
    }
    return PIECES[id].units;
  }

  // 並びの半拍の合計を返す。配列でない、または知らない id が1つでもあれば null を返す
  function totalUnits(pieces) {
    if (!Array.isArray(pieces)) {
      return null;
    }
    var total = 0;
    for (var i = 0; i < pieces.length; i++) {
      var u = pieceUnits(pieces[i]);
      if (u === 0) {
        return null;
      }
      total += u;
    }
    return total;
  }

  // 1小節の半拍 − 合計（多すぎるとマイナス）を返す。正しくない入力のときは null を返す
  function remainingUnits(meter, pieces) {
    var m = measureUnits(meter);
    var t = totalUnits(pieces);
    if (m === 0 || t === null) {
      return null;
    }
    return m - t;
  }

  // 残りの拍数（半拍 ÷ 2）を返す。remainingUnits が null のときは null を返す
  function remainingBeats(meter, pieces) {
    var rem = remainingUnits(meter, pieces);
    if (rem === null) {
      return null;
    }
    return rem / 2;
  }

  // 残りの状態（"short" / "exact" / "over" / null）を返す
  function status(meter, pieces) {
    var rem = remainingUnits(meter, pieces);
    if (rem === null) {
      return null;
    }
    if (rem > 0) {
      return "short";
    }
    if (rem === 0) {
      return "exact";
    }
    return "over";
  }

  // 指定したピースを並びの末尾に追加できるかを判定する
  function canPlace(meter, pieces, id) {
    var rem = remainingUnits(meter, pieces);
    var u = pieceUnits(id);
    return rem !== null && u > 0 && u <= rem;
  }

  // ピースを入れた結果を { ok, reason, pieces } で返す（元の配列は変えない）
  function place(meter, pieces, id) {
    var copy = Array.isArray(pieces) ? pieces.slice() : [];
    var rem = remainingUnits(meter, pieces);
    var u = pieceUnits(id);
    if (rem === null || u === 0) {
      return { ok: false, reason: "invalid", pieces: copy };
    }
    if (u > rem) {
      return { ok: false, reason: "over", pieces: copy };
    }
    copy.push(id);
    return { ok: true, reason: null, pieces: copy };
  }

  // index 番目を取り除いた新しい配列を返す（範囲外・整数でないときは写しを返す）
  function removeAt(pieces, index) {
    if (!Array.isArray(pieces)) {
      return [];
    }
    var copy = pieces.slice();
    if (
      typeof index === "number" &&
      isFinite(index) &&
      Math.floor(index) === index &&
      index >= 0 &&
      index < copy.length
    ) {
      copy.splice(index, 1);
    }
    return copy;
  }

  // 各ピースの始まりの時刻（秒。1拍目の頭＝0）の配列を返す
  function pieceStartTimes(pieces, bpm) {
    if (totalUnits(pieces) === null || !isPositiveNumber(bpm)) {
      return [];
    }
    var secPerUnit = 30 / bpm;
    var times = [];
    var unitOffset = 0;
    for (var i = 0; i < pieces.length; i++) {
      times.push(unitOffset * secPerUnit);
      unitOffset += pieceUnits(pieces[i]);
    }
    return times;
  }

  // 鳴らす時刻（秒）を早い順の配列で返す（ぴったりでない・bpm が不正なときは []）
  function playTimes(meter, pieces, bpm) {
    if (status(meter, pieces) !== "exact" || !isPositiveNumber(bpm)) {
      return [];
    }
    var secPerUnit = 30 / bpm;
    var times = [];
    var unitOffset = 0;
    for (var i = 0; i < pieces.length; i++) {
      var piece = PIECES[pieces[i]];
      if (!piece.rest) {
        for (var j = 0; j < piece.hits.length; j++) {
          times.push((unitOffset + piece.hits[j]) * secPerUnit);
        }
      }
      unitOffset += piece.units;
    }
    return times;
  }

  // choices を使って残りの半拍をちょうど埋められるかを判定する
  function canFill(meter, pieces, choices) {
    var rem = remainingUnits(meter, pieces);
    if (rem === null || rem < 0) {
      return false;
    }
    if (!Array.isArray(choices) || choices.length === 0) {
      return false;
    }
    var choiceUnits = [];
    for (var i = 0; i < choices.length; i++) {
      var u = pieceUnits(choices[i]);
      if (u === 0) {
        return false;
      }
      choiceUnits.push(u);
    }

    var dp = [];
    for (var k = 0; k <= rem; k++) {
      dp.push(false);
    }
    dp[0] = true;
    for (var s = 1; s <= rem; s++) {
      for (var c = 0; c < choiceUnits.length; c++) {
        var unit = choiceUnits[c];
        if (s >= unit && dp[s - unit]) {
          dp[s] = true;
          break;
        }
      }
    }
    return dp[rem];
  }

  // 問題データ { meter, given, choices } が正しいかを判定する
  function isValidProblem(problem) {
    if (!problem || typeof problem !== "object" || Array.isArray(problem)) {
      return false;
    }
    var rem = remainingUnits(problem.meter, problem.given);
    if (rem === null || rem < 1) {
      return false;
    }
    return canFill(problem.meter, problem.given, problem.choices);
  }

  // 1小節の各拍の頭の時刻（秒。1拍目＝0）の配列を返す
  function beatTimes(meter, bpm) {
    var units = measureUnits(meter);
    if (units === 0 || !isPositiveNumber(bpm)) {
      return [];
    }
    var beats = units / 2;
    var secPerBeat = 60 / bpm;
    var times = [];
    for (var i = 0; i < beats; i++) {
      times.push(i * secPerBeat);
    }
    return times;
  }

  // 小節の頭からの経過 elapsed（秒）のときに鳴っているピースの番号（0 から）を返す
  function pieceIndexAt(meter, pieces, bpm, elapsed) {
    if (
      status(meter, pieces) !== "exact" ||
      !isPositiveNumber(bpm) ||
      typeof elapsed !== "number" ||
      !isFinite(elapsed)
    ) {
      return -1;
    }
    var starts = pieceStartTimes(pieces, bpm);
    if (starts.length === 0) {
      return -1;
    }
    var end = (measureUnits(meter) / 2) * (60 / bpm);
    var t = elapsed + 1e-9;
    if (t < 0 || t >= end) {
      return -1;
    }
    for (var i = starts.length - 1; i >= 0; i--) {
      if (t >= starts[i]) {
        return i;
      }
    }
    return -1;
  }

  // 半拍の数を整数の拍と半拍があるかに分けて { whole, half } で返す（0以上の整数でないときは null）
  function beatParts(units) {
    if (
      typeof units !== "number" ||
      !isFinite(units) ||
      Math.floor(units) !== units ||
      units < 0
    ) {
      return null;
    }
    return {
      whole: Math.floor(units / 2),
      half: units % 2 === 1
    };
  }

  // pool から重ならないように count 個を選び、順番も入れかえて写しを返す
  function pickProblems(pool, count, rng) {
    if (!Array.isArray(pool) || pool.length === 0) {
      return [];
    }
    if (typeof count !== "number" || !isFinite(count) || Math.floor(count) !== count || count < 1) {
      return [];
    }
    var n = pool.length;
    var indices = [];
    for (var i = 0; i < n; i++) {
      indices.push(i);
    }
    var randomFn = typeof rng === "function" ? rng : Math.random;
    for (var k = n - 1; k > 0; k--) {
      var j = Math.floor(randomFn() * (k + 1));
      if (typeof j === "number" && !isNaN(j) && j >= 0 && j <= k) {
        var tmp = indices[k];
        indices[k] = indices[j];
        indices[j] = tmp;
      }
    }
    var limit = count < n ? count : n;
    var result = [];
    for (var m = 0; m < limit; m++) {
      var item = pool[indices[m]];
      result.push({
        meter: item.meter,
        given: Array.isArray(item.given) ? item.given.slice() : [],
        choices: Array.isArray(item.choices) ? item.choices.slice() : []
      });
    }
    return result;
  }

  ONPU.puzzle = {
    METERS: METERS,
    PIECES: PIECES,
    QUESTION_COUNT: QUESTION_COUNT,
    LEVELS: LEVELS,
    measureUnits: measureUnits,
    pieceUnits: pieceUnits,
    totalUnits: totalUnits,
    remainingUnits: remainingUnits,
    remainingBeats: remainingBeats,
    status: status,
    canPlace: canPlace,
    place: place,
    removeAt: removeAt,
    pieceStartTimes: pieceStartTimes,
    playTimes: playTimes,
    canFill: canFill,
    isValidProblem: isValidProblem,
    beatTimes: beatTimes,
    pieceIndexAt: pieceIndexAt,
    beatParts: beatParts,
    pickProblems: pickProblems
  };
})();
