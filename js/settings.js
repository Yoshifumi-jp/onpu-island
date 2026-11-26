window.ONPU = window.ONPU || {};

// おうちの方の設定（音の大きさ・利用時間・読み上げ・判定の幅）とロック問題の計算
// 画面やブラウザの保存機能・音・読み上げ・現在時刻には直接触れず、引数で渡された値だけを使う
(function () {
  "use strict";

  // 保存先で使うキー名（記録とは別）
  var STORAGE_KEY = "onpuIsland.settings";

  // 音の大きさ（全体の音量）
  var VOLUMES = {
    small: 0.3,
    normal: 0.6,
    large: 0.9
  };

  // 1日に遊ぶ時間の目安（分。0 は「きめない」）
  var TIME_LIMITS = [0, 15, 30, 45, 60];

  // 確認モードだけで選べる時間（分）
  var DEBUG_TIME_LIMIT = 1;

  // おうちの方がのばす時間（分）
  var EXTEND_MINUTES = 15;

  // リズムの森の判定の幅（秒）
  var RHYTHM_WINDOWS = {
    loose: { perfect: 0.15, good: 0.30 },
    normal: { perfect: 0.10, good: 0.20 }
  };

  // 読み上げのはやさ
  var SPEECH_RATE = 0.9;

  // オブジェクト自身のプロパティを持っているか調べる
  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  // 配列ではない普通のオブジェクトかを調べる
  function isPlainObject(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  // 子の id が "p" と数字の形かを調べる
  function isValidPlayerId(id) {
    return typeof id === "string" && /^p[0-9]+$/.test(id);
  }

  // 日付が "YYYY-MM-DD" の形かを調べる
  function isValidDateKey(value) {
    return typeof value === "string" && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value);
  }

  // 0 以上の整数（number 型）かを調べる
  function isNonNegativeInt(value) {
    return (
      typeof value === "number" &&
      isFinite(value) &&
      Math.floor(value) === value &&
      value >= 0
    );
  }

  // 音の大きさの値が正しいかを調べる
  function isValidVolume(value) {
    return typeof value === "string" && hasOwn(VOLUMES, value);
  }

  // 利用時間の値が正しいかを調べる
  function isValidTimeLimit(value) {
    return (
      typeof value === "number" &&
      (TIME_LIMITS.indexOf(value) !== -1 || value === DEBUG_TIME_LIMIT)
    );
  }

  // 読み上げの値が正しいかを調べる
  function isValidSpeech(value) {
    return typeof value === "boolean";
  }

  // 判定の幅の値が正しいかを調べる
  function isValidRhythm(value) {
    return typeof value === "string" && hasOwn(RHYTHM_WINDOWS, value);
  }

  // 2桁のゼロ埋め文字列にする
  function pad2(num) {
    return num < 10 ? "0" + String(num) : String(num);
  }

  // 最初の設定を新しく作って返す（キーの順番を固定する）
  function defaults() {
    return {
      version: 1,
      volume: "normal",
      timeLimit: 0,
      speech: true,
      rhythm: "loose",
      usage: {
        date: "",
        players: {}
      }
    };
  }

  // 設定データを正しい形に整えた新しいオブジェクトを返す
  function normalize(data) {
    var result = defaults();
    if (!isPlainObject(data)) {
      return result;
    }

    if (isValidVolume(data.volume)) {
      result.volume = data.volume;
    }
    if (isValidTimeLimit(data.timeLimit)) {
      result.timeLimit = data.timeLimit === 0 ? 0 : data.timeLimit;
    }
    if (isValidSpeech(data.speech)) {
      result.speech = data.speech;
    }
    if (isValidRhythm(data.rhythm)) {
      result.rhythm = data.rhythm;
    }

    if (
      isPlainObject(data.usage) &&
      isValidDateKey(data.usage.date) &&
      isPlainObject(data.usage.players)
    ) {
      result.usage.date = data.usage.date;
      var keys = Object.keys(data.usage.players);
      for (var i = 0; i < keys.length; i++) {
        var id = keys[i];
        if (!isValidPlayerId(id)) {
          continue;
        }
        var entry = data.usage.players[id];
        if (
          isPlainObject(entry) &&
          isNonNegativeInt(entry.seconds) &&
          isNonNegativeInt(entry.extraMinutes)
        ) {
          result.usage.players[id] = {
            seconds: entry.seconds === 0 ? 0 : entry.seconds,
            extraMinutes: entry.extraMinutes === 0 ? 0 : entry.extraMinutes
          };
        }
      }
    }

    return result;
  }

  // 保存した文字列を読み取り、正しい形に整えた設定を返す
  function parse(text) {
    if (typeof text !== "string") {
      return defaults();
    }
    var raw;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      return defaults();
    }
    return normalize(raw);
  }

  // 設定データを決まった順番の JSON 文字列にする
  function serialize(data) {
    return JSON.stringify(normalize(data));
  }

  // 保存先から設定データを読み込む
  function load(storage) {
    if (!storage || typeof storage.getItem !== "function") {
      return { ok: false, data: defaults() };
    }
    try {
      var rawText = storage.getItem(STORAGE_KEY);
      return { ok: true, data: parse(rawText) };
    } catch (e) {
      return { ok: false, data: defaults() };
    }
  }

  // 保存先に設定データを書き込む
  function save(storage, data) {
    if (!storage || typeof storage.setItem !== "function") {
      return false;
    }
    try {
      storage.setItem(STORAGE_KEY, serialize(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  // 設定項目（volume・timeLimit・speech・rhythm）を1つ変えた新しい設定を返す
  function setValue(data, key, value) {
    var copy = normalize(data);
    var valid = false;
    if (key === "volume" && isValidVolume(value)) {
      copy.volume = value;
      valid = true;
    } else if (key === "timeLimit" && isValidTimeLimit(value)) {
      copy.timeLimit = value === 0 ? 0 : value;
      valid = true;
    } else if (key === "speech" && isValidSpeech(value)) {
      copy.speech = value;
      valid = true;
    } else if (key === "rhythm" && isValidRhythm(value)) {
      copy.rhythm = value;
      valid = true;
    }
    return {
      ok: valid,
      data: copy
    };
  }

  // 設定の音の大きさに当たる音量倍率を返す
  function volumeGain(data) {
    var norm = normalize(data);
    return VOLUMES[norm.volume];
  }

  // 設定の判定の幅に当たるオブジェクトの写しを新しく返す
  function rhythmWindow(data) {
    var norm = normalize(data);
    var win = RHYTHM_WINDOWS[norm.rhythm];
    return {
      perfect: win.perfect,
      good: win.good
    };
  }

  // Date オブジェクトの端末の地域の時刻での日付を "YYYY-MM-DD" で返す
  function dateKey(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return "";
    }
    var year = String(date.getFullYear());
    while (year.length < 4) {
      year = "0" + year;
    }
    var month = pad2(date.getMonth() + 1);
    var day = pad2(date.getDate());
    return year + "-" + month + "-" + day;
  }

  // 指定した子の利用時間（秒）を加えた新しい設定を返す
  function addUsage(data, playerId, seconds, today) {
    var copy = normalize(data);
    if (!isValidPlayerId(playerId) || !isNonNegativeInt(seconds) || !isValidDateKey(today)) {
      return copy;
    }
    if (copy.usage.date !== today) {
      copy.usage = { date: today, players: {} };
    }
    if (!hasOwn(copy.usage.players, playerId)) {
      copy.usage.players[playerId] = { seconds: 0, extraMinutes: 0 };
    }
    copy.usage.players[playerId].seconds += seconds === 0 ? 0 : seconds;
    return copy;
  }

  // 指定した日の、指定した子の遊んだ秒数を返す
  function usedSeconds(data, playerId, today) {
    var norm = normalize(data);
    if (
      !isValidPlayerId(playerId) ||
      !isValidDateKey(today) ||
      norm.usage.date !== today ||
      !hasOwn(norm.usage.players, playerId)
    ) {
      return 0;
    }
    return norm.usage.players[playerId].seconds;
  }

  // 指定した日の、指定した子の上限秒数を返す（0 は「きめない」）
  function limitSeconds(data, playerId, today) {
    var norm = normalize(data);
    if (norm.timeLimit === 0) {
      return 0;
    }
    var extra = 0;
    if (
      isValidPlayerId(playerId) &&
      isValidDateKey(today) &&
      norm.usage.date === today &&
      hasOwn(norm.usage.players, playerId)
    ) {
      extra = norm.usage.players[playerId].extraMinutes;
    }
    return (norm.timeLimit + extra) * 60;
  }

  // 指定した日の、指定した子の利用時間が上限に達しているかを返す
  function isOverLimit(data, playerId, today) {
    var norm = normalize(data);
    if (norm.timeLimit === 0) {
      return false;
    }
    return usedSeconds(norm, playerId, today) >= limitSeconds(norm, playerId, today);
  }

  // 指定した子の利用時間を EXTEND_MINUTES 分のばした新しい設定を返す
  function extendTime(data, playerId, today) {
    var copy = normalize(data);
    if (!isValidPlayerId(playerId) || !isValidDateKey(today)) {
      return copy;
    }
    if (copy.usage.date !== today) {
      copy.usage = { date: today, players: {} };
    }
    if (!hasOwn(copy.usage.players, playerId)) {
      copy.usage.players[playerId] = { seconds: 0, extraMinutes: 0 };
    }
    copy.usage.players[playerId].extraMinutes += EXTEND_MINUTES;
    return copy;
  }

  // 指定した子の利用時間の記録を取り除いた新しい設定を返す
  function removePlayerUsage(data, playerId) {
    var copy = normalize(data);
    if (typeof playerId === "string" && hasOwn(copy.usage.players, playerId)) {
      delete copy.usage.players[playerId];
    }
    return copy;
  }

  // おうちの方のロックのかけ算問題を作る
  function makeLockProblem(rand) {
    var fn = typeof rand === "function" ? rand : Math.random;
    for (var i = 0; i < 100; i++) {
      var a = 13 + Math.floor(fn() * 37);
      var b = 3 + Math.floor(fn() * 7);
      if (a % 10 !== 0 && a * b >= 100) {
        return {
          a: a,
          b: b,
          answer: a * b
        };
      }
    }
    return {
      a: 23,
      b: 5,
      answer: 115
    };
  }

  // ロック問題の答えが合っているかを調べる
  function checkLockAnswer(problem, input) {
    if (
      !problem ||
      typeof problem !== "object" ||
      typeof problem.answer !== "number" ||
      !isFinite(problem.answer) ||
      typeof input !== "string"
    ) {
      return false;
    }
    return input === String(problem.answer);
  }

  // 読み上げに使う日本語の声を選ぶ（端末の中の声を先に選ぶ）
  function pickVoice(voices) {
    if (!Array.isArray(voices)) {
      return null;
    }
    var fallback = null;
    for (var i = 0; i < voices.length; i++) {
      var v = voices[i];
      if (!v || typeof v.lang !== "string" || !/^ja/i.test(v.lang)) {
        continue;
      }
      if (v.localService === true) {
        return v;
      }
      if (fallback === null) {
        fallback = v;
      }
    }
    return fallback;
  }

  ONPU.settings = {
    STORAGE_KEY: STORAGE_KEY,
    VOLUMES: VOLUMES,
    TIME_LIMITS: TIME_LIMITS,
    DEBUG_TIME_LIMIT: DEBUG_TIME_LIMIT,
    EXTEND_MINUTES: EXTEND_MINUTES,
    RHYTHM_WINDOWS: RHYTHM_WINDOWS,
    SPEECH_RATE: SPEECH_RATE,
    defaults: defaults,
    normalize: normalize,
    parse: parse,
    serialize: serialize,
    load: load,
    save: save,
    setValue: setValue,
    volumeGain: volumeGain,
    rhythmWindow: rhythmWindow,
    dateKey: dateKey,
    addUsage: addUsage,
    usedSeconds: usedSeconds,
    limitSeconds: limitSeconds,
    isOverLimit: isOverLimit,
    extendTime: extendTime,
    removePlayerUsage: removePlayerUsage,
    makeLockProblem: makeLockProblem,
    checkLockAnswer: checkLockAnswer,
    pickVoice: pickVoice
  };
})();
