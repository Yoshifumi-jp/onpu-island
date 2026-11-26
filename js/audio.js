window.ONPU = window.ONPU || {};

// Web Audio API で音を合成して鳴らす処理
(function () {
  "use strict";

  var audioCtx = null;
  var masterGain = null;
  var masterVolume = 0.6;
  var noiseBuffer = null;
  var instNoiseBuffer = null;
  var audioUnavailable = false;

  // AudioContext とマスター音量（初期値 0.6）を用意し、動いていなければ再開する
  function ensureContext(playSilent) {
    if (audioUnavailable) {
      return null;
    }
    try {
      if (audioCtx && audioCtx.state === "closed") {
        audioCtx = null;
        masterGain = null;
        noiseBuffer = null;
        instNoiseBuffer = null;
      }
      var isNew = false;
      if (!audioCtx) {
        var CtxClass = window.AudioContext || window.webkitAudioContext;
        if (!CtxClass) {
          audioUnavailable = true;
          return null;
        }
        audioCtx = new CtxClass();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = masterVolume;
        masterGain.connect(audioCtx.destination);
        instNoiseBuffer = null;

        // バチの音に使う白色雑音（0.1秒）を1回だけ作って取っておく
        var sampleRate = audioCtx.sampleRate || 44100;
        noiseBuffer = audioCtx.createBuffer(1, Math.floor(sampleRate * 0.1), sampleRate);
        var data = noiseBuffer.getChannelData(0);
        for (var i = 0; i < data.length; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        isNew = true;
      }
      if (audioCtx.state !== "running") {
        try {
          var p = audioCtx.resume();
          if (p && typeof p.catch === "function") {
            p.catch(function () {});
          }
        } catch (e) {
          // 再開に失敗しても画面は止めない
        }
      }
      if (isNew && playSilent) {
        // iPhone・iPad 向けに、作った直後に長さ1サンプルの無音を1回鳴らす
        var buffer = audioCtx.createBuffer(1, 1, audioCtx.sampleRate || 22050);
        var source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(masterGain);
        source.start(0);
      }
      return audioCtx;
    } catch (e) {
      audioUnavailable = true;
      return null;
    }
  }

  // AudioContext がすでにあり、動いていなければ再開する（まだないときは何もしない）
  function resumeIfNeeded() {
    if (!audioCtx || audioUnavailable) {
      return;
    }
    try {
      if (audioCtx.state === "running") {
        return;
      }
      ensureContext(false);
    } catch (e) {
      // 再開に失敗しても画面は止めない
    }
  }

  // 音の準備（ボタン操作時に呼ぶ）
  function unlock() {
    ensureContext(true);
  }

  // 指定した時刻（startTime）・長さ（duration）・音の大きさ（volume）でピアノ風の音を予約する
  function schedulePianoNote(ctx, freq, startTime, duration, volume) {
    var vol = (typeof volume === "number" && isFinite(volume) && volume > 0 && volume <= 1) ? volume : 1;
    var endTime = startTime + duration + 0.6;

    // 音量のエンベロープ（0 → 0.005秒で 0.5 * vol → duration+0.6秒で 0.001 * vol）
    var envGain = ctx.createGain();
    envGain.gain.setValueAtTime(0, startTime);
    envGain.gain.linearRampToValueAtTime(0.5 * vol, startTime + 0.005);
    envGain.gain.exponentialRampToValueAtTime(0.001 * vol, endTime);
    envGain.connect(masterGain);

    // 三角波（周波数どおり、音量 1.0）
    var oscTri = ctx.createOscillator();
    var gainTri = ctx.createGain();
    oscTri.type = "triangle";
    oscTri.frequency.setValueAtTime(freq, startTime);
    gainTri.gain.setValueAtTime(1.0, startTime);
    oscTri.connect(gainTri);
    gainTri.connect(envGain);

    // 正弦波（周波数の2倍、音量 0.25）
    var oscSine = ctx.createOscillator();
    var gainSine = ctx.createGain();
    oscSine.type = "sine";
    oscSine.frequency.setValueAtTime(freq * 2, startTime);
    gainSine.gain.setValueAtTime(0.25, startTime);
    oscSine.connect(gainSine);
    gainSine.connect(envGain);

    oscTri.start(startTime);
    oscSine.start(startTime);
    oscTri.stop(endTime);
    oscSine.stop(endTime);
  }

  // ピアノ風の1音を鳴らす（duration を省いたときは 0.5秒）
  function playNote(name, duration) {
    if (!ONPU.music || typeof ONPU.music.noteToFrequency !== "function") {
      return;
    }
    var freq = ONPU.music.noteToFrequency(name);
    if (freq === null) {
      return;
    }
    var dur = (typeof duration === "number" && duration > 0) ? duration : 0.5;
    var ctx = ensureContext(false);
    if (!ctx) {
      return;
    }
    try {
      schedulePianoNote(ctx, freq, ctx.currentTime, dur);
    } catch (e) {
      // 音の再生に失敗しても画面は止めない
    }
  }

  // ピアノ風の1音を指定した時刻に予約する（duration を省いたときは 0.1秒）
  function playNoteAt(name, when, duration, volume) {
    if (!ONPU.music || typeof ONPU.music.noteToFrequency !== "function") {
      return;
    }
    var freq = ONPU.music.noteToFrequency(name);
    if (freq === null) {
      return;
    }
    var dur = (typeof duration === "number" && isFinite(duration) && duration > 0) ? duration : 0.1;
    var ctx = ensureContext(false);
    if (!ctx) {
      return;
    }
    try {
      var startTime = (typeof when === "number" && isFinite(when))
        ? Math.max(when, ctx.currentTime)
        : ctx.currentTime;
      schedulePianoNote(ctx, freq, startTime, dur, volume);
    } catch (e) {
      // 音の再生に失敗しても画面は止めない
    }
  }

  // たいこの1つの層（発振器）を鳴らす
  function scheduleDrumTone(ctx, t, type, f0, f1, sweep, gain, decay, attack) {
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + sweep);
    if (attack > 0) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + attack);
    } else {
      g.gain.setValueAtTime(gain, t);
    }
    g.gain.exponentialRampToValueAtTime(0.001, t + decay);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(t);
    osc.stop(t + decay + 0.02);
  }

  // 太鼓の音を鳴らす（胴の音・倍音・バチの音の3層）
  function playDrum(when) {
    if (!ONPU.music || !ONPU.music.DRUM || !ONPU.music.DRUM.body) {
      return;
    }
    var ctx = ensureContext(false);
    if (!ctx) {
      return;
    }
    try {
      var drum = ONPU.music.DRUM;
      var b = drum.body;
      var t = (typeof when === "number" && isFinite(when))
        ? Math.max(when, ctx.currentTime)
        : ctx.currentTime;

      // 胴の音
      scheduleDrumTone(ctx, t, b.type, b.f0, b.f1, b.sweep, b.gain, b.decay, b.attack);

      // 重ねる倍音
      if (drum.over) {
        scheduleDrumTone(
          ctx,
          t,
          drum.over.type,
          b.f0 * drum.over.ratio,
          b.f1 * drum.over.ratio,
          b.sweep,
          drum.over.gain,
          drum.over.decay,
          b.attack
        );
      }

      // バチが当たる音（白色雑音を帯域フィルタに通す）
      if (drum.hit && noiseBuffer) {
        var src = ctx.createBufferSource();
        var filter = ctx.createBiquadFilter();
        var hitGain = ctx.createGain();

        src.buffer = noiseBuffer;
        filter.type = "bandpass";
        filter.frequency.value = drum.hit.freq;
        filter.Q.value = drum.hit.q;

        hitGain.gain.setValueAtTime(drum.hit.gain, t);
        hitGain.gain.exponentialRampToValueAtTime(0.001, t + drum.hit.decay);

        src.connect(filter);
        filter.connect(hitGain);
        hitGain.connect(masterGain);

        src.start(t);
        src.stop(t + drum.hit.decay + 0.02);
      }
    } catch (e) {
      // 音の再生に失敗しても画面は止めない
    }
  }

  // メロディを予約して鳴らす
  function playMelody(key) {
    if (!ONPU.music || !ONPU.music.MELODIES || !ONPU.music.MELODIES[key]) {
      return;
    }
    var ctx = ensureContext(false);
    if (!ctx) {
      return;
    }
    try {
      var schedule = ONPU.music.toSchedule(ONPU.music.MELODIES[key]);
      var baseTime = ctx.currentTime + 0.05;
      for (var i = 0; i < schedule.events.length; i++) {
        var ev = schedule.events[i];
        schedulePianoNote(ctx, ev.frequency, baseTime + ev.start, ev.duration);
      }
    } catch (e) {
      // 音の再生に失敗しても画面は止めない
    }
  }

  // 複数の音を指定した時刻で予約して鳴らす
  function playSequence(list) {
    if (!Array.isArray(list) || !ONPU.music || typeof ONPU.music.noteToFrequency !== "function") {
      return;
    }
    var ctx = ensureContext(false);
    if (!ctx) {
      return;
    }
    try {
      var baseTime = ctx.currentTime + 0.05;
      for (var i = 0; i < list.length; i++) {
        var item = list[i];
        if (!item) {
          continue;
        }
        var freq = ONPU.music.noteToFrequency(item.name);
        if (freq !== null) {
          schedulePianoNote(ctx, freq, baseTime + item.start, item.duration);
        }
      }
    } catch (e) {
      // 音の再生に失敗しても画面は止めない
    }
  }

  // 楽器の音に使う白色雑音（2秒）を初回のみ作って返す
  function ensureInstNoiseBuffer(ctx) {
    if (!instNoiseBuffer) {
      var sampleRate = ctx.sampleRate || 44100;
      instNoiseBuffer = ctx.createBuffer(1, Math.floor(sampleRate * 2), sampleRate);
      var data = instNoiseBuffer.getChannelData(0);
      for (var i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    return instNoiseBuffer;
  }

  // MIDI 番号を周波数（Hz）に変換する（60＝ド C4）
  function instHz(n) {
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  // 楽器音用の音量エンベロープを作って masterGain につなぐ
  function instEnv(ctx, t, a, peak, d, hold) {
    var g = ctx.createGain();
    hold = hold || 0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    if (hold) {
      g.gain.setValueAtTime(peak, t + a + hold);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + d);
    g.connect(masterGain);
    return g;
  }

  // 楽器音用の単発オシレータを予約する
  function instTone(ctx, type, f, t, a, peak, d, hold, f2) {
    var o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) {
      o.frequency.exponentialRampToValueAtTime(f2, t + a + (hold || 0) + d);
    }
    var g = instEnv(ctx, t, a, peak, d, hold);
    o.connect(g);
    o.start(t);
    o.stop(t + a + (hold || 0) + d + 0.05);
    return o;
  }

  // 楽器音用のノイズをフィルタに通して予約する
  function instNoise(ctx, buf, t, ftype, f, q, a, peak, d) {
    var s = ctx.createBufferSource();
    s.buffer = buf;
    var fl = ctx.createBiquadFilter();
    fl.type = ftype;
    fl.frequency.value = f;
    fl.Q.value = q;
    var g = instEnv(ctx, t, a, peak, d);
    s.connect(fl);
    fl.connect(g);
    s.start(t, Math.random());
    s.stop(t + a + d + 0.05);
  }

  // ふく楽器・こする楽器のつづく音を予約する（vib＝ゆれ、filt＝ローパスの周波数）
  function instHeld(ctx, type, f, t, dur, peak, opt) {
    opt = opt || {};
    var o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (opt.vib) {
      var lfo = ctx.createOscillator();
      lfo.frequency.value = opt.vib;
      var lg = ctx.createGain();
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * 0.006, t + 0.25);
      lfo.connect(lg);
      lg.connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.2);
    }
    var node = o;
    if (opt.filt) {
      var fl = ctx.createBiquadFilter();
      fl.type = "lowpass";
      fl.Q.value = opt.q || 0.8;
      if (opt.brass) {
        fl.frequency.setValueAtTime(500, t);
        fl.frequency.linearRampToValueAtTime(opt.filt, t + 0.06);
        fl.frequency.linearRampToValueAtTime(opt.filt * 0.7, t + dur);
      } else {
        fl.frequency.value = opt.filt;
      }
      o.connect(fl);
      node = fl;
    }
    var a = opt.a || 0.05;
    var r = opt.r || 0.08;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + dur - r);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(masterGain);
    node.connect(g);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // 息の音を予約する
  function instBreath(ctx, buf, t, f, dur, peak) {
    var s = ctx.createBufferSource();
    s.buffer = buf;
    var fl = ctx.createBiquadFilter();
    fl.type = "bandpass";
    fl.frequency.value = f;
    fl.Q.value = 1.2;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.05);
    g.gain.setValueAtTime(peak * 0.5, t + dur - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl);
    fl.connect(g);
    g.connect(masterGain);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }

  // 10種の楽器ごとの合成処理
  var INSTRUMENT_SYNTHS = {
    castanet: function (ctx, buf, t) {
      [0, 0.25, 0.5, 0.625, 0.75].forEach(function (x) {
        instNoise(ctx, buf, t + x, "bandpass", 2400, 4, 0.002, 0.9, 0.05);
        instTone(ctx, "sine", 1700, t + x, 0.002, 0.25, 0.04);
      });
    },
    suzu: function (ctx, buf, t) {
      [0, 0.2, 0.4, 0.6].forEach(function (x) {
        instNoise(ctx, buf, t + x, "highpass", 6000, 0.7, 0.004, 0.25, 0.09);
        [4300, 5200, 6100, 7300].forEach(function (f) {
          instTone(ctx, "sine", f * (0.97 + Math.random() * 0.06), t + x + Math.random() * 0.03, 0.003, 0.05, 0.35);
        });
      });
    },
    triangle: function (ctx, buf, t) {
      instNoise(ctx, buf, t, "highpass", 5000, 0.7, 0.002, 0.15, 0.03);
      [[1180, .2], [2630, .1], [4050, .07], [5520, .05], [7080, .035]].forEach(function (p) {
        instTone(ctx, "sine", p[0], t, 0.003, p[1], 2.8);
      });
    },
    kenhamo: function (ctx, buf, t) {
      [72, 76, 79, 76, 72].forEach(function (n, i) {
        var f = instHz(n);
        var x = t + i * 0.36;
        var d = i === 4 ? 0.7 : 0.34;
        instHeld(ctx, "sawtooth", f, x, d, 0.16, { filt: 2600, a: 0.03, r: 0.05 });
        instHeld(ctx, "square", f, x, d, 0.08, { filt: 2200, a: 0.03, r: 0.05 });
      });
    },
    recorder: function (ctx, buf, t) {
      [79, 81, 83, 84].forEach(function (n, i) {
        var f = instHz(n);
        var x = t + i * 0.4;
        var d = i === 3 ? 0.8 : 0.38;
        instHeld(ctx, "sine", f, x, d, 0.32, { a: 0.06, r: 0.06 });
        instHeld(ctx, "sine", f * 2, x, d, 0.035, { a: 0.06, r: 0.06 });
        instHeld(ctx, "sine", f * 3, x, d, 0.05, { a: 0.06, r: 0.06 });
        instBreath(ctx, buf, x, f * 2, d, 0.04);
      });
    },
    violin: function (ctx, buf, t) {
      [69, 72, 76].forEach(function (n, i) {
        var f = instHz(n);
        var x = t + i * 0.55;
        var d = i === 2 ? 1.1 : 0.55;
        instHeld(ctx, "sawtooth", f, x, d, 0.16, { filt: 3200, q: 1.2, vib: 5.5, a: 0.12, r: 0.1 });
      });
    },
    flute: function (ctx, buf, t) {
      [72, 76, 79, 84].forEach(function (n, i) {
        var f = instHz(n);
        var x = t + i * 0.4;
        var d = i === 3 ? 0.9 : 0.38;
        instHeld(ctx, "sine", f, x, d, 0.34, { vib: 5, a: 0.08, r: 0.08 });
        instHeld(ctx, "sine", f * 2, x, d, 0.04, { vib: 5, a: 0.08, r: 0.08 });
        instBreath(ctx, buf, x, f * 1.5, d, 0.05);
      });
    },
    trumpet: function (ctx, buf, t) {
      [[67, 0, .15], [72, .18, .15], [76, .36, .15], [79, .54, .7]].forEach(function (p) {
        instHeld(ctx, "sawtooth", instHz(p[0]), t + p[1], p[2], 0.2, { filt: 3500, brass: true, a: 0.03, r: 0.05 });
      });
    },
    harp: function (ctx, buf, t) {
      [60, 64, 67, 72, 76, 79, 84].forEach(function (n, i) {
        var f = instHz(n);
        var x = t + i * 0.1;
        instTone(ctx, "triangle", f, x, 0.003, 0.3, 1.3);
        instTone(ctx, "sine", f * 2, x, 0.002, 0.08, 0.4);
      });
    },
    timpani: function (ctx, buf, t) {
      [[43, 0], [48, 0.5], [43, 0.9], [48, 1.05]].forEach(function (p) {
        var f = instHz(p[0]);
        var x = t + p[1];
        instNoise(ctx, buf, x, "lowpass", 700, 0.7, 0.002, 0.25, 0.08);
        instTone(ctx, "sine", f * 1.03, x, 0.004, 0.6, 1.2, 0, f);
        instTone(ctx, "sine", f * 1.5, x, 0.004, 0.25, 0.7);
        instTone(ctx, "sine", f * 2, x, 0.004, 0.2, 0.5);
        instTone(ctx, "sine", f * 3, x, 0.004, 0.08, 0.3);
      });
    }
  };

  // 指定した楽器の音を鳴らす（10種以外は無視。音が使えない端末でも止めない）
  function playInstrument(id) {
    if (typeof id !== "string" || !Object.prototype.hasOwnProperty.call(INSTRUMENT_SYNTHS, id)) {
      return;
    }
    var ctx = ensureContext(false);
    if (!ctx) {
      return;
    }
    try {
      var buf = ensureInstNoiseBuffer(ctx);
      INSTRUMENT_SYNTHS[id](ctx, buf, ctx.currentTime + 0.05);
    } catch (e) {
      // 音の再生に失敗しても画面は止めない
    }
  }

  // 音の時計の今の時刻（秒）を返す。音が使えないときは null
  function now() {
    var ctx = ensureContext(false);
    if (!ctx) {
      return null;
    }
    try {
      return typeof ctx.currentTime === "number" ? ctx.currentTime : null;
    } catch (e) {
      return null;
    }
  }

  // 端末が知らせる音の遅れを返す。AudioContext がまだないときは null
  function getLatency() {
    if (!audioCtx || audioUnavailable) {
      return null;
    }
    try {
      if (audioCtx.state === "closed") {
        return null;
      }
      return {
        base: audioCtx.baseLatency,
        output: audioCtx.outputLatency
      };
    } catch (e) {
      return null;
    }
  }

  // 全体の音量（0 より大きく 1 以下）を変える
  function setVolume(gain) {
    if (typeof gain !== "number" || !isFinite(gain) || gain <= 0 || gain > 1) {
      return;
    }
    masterVolume = gain;
    if (masterGain) {
      try {
        masterGain.gain.value = masterVolume;
      } catch (e) {
        // 反映に失敗しても画面は止めない
      }
    }
  }

  ONPU.audio = {
    unlock: unlock,
    resumeIfNeeded: resumeIfNeeded,
    setVolume: setVolume,
    playNote: playNote,
    playNoteAt: playNoteAt,
    playDrum: playDrum,
    playMelody: playMelody,
    playSequence: playSequence,
    playInstrument: playInstrument,
    now: now,
    getLatency: getLatency
  };

  // 画面にもどったとき・表示し直されたとき・触れたときに、止まっていれば再開する
  if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") {
        resumeIfNeeded();
      }
    });
    document.addEventListener("pointerdown", function () {
      resumeIfNeeded();
    }, true);
  }
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("pageshow", function () {
      resumeIfNeeded();
    });
  }
})();

