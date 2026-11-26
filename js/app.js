window.ONPU = window.ONPU || {};

(function () {
  "use strict";

  // iPhone・iPad でボタンを押したときの :active（縮む動き）を有効にする
  document.addEventListener("touchstart", function () {}, { passive: true });

  var STAGE_WIDTH = 1194;
  var STAGE_HEIGHT = 834;
  var toastTimerId = null;
  var currentIslandKey = null;
  var currentLevel = null;
  var currentSession = null;
  var nextTimerId = null;
  var earTimerId = null;
  var waitingNext = false;
  var lastCorrectKey = null; // 前に鳴らした正解のメロディの名前
  var currentClef = "treble"; // レベルを選ぶ画面で今選んでいる記号（"treble"／"bass"）

  var RHYTHM_SPEED_ORDER = ["slow", "normal", "fast"];
  var RHYTHM_GLYPH_WIDTH = {
    ta: 34,
    titi: 86,
    un: 35,
    taan: 31
  };

  var rhythmSpeedKey = "slow";
  var rhythmLevel = null;
  var rhythmQuestions = [];
  var rhythmQIndex = 0;
  var rhythmAttempt = 1;
  var rhythmResults = [];
  var rhythmLastResult = null;
  var rhythmFlowTimerId = null;
  var clearKind = "doremi";
  var rhythmState = "waiting";
  var rhythmRafId = null;
  var rhythmAutoTimerId = null;
  var rhythmDotTimers = [];
  var rhythmCardEls = [];
  var rhythmDotEls = [];
  var rhythmPattern = [];
  var rhythmBpm = 60;
  var rhythmBeatSec = 1;
  var rhythmLat = 0;
  var rhythmBase = 0;
  var rhythmStart = 0;
  var rhythmModelTimeline = null;
  var rhythmSoundQueue = [];
  var rhythmTaps = [];
  var rhythmLeadText = null;
  var rhythmLeadBeatNum = null;

  var PUZZLE_BEAT_WIDTH = 190;
  var PUZZLE_SHELF_BEAT_WIDTH = 120;
  var PUZZLE_BOX_GLYPH_WIDTH = {
    ta: 34,
    titi: 86,
    un: 35,
    taan: 31,
    eighth: 58,
    dotted_quarter: 48,
    dotted_half: 44,
    whole: 43,
    half_rest: 94
  };
  var PUZZLE_SHELF_GLYPH_WIDTH = {
    ta: 24,
    titi: 59,
    un: 24,
    taan: 21,
    eighth: 40,
    dotted_quarter: 33,
    dotted_half: 31,
    whole: 30,
    half_rest: 65
  };

  var puzzleLevel = null;
  var puzzleQuestions = [];
  var puzzleQIndex = 0;
  var puzzleResults = [];
  var puzzleResultNow = null;
  var puzzlePlaced = [];
  var puzzleOverCount = 0;
  var puzzlePlaying = false;
  var puzzlePlacing = false;
  var puzzleActivePointerId = null;
  var puzzleActiveDragCleanup = null;
  var puzzleRafId = null;
  var puzzleAutoPlayTimerId = null;
  var puzzleLeadTimerId = null;
  var puzzleRestTimerId = null;
  var puzzleAnimTimers = [];
  var puzzleGhosts = [];
  var puzzleSoundQueue = [];
  var puzzleStart = 0;
  var puzzleLat = 0;
  var puzzleBpm = 80;
  var puzzleBoxPieceEls = [];
  var puzzleBeatEls = [];

  var recordsData = null;
  var currentPlayerId = null;
  var recordsSavable = true;
  var makeAnimal = null;
  var makeChars = [];
  var makeKata = false;
  var makeEditPlayerId = null;
  var zukanOpenId = null;
  var clearNewInstId = null;

  var SETTINGS_TABS = ["volume", "time", "speech", "rhythm", "names", "other"];
  var USAGE_COUNT_SCREENS = [
    "screen-map",
    "screen-level",
    "screen-quiz",
    "screen-rhythm",
    "screen-puzzle",
    "screen-clear",
    "screen-zukan",
    "screen-stamp"
  ];
  var settingsData = null;
  var settingsTab = "volume";
  var settingsMsgTimerId = null;
  var settingsDeleteTargetId = null;
  var lockProblem = null;
  var lockInput = "";
  var lockOnOk = null;
  var lockOnBack = null;
  var usageUnsavedSeconds = 0;
  var rhythmSpaceDown = false;

  // あいうえお ボタンの並び（10列×5行。空白は空きマス）
  var KANA_TABLE = [
    "あいうえお",
    "かきくけこ",
    "さしすせそ",
    "たちつてと",
    "なにぬねの",
    "はひふへほ",
    "まみむめも",
    "や ゆ よ",
    "らりるれろ",
    "わをん  "
  ];

  // 島ごとの問題画面の設定
  var ISLANDS = {
    doremi: {
      titleTextId: "map.island.doremi",
      questionTextId: "doremi.question",
      earQuestionTextId: "doremi.question.ear",
      hintTextId: "doremi.hint",
      earHintTextId: "doremi.hint.ear",
      bgColor: "var(--doremi-bg)",
      getAnswers: function () {
        return (ONPU.music && Array.isArray(ONPU.music.ANSWERS)) ? ONPU.music.ANSWERS : [];
      },
      answerOf: function (q) {
        return (ONPU.music && typeof ONPU.music.answerOf === "function") ? ONPU.music.answerOf(q) : null;
      }
    }
  };

  // 文言の取得と {version}・{stars} などの置き換え
  function getText(id, params) {
    var raw = (ONPU.texts && ONPU.texts[id]) ? ONPU.texts[id] : "";
    if (!params) {
      return raw;
    }
    return raw.replace(/\{(\w+)\}/g, function (match, key) {
      return Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match;
    });
  }

  // ウィンドウの大きさに合わせて #stage を縦横比を保ったまま拡大・縮小して中央に置く
  function updateStageScale() {
    var stage = document.getElementById("stage");
    if (!stage) {
      return;
    }
    var winW = window.innerWidth;
    var winH = window.innerHeight;
    var scale = Math.min(winW / STAGE_WIDTH, winH / STAGE_HEIGHT);
    stage.style.transform = "translate(-50%, -50%) scale(" + scale + ")";
  }

  // 保存先を取得する（触るだけで例外になる端末に備える）
  function getStorage() {
    try {
      return window.localStorage;
    } catch (e) {
      return null;
    }
  }

  // 記録を保存する（保存できないときは印だけ変えて遊びを止めない）
  function saveRecords() {
    if (!ONPU.records || typeof ONPU.records.save !== "function") {
      return false;
    }
    var ok = ONPU.records.save(getStorage(), recordsData);
    if (!ok) {
      recordsSavable = false;
    }
    return ok;
  }

  // いま選んでいる子の記録を返す（いないときは null）
  function getCurrentPlayer() {
    if (!recordsData || !Array.isArray(recordsData.players) || !currentPlayerId) {
      return null;
    }
    for (var i = 0; i < recordsData.players.length; i++) {
      if (recordsData.players[i].id === currentPlayerId) {
        return recordsData.players[i];
      }
    }
    return null;
  }

  // どうぶつの絵の SVG マークアップを返す
  function animalSvgHtml(animalId) {
    if (!ONPU.records || !Array.isArray(ONPU.records.ANIMALS) || ONPU.records.ANIMALS.indexOf(animalId) === -1) {
      return "";
    }
    return '<svg viewBox="0 0 120 120" aria-hidden="true"><use href="#animal-' + animalId + '"/></svg>';
  }

  // 楽器の絵の SVG マークアップを返す
  function instrumentSvgHtml(id) {
    if (!ONPU.rewards || !Array.isArray(ONPU.rewards.INSTRUMENTS) || ONPU.rewards.INSTRUMENTS.indexOf(id) === -1) {
      return "";
    }
    return '<svg viewBox="0 0 120 120" aria-hidden="true"><use href="#inst-' + id + '"/></svg>';
  }

  // レベルキーから島・しるし名・レベル番号を取り出す
  function parseStampKey(levelKey) {
    if (typeof levelKey !== "string") {
      return null;
    }
    var parts = levelKey.split(".");
    if (parts[0] === "doremi" && (parts[1] === "treble" || parts[1] === "bass") && parts.length === 3) {
      return { island: "doremi", mark: parts[1], level: parseInt(parts[2], 10) };
    }
    if ((parts[0] === "rhythm" || parts[0] === "puzzle") && parts.length === 2) {
      return { island: parts[0], mark: parts[0], level: parseInt(parts[1], 10) };
    }
    return null;
  }

  // スタンプの中身（島のしるし）の HTML を返す
  function stampInnerHtml(mark, size) {
    var k = size / 104;
    if (mark === "treble") {
      return '<svg width="' + Math.round(22 * k) + '" height="' + Math.round(62 * k) + '" aria-hidden="true"><use href="#mark-treble"/></svg>';
    }
    if (mark === "bass") {
      return '<svg width="' + Math.round(54 * k) + '" height="' + Math.round(62 * k) + '" aria-hidden="true"><use href="#mark-bass"/></svg>';
    }
    if (mark === "rhythm") {
      return '<svg width="' + Math.round(16 * k) + '" height="' + Math.round(48 * k) + '" aria-hidden="true"><use href="#glyph-ta"/></svg>' +
        '<svg width="' + Math.round(40 * k) + '" height="' + Math.round(48 * k) + '" aria-hidden="true"><use href="#glyph-titi"/></svg>';
    }
    return '<span class="t44" style="font-size:' + Math.round(34 * k) + 'px">4/4</span>';
  }

  // スタンプの HTML を返す（スタンプちょう・クリア画面で共用）
  function stampHtml(levelKey, on, size) {
    var parsed = parseStampKey(levelKey);
    if (!parsed || isNaN(parsed.level)) {
      return "";
    }
    if (!on) {
      return '<div class="stamp off">' + parsed.level + "</div>";
    }
    var s = size || 104;
    var rot = ((parsed.level * 37 + parsed.mark.length * 11) % 15) - 7;
    var style = "transform:rotate(" + rot + "deg)" + (size ? ";width:" + size + "px;height:" + size + "px" : "");
    return '<div class="stamp on" style="' + style + '">' + stampInnerHtml(parsed.mark, s) + '<span class="lv">' + parsed.level + "</span></div>";
  }

  // ★の数（0〜3）を「★☆☆」の形の文字にする
  function formatThreeStars(count) {
    var s = "";
    for (var i = 0; i < 3; i++) {
      s += i < count ? "★" : "☆";
    }
    return s;
  }

  // クリアしたレベルの★を記録して保存し、保存前後の情報を返す
  function recordAndSaveStars(island, clef, level, stars) {
    var playerBefore = getCurrentPlayer();
    if (!playerBefore || !ONPU.records || typeof ONPU.records.levelKey !== "function") {
      return null;
    }
    var key = ONPU.records.levelKey(island, clef, level);
    if (key === null) {
      return null;
    }
    var prev = (playerBefore.best && Object.prototype.hasOwnProperty.call(playerBefore.best, key))
      ? playerBefore.best[key]
      : undefined;
    var before = ONPU.records.totalStars(playerBefore);
    recordsData = ONPU.records.recordStars(recordsData, currentPlayerId, key, stars);
    saveRecords();
    var playerAfter = getCurrentPlayer();
    var after = playerAfter ? ONPU.records.totalStars(playerAfter) : before;
    return {
      key: key,
      prev: prev,
      before: before,
      after: after
    };
  }

  // 地図の右上のプレイヤー・★合計・各島の★を表示する
  function renderMapRecords() {
    var player = getCurrentPlayer();
    var faceEl = document.getElementById("map-player-face");
    if (faceEl) {
      faceEl.innerHTML = player ? animalSvgHtml(player.animal) : "";
    }
    var nameEl = document.getElementById("map-player-name");
    if (nameEl) {
      nameEl.textContent = player ? player.name : "";
    }
    var starTotalEl = document.getElementById("map-star-total");
    if (starTotalEl) {
      var total = (player && ONPU.records) ? ONPU.records.totalStars(player) : 0;
      starTotalEl.textContent = getText("map.star.total", { stars: total });
    }
    var islands = ["doremi", "rhythm", "puzzle"];
    for (var i = 0; i < islands.length; i++) {
      var island = islands[i];
      var starsEl = document.querySelector(".stars-" + island);
      if (starsEl) {
        var count = (player && ONPU.records) ? ONPU.records.islandStars(player, island) : 0;
        starsEl.textContent = formatThreeStars(count);
      }
    }
  }

  // 「だれが あそぶ？」画面のわくと保存不可の帯を作り直す
  function renderWho() {
    var listEl = document.getElementById("who-list");
    if (listEl && ONPU.records) {
      listEl.innerHTML = "";
      var players = (recordsData && Array.isArray(recordsData.players)) ? recordsData.players : [];
      var maxPlayers = ONPU.records.MAX_PLAYERS;
      for (var i = 0; i < maxPlayers; i++) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.id = "btn-who-" + i;
        if (players[i]) {
          var p = players[i];
          btn.className = "who-card";

          var faceSpan = document.createElement("span");
          faceSpan.className = "who-face";
          faceSpan.innerHTML = animalSvgHtml(p.animal);

          var nameSpan = document.createElement("span");
          nameSpan.className = "who-name";
          nameSpan.textContent = p.name;

          var starsSpan = document.createElement("span");
          starsSpan.className = "who-stars";
          var starIcon = document.createElement("span");
          starIcon.className = "who-stars-icon";
          starIcon.textContent = "★";
          var starNum = document.createElement("span");
          starNum.textContent = getText("who.stars", { stars: ONPU.records.totalStars(p) });
          starsSpan.appendChild(starIcon);
          starsSpan.appendChild(document.createTextNode(" "));
          starsSpan.appendChild(starNum);

          btn.appendChild(faceSpan);
          btn.appendChild(nameSpan);
          btn.appendChild(starsSpan);
          listEl.appendChild(btn);

          (function (btnId, playerId) {
            bindButton(btnId, function () {
              currentPlayerId = playerId;
              showScreen("screen-map");
            });
          })(btn.id, p.id);
        } else {
          btn.className = "who-card empty";

          var plusSpan = document.createElement("span");
          plusSpan.className = "who-new-plus";
          plusSpan.textContent = "+";

          var newTextSpan = document.createElement("span");
          newTextSpan.className = "who-new-text";
          newTextSpan.textContent = getText("who.new");

          btn.appendChild(plusSpan);
          btn.appendChild(newTextSpan);
          listEl.appendChild(btn);

          bindButton(btn.id, function () {
            openMakeScreen();
          });
        }
      }
    }

    var nosaveEl = document.getElementById("who-nosave");
    if (nosaveEl) {
      nosaveEl.hidden = Boolean(recordsSavable);
    }
  }

  // 「あたらしく つくる」の一言を更新する
  function setMakeMsg(text) {
    var msgEl = document.getElementById("make-msg");
    if (msgEl) {
      msgEl.textContent = text || "";
    }
  }

  // 「できた！」ボタンの薄さ（押せる見た目の切り替え）を更新する
  function updateMakeDone() {
    var doneBtn = document.getElementById("btn-make-done");
    if (doneBtn) {
      doneBtn.classList.toggle("off", !(makeAnimal && makeChars.length > 0));
    }
  }

  // なまえの箱を並べ直す
  function renderNameBoxes() {
    var rowEl = document.getElementById("name-boxes");
    if (rowEl && ONPU.records) {
      var nameMax = ONPU.records.NAME_MAX;
      rowEl.innerHTML = "";
      for (var i = 0; i < nameMax; i++) {
        var box = document.createElement("div");
        box.className = "name-box" + (i === makeChars.length ? " cur" : "");
        box.textContent = makeChars[i] || "";
        rowEl.appendChild(box);
      }
    }
    updateMakeDone();
  }

  // あいうえお ボタンを並べ直す
  function renderKanaPad() {
    var padEl = document.getElementById("kana-pad");
    if (padEl && ONPU.records) {
      padEl.innerHTML = "";
      for (var c = 0; c < KANA_TABLE.length; c++) {
        for (var r = 0; r < 5; r++) {
          var ch = KANA_TABLE[c].charAt(r) || " ";
          var btn = document.createElement("button");
          btn.type = "button";
          if (ch === " ") {
            btn.className = "key blank";
            btn.tabIndex = -1;
            padEl.appendChild(btn);
          } else {
            var displayCh = makeKata ? ONPU.records.toKatakana(ch) : ch;
            btn.id = "btn-kana-" + c + "-" + r;
            btn.className = "key";
            btn.textContent = displayCh;
            padEl.appendChild(btn);

            (function (btnId, charToAdd) {
              bindButton(btnId, function () {
                addMakeChar(charToAdd);
              });
            })(btn.id, displayCh);
          }
        }
      }
    }

    var kanaBtn = document.getElementById("btn-key-kana");
    if (kanaBtn) {
      kanaBtn.textContent = getText(makeKata ? "make.key.hira" : "make.key.kata");
    }
  }

  // 名前に1文字足す
  function addMakeChar(ch) {
    if (!ONPU.records) {
      return;
    }
    var nameMax = ONPU.records.NAME_MAX;
    if (makeChars.length >= nameMax) {
      setMakeMsg(getText("make.msg.tooLong", { max: nameMax }));
      return;
    }
    makeChars.push(ch);
    setMakeMsg("");
    renderNameBoxes();
  }

  // 名前の最後の1字に てんてん・まる・ちいさく を付ける（または戻す）
  function applyMakeMark(kind) {
    if (makeChars.length === 0 || !ONPU.records) {
      return;
    }
    var lastIdx = makeChars.length - 1;
    makeChars[lastIdx] = ONPU.records.toggleMark(makeChars[lastIdx], kind);
    renderNameBoxes();
  }

  // 「あたらしく つくる」画面を初期状態（editPlayerId 指定時は名前変更の形）にして開く
  function openMakeScreen(editPlayerId) {
    var editPlayer = null;
    if (editPlayerId && recordsData && Array.isArray(recordsData.players)) {
      for (var pIdx = 0; pIdx < recordsData.players.length; pIdx++) {
        if (recordsData.players[pIdx].id === editPlayerId) {
          editPlayer = recordsData.players[pIdx];
          break;
        }
      }
      if (!editPlayer) {
        openSettings("names");
        return;
      }
    }

    makeEditPlayerId = editPlayer ? editPlayer.id : null;
    makeAnimal = editPlayer ? editPlayer.animal : null;
    makeChars = editPlayer ? editPlayer.name.split("") : [];
    makeKata = false;
    setMakeMsg("");

    var makeTitleEl = document.getElementById("make-title");
    if (makeTitleEl) {
      makeTitleEl.textContent = getText(editPlayer ? "make.title.rename" : "make.title");
    }

    var gridEl = document.getElementById("animal-grid");
    if (gridEl && ONPU.records) {
      gridEl.innerHTML = "";
      var animals = ONPU.records.ANIMALS;
      var usedList = [];
      if (recordsData && Array.isArray(recordsData.players)) {
        for (var u = 0; u < recordsData.players.length; u++) {
          var pl = recordsData.players[u];
          if (!editPlayer || pl.id !== editPlayer.id) {
            usedList.push(pl.animal);
          }
        }
      }
      for (var i = 0; i < animals.length; i++) {
        var id = animals[i];
        var used = usedList.indexOf(id) !== -1;
        var selected = makeAnimal === id;
        var btn = document.createElement("button");
        btn.type = "button";
        btn.id = "btn-animal-" + id;
        btn.className = "animal-btn" + (used ? " used" : "") + (selected ? " sel" : "");
        btn.setAttribute("aria-label", getText("animal." + id));
        btn.innerHTML = animalSvgHtml(id);
        gridEl.appendChild(btn);

        (function (btnId, animalId, isUsed) {
          bindButton(btnId, function () {
            if (isUsed) {
              return;
            }
            makeAnimal = animalId;
            var allBtns = gridEl.querySelectorAll(".animal-btn");
            for (var k = 0; k < allBtns.length; k++) {
              allBtns[k].classList.remove("sel");
            }
            var targetBtn = document.getElementById(btnId);
            if (targetBtn) {
              targetBtn.classList.add("sel");
            }
            setMakeMsg("");
            updateMakeDone();
          });
        })(btn.id, id, used);
      }
    }

    renderKanaPad();
    renderNameBoxes();
    showScreen("screen-make");
  }

  // 画面への文言の流し込み
  function applyTexts() {
    document.title = getText("app.name");

    // data-text 属性を持つ要素に文言を入れる
    var textNodes = document.querySelectorAll("[data-text]");
    for (var i = 0; i < textNodes.length; i++) {
      var el = textNodes[i];
      var key = el.getAttribute("data-text");
      el.textContent = getText(key);
    }

    // data-aria-label 属性を持つ要素に aria-label を入れる
    var ariaNodes = document.querySelectorAll("[data-aria-label]");
    for (var j = 0; j < ariaNodes.length; j++) {
      var ariaEl = ariaNodes[j];
      var ariaKey = ariaEl.getAttribute("data-aria-label");
      ariaEl.setAttribute("aria-label", getText(ariaKey));
    }

    // 「あたらしく つくる」のニックネーム見出し
    var makeNameLabel = document.getElementById("make-name-label");
    if (makeNameLabel && ONPU.records) {
      makeNameLabel.textContent = getText("make.name.label", { max: ONPU.records.NAME_MAX });
    }

    renderMapRecords();

    // 設定画面・使い方のページのバージョン表示
    var ver = (ONPU.config && ONPU.config.version) ? ONPU.config.version : "";
    var versionText = getText("settings.version", { version: ver });
    var versionEl = document.getElementById("settings-version");
    if (versionEl) {
      versionEl.textContent = versionText;
    }
    var guideVersionEl = document.getElementById("guide-version");
    if (guideVersionEl) {
      guideVersionEl.textContent = versionText;
    }

    // デバッグモードのバッジ表示
    var debugBadge = document.getElementById("debug-badge");
    if (debugBadge) {
      if (ONPU.config && ONPU.config.debug) {
        debugBadge.textContent = getText("debug.badge");
        debugBadge.hidden = false;
      } else {
        debugBadge.hidden = true;
      }
    }

    updateRhythmSpeedButton();
  }

  // がっきずかんの大きくひらいたカードを閉じる
  function closeZukanBig() {
    zukanOpenId = null;
    var dimEl = document.getElementById("zukan-dim");
    if (dimEl) {
      dimEl.hidden = true;
    }
  }

  // がっきずかんのカードを大きくひらき、音を1回鳴らす
  function openZukanBig(id) {
    zukanOpenId = id;
    var picEl = document.getElementById("zukan-big-pic");
    if (picEl) {
      picEl.innerHTML = instrumentSvgHtml(id);
    }
    var nameEl = document.getElementById("zukan-big-name");
    if (nameEl) {
      nameEl.textContent = getText("inst." + id + ".name");
    }
    var hintEl = document.getElementById("zukan-big-hint");
    if (hintEl) {
      hintEl.textContent = getText("inst." + id + ".hint").replace(/([、。])\s*/g, "$1\n");
    }
    var dimEl = document.getElementById("zukan-dim");
    if (dimEl) {
      dimEl.hidden = false;
    }
    if (ONPU.audio && typeof ONPU.audio.playInstrument === "function") {
      ONPU.audio.playInstrument(id);
    }
  }

  // がっきずかん画面を作り直す
  function renderZukan() {
    closeZukanBig();
    if (!ONPU.rewards) {
      return;
    }
    var player = getCurrentPlayer();
    var total = (player && ONPU.records) ? ONPU.records.totalStars(player) : 0;
    var list = ONPU.rewards.INSTRUMENTS || [];
    var thresholds = ONPU.rewards.THRESHOLDS || [];
    var owned = ONPU.rewards.ownedCount(total);

    var sumEl = document.getElementById("zukan-sum");
    if (sumEl) {
      var maxStars = (ONPU.records && Array.isArray(ONPU.records.LEVEL_KEYS))
        ? ONPU.records.LEVEL_KEYS.length * 3
        : 45;
      var allCount = list.length;
      var sumHtml = getText("zukan.sum", {
        stars: "<b>" + total + "</b>",
        maxStars: "<b>" + maxStars + "</b>",
        owned: "<b>" + owned + "</b>",
        all: "<b>" + allCount + "</b>"
      });
      var nextText = owned < allCount
        ? getText("zukan.next", { n: ONPU.rewards.starsToNext(total) })
        : getText("zukan.all");
      sumEl.innerHTML = sumHtml + '<span class="next">' + nextText + "</span>";
    }

    var gridEl = document.getElementById("zukan-grid");
    if (!gridEl) {
      return;
    }
    gridEl.innerHTML = "";
    for (var i = 0; i < list.length; i++) {
      var id = list[i];
      if (i < owned) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.id = "btn-zukan-card-" + id;
        btn.className = "zk-card";

        var sndSpan = document.createElement("span");
        sndSpan.className = "snd";
        sndSpan.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="#1F2A44" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/></svg>';

        var picDiv = document.createElement("div");
        picDiv.className = "pic";
        picDiv.innerHTML = instrumentSvgHtml(id);

        var nmDiv = document.createElement("div");
        var instName = getText("inst." + id + ".name");
        nmDiv.className = "nm" + (instName.length >= 8 ? " long" : "");
        nmDiv.textContent = instName;

        btn.appendChild(sndSpan);
        btn.appendChild(picDiv);
        btn.appendChild(nmDiv);
        gridEl.appendChild(btn);

        (function (btnId, instId) {
          bindButton(btnId, function () {
            openZukanBig(instId);
          });
        })(btn.id, id);
      } else {
        var lockDiv = document.createElement("div");
        lockDiv.className = "zk-card lock";

        var qDiv = document.createElement("div");
        qDiv.className = "q";
        qDiv.textContent = getText("zukan.locked");

        var needDiv = document.createElement("div");
        needDiv.className = "need";
        needDiv.innerHTML = getText("zukan.need", { need: "<b>★" + thresholds[i] + "</b>" });

        lockDiv.appendChild(qDiv);
        lockDiv.appendChild(needDiv);
        gridEl.appendChild(lockDiv);
      }
    }
  }

  // スタンプちょう画面を作り直す
  function renderStamp() {
    if (!ONPU.records || !ONPU.rewards) {
      return;
    }
    var player = getCurrentPlayer();
    var keys = ONPU.records.LEVEL_KEYS || [];
    var doremiEl = document.getElementById("stamp-list-doremi");
    var rhythmEl = document.getElementById("stamp-list-rhythm");
    var puzzleEl = document.getElementById("stamp-list-puzzle");
    if (doremiEl) {
      doremiEl.innerHTML = "";
    }
    if (rhythmEl) {
      rhythmEl.innerHTML = "";
    }
    if (puzzleEl) {
      puzzleEl.innerHTML = "";
    }

    var bassGapAdded = false;
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var parsed = parseStampKey(key);
      if (!parsed) {
        continue;
      }
      var targetEl = null;
      var capText = "";
      if (key.indexOf("doremi.") === 0) {
        targetEl = doremiEl;
        if (parsed.mark === "bass" && !bassGapAdded && doremiEl) {
          var gap = document.createElement("div");
          gap.className = "st-gap";
          doremiEl.appendChild(gap);
          bassGapAdded = true;
        }
        capText = getText(parsed.mark === "bass" ? "stamp.cap.bass" : "stamp.cap.treble", { n: parsed.level });
      } else if (key.indexOf("rhythm.") === 0) {
        targetEl = rhythmEl;
        capText = getText("stamp.cap.level", { n: parsed.level });
      } else if (key.indexOf("puzzle.") === 0) {
        targetEl = puzzleEl;
        capText = getText("stamp.cap.level", { n: parsed.level });
      }
      if (!targetEl) {
        continue;
      }

      var cell = document.createElement("div");
      cell.className = "st-cell";
      var on = ONPU.rewards.hasStamp(player, key);
      cell.innerHTML = stampHtml(key, on, 104);
      var capDiv = document.createElement("div");
      capDiv.className = "st-cap";
      capDiv.textContent = capText;
      cell.appendChild(capDiv);
      targetEl.appendChild(cell);
    }

    var sumEl = document.getElementById("stamp-sum");
    if (sumEl) {
      var got = ONPU.rewards.stampCount(player);
      sumEl.innerHTML = getText("stamp.sum", {
        got: "<b>" + got + "</b>",
        all: "<b>" + keys.length + "</b>"
      });
    }
  }

  // 読み上げを止める
  function stopSpeech() {
    if (!window.speechSynthesis) {
      return;
    }
    try {
      window.speechSynthesis.cancel();
    } catch (e) {
      // 読み上げ停止の例外で画面を止めない
    }
  }

  // 読み上げの🔊ボタンの表示・非表示を更新する
  function updateSpeakButtons() {
    var show = Boolean(settingsData && settingsData.speech === true && window.speechSynthesis);
    var ids = ["btn-quiz-speak", "btn-puzzle-speak"];
    for (var i = 0; i < ids.length; i++) {
      var btn = document.getElementById(ids[i]);
      if (btn) {
        btn.style.display = show ? "" : "none";
      }
    }
  }

  // 指定した文を日本語の声で読み上げる（声がない端末では何もしない）
  function speakText(text) {
    if (!settingsData || settingsData.speech !== true || !window.speechSynthesis || !text) {
      return;
    }
    try {
      var voices = window.speechSynthesis.getVoices();
      var jaVoice = (ONPU.settings && typeof ONPU.settings.pickVoice === "function")
        ? ONPU.settings.pickVoice(voices)
        : null;
      if (!jaVoice) {
        return;
      }
      window.speechSynthesis.cancel();
      var utter = new SpeechSynthesisUtterance(text);
      utter.voice = jaVoice;
      utter.lang = jaVoice.lang;
      utter.rate = (ONPU.settings && typeof ONPU.settings.SPEECH_RATE === "number")
        ? ONPU.settings.SPEECH_RATE
        : 0.9;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      // 読み上げの例外で画面を止めない
    }
  }

  // 画面（section）の切り替え
  function showScreen(screenId) {
    stopSpeech();
    rhythmSpaceDown = false;
    var donBtnEl = document.getElementById("btn-rhythm-don");
    if (donBtnEl) {
      donBtnEl.classList.remove("pressed");
    }
    if (
      screenId === "screen-map" &&
      ONPU.settings &&
      typeof ONPU.settings.isOverLimit === "function" &&
      typeof ONPU.settings.dateKey === "function"
    ) {
      var curPlayer = getCurrentPlayer();
      if (curPlayer && ONPU.settings.isOverLimit(settingsData, curPlayer.id, ONPU.settings.dateKey(new Date()))) {
        saveSettings();
        screenId = "screen-timeup";
      }
    }
    if (screenId !== "screen-settings") {
      closeDeleteDialog();
    }
    if (screenId === "screen-who") {
      renderWho();
    } else if (screenId === "screen-map") {
      renderMapRecords();
    } else if (screenId === "screen-zukan") {
      renderZukan();
    } else if (screenId === "screen-stamp") {
      renderStamp();
    } else if (screenId === "screen-quiz" || screenId === "screen-puzzle") {
      updateSpeakButtons();
    }
    var debugBadge = document.getElementById("debug-badge");
    if (debugBadge) {
      debugBadge.classList.toggle("at-top", screenId === "screen-make");
    }
    if (screenId === "screen-guide") {
      var guideCard = document.getElementById("guide-card");
      if (guideCard) {
        guideCard.scrollTop = 0;
      }
    }
    var screens = document.querySelectorAll(".screen");
    for (var i = 0; i < screens.length; i++) {
      var s = screens[i];
      if (s.id === screenId) {
        s.classList.add("active");
      } else {
        s.classList.remove("active");
      }
    }
  }

  // 案内（トースト）を2秒表示して消す（表示中に再度押されたら2秒延長）
  function showToast(message) {
    var toast = document.getElementById("toast");
    if (!toast) {
      return;
    }
    toast.textContent = message;
    toast.classList.add("visible");

    if (toastTimerId !== null) {
      clearTimeout(toastTimerId);
    }
    toastTimerId = setTimeout(function () {
      toast.classList.remove("visible");
      toastTimerId = null;
    }, 2000);
  }

  // Pointer Events（指とマウスの両方に対応）でボタンを押したときのイベント登録
  function bindButton(id, handler) {
    var btn = document.getElementById(id);
    if (!btn) {
      return;
    }
    var activePointerId = null;
    btn.addEventListener("pointerdown", function (e) {
      if (e.button !== undefined && e.button !== 0) {
        return;
      }
      activePointerId = e.pointerId;
    });
    btn.addEventListener("pointerup", function (e) {
      if (activePointerId !== null && e.pointerId === activePointerId) {
        activePointerId = null;
        handler(e);
      }
    });
    btn.addEventListener("pointercancel", function () {
      activePointerId = null;
    });
    btn.addEventListener("pointerleave", function () {
      activePointerId = null;
    });
    // キーボード操作（Enter / Space）への対応
    btn.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handler(e);
      }
    });
  }

  // おうちの方の画面の「おとの たしかめ」の鍵盤ボタンを作る
  function buildSoundKeys() {
    var container = document.getElementById("settings-keys");
    if (!container || !ONPU.music || !Array.isArray(ONPU.music.KEYS)) {
      return;
    }
    container.innerHTML = "";
    for (var i = 0; i < ONPU.music.KEYS.length; i++) {
      var keyInfo = ONPU.music.KEYS[i];
      var btn = document.createElement("button");
      btn.type = "button";
      btn.id = "btn-key-" + keyInfo.name;
      btn.className = "settings-key-btn";
      btn.style.backgroundColor = keyInfo.color;
      btn.setAttribute("data-text", keyInfo.textId);
      container.appendChild(btn);
    }
  }

  // おうちの方の画面の「おとの たしかめ」のボタン動作を登録する
  function bindSoundButtons() {
    if (ONPU.music && Array.isArray(ONPU.music.KEYS)) {
      for (var i = 0; i < ONPU.music.KEYS.length; i++) {
        (function (noteName) {
          bindButton("btn-key-" + noteName, function () {
            if (ONPU.audio && typeof ONPU.audio.playNote === "function") {
              ONPU.audio.playNote(noteName, 0.5);
            }
          });
        })(ONPU.music.KEYS[i].name);
      }
    }

    bindButton("btn-sound-drum", function () {
      if (ONPU.audio && typeof ONPU.audio.playDrum === "function") {
        ONPU.audio.playDrum();
      }
    });

    bindButton("btn-sound-correct", function () {
      if (ONPU.audio && typeof ONPU.audio.playMelody === "function") {
        ONPU.audio.playMelody("correct");
      }
    });

    bindButton("btn-sound-clear", function () {
      if (ONPU.audio && typeof ONPU.audio.playMelody === "function") {
        ONPU.audio.playMelody("clear");
      }
    });

    bindButton("btn-sound-unlock", function () {
      if (ONPU.audio && typeof ONPU.audio.playMelody === "function") {
        ONPU.audio.playMelody("unlock");
      }
    });
  }

  // 次の問題やレベル4の自動再生のタイマーを止める
  function stopQuizTimer() {
    if (nextTimerId !== null) {
      clearTimeout(nextTimerId);
      nextTimerId = null;
    }
    if (earTimerId !== null) {
      clearTimeout(earTimerId);
      earTimerId = null;
    }
    waitingNext = false;
  }

  // レベルを選ぶ画面のカードを作って動作を登録する
  function buildLevelCards() {
    var container = document.getElementById("level-cards");
    if (!container || !ONPU.music) {
      return;
    }
    var isBass = currentClef === "bass";
    var list = isBass ? ONPU.music.BASS_LEVELS : ONPU.music.LEVELS;
    if (!Array.isArray(list)) {
      return;
    }
    var idPrefix = isBass ? "btn-level-bass-" : "btn-level-";
    container.innerHTML = "";
    for (var i = 0; i < list.length; i++) {
      var lv = list[i];
      var btnId = idPrefix + lv.level;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.id = btnId;
      btn.className = "level-card";

      var badge = document.createElement("span");
      badge.className = "level-badge";
      badge.style.backgroundColor = lv.color;
      badge.textContent = String(lv.level);

      var nameEl = document.createElement("span");
      nameEl.className = "level-name";
      nameEl.textContent = getText("level.name", { level: lv.level });

      var descEl = document.createElement("span");
      descEl.className = "level-desc";
      descEl.textContent = getText(lv.textId);

      btn.appendChild(badge);
      btn.appendChild(nameEl);
      btn.appendChild(descEl);
      container.appendChild(btn);

      (function (buttonId, levelInfo) {
        bindButton(buttonId, function () {
          startQuiz("doremi", levelInfo);
        });
      })(btnId, lv);
    }
  }

  // レベルを選ぶ画面の記号タブを切り替える
  function selectClef(clef) {
    if (clef !== "treble" && clef !== "bass") {
      return;
    }
    currentClef = clef;
    var isTreble = clef === "treble";
    var trebleTab = document.getElementById("btn-clef-treble");
    if (trebleTab) {
      trebleTab.classList.toggle("on", isTreble);
      trebleTab.setAttribute("aria-pressed", isTreble ? "true" : "false");
    }
    var bassTab = document.getElementById("btn-clef-bass");
    if (bassTab) {
      bassTab.classList.toggle("on", !isTreble);
      bassTab.setAttribute("aria-pressed", !isTreble ? "true" : "false");
    }
    buildLevelCards();
  }

  // リズムの森のレベルを選ぶカードを作って動作を登録する
  function buildRhythmLevelCards() {
    var container = document.getElementById("level-cards");
    if (!container || !ONPU.rhythm || !Array.isArray(ONPU.rhythm.LEVELS)) {
      return;
    }
    var list = ONPU.rhythm.LEVELS;
    container.innerHTML = "";
    for (var i = 0; i < list.length; i++) {
      var lv = list[i];
      var btnId = "btn-rhythm-level-" + lv.level;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.id = btnId;
      btn.className = "level-card";

      var badge = document.createElement("span");
      badge.className = "level-badge";
      badge.style.backgroundColor = lv.color;
      badge.textContent = String(lv.level);

      var nameEl = document.createElement("span");
      nameEl.className = "level-name";
      nameEl.textContent = getText("level.name", { level: lv.level });

      var descEl = document.createElement("span");
      descEl.className = "level-desc";
      descEl.textContent = getText(lv.textId);

      btn.appendChild(badge);
      btn.appendChild(nameEl);
      btn.appendChild(descEl);
      container.appendChild(btn);

      (function (buttonId, levelInfo) {
        bindButton(buttonId, function () {
          startRhythmSession(levelInfo);
        });
      })(btnId, lv);
    }
  }

  // パズルの谷のレベルを選ぶカードを作って動作を登録する
  function buildPuzzleLevelCards() {
    var container = document.getElementById("level-cards");
    if (!container || !ONPU.puzzle || !Array.isArray(ONPU.puzzle.LEVELS)) {
      return;
    }
    var list = ONPU.puzzle.LEVELS;
    container.innerHTML = "";
    for (var i = 0; i < list.length; i++) {
      var lv = list[i];
      var btnId = "btn-puzzle-level-" + lv.level;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.id = btnId;
      btn.className = "level-card";

      var badge = document.createElement("span");
      badge.className = "level-badge";
      badge.style.backgroundColor = lv.color;
      badge.textContent = String(lv.level);

      var nameEl = document.createElement("span");
      nameEl.className = "level-name";
      nameEl.textContent = getText("level.name", { level: lv.level });

      var descEl = document.createElement("span");
      descEl.className = "level-desc";
      descEl.textContent = getText(lv.textId);

      btn.appendChild(badge);
      btn.appendChild(nameEl);
      btn.appendChild(descEl);
      container.appendChild(btn);

      (function (buttonId, levelInfo) {
        bindButton(buttonId, function () {
          startPuzzleSession(levelInfo);
        });
      })(btnId, lv);
    }
  }

  // レベルを選ぶ画面を開く
  function openLevelScreen(islandKey) {
    stopQuizTimer();
    stopRhythmRound();
    stopPuzzle();
    var screenEl = document.getElementById("screen-level");
    var titleEl = document.getElementById("level-title");
    var tabsEl = document.getElementById("level-tabs");
    if (islandKey === "rhythm") {
      if (screenEl) {
        screenEl.style.backgroundColor = "var(--rhythm-bg)";
      }
      if (titleEl) {
        titleEl.textContent = getText("rhythm.title");
      }
      if (tabsEl) {
        tabsEl.style.display = "none";
      }
      buildRhythmLevelCards();
    } else if (islandKey === "puzzle") {
      if (screenEl) {
        screenEl.style.backgroundColor = "var(--puzzle-bg)";
      }
      if (titleEl) {
        titleEl.textContent = getText("puzzle.title");
      }
      if (tabsEl) {
        tabsEl.style.display = "none";
      }
      buildPuzzleLevelCards();
    } else {
      if (screenEl) {
        screenEl.style.backgroundColor = "var(--doremi-bg)";
      }
      if (titleEl) {
        titleEl.textContent = getText("map.island.doremi");
      }
      if (tabsEl) {
        tabsEl.style.display = "";
      }
      selectClef(currentClef);
    }
    showScreen("screen-level");
  }

  // 正解・不正解の演出を元に戻す
  function resetQuizFeedback() {
    var mascotEl = document.getElementById("quiz-mascot");
    if (mascotEl) {
      mascotEl.classList.remove("mascot-jump1", "mascot-jump2", "mascot-jump3");
    }
    var hintAnimEl = document.getElementById("quiz-hint");
    if (hintAnimEl) {
      hintAnimEl.classList.remove("hint-pop", "hint-pulse");
    }
    var noteEl = document.getElementById("quiz-note");
    if (noteEl) {
      noteEl.classList.remove("quiz-bounce");
    }
    var noteHeadEl = document.getElementById("quiz-note-head");
    if (noteHeadEl) {
      noteHeadEl.classList.remove("correct");
    }
    var earIconEl = document.getElementById("quiz-ear-icon");
    if (earIconEl) {
      earIconEl.classList.remove("quiz-bounce");
    }
    var answerBtns = document.querySelectorAll(".quiz-answer-btn");
    for (var i = 0; i < answerBtns.length; i++) {
      answerBtns[i].classList.remove("blink");
    }
  }

  // 問題の画面の答えのボタンを並べて動作を登録する
  function buildQuizAnswers(answers) {
    var container = document.getElementById("quiz-answers");
    if (!container || !Array.isArray(answers)) {
      return;
    }
    container.innerHTML = "";
    for (var i = 0; i < answers.length; i++) {
      var ans = answers[i];
      var btn = document.createElement("button");
      btn.type = "button";
      btn.id = "btn-answer-" + ans.id;
      btn.className = ans.id === "fa" ? "quiz-answer-btn quiz-answer-btn-fa" : "quiz-answer-btn";
      btn.style.backgroundColor = ans.color;
      btn.textContent = getText(ans.textId);
      container.appendChild(btn);

      (function (answerId, btnId) {
        bindButton(btnId, function () {
          handleQuizAnswer(answerId);
        });
      })(ans.id, btn.id);
    }
  }

  // 今の問題の音を鳴らす（「おとを きく」ボタンとレベル4の自動再生）
  function playCurrentQuestionSound(question) {
    if (!question || !ONPU.audio) {
      return;
    }
    if (currentLevel && currentLevel.mode === "ear") {
      if (typeof ONPU.audio.playSequence === "function" && ONPU.music && typeof ONPU.music.earSequence === "function") {
        ONPU.audio.playSequence(ONPU.music.earSequence(question));
      }
    } else {
      if (typeof ONPU.audio.playNote === "function") {
        ONPU.audio.playNote(question, 0.8);
      }
    }
  }

  // 今の問題を画面に表示する
  function renderQuizQuestion() {
    if (!currentSession || !ONPU.quiz) {
      return;
    }
    if (earTimerId !== null) {
      clearTimeout(earTimerId);
      earTimerId = null;
    }
    resetQuizFeedback();

    var total = currentSession.questions.length;
    var currentNum = currentSession.index + 1;

    var dotsEl = document.getElementById("quiz-dots");
    if (dotsEl) {
      dotsEl.innerHTML = "";
      for (var i = 0; i < total; i++) {
        var dot = document.createElement("div");
        dot.className = i < currentNum ? "quiz-dot filled" : "quiz-dot";
        dotsEl.appendChild(dot);
      }
    }

    var progressTextEl = document.getElementById("quiz-progress-text");
    if (progressTextEl) {
      progressTextEl.textContent = getText("quiz.progress", {
        current: currentNum,
        total: total
      });
    }

    var q = ONPU.quiz.current(currentSession);
    if (q === null) {
      return;
    }

    if (currentLevel && currentLevel.mode === "ear") {
      earTimerId = setTimeout(function () {
        earTimerId = null;
        playCurrentQuestionSound(q);
      }, 300);
    } else if (ONPU.music) {
      var clef = (currentLevel && currentLevel.clef) ? currentLevel.clef : "treble";
      var cy = ONPU.music.staffY(q, clef);
      var ledger = ONPU.music.needsLedger(q, clef);
      var up = ONPU.music.stemUp(q, clef);

      var ledgerEl = document.getElementById("quiz-ledger");
      if (ledgerEl) {
        ledgerEl.style.display = ledger ? "" : "none";
        if (cy !== null) {
          ledgerEl.setAttribute("y", String(cy - 2));
        }
      }
      var ellipseEl = document.getElementById("quiz-note-ellipse");
      if (ellipseEl && cy !== null) {
        ellipseEl.setAttribute("cy", String(cy));
        ellipseEl.setAttribute("transform", "rotate(-20 433 " + cy + ")");
      }
      var stemEl = document.getElementById("quiz-note-stem");
      if (stemEl && cy !== null && up !== null) {
        stemEl.setAttribute("x", up ? "450" : "410");
        stemEl.setAttribute("y", String(up ? (cy - 128) : cy));
      }
    }
  }

  // クリア画面の「あたらしい スタンプ」「あたらしい がっき！」カードを作る
  function renderClearRewards(saveResult, stars, isRhythm) {
    clearNewInstId = null;
    var stampEl = document.getElementById("clear-new-stamp");
    var instEl = document.getElementById("btn-clear-new-inst");
    if (stampEl) {
      stampEl.hidden = true;
      stampEl.innerHTML = "";
    }
    if (instEl) {
      instEl.hidden = true;
      instEl.innerHTML = "";
    }
    if (!saveResult || !ONPU.rewards) {
      return;
    }

    if (stampEl && ONPU.rewards.isNewStamp(saveResult.prev, stars)) {
      var parsed = parseStampKey(saveResult.key);
      var islandName = parsed ? getText("map.island." + parsed.island) : "";
      var stampSize = isRhythm ? 76 : 92;

      var capStamp = document.createElement("div");
      capStamp.className = "cap";
      capStamp.textContent = getText("clear.newStamp");

      var stampWrap = document.createElement("div");
      stampWrap.innerHTML = stampHtml(saveResult.key, true, stampSize);

      var nmStamp = document.createElement("div");
      nmStamp.className = "nm";
      nmStamp.textContent = islandName;

      stampEl.appendChild(capStamp);
      if (stampWrap.firstChild) {
        stampEl.appendChild(stampWrap.firstChild);
      }
      stampEl.appendChild(nmStamp);
      stampEl.hidden = false;
    }

    var gained = ONPU.rewards.newInstruments(saveResult.before, saveResult.after);
    if (instEl && gained.length > 0) {
      var instId = gained[gained.length - 1];
      clearNewInstId = instId;

      var capInst = document.createElement("div");
      capInst.className = "cap";
      capInst.textContent = getText("clear.newInst");

      var picInst = document.createElement("div");
      picInst.className = "pic";
      picInst.innerHTML = instrumentSvgHtml(instId);

      var nmInst = document.createElement("div");
      var instName = getText("inst." + instId + ".name");
      nmInst.className = "nm" + (instName.length >= 8 ? " long" : "");
      nmInst.textContent = instName;

      instEl.appendChild(capInst);
      instEl.appendChild(picInst);
      instEl.appendChild(nmInst);
      instEl.hidden = false;
    }
  }

  // クリア画面を表示する
  function showClearScreen() {
    if (!currentSession || !ONPU.quiz) {
      return;
    }
    var total = currentSession.questions.length;
    var correct = currentSession.correct;
    var stars = ONPU.quiz.calcStars(correct, total);

    var titleEl = document.getElementById("clear-title");
    if (titleEl) {
      titleEl.textContent = stars >= 1 ? getText("clear.title") : getText("clear.title.miss");
    }

    var starsEl = document.getElementById("clear-stars");
    if (starsEl) {
      var starText = "";
      for (var i = 0; i < 3; i++) {
        starText += i < stars ? "★" : "☆";
      }
      starsEl.textContent = starText;
    }

    var resultEl = document.getElementById("clear-result");
    if (resultEl) {
      resultEl.textContent = getText("clear.result", {
        total: total,
        correct: correct
      });
    }

    var clearScreen = document.getElementById("screen-clear");
    if (clearScreen) {
      clearScreen.classList.remove("rhythm");
    }
    clearKind = "doremi";

    var saveResult = currentLevel
      ? recordAndSaveStars("doremi", currentLevel.clef, currentLevel.level, stars)
      : null;
    renderClearRewards(saveResult, stars, false);

    showScreen("screen-clear");

    if (stars >= 1 && ONPU.audio && typeof ONPU.audio.playMelody === "function") {
      ONPU.audio.playMelody("clear");
    }
  }

  // リズムの森のクリア画面を表示する
  function showRhythmClearScreen() {
    if (!ONPU.rhythm || !ONPU.quiz) {
      return;
    }
    var score = ONPU.rhythm.scoreOf(rhythmResults);
    var stars = ONPU.quiz.calcStars(score, 100);

    var titleEl = document.getElementById("clear-title");
    if (titleEl) {
      titleEl.textContent = stars >= 1 ? getText("clear.title") : getText("clear.title.miss");
    }

    var starsEl = document.getElementById("clear-stars");
    if (starsEl) {
      var starText = "";
      for (var i = 0; i < 3; i++) {
        starText += i < stars ? "★" : "☆";
      }
      starsEl.textContent = starText;
    }

    var scoreNumEl = document.getElementById("clear-score-num");
    if (scoreNumEl) {
      scoreNumEl.textContent = String(score);
    }

    var qdotsEl = document.getElementById("clear-qdots");
    if (qdotsEl) {
      qdotsEl.innerHTML = "";
      for (var k = 0; k < rhythmResults.length; k++) {
        var r = rhythmResults[k];
        var cls = (r === "pittari" || r === "oshii") ? r : "retry";
        var pt = (ONPU.rhythm.POINTS && Object.prototype.hasOwnProperty.call(ONPU.rhythm.POINTS, cls))
          ? ONPU.rhythm.POINTS[cls]
          : 0;

        var dot = document.createElement("div");
        dot.className = "clear-qdot " + cls;

        var numSpan = document.createElement("span");
        numSpan.className = "clear-qdot-num";
        numSpan.textContent = getText("rhythm.clear.qnum", { num: k + 1 });

        var ptSpan = document.createElement("span");
        ptSpan.className = "clear-qdot-pt";
        ptSpan.textContent = String(pt);

        dot.appendChild(numSpan);
        dot.appendChild(ptSpan);
        qdotsEl.appendChild(dot);
      }
    }

    var clearScreen = document.getElementById("screen-clear");
    if (clearScreen) {
      clearScreen.classList.add("rhythm");
    }
    clearKind = "rhythm";

    var saveResult = rhythmLevel
      ? recordAndSaveStars("rhythm", null, rhythmLevel.level, stars)
      : null;
    renderClearRewards(saveResult, stars, true);

    showScreen("screen-clear");

    if (stars >= 1 && ONPU.audio && typeof ONPU.audio.playMelody === "function") {
      ONPU.audio.playMelody("clear");
    }
  }

  // パズルの谷のクリア画面を表示する
  function showPuzzleClearScreen() {
    if (!ONPU.quiz) {
      return;
    }
    var total = puzzleQuestions.length;
    var correct = 0;
    for (var i = 0; i < puzzleResults.length; i++) {
      if (puzzleResults[i] === "pittari") {
        correct += 1;
      }
    }
    var stars = ONPU.quiz.calcStars(correct, total);

    var titleEl = document.getElementById("clear-title");
    if (titleEl) {
      titleEl.textContent = stars >= 1 ? getText("clear.title") : getText("clear.title.miss");
    }

    var starsEl = document.getElementById("clear-stars");
    if (starsEl) {
      var starText = "";
      for (var k = 0; k < 3; k++) {
        starText += k < stars ? "★" : "☆";
      }
      starsEl.textContent = starText;
    }

    var resultEl = document.getElementById("clear-result");
    if (resultEl) {
      resultEl.textContent = getText("puzzle.clear.result", {
        total: total,
        correct: correct
      });
    }

    var clearScreen = document.getElementById("screen-clear");
    if (clearScreen) {
      clearScreen.classList.remove("rhythm");
    }
    clearKind = "puzzle";

    var saveResult = puzzleLevel
      ? recordAndSaveStars("puzzle", null, puzzleLevel.level, stars)
      : null;
    renderClearRewards(saveResult, stars, false);

    showScreen("screen-clear");

    if (stars >= 1 && ONPU.audio && typeof ONPU.audio.playMelody === "function") {
      ONPU.audio.playMelody("clear");
    }
  }

  // class を外して付け直し、同じ動きでも毎回はじめから動かす
  function restartClass(el, cls) {
    el.classList.remove(cls);
    el.getBoundingClientRect();
    el.classList.add(cls);
  }

  // 吹き出しを元のヒントに戻し、連続正解の class をすべて外す
  function resetQuizHint() {
    var hintEl = document.getElementById("quiz-hint");
    if (!hintEl) {
      return;
    }
    var island = ISLANDS[currentIslandKey];
    if (island) {
      var isEar = currentLevel && currentLevel.mode === "ear";
      hintEl.textContent = getText(isEar ? island.earHintTextId : island.hintTextId);
    }
    hintEl.classList.remove("streak", "streak-s", "streak-m", "streak-l", "hint-pop", "hint-pulse");
  }

  // 連続正解の吹き出しとキャラの演出（streak が3以上のとき）
  function showStreak(streak) {
    var hintEl = document.getElementById("quiz-hint");
    var stage = streak >= 8 ? "l" : (streak >= 5 ? "m" : "s");
    if (hintEl) {
      hintEl.textContent = getText("quiz.streak", { count: streak });
      hintEl.classList.add("streak");
      hintEl.classList.remove("streak-s", "streak-m", "streak-l");
      hintEl.classList.add("streak-" + stage);
      hintEl.classList.remove("hint-pop", "hint-pulse");
      restartClass(hintEl, stage === "l" ? "hint-pulse" : "hint-pop");
    }
    var mascotEl = document.getElementById("quiz-mascot");
    if (mascotEl) {
      var jumpCls = stage === "l" ? "mascot-jump3" : (stage === "m" ? "mascot-jump2" : "mascot-jump1");
      mascotEl.classList.remove("mascot-jump1", "mascot-jump2", "mascot-jump3");
      restartClass(mascotEl, jumpCls);
    }
  }

  // 答えのボタンが押されたときの処理
  function handleQuizAnswer(answerId) {
    if (waitingNext || !currentSession || currentSession.finished || !ONPU.quiz) {
      return;
    }
    var question = ONPU.quiz.current(currentSession);
    var result = ONPU.quiz.submit(currentSession, answerId);
    if (!result) {
      return;
    }
    if (earTimerId !== null) {
      clearTimeout(earTimerId);
      earTimerId = null;
    }
    waitingNext = true;

    if (result.isCorrect) {
      if (ONPU.audio && typeof ONPU.audio.playMelody === "function") {
        var melodyKey = (ONPU.music && typeof ONPU.music.pickCorrectKey === "function")
          ? ONPU.music.pickCorrectKey(lastCorrectKey)
          : "correct";
        ONPU.audio.playMelody(melodyKey);
        lastCorrectKey = melodyKey;
      }
      if (result.streak >= 3) {
        showStreak(result.streak);
      }
      if (currentLevel && currentLevel.mode === "ear") {
        var earIconEl = document.getElementById("quiz-ear-icon");
        if (earIconEl) {
          earIconEl.classList.add("quiz-bounce");
        }
      } else {
        var noteEl = document.getElementById("quiz-note");
        if (noteEl) {
          noteEl.classList.add("quiz-bounce");
        }
        var noteHeadEl = document.getElementById("quiz-note-head");
        if (noteHeadEl) {
          noteHeadEl.classList.add("correct");
        }
      }
    } else {
      resetQuizHint();
      if (question !== null && ONPU.audio && typeof ONPU.audio.playNote === "function") {
        ONPU.audio.playNote(question, 0.6);
      }
      if (result.correctAnswer) {
        var correctBtn = document.getElementById("btn-answer-" + result.correctAnswer);
        if (correctBtn) {
          correctBtn.classList.add("blink");
        }
      }
    }

    var delay = result.isCorrect ? 900 : 1500;
    nextTimerId = setTimeout(function () {
      nextTimerId = null;
      waitingNext = false;
      if (result.finished) {
        showClearScreen();
      } else {
        renderQuizQuestion();
      }
    }, delay);
  }

  // 指定した島・レベルの問題を始める
  function startQuiz(islandKey, levelInfo) {
    var island = ISLANDS[islandKey];
    if (!island || !ONPU.quiz) {
      return;
    }
    var lv = levelInfo || (ONPU.music && Array.isArray(ONPU.music.LEVELS) ? ONPU.music.LEVELS[0] : null);
    if (!lv) {
      return;
    }
    stopQuizTimer();
    currentIslandKey = islandKey;
    currentLevel = lv;

    var isEar = lv.mode === "ear";

    var quizScreen = document.getElementById("screen-quiz");
    if (quizScreen) {
      quizScreen.style.backgroundColor = island.bgColor;
    }
    var titleEl = document.getElementById("quiz-title");
    if (titleEl) {
      titleEl.textContent = getText(island.titleTextId);
    }
    var questionTextEl = document.getElementById("quiz-question-text");
    if (questionTextEl) {
      questionTextEl.textContent = getText(isEar ? island.earQuestionTextId : island.questionTextId);
    }
    resetQuizHint();
    var isBass = lv.clef === "bass";
    var clefTrebleEl = document.getElementById("quiz-clef-treble");
    if (clefTrebleEl) {
      clefTrebleEl.style.display = isBass ? "none" : "";
    }
    var clefBassEl = document.getElementById("quiz-clef-bass");
    if (clefBassEl) {
      clefBassEl.style.display = isBass ? "" : "none";
    }
    var staffEl = document.getElementById("quiz-staff");
    if (staffEl) {
      staffEl.style.display = isEar ? "none" : "block";
    }
    var earIconEl = document.getElementById("quiz-ear-icon");
    if (earIconEl) {
      earIconEl.style.display = isEar ? "block" : "none";
    }

    buildQuizAnswers(island.getAnswers());

    var count = (ONPU.config && ONPU.config.questionCount) ? ONPU.config.questionCount : 10;
    var questions = ONPU.quiz.makeQuestions(lv.pool, count);
    currentSession = ONPU.quiz.createSession(questions, island.answerOf, { retry: true });

    renderQuizQuestion();
    showScreen("screen-quiz");
  }

  // リズムの森のはやさのボタンの表示を更新する
  function updateRhythmSpeedButton() {
    var btn = document.getElementById("btn-rhythm-speed");
    if (!btn) {
      return;
    }
    btn.textContent = getText("rhythm.speed", {
      speed: getText("rhythm.speed." + rhythmSpeedKey)
    });
  }

  // リズムの森のカードの上の一言を更新する
  function setRhythmLead(text, isCount, beatNum) {
    var leadEl = document.getElementById("rhythm-lead");
    if (!leadEl) {
      return;
    }
    var hasBeatNum = typeof beatNum === "number" && isFinite(beatNum) && Math.floor(beatNum) === beatNum && beatNum >= 1 && beatNum <= 4;
    var numKey = hasBeatNum ? beatNum : null;
    if (rhythmLeadText !== text || rhythmLeadBeatNum !== numKey) {
      rhythmLeadText = text;
      rhythmLeadBeatNum = numKey;
      leadEl.textContent = text;
      if (hasBeatNum) {
        var numSpan = document.createElement("span");
        numSpan.className = "rhythm-lead-num";
        numSpan.textContent = getText("rhythm.count", { count: beatNum });
        leadEl.appendChild(numSpan);
      }
    }
    leadEl.classList.toggle("count", Boolean(isCount));
  }

  // リズムの森の今の拍のカードを光らせる（-1 のときはすべて消す）
  function setActiveRhythmCard(activeIdx) {
    for (var i = 0; i < rhythmCardEls.length; i++) {
      rhythmCardEls[i].classList.toggle("active", i === activeIdx);
    }
  }

  // リズムの森の点をすべて「たたく前」にもどす
  function resetRhythmDots() {
    for (var i = 0; i < rhythmDotEls.length; i++) {
      rhythmDotEls[i].className = "rhythm-dot";
    }
  }

  // リズムの森の結果の吹き出しを消す
  function hideRhythmBubble() {
    var bubbleEl = document.getElementById("rhythm-bubble");
    if (bubbleEl) {
      bubbleEl.hidden = true;
      bubbleEl.classList.remove("pop");
      bubbleEl.textContent = "";
    }
  }

  // リズムの森の結果のあとのボタンを消す
  function hideRhythmFlowButtons() {
    var retryBtn = document.getElementById("btn-rhythm-retry");
    if (retryBtn) {
      retryBtn.hidden = true;
    }
    var nextBtn = document.getElementById("btn-rhythm-next");
    if (nextBtn) {
      nextBtn.hidden = true;
    }
  }

  // リズムの森の1回の記録を捨てる
  function clearRhythmSession() {
    rhythmQuestions = [];
    rhythmQIndex = 0;
    rhythmAttempt = 1;
    rhythmResults = [];
    rhythmLastResult = null;
  }

  // リズムの森の進行中の繰り返しとタイマーをすべて止め、表示を初期状態にもどす
  function stopRhythmRound() {
    if (rhythmRafId !== null) {
      cancelAnimationFrame(rhythmRafId);
      rhythmRafId = null;
    }
    if (rhythmAutoTimerId !== null) {
      clearTimeout(rhythmAutoTimerId);
      rhythmAutoTimerId = null;
    }
    if (rhythmFlowTimerId !== null) {
      clearTimeout(rhythmFlowTimerId);
      rhythmFlowTimerId = null;
    }
    for (var i = 0; i < rhythmDotTimers.length; i++) {
      clearTimeout(rhythmDotTimers[i]);
    }
    rhythmDotTimers = [];
    rhythmSoundQueue = [];
    rhythmTaps = [];
    rhythmState = "waiting";
    setActiveRhythmCard(-1);
    setRhythmLead(getText("rhythm.lead"), false);
    hideRhythmBubble();
    hideRhythmFlowButtons();
    resetRhythmDots();
  }

  // リズムの森の今の問題のカードと点の列、進み具合を作る
  function renderRhythmPattern() {
    rhythmPattern = rhythmQuestions[rhythmQIndex] || [];
    var total = rhythmQuestions.length;
    var currentNum = rhythmQIndex + 1;

    var progDotsEl = document.getElementById("rhythm-progress-dots");
    if (progDotsEl) {
      progDotsEl.innerHTML = "";
      for (var p = 0; p < total; p++) {
        var pDot = document.createElement("div");
        pDot.className = p < currentNum ? "quiz-dot filled" : "quiz-dot";
        progDotsEl.appendChild(pDot);
      }
    }

    var progTextEl = document.getElementById("rhythm-progress-text");
    if (progTextEl) {
      progTextEl.textContent = getText("quiz.progress", {
        current: currentNum,
        total: total
      });
    }

    var cardsContainer = document.getElementById("rhythm-cards");
    var dotsContainer = document.getElementById("rhythm-dots");
    rhythmCardEls = [];
    rhythmDotEls = [];
    if (!cardsContainer || !dotsContainer) {
      return;
    }
    cardsContainer.innerHTML = "";
    dotsContainer.innerHTML = "";

    for (var i = 0; i < rhythmPattern.length; i++) {
      var id = rhythmPattern[i];
      var isWide = id === "taan";
      var w = RHYTHM_GLYPH_WIDTH[id] || 34;

      var cardEl = document.createElement("div");
      cardEl.className = isWide ? "rhythm-card wide" : "rhythm-card";
      cardEl.innerHTML =
        '<svg width="' + w + '" height="104" aria-hidden="true"><use href="#glyph-' + id + '"/></svg>' +
        '<span class="rhythm-card-label">' + getText("rhythm.card." + id) + "</span>";
      cardsContainer.appendChild(cardEl);
      rhythmCardEls.push(cardEl);

      var colEl = document.createElement("div");
      colEl.className = isWide ? "rhythm-dot-col wide" : "rhythm-dot-col";
      var hitCount = (ONPU.rhythm && ONPU.rhythm.CARDS && ONPU.rhythm.CARDS[id])
        ? ONPU.rhythm.CARDS[id].hits.length
        : 0;
      for (var k = 0; k < hitCount; k++) {
        var dotEl = document.createElement("div");
        dotEl.className = "rhythm-dot";
        colEl.appendChild(dotEl);
        rhythmDotEls.push(dotEl);
      }
      dotsContainer.appendChild(colEl);
    }
  }

  // まだ予約していない音のうち、時刻が now + 0.15 秒以内のものだけを予約する
  function scheduleDueRhythmSounds(now) {
    if (!ONPU.audio) {
      return;
    }
    for (var i = 0; i < rhythmSoundQueue.length; i++) {
      var ev = rhythmSoundQueue[i];
      if (!ev.done && ev.time <= now + 0.15) {
        ev.done = true;
        if (ev.kind === "drum" && typeof ONPU.audio.playDrum === "function") {
          ONPU.audio.playDrum(ev.time);
        } else if (ev.kind === "note" && typeof ONPU.audio.playNoteAt === "function") {
          ONPU.audio.playNoteAt(ev.note, ev.time, ev.duration, ev.volume);
        }
      }
    }
  }

  // 1問の判定を行い、点・吹き出し・メロディを出して結果のあとのボタンを予約する
  function finishRhythmRound() {
    if (rhythmRafId !== null) {
      cancelAnimationFrame(rhythmRafId);
      rhythmRafId = null;
    }
    rhythmState = "result";
    setActiveRhythmCard(-1);
    setRhythmLead(getText("rhythm.lead"), false);
    resetRhythmDots();

    if (!ONPU.rhythm || typeof ONPU.rhythm.judge !== "function") {
      return;
    }
    var win = (ONPU.settings && typeof ONPU.settings.rhythmWindow === "function")
      ? ONPU.settings.rhythmWindow(settingsData)
      : ((ONPU.config && ONPU.config.rhythmWindow)
        ? ONPU.config.rhythmWindow
        : { perfect: 0.15, good: 0.30 });
    var res = ONPU.rhythm.judge(rhythmPattern, rhythmBpm, rhythmTaps, {
      perfect: win.perfect,
      good: win.good,
      offset: rhythmLat
    });
    var resultKey = res ? res.result : "retry";
    rhythmLastResult = resultKey;

    if (res) {
      for (var i = 0; i < res.notes.length; i++) {
        (function (idx, grade) {
          var applyDot = function () {
            var dot = rhythmDotEls[idx];
            if (!dot) {
              return;
            }
            dot.className = "rhythm-dot " + grade;
            restartClass(dot, "pop");
          };
          if (idx === 0) {
            applyDot();
          } else {
            var tid = setTimeout(applyDot, idx * 120);
            rhythmDotTimers.push(tid);
          }
        })(i, res.notes[i].grade);
      }

      var bubbleEl = document.getElementById("rhythm-bubble");
      if (bubbleEl) {
        bubbleEl.textContent = getText("rhythm.result." + res.result);
        bubbleEl.hidden = false;
        restartClass(bubbleEl, "pop");
      }

      if (res.result === "pittari" && ONPU.audio && typeof ONPU.audio.playMelody === "function") {
        var melodyKey = (ONPU.music && typeof ONPU.music.pickCorrectKey === "function")
          ? ONPU.music.pickCorrectKey(lastCorrectKey)
          : "correct";
        ONPU.audio.playMelody(melodyKey);
        lastCorrectKey = melodyKey;
      }
    }

    rhythmFlowTimerId = setTimeout(function () {
      rhythmFlowTimerId = null;
      var retryBtn = document.getElementById("btn-rhythm-retry");
      var nextBtn = document.getElementById("btn-rhythm-next");
      var retryable = typeof ONPU.rhythm.canRetry === "function" && ONPU.rhythm.canRetry(resultKey, rhythmAttempt);
      if (retryable) {
        if (retryBtn) {
          retryBtn.className = "rhythm-flow-btn";
          retryBtn.hidden = false;
        }
        if (nextBtn) {
          nextBtn.className = "rhythm-flow-btn sub";
          nextBtn.hidden = false;
        }
      } else {
        if (retryBtn) {
          retryBtn.hidden = true;
        }
        if (nextBtn) {
          nextBtn.className = "rhythm-flow-btn";
          nextBtn.hidden = false;
        }
      }
    }, 600);
  }

  // requestAnimationFrame で音の予約と画面の表示を進める
  function tickRhythm() {
    rhythmRafId = null;
    var now = (ONPU.audio && typeof ONPU.audio.now === "function") ? ONPU.audio.now() : null;
    if (now === null) {
      stopRhythmRound();
      return;
    }

    scheduleDueRhythmSounds(now);

    if (now >= rhythmStart + 4 * rhythmBeatSec + rhythmLat + 0.4) {
      finishRhythmRound();
      return;
    }

    var viewNow = now - rhythmLat;
    var modelEnd = rhythmBase + 4 * rhythmBeatSec;
    var tapEnd = rhythmStart + 4 * rhythmBeatSec;

    if (viewNow < modelEnd - 1e-9) {
      rhythmState = "model";
      setRhythmLead(getText(rhythmAttempt === 2 ? "rhythm.listen.again" : "rhythm.listen"), false);
      if (viewNow >= rhythmBase - 1e-9) {
        var modelCardIdx = ONPU.rhythm.cardIndexAt(rhythmPattern, rhythmBpm, viewNow - rhythmBase);
        setActiveRhythmCard(modelCardIdx);
        if (rhythmModelTimeline && Array.isArray(rhythmModelTimeline.hits)) {
          for (var k = 0; k < rhythmModelTimeline.hits.length; k++) {
            if (viewNow + 1e-9 >= rhythmModelTimeline.hits[k] && rhythmDotEls[k]) {
              rhythmDotEls[k].classList.add("model");
            }
          }
        }
      } else {
        setActiveRhythmCard(-1);
      }
    } else if (viewNow < rhythmStart - 1e-9) {
      rhythmState = "count";
      setActiveRhythmCard(-1);
      for (var d = 0; d < rhythmDotEls.length; d++) {
        rhythmDotEls[d].classList.remove("model");
      }
      var beatNum = Math.floor((viewNow - modelEnd + 1e-9) / rhythmBeatSec) + 1;
      if (beatNum < 1) {
        beatNum = 1;
      } else if (beatNum > 4) {
        beatNum = 4;
      }
      setRhythmLead(getText("rhythm.count", { count: beatNum }), true);
    } else {
      rhythmState = "tap";
      for (var d2 = 0; d2 < rhythmDotEls.length; d2++) {
        rhythmDotEls[d2].classList.remove("model");
      }
      if (viewNow < tapEnd - 1e-9) {
        var tapBeatNum = Math.floor((viewNow - rhythmStart + 1e-9) / rhythmBeatSec) + 1;
        if (tapBeatNum < 1) {
          tapBeatNum = 1;
        } else if (tapBeatNum > 4) {
          tapBeatNum = 4;
        }
        setRhythmLead(getText("rhythm.go"), false, tapBeatNum);
        var tapCardIdx = ONPU.rhythm.cardIndexAt(rhythmPattern, rhythmBpm, viewNow - rhythmStart);
        setActiveRhythmCard(tapCardIdx);
      } else {
        setRhythmLead(getText("rhythm.go"), false);
        setActiveRhythmCard(-1);
      }
    }

    rhythmRafId = requestAnimationFrame(tickRhythm);
  }

  // 今の問題をお手本から始める
  function startRhythmPlayback() {
    stopRhythmRound();
    if (!ONPU.rhythm || !ONPU.audio || typeof ONPU.audio.now !== "function") {
      return;
    }
    var now = ONPU.audio.now();
    if (now === null) {
      return;
    }
    var info = typeof ONPU.audio.getLatency === "function" ? ONPU.audio.getLatency() : null;
    rhythmLat = info ? ONPU.rhythm.latencyFrom(info.base, info.output) : 0;
    rhythmPattern = rhythmQuestions[rhythmQIndex] || [];
    rhythmBpm = (ONPU.rhythm.SPEEDS && ONPU.rhythm.SPEEDS[rhythmSpeedKey]) ? ONPU.rhythm.SPEEDS[rhythmSpeedKey] : 60;
    rhythmBeatSec = 60 / rhythmBpm;
    rhythmBase = now + 0.3;
    rhythmStart = rhythmBase + 8 * rhythmBeatSec;

    rhythmModelTimeline = ONPU.rhythm.timeline(rhythmPattern, rhythmBpm, rhythmBase);
    var countTimes = ONPU.rhythm.countInTimes(rhythmBpm, rhythmStart);
    var tapTimes = ONPU.rhythm.tapBeatTimes(rhythmBpm, rhythmStart);

    rhythmSoundQueue = [];
    if (rhythmModelTimeline && Array.isArray(rhythmModelTimeline.hits)) {
      for (var i = 0; i < rhythmModelTimeline.hits.length; i++) {
        rhythmSoundQueue.push({
          time: rhythmModelTimeline.hits[i],
          kind: "drum",
          done: false
        });
      }
    }
    for (var j = 0; j < countTimes.length; j++) {
      rhythmSoundQueue.push({
        time: countTimes[j],
        kind: "note",
        note: j === 0 ? "C6" : "C5",
        duration: 0.1,
        done: false
      });
    }
    for (var m = 0; m < tapTimes.length; m++) {
      rhythmSoundQueue.push({
        time: tapTimes[m],
        kind: "note",
        note: m === 0 ? "C6" : "C5",
        duration: 0.1,
        volume: ONPU.rhythm.TAP_BEAT_VOLUME,
        done: false
      });
    }

    rhythmTaps = [];
    rhythmState = "model";
    setRhythmLead(getText(rhythmAttempt === 2 ? "rhythm.listen.again" : "rhythm.listen"), false);
    scheduleDueRhythmSounds(now);
    rhythmRafId = requestAnimationFrame(tickRhythm);
  }

  // リズムの森の1回（5問）を始める
  function startRhythmSession(lv) {
    if (!lv || !ONPU.rhythm) {
      return;
    }
    stopQuizTimer();
    stopRhythmRound();
    rhythmLevel = lv;
    rhythmQuestions = ONPU.rhythm.pickPatterns(lv.pool, ONPU.rhythm.QUESTION_COUNT);
    rhythmQIndex = 0;
    rhythmAttempt = 1;
    rhythmResults = [];
    rhythmLastResult = null;
    updateRhythmSpeedButton();
    renderRhythmPattern();
    showScreen("screen-rhythm");
    rhythmAutoTimerId = setTimeout(function () {
      rhythmAutoTimerId = null;
      startRhythmPlayback();
    }, 600);
  }

  // ---- パズルの谷 ----

  // 現在の問題を返す（ないときは null）
  function currentPuzzleProblem() {
    return puzzleQuestions[puzzleQIndex] || null;
  }

  // はじめのピースと子どもが入れたピースを合わせた並びを返す
  function currentPuzzleList() {
    var prob = currentPuzzleProblem();
    return prob ? prob.given.concat(puzzlePlaced) : [];
  }

  // 埋まったときの言葉（「ぴったり！」または「できた！」）を返す
  function puzzleFilledText() {
    return getText(puzzleResultNow === "done" ? "puzzle.done" : "puzzle.exact");
  }

  // パズルの谷の1回の記録を捨てる
  function clearPuzzleSession() {
    puzzleQuestions = [];
    puzzleQIndex = 0;
    puzzleResults = [];
    puzzleResultNow = null;
    puzzlePlaced = [];
    puzzleOverCount = 0;
  }

  // ピースの拍数（半拍 ÷ 2）を返す
  function puzzlePieceBeats(id) {
    return ONPU.puzzle ? ONPU.puzzle.pieceUnits(id) / 2 : 0;
  }

  // ピースの色を表す CSS クラス名を返す
  function puzzlePieceColorClass(id) {
    if (!ONPU.puzzle) {
      return "u2";
    }
    var piece = ONPU.puzzle.PIECES && ONPU.puzzle.PIECES[id];
    if (piece && piece.rest) {
      return "rest";
    }
    return "u" + ONPU.puzzle.pieceUnits(id);
  }

  // 半拍の数から { num, unit } の言い方を返す
  function puzzleBeatWords(units) {
    var parts = (ONPU.puzzle && typeof ONPU.puzzle.beatParts === "function")
      ? ONPU.puzzle.beatParts(units)
      : null;
    if (!parts) {
      return { num: "0", unit: getText("puzzle.unit") };
    }
    if (!parts.half) {
      return { num: String(parts.whole), unit: getText("puzzle.unit") };
    }
    if (parts.whole === 0) {
      return { num: getText("puzzle.half"), unit: getText("puzzle.unit") };
    }
    return { num: String(parts.whole), unit: getText("puzzle.unitHalf") };
  }

  // 小節の箱の位置と幅を返す
  function puzzleBoxGeom(meter) {
    var beats = ONPU.puzzle ? ONPU.puzzle.measureUnits(meter) / 2 : 4;
    var w = beats * PUZZLE_BEAT_WIDTH + 40;
    return {
      beats: beats,
      w: w,
      left: Math.round((STAGE_WIDTH - w) / 2)
    };
  }

  // #stage の拡大・縮小を戻した座標を返す
  function puzzleStagePoint(e) {
    var stage = document.getElementById("stage");
    if (!stage) {
      return { x: 0, y: 0 };
    }
    var r = stage.getBoundingClientRect();
    var scale = r.width / STAGE_WIDTH;
    if (!scale) {
      return { x: 0, y: 0 };
    }
    return {
      x: (e.clientX - r.left) / scale,
      y: (e.clientY - r.top) / scale
    };
  }

  // 箱の上（左右 30px・上下 40px 広げた範囲）かどうかを判定する
  function isPointOverPuzzleBox(p, meter) {
    var g = puzzleBoxGeom(meter);
    return (
      p.x >= g.left - 30 &&
      p.x <= g.left + g.w + 30 &&
      p.y >= 236 - 40 &&
      p.y <= 236 + 220 + 40
    );
  }

  // 今の空きの左端の #stage 上の座標を返す
  function puzzleSlotPos() {
    var prob = currentPuzzleProblem();
    if (!prob || !ONPU.puzzle) {
      return { x: 0, y: 0 };
    }
    var g = puzzleBoxGeom(prob.meter);
    var usedBeats = ONPU.puzzle.totalUnits(currentPuzzleList()) / 2;
    return {
      x: g.left + 6 + 14 + usedBeats * PUZZLE_BEAT_WIDTH,
      y: 236 + 6 + 14
    };
  }

  // 音符の SVG マークアップを返す
  function puzzleGlyphSvg(id, widths, height) {
    var w = widths[id] || 24;
    return '<svg width="' + w + '" height="' + height + '" aria-hidden="true"><use href="#glyph-' + id + '"/></svg>';
  }

  // 移動中のアニメ用タイマーを登録する
  function addPuzzleAnimTimer(fn, ms) {
    var tid = setTimeout(function () {
      var idx = puzzleAnimTimers.indexOf(tid);
      if (idx !== -1) {
        puzzleAnimTimers.splice(idx, 1);
      }
      fn();
    }, ms);
    puzzleAnimTimers.push(tid);
    return tid;
  }

  // 運んでいる・飛んでいるゴーストピースを作る
  function makePuzzleGhost(id, x, y) {
    var stage = document.getElementById("stage");
    var beats = puzzlePieceBeats(id);
    var w = beats * PUZZLE_BEAT_WIDTH - 10;
    var g = document.createElement("div");
    g.className = "puzzle-piece ghost " + puzzlePieceColorClass(id);
    g.style.width = w + "px";
    g.style.left = x + "px";
    g.style.top = y + "px";
    g.innerHTML = puzzleGlyphSvg(id, PUZZLE_BOX_GLYPH_WIDTH, 104);
    if (stage) {
      stage.appendChild(g);
    }
    puzzleGhosts.push(g);
    return g;
  }

  // ゴーストピースを消す
  function removePuzzleGhost(g) {
    if (!g) {
      return;
    }
    if (g.parentNode) {
      g.parentNode.removeChild(g);
    }
    var idx = puzzleGhosts.indexOf(g);
    if (idx !== -1) {
      puzzleGhosts.splice(idx, 1);
    }
  }

  // ゴーストピースを目標位置へ滑らかに動かす
  function flyPuzzleGhost(g, x, y, isBack, done) {
    if (!g) {
      if (done) {
        done();
      }
      return;
    }
    g.classList.remove("fly-in", "fly-back");
    g.getBoundingClientRect();
    g.classList.add(isBack ? "fly-back" : "fly-in");
    g.style.left = x + "px";
    g.style.top = y + "px";
    var ms = isBack ? 170 : 180;
    addPuzzleAnimTimer(function () {
      if (done) {
        done();
      }
    }, ms + 10);
  }

  // 箱の上の一言を更新する（durationMs があるときは時間経過後に通常の案内へもどす）
  function setPuzzleLead(text, isWarn, durationMs) {
    if (puzzleLeadTimerId !== null) {
      clearTimeout(puzzleLeadTimerId);
      puzzleLeadTimerId = null;
    }
    var leadEl = document.getElementById("puzzle-lead");
    var leadTextEl = document.getElementById("puzzle-lead-text");
    var prob = currentPuzzleProblem();
    if (!leadEl || !leadTextEl || !prob) {
      return;
    }
    var beats = ONPU.puzzle ? ONPU.puzzle.measureUnits(prob.meter) / 2 : 4;
    var defaultText = getText("puzzle.lead", { beats: beats });
    leadEl.classList.toggle("warn", Boolean(isWarn));
    leadTextEl.textContent = text || defaultText;
    if (durationMs) {
      puzzleLeadTimerId = setTimeout(function () {
        puzzleLeadTimerId = null;
        var el = document.getElementById("puzzle-lead");
        var textEl = document.getElementById("puzzle-lead-text");
        var curProb = currentPuzzleProblem();
        if (el && textEl && curProb && ONPU.puzzle) {
          el.classList.remove("warn");
          var curBeats = ONPU.puzzle.measureUnits(curProb.meter) / 2;
          var st = ONPU.puzzle.status(curProb.meter, currentPuzzleList());
          textEl.textContent = st === "exact" ? puzzleFilledText() : getText("puzzle.lead", { beats: curBeats });
        }
      }, durationMs);
    }
  }

  // 「ならして みる」の押せる・押せないを更新する
  function updatePuzzlePlayButton() {
    var playBtn = document.getElementById("btn-puzzle-play");
    if (!playBtn || !ONPU.puzzle) {
      return;
    }
    var prob = currentPuzzleProblem();
    if (!prob) {
      playBtn.disabled = true;
      return;
    }
    var exact = ONPU.puzzle.status(prob.meter, currentPuzzleList()) === "exact";
    playBtn.disabled = !exact || puzzlePlaying;
  }

  // 鳴っているピースの浮きと拍の数字の強調を切り替える（-1 ならすべて戻す）
  function setActivePuzzleHighlight(pieceIdx, beatIdx) {
    for (var i = 0; i < puzzleBoxPieceEls.length; i++) {
      puzzleBoxPieceEls[i].classList.toggle("now", i === pieceIdx);
    }
    for (var j = 0; j < puzzleBeatEls.length; j++) {
      puzzleBeatEls[j].classList.toggle("now", j === beatIdx);
    }
  }

  // 残りの表示の赤枠・ふくらみを元に戻し、タイマーを止める
  function clearPuzzleRestAlert() {
    if (puzzleRestTimerId !== null) {
      clearTimeout(puzzleRestTimerId);
      puzzleRestTimerId = null;
    }
    var restEl = document.getElementById("puzzle-rest");
    if (restEl) {
      restEl.classList.remove("alert", "pop");
    }
  }

  // パズルの谷の再生・タイマー・アニメ・表示状態をすべて止めて戻す
  function stopPuzzle() {
    if (puzzleRafId !== null) {
      cancelAnimationFrame(puzzleRafId);
      puzzleRafId = null;
    }
    if (puzzleAutoPlayTimerId !== null) {
      clearTimeout(puzzleAutoPlayTimerId);
      puzzleAutoPlayTimerId = null;
    }
    if (puzzleLeadTimerId !== null) {
      clearTimeout(puzzleLeadTimerId);
      puzzleLeadTimerId = null;
    }
    clearPuzzleRestAlert();
    for (var i = 0; i < puzzleAnimTimers.length; i++) {
      clearTimeout(puzzleAnimTimers[i]);
    }
    puzzleAnimTimers = [];
    if (puzzleActiveDragCleanup) {
      puzzleActiveDragCleanup();
      puzzleActiveDragCleanup = null;
    }
    puzzleActivePointerId = null;
    while (puzzleGhosts.length > 0) {
      removePuzzleGhost(puzzleGhosts[puzzleGhosts.length - 1]);
    }
    puzzleSoundQueue = [];
    puzzlePlaying = false;
    puzzlePlacing = false;
    setActivePuzzleHighlight(-1, -1);

    var boxEl = document.getElementById("puzzle-box");
    if (boxEl) {
      boxEl.classList.remove("hover");
    }
    updatePuzzlePlayButton();
    var prob = currentPuzzleProblem();
    if (!prob) {
      return;
    }
    if (ONPU.puzzle) {
      var st = ONPU.puzzle.status(prob.meter, currentPuzzleList());
      setPuzzleLead(st === "exact" ? puzzleFilledText() : null, false);
    }
  }

  // まだ予約していない音のうち、時刻が now + 0.15 秒以内のものだけを予約する
  function scheduleDuePuzzleSounds(now) {
    if (!ONPU.audio) {
      return;
    }
    for (var i = 0; i < puzzleSoundQueue.length; i++) {
      var ev = puzzleSoundQueue[i];
      if (!ev.done && ev.time <= now + 0.15) {
        ev.done = true;
        if (ev.kind === "drum" && typeof ONPU.audio.playDrum === "function") {
          ONPU.audio.playDrum(ev.time);
        } else if (ev.kind === "note" && typeof ONPU.audio.playNoteAt === "function") {
          ONPU.audio.playNoteAt(ev.note, ev.time, ev.duration, ev.volume);
        }
      }
    }
  }

  // requestAnimationFrame でパズルの谷の音の予約と表示を進める
  function tickPuzzle() {
    puzzleRafId = null;
    var now = (ONPU.audio && typeof ONPU.audio.now === "function") ? ONPU.audio.now() : null;
    if (now === null || !ONPU.puzzle) {
      stopPuzzle();
      return;
    }

    scheduleDuePuzzleSounds(now);

    var prob = currentPuzzleProblem();
    if (!prob) {
      stopPuzzle();
      return;
    }
    var list = currentPuzzleList();
    var beats = ONPU.puzzle.measureUnits(prob.meter) / 2;
    var secPerBeat = 60 / puzzleBpm;
    var measureEnd = beats * secPerBeat;
    var elapsed = now - puzzleLat - puzzleStart;

    if (elapsed >= measureEnd) {
      setActivePuzzleHighlight(-1, -1);
      puzzlePlaying = false;
      updatePuzzlePlayButton();
      setPuzzleLead(puzzleFilledText(), false);
      var hintEl = document.getElementById("puzzle-hint");
      if (hintEl) {
        hintEl.hidden = true;
      }
      var nextBtn = document.getElementById("btn-puzzle-next");
      if (nextBtn) {
        nextBtn.hidden = false;
      }
      return;
    }

    setPuzzleLead(getText("puzzle.listen"), false);
    var pIdx = ONPU.puzzle.pieceIndexAt(prob.meter, list, puzzleBpm, elapsed);
    var bIdx = elapsed + 1e-9 >= 0 ? Math.floor((elapsed + 1e-9) / secPerBeat) : -1;
    setActivePuzzleHighlight(pIdx, bIdx);

    puzzleRafId = requestAnimationFrame(tickPuzzle);
  }

  // ぴったり埋まった並びを速さ 80 で1回鳴らす
  function startPuzzlePlayback() {
    if (!ONPU.puzzle || !ONPU.audio || typeof ONPU.audio.now !== "function") {
      return;
    }
    var prob = currentPuzzleProblem();
    if (!prob) {
      return;
    }
    if (puzzleAutoPlayTimerId !== null) {
      clearTimeout(puzzleAutoPlayTimerId);
      puzzleAutoPlayTimerId = null;
    }
    clearPuzzleRestAlert();
    var list = currentPuzzleList();
    if (puzzlePlaying || ONPU.puzzle.status(prob.meter, list) !== "exact") {
      return;
    }
    var now = ONPU.audio.now();
    if (now === null) {
      return;
    }
    var info = typeof ONPU.audio.getLatency === "function" ? ONPU.audio.getLatency() : null;
    puzzleLat = (info && ONPU.rhythm && typeof ONPU.rhythm.latencyFrom === "function")
      ? ONPU.rhythm.latencyFrom(info.base, info.output)
      : 0;
    puzzleBpm = (ONPU.rhythm && ONPU.rhythm.SPEEDS && ONPU.rhythm.SPEEDS.normal)
      ? ONPU.rhythm.SPEEDS.normal
      : 80;
    puzzleStart = now + 0.3;

    var drumTimes = ONPU.puzzle.playTimes(prob.meter, list, puzzleBpm);
    var beatTimes = ONPU.puzzle.beatTimes(prob.meter, puzzleBpm);
    var beatVol = (ONPU.rhythm && typeof ONPU.rhythm.TAP_BEAT_VOLUME === "number")
      ? ONPU.rhythm.TAP_BEAT_VOLUME
      : 0.5;

    puzzleSoundQueue = [];
    for (var i = 0; i < drumTimes.length; i++) {
      puzzleSoundQueue.push({
        time: puzzleStart + drumTimes[i],
        kind: "drum",
        done: false
      });
    }
    for (var j = 0; j < beatTimes.length; j++) {
      puzzleSoundQueue.push({
        time: puzzleStart + beatTimes[j],
        kind: "note",
        note: j === 0 ? "C6" : "C5",
        duration: 0.1,
        volume: beatVol,
        done: false
      });
    }

    puzzlePlaying = true;
    updatePuzzlePlayButton();
    setPuzzleLead(getText("puzzle.listen"), false);
    scheduleDuePuzzleSounds(now);
    puzzleRafId = requestAnimationFrame(tickPuzzle);
  }

  // 箱の中の子どもが入れたピースを押したときにたなへ戻す
  function onPuzzleBoxPieceDown(e) {
    if (e.button !== undefined && e.button !== 0) {
      return;
    }
    if (puzzlePlaying || puzzlePlacing || puzzleActivePointerId !== null || !ONPU.puzzle) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (puzzleAutoPlayTimerId !== null) {
      clearTimeout(puzzleAutoPlayTimerId);
      puzzleAutoPlayTimerId = null;
    }
    var idx = parseInt(e.currentTarget.getAttribute("data-placed-idx"), 10);
    if (isNaN(idx)) {
      return;
    }
    puzzlePlaced = ONPU.puzzle.removeAt(puzzlePlaced, idx);
    renderPuzzle();
  }

  // たなからピースを入れてみる（ok なら入り、over なら揺れて戻る）
  function tryPlacePuzzlePiece(id, ghost, from) {
    var prob = currentPuzzleProblem();
    if (!ONPU.puzzle || !prob) {
      removePuzzleGhost(ghost);
      return;
    }
    var list = currentPuzzleList();
    var res = ONPU.puzzle.place(prob.meter, list, id);
    var s = puzzleSlotPos();

    if (res.ok) {
      puzzlePlacing = true;
      flyPuzzleGhost(ghost, s.x, s.y, false, function () {
        removePuzzleGhost(ghost);
        puzzlePlacing = false;
        if (!currentPuzzleProblem()) {
          return;
        }
        puzzlePlaced.push(id);
        var filledExact = ONPU.puzzle.status(prob.meter, currentPuzzleList()) === "exact";
        if (filledExact && puzzleResultNow === null) {
          puzzleResultNow = puzzleOverCount === 0 ? "pittari" : "done";
        }
        renderPuzzle();
        if (filledExact) {
          setPuzzleLead(puzzleFilledText(), false);
          puzzleAutoPlayTimerId = setTimeout(function () {
            puzzleAutoPlayTimerId = null;
            startPuzzlePlayback();
          }, 500);
        }
      });
    } else if (res.reason === "over") {
      puzzleOverCount += 1;
      var targetGhost = ghost || makePuzzleGhost(id, from.x, from.y);
      var beats = puzzlePieceBeats(id);
      var targetX = Math.min(s.x, STAGE_WIDTH - 40 - beats * PUZZLE_BEAT_WIDTH);
      flyPuzzleGhost(targetGhost, targetX, s.y, false, function () {
        targetGhost.classList.remove("fly-in");
        targetGhost.classList.add("shake");
        addPuzzleAnimTimer(function () {
          targetGhost.classList.remove("shake");
          flyPuzzleGhost(targetGhost, from.x, from.y, true, function () {
            removePuzzleGhost(targetGhost);
          });
        }, 420);
      });

      var remU = ONPU.puzzle.remainingUnits(prob.meter, list);
      var remWords = puzzleBeatWords(remU);
      var restEl = document.getElementById("puzzle-rest");
      if (restEl) {
        restEl.classList.remove("pop");
        restEl.getBoundingClientRect();
        restEl.classList.add("pop", "alert");
        if (puzzleRestTimerId !== null) {
          clearTimeout(puzzleRestTimerId);
        }
        puzzleRestTimerId = setTimeout(function () {
          puzzleRestTimerId = null;
          var rEl = document.getElementById("puzzle-rest");
          if (rEl) {
            rEl.classList.remove("alert", "pop");
          }
        }, 2000);
      }
      setPuzzleLead(getText("puzzle.over", { num: remWords.num, unit: remWords.unit }), true, 2000);
    } else {
      removePuzzleGhost(ghost);
    }
  }

  // たなのピースを押した・運んだときの Pointer Events 処理
  function onPuzzleShelfPieceDown(e) {
    if (e.button !== undefined && e.button !== 0) {
      return;
    }
    if (puzzlePlaying || puzzlePlacing || puzzleActivePointerId !== null) {
      return;
    }
    var prob = currentPuzzleProblem();
    if (!prob) {
      return;
    }
    e.preventDefault();
    var src = e.currentTarget;
    var id = src.getAttribute("data-piece-id");
    var pointerId = e.pointerId;
    var startPoint = puzzleStagePoint(e);
    var srcLeft = parseFloat(src.style.left);
    var srcTop = 585;
    var beats = puzzlePieceBeats(id);
    var offX = (beats * PUZZLE_BEAT_WIDTH - 10) / 2;
    var offY = 90;
    var ghost = null;
    var moved = false;

    puzzleActivePointerId = pointerId;
    try {
      src.setPointerCapture(pointerId);
    } catch (err) {
      // キャプチャに失敗してもそのまま進める
    }

    function cleanup() {
      src.removeEventListener("pointermove", onMove);
      src.removeEventListener("pointerup", onUp);
      src.removeEventListener("pointercancel", onCancel);
      var boxEl = document.getElementById("puzzle-box");
      if (boxEl) {
        boxEl.classList.remove("hover");
      }
      if (puzzleActivePointerId === pointerId) {
        puzzleActivePointerId = null;
      }
      puzzleActiveDragCleanup = null;
    }

    function onMove(ev) {
      if (ev.pointerId !== pointerId) {
        return;
      }
      var p = puzzleStagePoint(ev);
      var dx = p.x - startPoint.x;
      var dy = p.y - startPoint.y;
      if (!moved && Math.sqrt(dx * dx + dy * dy) >= 10) {
        moved = true;
        ghost = makePuzzleGhost(id, srcLeft, srcTop);
      }
      if (moved && ghost) {
        ghost.style.left = (p.x - offX) + "px";
        ghost.style.top = (p.y - offY) + "px";
        var boxEl = document.getElementById("puzzle-box");
        if (boxEl) {
          boxEl.classList.toggle("hover", isPointOverPuzzleBox(p, prob.meter));
        }
      }
    }

    function onUp(ev) {
      if (ev.pointerId !== pointerId) {
        return;
      }
      var wasMoved = moved;
      var curGhost = ghost;
      cleanup();
      if (wasMoved) {
        var p = puzzleStagePoint(ev);
        if (isPointOverPuzzleBox(p, prob.meter)) {
          tryPlacePuzzlePiece(id, curGhost, { x: srcLeft, y: srcTop });
        } else {
          flyPuzzleGhost(curGhost, srcLeft, srcTop, true, function () {
            removePuzzleGhost(curGhost);
          });
        }
      } else {
        var tapGhost = makePuzzleGhost(id, srcLeft, srcTop);
        tryPlacePuzzlePiece(id, tapGhost, { x: srcLeft, y: srcTop });
      }
    }

    function onCancel(ev) {
      if (ev.pointerId !== pointerId) {
        return;
      }
      var curGhost = ghost;
      cleanup();
      if (curGhost) {
        flyPuzzleGhost(curGhost, srcLeft, srcTop, true, function () {
          removePuzzleGhost(curGhost);
        });
      }
    }

    puzzleActiveDragCleanup = cleanup;
    src.addEventListener("pointermove", onMove);
    src.addEventListener("pointerup", onUp);
    src.addEventListener("pointercancel", onCancel);
  }

  // パズルの谷の箱・拍子・残り・拍の数字を作り直す
  function renderPuzzle() {
    var prob = currentPuzzleProblem();
    if (!ONPU.puzzle || !prob) {
      return;
    }
    var list = currentPuzzleList();
    var g = puzzleBoxGeom(prob.meter);
    var remU = ONPU.puzzle.remainingUnits(prob.meter, list);
    var remB = remU !== null ? remU / 2 : 0;
    var st = ONPU.puzzle.status(prob.meter, list);

    var meterEl = document.getElementById("puzzle-meter");
    if (meterEl) {
      meterEl.style.left = g.left + "px";
      meterEl.textContent = prob.meter;
    }

    var restEl = document.getElementById("puzzle-rest");
    clearPuzzleRestAlert();
    if (restEl) {
      restEl.style.left = "auto";
      restEl.style.right = (STAGE_WIDTH - g.left - g.w) + "px";
      restEl.innerHTML = "";
      if (st === "exact") {
        var exactSpan = document.createElement("span");
        exactSpan.className = "puzzle-rest-exact";
        exactSpan.textContent = puzzleFilledText();
        restEl.appendChild(exactSpan);
      } else {
        var remWords = puzzleBeatWords(remU);
        var tmpl = getText("puzzle.rest");
        var parts = tmpl.split("{num}");
        if (parts[0]) {
          restEl.appendChild(document.createTextNode(parts[0].replace(/\{unit\}/g, remWords.unit)));
        }
        var numSpan = document.createElement("span");
        numSpan.className = "puzzle-rest-num";
        numSpan.textContent = remWords.num;
        restEl.appendChild(numSpan);
        if (parts.length > 1 && parts[1]) {
          var tail = parts[1].replace(/\{unit\}/g, remWords.unit);
          if (tail) {
            restEl.appendChild(document.createTextNode(tail));
          }
        }
      }
    }

    var boxEl = document.getElementById("puzzle-box");
    puzzleBoxPieceEls = [];
    if (boxEl) {
      boxEl.style.left = g.left + "px";
      boxEl.style.width = g.w + "px";
      boxEl.innerHTML = "";

      var x = 14;
      var givenCount = prob.given.length;
      for (var i = 0; i < list.length; i++) {
        var id = list[i];
        var beats = puzzlePieceBeats(id);
        var w = beats * PUZZLE_BEAT_WIDTH - 10;
        var pieceEl = document.createElement("div");
        pieceEl.className = "puzzle-piece in-box " + (i < givenCount ? "given" : puzzlePieceColorClass(id));
        pieceEl.style.left = x + "px";
        pieceEl.style.width = w + "px";
        pieceEl.innerHTML = puzzleGlyphSvg(id, PUZZLE_BOX_GLYPH_WIDTH, 104);
        if (i >= givenCount) {
          pieceEl.setAttribute("data-placed-idx", String(i - givenCount));
          pieceEl.addEventListener("pointerdown", onPuzzleBoxPieceDown);
        }
        boxEl.appendChild(pieceEl);
        puzzleBoxPieceEls.push(pieceEl);
        x += w + 10;
      }

      if (remB > 0) {
        var gapEl = document.createElement("div");
        gapEl.className = "puzzle-gap";
        gapEl.style.left = x + "px";
        gapEl.style.width = (remB * PUZZLE_BEAT_WIDTH - 10) + "px";
        gapEl.textContent = "？";
        boxEl.appendChild(gapEl);
      }
    }

    var beatsEl = document.getElementById("puzzle-beats");
    puzzleBeatEls = [];
    if (beatsEl) {
      beatsEl.style.left = (g.left + 20) + "px";
      beatsEl.innerHTML = "";
      for (var b = 1; b <= g.beats; b++) {
        var beatDiv = document.createElement("div");
        beatDiv.style.width = PUZZLE_BEAT_WIDTH + "px";
        beatDiv.textContent = String(b);
        beatsEl.appendChild(beatDiv);
        puzzleBeatEls.push(beatDiv);
      }
    }

    if (st !== "exact") {
      var nextBtn = document.getElementById("btn-puzzle-next");
      if (nextBtn) {
        nextBtn.hidden = true;
      }
      var hintEl = document.getElementById("puzzle-hint");
      if (hintEl) {
        hintEl.hidden = false;
      }
      setPuzzleLead(null, false);
    }
    updatePuzzlePlayButton();
  }

  // パズルの谷のたなのピースを作る
  function renderPuzzleShelf() {
    var shelfEl = document.getElementById("puzzle-shelf");
    var prob = currentPuzzleProblem();
    if (!shelfEl || !ONPU.puzzle || !prob) {
      return;
    }
    var choices = prob.choices;
    var totalWidth = 0;
    for (var i = 0; i < choices.length; i++) {
      totalWidth += puzzlePieceBeats(choices[i]) * PUZZLE_SHELF_BEAT_WIDTH;
    }
    totalWidth += (choices.length - 1) * 20;
    var x = Math.round((STAGE_WIDTH - totalWidth) / 2);

    shelfEl.innerHTML = "";
    for (var j = 0; j < choices.length; j++) {
      var id = choices[j];
      var units = ONPU.puzzle.pieceUnits(id);
      var beats = puzzlePieceBeats(id);
      var w = beats * PUZZLE_SHELF_BEAT_WIDTH;
      var parts = typeof ONPU.puzzle.beatParts === "function" ? ONPU.puzzle.beatParts(units) : null;
      var isHalfOnly = Boolean(parts && parts.half && parts.whole === 0);
      var beatWords = puzzleBeatWords(units);
      var el = document.createElement("div");
      el.className = "puzzle-piece shelf " + puzzlePieceColorClass(id);
      el.style.left = x + "px";
      el.style.width = w + "px";
      el.setAttribute("data-piece-id", id);
      el.innerHTML =
        puzzleGlyphSvg(id, PUZZLE_SHELF_GLYPH_WIDTH, 72) +
        '<span class="puzzle-piece-beats' + (isHalfOnly ? " two" : "") + '">' +
        getText("puzzle.piece.beats", { num: beatWords.num, unit: beatWords.unit }) +
        "</span>";
      el.addEventListener("pointerdown", onPuzzleShelfPieceDown);
      shelfEl.appendChild(el);
      x += w + 20;
    }
  }

  // パズルの谷の上の帯の進み具合を更新する
  function renderPuzzleProgress() {
    var total = puzzleQuestions.length;
    var currentNum = total > 0 ? (puzzleQIndex + 1) : 0;

    var progDotsEl = document.getElementById("puzzle-progress-dots");
    if (progDotsEl) {
      progDotsEl.innerHTML = "";
      for (var i = 0; i < total; i++) {
        var dot = document.createElement("div");
        dot.className = i < currentNum ? "quiz-dot filled" : "quiz-dot";
        progDotsEl.appendChild(dot);
      }
    }

    var progTextEl = document.getElementById("puzzle-progress-text");
    if (progTextEl) {
      progTextEl.textContent = getText("quiz.progress", {
        current: currentNum,
        total: total
      });
    }
  }

  // パズルの谷の1問を始める
  function startPuzzleQuestion() {
    puzzlePlaced = [];
    puzzleOverCount = 0;
    puzzleResultNow = null;
    var nextBtn = document.getElementById("btn-puzzle-next");
    if (nextBtn) {
      nextBtn.hidden = true;
    }
    var hintEl = document.getElementById("puzzle-hint");
    if (hintEl) {
      hintEl.hidden = false;
    }
    renderPuzzleShelf();
    renderPuzzle();
    renderPuzzleProgress();
  }

  // パズルの谷の1回（5問）を始める
  function startPuzzleSession(lv) {
    if (!lv || !ONPU.puzzle) {
      return;
    }
    stopQuizTimer();
    stopRhythmRound();
    stopPuzzle();
    puzzleLevel = lv;
    puzzleQuestions = ONPU.puzzle.pickProblems(lv.pool, ONPU.puzzle.QUESTION_COUNT);
    puzzleQIndex = 0;
    puzzleResults = [];
    startPuzzleQuestion();
    showScreen("screen-puzzle");
  }

  // 設定を保存する（保存できたかを true / false で返す）
  function saveSettings() {
    if (!ONPU.settings || typeof ONPU.settings.save !== "function") {
      return false;
    }
    usageUnsavedSeconds = 0;
    return ONPU.settings.save(getStorage(), settingsData);
  }

  // たまった利用時間があれば保存する
  function flushUsageIfNeeded() {
    if (usageUnsavedSeconds > 0 && ONPU.settings) {
      saveSettings();
    }
  }

  // 1秒ごとに遊ぶ画面が表示されている子の利用時間を数える
  function tickUsage() {
    if (
      !ONPU.settings ||
      typeof ONPU.settings.addUsage !== "function" ||
      typeof ONPU.settings.dateKey !== "function"
    ) {
      return;
    }
    if (document.visibilityState !== "visible") {
      return;
    }
    var player = getCurrentPlayer();
    if (!player) {
      return;
    }
    var activeScreen = document.querySelector(".screen.active");
    if (!activeScreen || USAGE_COUNT_SCREENS.indexOf(activeScreen.id) === -1) {
      return;
    }
    settingsData = ONPU.settings.addUsage(
      settingsData,
      player.id,
      1,
      ONPU.settings.dateKey(new Date())
    );
    usageUnsavedSeconds += 1;
    if (usageUnsavedSeconds >= 10) {
      saveSettings();
      usageUnsavedSeconds = 0;
    }
  }

  // おうちの方の画面の下の一言を消す
  function clearSettingsMsg() {
    if (settingsMsgTimerId !== null) {
      clearTimeout(settingsMsgTimerId);
      settingsMsgTimerId = null;
    }
    var msgEl = document.getElementById("settings-msg");
    if (msgEl) {
      msgEl.textContent = "";
      msgEl.classList.remove("err");
    }
  }

  // おうちの方の画面の下に保存の結果を 1.8秒出す
  function showSettingsMsg(saved) {
    var msgEl = document.getElementById("settings-msg");
    if (!msgEl) {
      return;
    }
    if (settingsMsgTimerId !== null) {
      clearTimeout(settingsMsgTimerId);
    }
    msgEl.classList.toggle("err", !saved);
    msgEl.textContent = getText(saved ? "settings.saved" : "settings.nosave");
    settingsMsgTimerId = setTimeout(function () {
      settingsMsgTimerId = null;
      var el = document.getElementById("settings-msg");
      if (el) {
        el.textContent = "";
        el.classList.remove("err");
      }
    }, 1800);
  }

  // 削除の確かめを閉じる
  function closeDeleteDialog() {
    settingsDeleteTargetId = null;
    var dlg = document.getElementById("settings-del");
    if (dlg) {
      dlg.hidden = true;
    }
  }

  // 削除の確かめを開く
  function openDeleteDialog(player) {
    if (!player) {
      return;
    }
    settingsDeleteTargetId = player.id;
    var qEl = document.getElementById("settings-del-q");
    if (qEl) {
      qEl.textContent = getText("settings.del.q", { name: player.name });
    }
    var dlg = document.getElementById("settings-del");
    if (dlg) {
      dlg.hidden = false;
    }
  }

  // ロックの問題を新しく作り、答えの欄を空にする
  function setNewLockProblem() {
    lockProblem = (ONPU.settings && typeof ONPU.settings.makeLockProblem === "function")
      ? ONPU.settings.makeLockProblem()
      : { a: 23, b: 5, answer: 115 };
    lockInput = "";
    var probEl = document.getElementById("lock-problem");
    if (probEl) {
      probEl.textContent = getText("lock.problem", {
        a: lockProblem.a,
        b: lockProblem.b
      });
    }
    var ansEl = document.getElementById("lock-answer");
    if (ansEl) {
      ansEl.textContent = "";
    }
  }

  // ロック画面の下の一言を更新する
  function setLockMsg(text) {
    var msgEl = document.getElementById("lock-msg");
    if (msgEl) {
      msgEl.textContent = text || "";
    }
  }

  // おうちの方のロックを開く（onOk＝正解時、onBack＝もどる時）
  function openLock(onOk, onBack) {
    lockOnOk = typeof onOk === "function" ? onOk : null;
    lockOnBack = typeof onBack === "function" ? onBack : null;
    var cardEl = document.getElementById("lock-card");
    if (cardEl) {
      cardEl.classList.remove("shake");
    }
    setNewLockProblem();
    setLockMsg("");
    showScreen("screen-lock");
  }

  // ロックの数字ボタンが押されたときの処理
  function pushLockDigit(digit) {
    setLockMsg("");
    if (lockInput.length >= 3) {
      return;
    }
    lockInput += digit;
    var ansEl = document.getElementById("lock-answer");
    if (ansEl) {
      ansEl.textContent = lockInput;
    }
  }

  // おうちの方の画面のタブを切り替える
  function selectSettingsTab(tab) {
    var target = SETTINGS_TABS.indexOf(tab) !== -1 ? tab : "volume";
    settingsTab = target;
    for (var i = 0; i < SETTINGS_TABS.length; i++) {
      var name = SETTINGS_TABS[i];
      var isCur = name === target;
      var btn = document.getElementById("btn-tab-" + name);
      if (btn) {
        btn.classList.toggle("on", isCur);
      }
      var pane = document.getElementById("panel-" + name);
      if (pane) {
        pane.classList.toggle("cur", isCur);
      }
    }
  }

  // 設定項目を変更して保存し、画面と音に反映する
  function applySettingChange(key, value) {
    if (!ONPU.settings || typeof ONPU.settings.setValue !== "function") {
      return;
    }
    var res = ONPU.settings.setValue(settingsData, key, value);
    if (!res.ok) {
      return;
    }
    settingsData = res.data;
    var saved = saveSettings();
    renderSettingsOpts();
    showSettingsMsg(saved);

    if (key === "volume" && ONPU.audio) {
      if (typeof ONPU.audio.setVolume === "function") {
        ONPU.audio.setVolume(ONPU.settings.volumeGain(settingsData));
      }
      if (typeof ONPU.audio.playMelody === "function") {
        ONPU.audio.playMelody("correct");
      }
    }
  }

  // えらぶボタン群を 1つの入れ物に描画する
  function renderSettingButtons(containerId, key, options) {
    var box = document.getElementById(containerId);
    if (!box) {
      return;
    }
    box.innerHTML = "";
    var currentVal = settingsData ? settingsData[key] : undefined;
    for (var i = 0; i < options.length; i++) {
      var opt = options[i];
      var btn = document.createElement("button");
      btn.type = "button";
      btn.id = "btn-opt-" + key + "-" + opt.idSuffix;
      btn.className = "settings-opt" + (currentVal === opt.value ? " on" : "");
      btn.textContent = opt.label;
      box.appendChild(btn);

      (function (btnId, optValue) {
        bindButton(btnId, function () {
          applySettingChange(key, optValue);
        });
      })(btn.id, opt.value);
    }
  }

  // 音・時間・読み上げ・リズムのえらぶボタンを現在の設定に合わせて作り直す
  function renderSettingsOpts() {
    renderSettingButtons("opts-volume", "volume", [
      { idSuffix: "small", label: getText("settings.volume.small"), value: "small" },
      { idSuffix: "normal", label: getText("settings.volume.normal"), value: "normal" },
      { idSuffix: "large", label: getText("settings.volume.large"), value: "large" }
    ]);

    var timeOpts = [
      { idSuffix: "0", label: getText("settings.time.none"), value: 0 }
    ];
    var showDebugMin = (ONPU.config && ONPU.config.debug) || (settingsData && settingsData.timeLimit === 1);
    if (showDebugMin) {
      timeOpts.push({ idSuffix: "1", label: getText("settings.time.min", { n: 1 }), value: 1 });
    }
    var mins = [15, 30, 45, 60];
    for (var i = 0; i < mins.length; i++) {
      timeOpts.push({
        idSuffix: String(mins[i]),
        label: getText("settings.time.min", { n: mins[i] }),
        value: mins[i]
      });
    }
    renderSettingButtons("opts-time", "timeLimit", timeOpts);

    renderSettingButtons("opts-speech", "speech", [
      { idSuffix: "off", label: getText("settings.speech.off"), value: false },
      { idSuffix: "on", label: getText("settings.speech.on"), value: true }
    ]);

    renderSettingButtons("opts-rhythm", "rhythm", [
      { idSuffix: "loose", label: getText("settings.rhythm.loose"), value: "loose" },
      { idSuffix: "normal", label: getText("settings.rhythm.normal"), value: "normal" }
    ]);
  }

  // 名前のタブの一覧を作り直す
  function renderSettingsNames() {
    var listEl = document.getElementById("settings-names");
    if (!listEl) {
      return;
    }
    listEl.innerHTML = "";
    var players = (recordsData && Array.isArray(recordsData.players)) ? recordsData.players : [];
    if (players.length === 0) {
      var emptyP = document.createElement("p");
      emptyP.className = "settings-names-empty";
      emptyP.textContent = getText("settings.names.empty");
      listEl.appendChild(emptyP);
      return;
    }

    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      var row = document.createElement("div");
      row.className = "settings-name-row";

      var face = document.createElement("span");
      face.className = "settings-name-face";
      face.innerHTML = animalSvgHtml(p.animal);

      var nameEl = document.createElement("span");
      nameEl.className = "settings-name-text";
      nameEl.textContent = p.name;

      var starsEl = document.createElement("span");
      starsEl.className = "settings-name-stars";
      var starCount = ONPU.records ? ONPU.records.totalStars(p) : 0;
      starsEl.textContent = getText("settings.names.stars", { stars: starCount });

      var renameBtn = document.createElement("button");
      renameBtn.type = "button";
      renameBtn.id = "btn-name-rename-" + p.id;
      renameBtn.className = "settings-opt";
      renameBtn.textContent = getText("settings.names.rename");

      var removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.id = "btn-name-remove-" + p.id;
      removeBtn.className = "settings-opt red";
      removeBtn.textContent = getText("settings.names.remove");

      row.appendChild(face);
      row.appendChild(nameEl);
      row.appendChild(starsEl);
      row.appendChild(renameBtn);
      row.appendChild(removeBtn);
      listEl.appendChild(row);

      (function (playerObj, renameId, removeId) {
        bindButton(renameId, function () {
          openMakeScreen(playerObj.id);
        });
        bindButton(removeId, function () {
          openDeleteDialog(playerObj);
        });
      })(p, renameBtn.id, removeBtn.id);
    }
  }

  // おうちの方の画面を指定したタブ（省略時は音）で開く
  function openSettings(tab) {
    closeDeleteDialog();
    clearSettingsMsg();
    selectSettingsTab(tab || "volume");
    renderSettingsOpts();
    renderSettingsNames();
    showScreen("screen-settings");
  }

  // 初期化
  function init() {
    var storage = getStorage();
    if (ONPU.records) {
      recordsSavable = ONPU.records.canSave(storage);
      recordsData = ONPU.records.load(storage).data;
    }
    if (ONPU.settings) {
      settingsData = ONPU.settings.load(storage).data;
      if (ONPU.audio && typeof ONPU.audio.setVolume === "function") {
        ONPU.audio.setVolume(ONPU.settings.volumeGain(settingsData));
      }
    }
    if (window.speechSynthesis && typeof window.speechSynthesis.getVoices === "function") {
      try {
        window.speechSynthesis.getVoices();
      } catch (e) {
        // 音声一覧の取得失敗で画面を止めない
      }
    }

    buildSoundKeys();
    applyTexts();
    selectClef("treble");
    updateStageScale();

    window.addEventListener("resize", updateStageScale);
    window.addEventListener("orientationchange", updateStageScale);
    window.addEventListener("pagehide", function () {
      flushUsageIfNeeded();
    });
    setInterval(tickUsage, 1000);

    // レベルを選ぶ画面の記号タブ
    bindButton("btn-clef-treble", function () {
      selectClef("treble");
    });
    bindButton("btn-clef-bass", function () {
      selectClef("bass");
    });

    // はじめるボタン → 音の準備をして「だれが あそぶ？」画面へ
    bindButton("btn-start", function () {
      if (ONPU.audio && typeof ONPU.audio.unlock === "function") {
        ONPU.audio.unlock();
      }
      showScreen("screen-who");
    });

    // はじめる画面［おうちの方へ］ → 使い方のページへ（音の準備はしない）
    bindButton("btn-guide", function () {
      showScreen("screen-guide");
    });

    // 使い方のページ［もどる］ → はじめる画面へ
    bindButton("btn-guide-back", function () {
      showScreen("screen-start");
    });

    // 地図の右上のだれかボタン → 「だれが あそぶ？」画面へ
    bindButton("btn-map-player", function () {
      showScreen("screen-who");
    });

    // 「あたらしく つくる」の もどるボタン → 保存せず前の画面へ
    bindButton("btn-make-back", function () {
      if (makeEditPlayerId) {
        makeEditPlayerId = null;
        openSettings("names");
      } else {
        showScreen("screen-who");
      }
    });

    // 「あたらしく つくる」の加工・編集ボタン群
    bindButton("btn-key-dakuten", function () {
      applyMakeMark("dakuten");
    });
    bindButton("btn-key-handaku", function () {
      applyMakeMark("handaku");
    });
    bindButton("btn-key-small", function () {
      applyMakeMark("small");
    });
    bindButton("btn-key-long", function () {
      addMakeChar("ー");
    });
    bindButton("btn-key-kana", function () {
      makeKata = !makeKata;
      renderKanaPad();
    });
    bindButton("btn-key-del", function () {
      makeChars.pop();
      setMakeMsg("");
      renderNameBoxes();
    });

    // 「あたらしく つくる」の できた！ボタン
    bindButton("btn-make-done", function () {
      if (!ONPU.records) {
        return;
      }
      if (!makeAnimal) {
        setMakeMsg(getText("make.msg.noAnimal"));
        return;
      }
      var name = makeChars.join("");
      if (name.length === 0) {
        setMakeMsg(getText("make.msg.noName"));
        return;
      }
      var editingId = makeEditPlayerId;
      var res = editingId
        ? ONPU.records.renamePlayer(recordsData, editingId, name, makeAnimal)
        : ONPU.records.addPlayer(recordsData, name, makeAnimal);
      if (res.ok) {
        recordsData = res.data;
        saveRecords();
        if (editingId) {
          makeEditPlayerId = null;
          openSettings("names");
        } else {
          showScreen("screen-who");
        }
        return;
      }
      if (res.reason === "not_found") {
        makeEditPlayerId = null;
        openSettings("names");
      } else if (res.reason === "empty") {
        setMakeMsg(getText("make.msg.noName"));
      } else if (res.reason === "too_long") {
        setMakeMsg(getText("make.msg.tooLong", { max: ONPU.records.NAME_MAX }));
      } else if (res.reason === "bad_char") {
        setMakeMsg(getText("make.msg.badChar"));
      } else if (res.reason === "bad_animal" || res.reason === "animal_used") {
        setMakeMsg(getText("make.msg.noAnimal"));
      } else if (res.reason === "full") {
        showScreen("screen-who");
      }
    });

    // 歯車ボタン → ロック画面へ（押すたびに毎回出す）
    bindButton("btn-settings", function () {
      openLock(
        function () {
          openSettings("volume");
        },
        function () {
          showScreen("screen-map");
        }
      );
    });

    // ロック画面の数字・消す・OK・もどるボタン
    for (var d = 0; d <= 9; d++) {
      (function (digitStr) {
        bindButton("btn-lock-" + digitStr, function () {
          pushLockDigit(digitStr);
        });
      })(String(d));
    }
    bindButton("btn-lock-del", function () {
      lockInput = lockInput.slice(0, -1);
      var ansEl = document.getElementById("lock-answer");
      if (ansEl) {
        ansEl.textContent = lockInput;
      }
    });
    bindButton("btn-lock-ok", function () {
      if (lockInput === "") {
        return;
      }
      var ok = ONPU.settings && typeof ONPU.settings.checkLockAnswer === "function"
        ? ONPU.settings.checkLockAnswer(lockProblem, lockInput)
        : false;
      if (ok) {
        if (lockOnOk) {
          lockOnOk();
        }
      } else {
        var cardEl = document.getElementById("lock-card");
        if (cardEl) {
          restartClass(cardEl, "shake");
        }
        setNewLockProblem();
        setLockMsg(getText("lock.wrong"));
      }
    });
    bindButton("btn-lock-back", function () {
      if (lockOnBack) {
        lockOnBack();
      }
    });

    // おうちの方の画面の左のタブ 6つ
    for (var t = 0; t < SETTINGS_TABS.length; t++) {
      (function (tabName) {
        bindButton("btn-tab-" + tabName, function () {
          selectSettingsTab(tabName);
        });
      })(SETTINGS_TABS[t]);
    }

    // 削除の確かめボタン
    bindButton("btn-del-yes", function () {
      if (!settingsDeleteTargetId || !ONPU.records) {
        closeDeleteDialog();
        return;
      }
      var targetId = settingsDeleteTargetId;
      var res = ONPU.records.removePlayer(recordsData, targetId);
      if (!res.ok) {
        closeDeleteDialog();
        renderSettingsNames();
        return;
      }
      recordsData = res.data;
      var rSaved = saveRecords();
      var sSaved = true;
      if (ONPU.settings && typeof ONPU.settings.removePlayerUsage === "function") {
        settingsData = ONPU.settings.removePlayerUsage(settingsData, targetId);
        sSaved = saveSettings();
      }
      if (currentPlayerId === targetId) {
        currentPlayerId = null;
      }
      closeDeleteDialog();
      renderSettingsNames();
      showSettingsMsg(rSaved && sSaved);
    });
    bindButton("btn-del-no", function () {
      closeDeleteDialog();
    });

    // おうちの方の画面のもどるボタン → いま遊んでいる子がいれば地図へ、いなければ「だれが あそぶ？」へ
    bindButton("btn-settings-back", function () {
      closeDeleteDialog();
      if (getCurrentPlayer()) {
        showScreen("screen-map");
      } else {
        showScreen("screen-who");
      }
    });

    // おとの たしかめボタン群
    bindSoundButtons();

    // ドレミの島 → レベルを選ぶ画面へ
    bindButton("island-doremi", function () {
      openLevelScreen("doremi");
    });

    // リズムの森 → レベルを選ぶ画面へ
    bindButton("island-rhythm", function () {
      openLevelScreen("rhythm");
    });

    // パズルの谷 → レベルを選ぶ画面へ
    bindButton("island-puzzle", function () {
      openLevelScreen("puzzle");
    });

    // パズルの谷「ちずへ」 → 鳴らしている音と運んでいるピースを止め、1回の記録を捨てて地図にもどる
    bindButton("btn-puzzle-map", function () {
      stopPuzzle();
      clearPuzzleSession();
      showScreen("screen-map");
    });

    // パズルの谷「ならして みる」 → ぴったりのとき1回鳴らす
    bindButton("btn-puzzle-play", function () {
      startPuzzlePlayback();
    });

    // パズルの谷［つぎへ］ → 結果を記録し、5問終えたらクリア画面へ、まだなら次の問題へ進む
    bindButton("btn-puzzle-next", function () {
      var nextBtn = document.getElementById("btn-puzzle-next");
      if (!nextBtn || nextBtn.hidden) {
        return;
      }
      stopPuzzle();
      puzzleResults.push(puzzleResultNow);
      if (puzzleResults.length >= puzzleQuestions.length) {
        showPuzzleClearScreen();
        return;
      }
      puzzleQIndex += 1;
      startPuzzleQuestion();
    });

    // リズムの森「ちずへ」 → 進めている1問を止め、1回の記録を捨てて地図にもどる
    bindButton("btn-rhythm-map", function () {
      stopRhythmRound();
      clearRhythmSession();
      showScreen("screen-map");
    });

    // リズムの森「おてほん」 → いつ押しても、進めている1問を止めて同じ問題をお手本から始め直す
    bindButton("btn-rhythm-model", function () {
      startRhythmPlayback();
    });

    // リズムの森「はやさ」 → いつ押しても、進めている1問を止めて速さを変え、同じ問題をお手本から始め直す
    bindButton("btn-rhythm-speed", function () {
      var idx = RHYTHM_SPEED_ORDER.indexOf(rhythmSpeedKey);
      rhythmSpeedKey = RHYTHM_SPEED_ORDER[(idx + 1) % RHYTHM_SPEED_ORDER.length];
      updateRhythmSpeedButton();
      startRhythmPlayback();
    });

    // リズムの森［もういちど］ → 結果のあとだけ受け付け、同じ問題を2回目としてお手本から始める
    bindButton("btn-rhythm-retry", function () {
      var retryBtn = document.getElementById("btn-rhythm-retry");
      if (rhythmState !== "result" || !retryBtn || retryBtn.hidden) {
        return;
      }
      rhythmAttempt = 2;
      stopRhythmRound();
      rhythmAutoTimerId = setTimeout(function () {
        rhythmAutoTimerId = null;
        startRhythmPlayback();
      }, 600);
    });

    // リズムの森［つぎへ］ → 結果のあとだけ受け付け、結果を記録して次の問題またはクリア画面へ進む
    bindButton("btn-rhythm-next", function () {
      var nextBtn = document.getElementById("btn-rhythm-next");
      if (rhythmState !== "result" || !nextBtn || nextBtn.hidden) {
        return;
      }
      rhythmResults[rhythmQIndex] = rhythmLastResult;
      stopRhythmRound();
      if (rhythmQIndex + 1 >= rhythmQuestions.length) {
        showRhythmClearScreen();
        return;
      }
      rhythmQIndex += 1;
      rhythmAttempt = 1;
      renderRhythmPattern();
      rhythmAutoTimerId = setTimeout(function () {
        rhythmAutoTimerId = null;
        startRhythmPlayback();
      }, 600);
    });

    // リズムの森「ドン！」の打つ処理（ボタン押下とスペースキーで共用）
    function hitRhythmDon() {
      var btn = document.getElementById("btn-rhythm-don");
      if (btn) {
        btn.classList.add("pressed");
      }
      if (ONPU.audio && typeof ONPU.audio.playDrum === "function") {
        ONPU.audio.playDrum();
      }
      if ((rhythmState === "count" || rhythmState === "tap") && ONPU.audio && typeof ONPU.audio.now === "function") {
        var tapNow = ONPU.audio.now();
        if (tapNow !== null) {
          var rel = tapNow - rhythmStart;
          if (rel >= -0.5 * rhythmBeatSec) {
            rhythmTaps.push(rel);
          }
        }
      }
    }

    // リズムの森「ドン！」 → pointerdown で今すぐたいこを鳴らし、カウント・たたく状態のとき時刻を記録する
    var donBtn = document.getElementById("btn-rhythm-don");
    if (donBtn) {
      donBtn.addEventListener("pointerdown", function (e) {
        if (e.button !== undefined && e.button !== 0) {
          return;
        }
        e.preventDefault();
        hitRhythmDon();
      });
      var clearDonPressed = function () {
        donBtn.classList.remove("pressed");
      };
      donBtn.addEventListener("pointerup", clearDonPressed);
      donBtn.addEventListener("pointerleave", clearDonPressed);
      donBtn.addEventListener("pointercancel", clearDonPressed);
    }

    // リズムの森のスペースキーで「ドン！」（capture 段階で受け取り、他のボタンやスクロールを止める）
    document.addEventListener("keydown", function (e) {
      var rhythmScreen = document.getElementById("screen-rhythm");
      if (!rhythmScreen || !rhythmScreen.classList.contains("active")) {
        return;
      }
      if (e.code !== "Space" && e.key !== " ") {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat || rhythmSpaceDown) {
        return;
      }
      rhythmSpaceDown = true;
      if (rhythmState === "count" || rhythmState === "tap") {
        hitRhythmDon();
      }
    }, true);

    document.addEventListener("keyup", function (e) {
      var rhythmScreen = document.getElementById("screen-rhythm");
      if (!rhythmScreen || !rhythmScreen.classList.contains("active")) {
        return;
      }
      if (e.code !== "Space" && e.key !== " ") {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      rhythmSpaceDown = false;
      var btn = document.getElementById("btn-rhythm-don");
      if (btn) {
        btn.classList.remove("pressed");
      }
    }, true);

    // 画面が隠れたとき → リズムの森の進行中（お手本・カウント・たたく）やパズルの谷を止め、未保存の利用時間を保存する
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") {
        flushUsageIfNeeded();
        rhythmSpaceDown = false;
        var btn = document.getElementById("btn-rhythm-don");
        if (btn) {
          btn.classList.remove("pressed");
        }
        var rhythmScreen = document.getElementById("screen-rhythm");
        if (
          rhythmScreen &&
          rhythmScreen.classList.contains("active") &&
          (rhythmState === "model" || rhythmState === "count" || rhythmState === "tap")
        ) {
          stopRhythmRound();
        }
        var puzzleScreen = document.getElementById("screen-puzzle");
        if (puzzleScreen && puzzleScreen.classList.contains("active")) {
          stopPuzzle();
        }
      }
    });

    // レベルを選ぶ画面「ちずへ」 → 地図にもどる
    bindButton("btn-level-map", function () {
      stopQuizTimer();
      showScreen("screen-map");
    });

    // 問題の画面「ちずへ」 → 進めている問題をやめて地図にもどる
    bindButton("btn-quiz-map", function () {
      stopQuizTimer();
      currentSession = null;
      showScreen("screen-map");
    });

    // 問題の画面「おとを きく」 → 今の問題の音を鳴らす
    bindButton("btn-quiz-listen", function () {
      if (waitingNext || !currentSession || currentSession.finished || !ONPU.quiz) {
        return;
      }
      var q = ONPU.quiz.current(currentSession);
      if (q === null) {
        return;
      }
      if (earTimerId !== null) {
        clearTimeout(earTimerId);
        earTimerId = null;
      }
      playCurrentQuestionSound(q);
    });

    // クリア画面「もういちど」 → 同じレベルをはじめからやり直す
    bindButton("btn-clear-retry", function () {
      if (clearKind === "rhythm") {
        if (rhythmLevel) {
          startRhythmSession(rhythmLevel);
        }
      } else if (clearKind === "puzzle") {
        if (puzzleLevel) {
          startPuzzleSession(puzzleLevel);
        }
      } else if (currentIslandKey) {
        startQuiz(currentIslandKey, currentLevel);
      }
    });

    // クリア画面「つぎの しまへ」 → 地図にもどる
    bindButton("btn-clear-next", function () {
      stopQuizTimer();
      stopRhythmRound();
      stopPuzzle();
      currentSession = null;
      clearRhythmSession();
      clearPuzzleSession();
      showScreen("screen-map");
    });

    // 地図の［スタンプちょう］・［がっきずかん］と、それぞれの［ちずへ］
    bindButton("btn-stamp", function () {
      showScreen("screen-stamp");
    });
    bindButton("btn-instruments", function () {
      showScreen("screen-zukan");
    });
    bindButton("btn-zukan-back", function () {
      closeZukanBig();
      showScreen("screen-map");
    });
    bindButton("btn-stamp-back", function () {
      showScreen("screen-map");
    });

    // がっきずかんのモーダル［おとを きく］・［とじる］
    bindButton("btn-zukan-play", function () {
      if (zukanOpenId && ONPU.audio && typeof ONPU.audio.playInstrument === "function") {
        ONPU.audio.playInstrument(zukanOpenId);
      }
    });
    bindButton("btn-zukan-close", function () {
      closeZukanBig();
    });

    // 利用時間の案内画面［おわる］・［おうちの ひとと つづける］
    bindButton("btn-timeup-end", function () {
      showScreen("screen-start");
    });
    bindButton("btn-timeup-more", function () {
      openLock(
        function () {
          var player = getCurrentPlayer();
          if (
            player &&
            ONPU.settings &&
            typeof ONPU.settings.extendTime === "function" &&
            typeof ONPU.settings.dateKey === "function"
          ) {
            settingsData = ONPU.settings.extendTime(
              settingsData,
              player.id,
              ONPU.settings.dateKey(new Date())
            );
            saveSettings();
          }
          showScreen("screen-map");
          if (ONPU.settings && typeof ONPU.settings.EXTEND_MINUTES === "number") {
            showToast(getText("timeup.extended", { n: ONPU.settings.EXTEND_MINUTES }));
          }
        },
        function () {
          showScreen("screen-timeup");
        }
      );
    });

    // 読み上げの🔊ボタン（ドレミの島・パズルの谷）
    bindButton("btn-quiz-speak", function () {
      var textEl = document.getElementById("quiz-question-text");
      if (textEl) {
        speakText(textEl.textContent);
      }
    });
    bindButton("btn-puzzle-speak", function () {
      var textEl = document.getElementById("puzzle-lead-text");
      if (textEl) {
        speakText(textEl.textContent);
      }
    });

    // クリア画面の「あたらしい がっき！」カード
    bindButton("btn-clear-new-inst", function () {
      if (clearNewInstId && ONPU.audio && typeof ONPU.audio.playInstrument === "function") {
        ONPU.audio.playInstrument(clearNewInstId);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
