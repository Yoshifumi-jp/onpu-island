window.ONPU = window.ONPU || {};

// 遊ぶ子ごとの記録（ニックネーム・どうぶつの絵・レベルごとの★・読み書き）の計算
// 画面やブラウザの保存機能には直接触れず、引数で渡されたデータと保存先だけを使う
(function () {
  "use strict";

  // 遊ぶ子の人数の上限（人数上限はこの1か所だけで決める）
  var MAX_PLAYERS = 3;

  // ニックネームの文字数の上限
  var NAME_MAX = 6;

  // 保存先で使うキー名
  var STORAGE_KEY = "onpuIsland.records";

  // 書き込み可能かを確かめるための一時キー名
  var CHECK_KEY = "onpuIsland.check";

  // 1レベルあたりの★の上限
  var MAX_STARS = 3;

  // どうぶつの絵の並び
  var ANIMALS = ["usagi", "neko", "inu", "kuma", "pengin", "kaeru"];

  // すべてのレベルのキー（15個）
  var LEVEL_KEYS = [
    "doremi.treble.1",
    "doremi.treble.2",
    "doremi.treble.3",
    "doremi.treble.4",
    "doremi.bass.1",
    "doremi.bass.2",
    "doremi.bass.3",
    "rhythm.1",
    "rhythm.2",
    "rhythm.3",
    "rhythm.4",
    "puzzle.1",
    "puzzle.2",
    "puzzle.3",
    "puzzle.4"
  ];

  // てんてん（濁点）の変換表（ひらがな基準）
  var DAKUTEN_MAP = {
    "か": "が", "き": "ぎ", "く": "ぐ", "け": "げ", "こ": "ご",
    "さ": "ざ", "し": "じ", "す": "ず", "せ": "ぜ", "そ": "ぞ",
    "た": "だ", "ち": "ぢ", "つ": "づ", "て": "で", "と": "ど",
    "は": "ば", "ひ": "び", "ふ": "ぶ", "へ": "べ", "ほ": "ぼ",
    "う": "ゔ",
    "が": "か", "ぎ": "き", "ぐ": "く", "げ": "け", "ご": "こ",
    "ざ": "さ", "じ": "し", "ず": "す", "ぜ": "せ", "ぞ": "そ",
    "だ": "た", "ぢ": "ち", "づ": "つ", "で": "て", "ど": "と",
    "ば": "は", "び": "ひ", "ぶ": "ふ", "べ": "へ", "ぼ": "ほ",
    "ゔ": "う",
    "ぱ": "ば", "ぴ": "び", "ぷ": "ぶ", "ぺ": "べ", "ぽ": "ぼ"
  };

  // まる（半濁点）の変換表（ひらがな基準）
  var HANDAKU_MAP = {
    "は": "ぱ", "ひ": "ぴ", "ふ": "ぷ", "へ": "ぺ", "ほ": "ぽ",
    "ぱ": "は", "ぴ": "ひ", "ぷ": "ふ", "ぺ": "へ", "ぽ": "ほ",
    "ば": "ぱ", "び": "ぴ", "ぶ": "ぷ", "べ": "ぺ", "ぼ": "ぽ"
  };

  // ちいさく（小書き文字）の変換表（ひらがな基準）
  var SMALL_MAP = {
    "あ": "ぁ", "い": "ぃ", "う": "ぅ", "え": "ぇ", "お": "ぉ",
    "つ": "っ", "や": "ゃ", "ゆ": "ゅ", "よ": "ょ", "わ": "ゎ",
    "ぁ": "あ", "ぃ": "い", "ぅ": "う", "ぇ": "え", "ぉ": "お",
    "っ": "つ", "ゃ": "や", "ゅ": "ゆ", "ょ": "よ", "ゎ": "わ"
  };

  // オブジェクト自身のプロパティを持っているか調べる
  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  // ★の数（0〜MAX_STARS の整数）として正しいか調べる
  function isValidStar(value) {
    return (
      typeof value === "number" &&
      isFinite(value) &&
      Math.floor(value) === value &&
      value >= 0 &&
      value <= MAX_STARS
    );
  }

  // レベルのキーが LEVEL_KEYS に含まれるか調べる
  function isValidLevelKey(levelKey) {
    return typeof levelKey === "string" && LEVEL_KEYS.indexOf(levelKey) !== -1;
  }

  // どうぶつの名前が ANIMALS に含まれるか調べる
  function isValidAnimal(animal) {
    return typeof animal === "string" && ANIMALS.indexOf(animal) !== -1;
  }

  // 子の id が "p" と数字の形かを調べる
  function isValidPlayerId(id) {
    return typeof id === "string" && /^p[0-9]+$/.test(id);
  }

  // 空の記録データを新しく作って返す
  function emptyData() {
    return { version: 1, players: [] };
  }

  // best オブジェクトから有効な項目だけを LEVEL_KEYS の順に写す
  function cloneBest(best) {
    var copy = {};
    if (!best || typeof best !== "object" || Array.isArray(best)) {
      return copy;
    }
    for (var i = 0; i < LEVEL_KEYS.length; i++) {
      var key = LEVEL_KEYS[i];
      if (hasOwn(best, key) && isValidStar(best[key])) {
        copy[key] = best[key];
      }
    }
    return copy;
  }

  // 1人分の記録の写しを作る
  function clonePlayer(player) {
    return {
      id: player.id,
      name: player.name,
      animal: player.animal,
      best: cloneBest(player.best)
    };
  }

  // 記録データ全体の写しを作る（元のデータは書き換えない）
  function cloneData(data) {
    var result = emptyData();
    if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray(data.players)) {
      return result;
    }
    for (var i = 0; i < data.players.length; i++) {
      var p = data.players[i];
      if (p && typeof p === "object" && !Array.isArray(p)) {
        result.players.push(clonePlayer(p));
      }
    }
    return result;
  }

  // ニックネームが使える文字・長さかを調べる
  function validateName(name) {
    if (typeof name !== "string" || name.length === 0) {
      return "empty";
    }
    if (name.length > NAME_MAX) {
      return "too_long";
    }
    for (var i = 0; i < name.length; i++) {
      var code = name.charCodeAt(i);
      var isHiragana = code >= 0x3041 && code <= 0x3096;
      var isKatakana = code >= 0x30A1 && code <= 0x30FA;
      var isLongMark = code === 0x30FC;
      if (!isHiragana && !isKatakana && !isLongMark) {
        return "bad_char";
      }
    }
    return "ok";
  }

  // 次の番号の id（"p"＋数字）を作る
  function nextPlayerId(players) {
    var maxNum = 0;
    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      if (p && isValidPlayerId(p.id)) {
        var num = parseInt(p.id.slice(1), 10);
        if (num > maxNum) {
          maxNum = num;
        }
      }
    }
    return "p" + String(maxNum + 1);
  }

  // 新しい子を追加した記録を返す（元のデータは変えない）
  function addPlayer(data, name, animal) {
    var base = cloneData(data);
    if (base.players.length >= MAX_PLAYERS) {
      return { ok: false, reason: "full", data: data };
    }
    var nameStatus = validateName(name);
    if (nameStatus !== "ok") {
      return { ok: false, reason: nameStatus, data: data };
    }
    if (!isValidAnimal(animal)) {
      return { ok: false, reason: "bad_animal", data: data };
    }
    for (var i = 0; i < base.players.length; i++) {
      if (base.players[i].animal === animal) {
        return { ok: false, reason: "animal_used", data: data };
      }
    }
    var newPlayer = {
      id: nextPlayerId(base.players),
      name: name,
      animal: animal,
      best: {}
    };
    base.players.push(newPlayer);
    return {
      ok: true,
      reason: "ok",
      data: base,
      player: clonePlayer(newPlayer)
    };
  }

  // 指定した子のニックネームとどうぶつの絵を変えた記録を返す（元のデータは変えない）
  function renamePlayer(data, playerId, name, animal) {
    var base = cloneData(data);
    var targetIndex = -1;
    if (typeof playerId === "string") {
      for (var i = 0; i < base.players.length; i++) {
        if (base.players[i].id === playerId) {
          targetIndex = i;
          break;
        }
      }
    }
    if (targetIndex === -1) {
      return { ok: false, reason: "not_found", data: data };
    }
    var nameStatus = validateName(name);
    if (nameStatus !== "ok") {
      return { ok: false, reason: nameStatus, data: data };
    }
    if (!isValidAnimal(animal)) {
      return { ok: false, reason: "bad_animal", data: data };
    }
    for (var j = 0; j < base.players.length; j++) {
      if (j !== targetIndex && base.players[j].animal === animal) {
        return { ok: false, reason: "animal_used", data: data };
      }
    }
    base.players[targetIndex].name = name;
    base.players[targetIndex].animal = animal;
    return {
      ok: true,
      reason: "ok",
      data: base,
      player: clonePlayer(base.players[targetIndex])
    };
  }

  // 指定した子を取り除いた記録を返す（元のデータは変えない）
  function removePlayer(data, playerId) {
    var base = cloneData(data);
    var targetIndex = -1;
    if (typeof playerId === "string") {
      for (var i = 0; i < base.players.length; i++) {
        if (base.players[i].id === playerId) {
          targetIndex = i;
          break;
        }
      }
    }
    if (targetIndex === -1) {
      return { ok: false, reason: "not_found", data: data };
    }
    base.players.splice(targetIndex, 1);
    return {
      ok: true,
      reason: "ok",
      data: base
    };
  }

  // 指定した子のレベルごとの★を更新した記録の写しを返す
  function recordStars(data, playerId, levelKey, stars) {
    var copy = cloneData(data);
    if (!isValidStar(stars) || !isValidLevelKey(levelKey) || typeof playerId !== "string") {
      return copy;
    }
    for (var i = 0; i < copy.players.length; i++) {
      var p = copy.players[i];
      if (p.id === playerId) {
        if (!hasOwn(p.best, levelKey) || stars > p.best[levelKey]) {
          p.best[levelKey] = stars;
        }
        break;
      }
    }
    return copy;
  }

  // 1人分の全レベルの★を合計する
  function totalStars(player) {
    if (!player || typeof player !== "object" || !player.best || typeof player.best !== "object" || Array.isArray(player.best)) {
      return 0;
    }
    var sum = 0;
    for (var i = 0; i < LEVEL_KEYS.length; i++) {
      var key = LEVEL_KEYS[i];
      if (hasOwn(player.best, key) && isValidStar(player.best[key])) {
        sum += player.best[key];
      }
    }
    return sum;
  }

  // 指定した島（"doremi"・"rhythm"・"puzzle"）で獲得した★の最大値を返す
  function islandStars(player, island) {
    if (
      typeof island !== "string" ||
      island.length === 0 ||
      !player ||
      typeof player !== "object" ||
      !player.best ||
      typeof player.best !== "object" ||
      Array.isArray(player.best)
    ) {
      return 0;
    }
    var prefix = island + ".";
    var maxStars = 0;
    for (var i = 0; i < LEVEL_KEYS.length; i++) {
      var key = LEVEL_KEYS[i];
      if (key.indexOf(prefix) === 0 && hasOwn(player.best, key) && isValidStar(player.best[key])) {
        if (player.best[key] > maxStars) {
          maxStars = player.best[key];
        }
      }
    }
    return maxStars;
  }

  // 今いる子が使っているどうぶつの名前を順に配列で返す
  function usedAnimals(data) {
    if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray(data.players)) {
      return [];
    }
    var list = [];
    for (var i = 0; i < data.players.length; i++) {
      var p = data.players[i];
      if (p && typeof p === "object" && typeof p.animal === "string") {
        list.push(p.animal);
      }
    }
    return list;
  }

  // 保存した文字列を読み取り、正しい形と人数上限に整えた記録データを返す
  function parse(text) {
    if (typeof text !== "string") {
      return emptyData();
    }
    var raw;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      return emptyData();
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || !Array.isArray(raw.players)) {
      return emptyData();
    }
    var result = emptyData();
    var seenIds = {};
    var seenAnimals = {};
    for (var i = 0; i < raw.players.length; i++) {
      if (result.players.length >= MAX_PLAYERS) {
        break;
      }
      var p = raw.players[i];
      if (!p || typeof p !== "object" || Array.isArray(p)) {
        continue;
      }
      if (!isValidPlayerId(p.id) || hasOwn(seenIds, p.id)) {
        continue;
      }
      if (validateName(p.name) !== "ok") {
        continue;
      }
      if (!isValidAnimal(p.animal) || hasOwn(seenAnimals, p.animal)) {
        continue;
      }
      seenIds[p.id] = true;
      seenAnimals[p.animal] = true;
      result.players.push({
        id: p.id,
        name: p.name,
        animal: p.animal,
        best: cloneBest(p.best)
      });
    }
    return result;
  }

  // 記録データを決まった順番の JSON 文字列にする
  function serialize(data) {
    return JSON.stringify(cloneData(data));
  }

  // 保存先から記録データを読み込む
  function load(storage) {
    if (!storage || typeof storage.getItem !== "function") {
      return { ok: false, data: emptyData() };
    }
    try {
      var rawText = storage.getItem(STORAGE_KEY);
      return { ok: true, data: parse(rawText) };
    } catch (e) {
      return { ok: false, data: emptyData() };
    }
  }

  // 保存先に記録データを書き込む
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

  // 保存先にテスト書き込みと削除ができるか調べる
  function canSave(storage) {
    if (!storage || typeof storage.setItem !== "function" || typeof storage.removeItem !== "function") {
      return false;
    }
    try {
      storage.setItem(CHECK_KEY, "1");
      storage.removeItem(CHECK_KEY);
      return true;
    } catch (e) {
      return false;
    }
  }

  // 1文字をカタカナからひらがなに変える（対象外はそのまま）
  function toHiragana(ch) {
    if (typeof ch !== "string" || ch.length !== 1) {
      return ch;
    }
    var code = ch.charCodeAt(0);
    if (code >= 0x30A1 && code <= 0x30F6) {
      return String.fromCharCode(code - 0x60);
    }
    return ch;
  }

  // 1文字をひらがなからカタカナに変える（対象外はそのまま）
  function toKatakana(ch) {
    if (typeof ch !== "string" || ch.length !== 1) {
      return ch;
    }
    var code = ch.charCodeAt(0);
    if (code >= 0x3041 && code <= 0x3096) {
      return String.fromCharCode(code + 0x60);
    }
    return ch;
  }

  // 1文字のてんてん・まる・ちいさくを切り替える（カタカナはカタカナのまま返す）
  function toggleMark(ch, kind) {
    if (typeof ch !== "string" || ch.length !== 1) {
      return ch;
    }
    var map = null;
    if (kind === "dakuten") {
      map = DAKUTEN_MAP;
    } else if (kind === "handaku") {
      map = HANDAKU_MAP;
    } else if (kind === "small") {
      map = SMALL_MAP;
    } else {
      return ch;
    }
    var hira = toHiragana(ch);
    var isKata = hira !== ch;
    if (!hasOwn(map, hira)) {
      return ch;
    }
    var converted = map[hira];
    return isKata ? toKatakana(converted) : converted;
  }

  // 島・記号・レベル番号からレベルのキーを作って返す（対象外は null）
  function levelKey(island, clef, level) {
    if (typeof level !== "number" || !isFinite(level) || Math.floor(level) !== level) {
      return null;
    }
    var key = null;
    if (island === "doremi") {
      if (clef !== "treble" && clef !== "bass") {
        return null;
      }
      key = "doremi." + clef + "." + level;
    } else if (island === "rhythm" || island === "puzzle") {
      key = island + "." + level;
    } else {
      return null;
    }
    return isValidLevelKey(key) ? key : null;
  }

  ONPU.records = {
    MAX_PLAYERS: MAX_PLAYERS,
    NAME_MAX: NAME_MAX,
    STORAGE_KEY: STORAGE_KEY,
    ANIMALS: ANIMALS,
    LEVEL_KEYS: LEVEL_KEYS,
    emptyData: emptyData,
    validateName: validateName,
    addPlayer: addPlayer,
    renamePlayer: renamePlayer,
    removePlayer: removePlayer,
    recordStars: recordStars,
    totalStars: totalStars,
    islandStars: islandStars,
    usedAnimals: usedAnimals,
    parse: parse,
    serialize: serialize,
    load: load,
    save: save,
    canSave: canSave,
    toHiragana: toHiragana,
    toKatakana: toKatakana,
    toggleMark: toggleMark,
    levelKey: levelKey
  };
})();
