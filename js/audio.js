/* =========================================================
   CityHz - 音響エンジン
   外部音源は一切使わず、Web Audio API で全て合成する。
   BGM は時間帯ごとにムードが変わる「自動生成のラジオ番組BGM」。
   SE は時報・ジングル・カフ・混信ノイズなどラジオ由来の音。
   ========================================================= */
const AUDIO = {
  ctx:null, ready:false,
  enabled:{ bgm:true, sfx:true },
  vol:{ bgm:0.55, sfx:0.7 },
  mood:null,
  _timer:null, _next:0, _step:0, _bar:0,
  _lastJingle:0
};

const m2f = m => 440 * Math.pow(2, (m-69)/12);

/* ---------- コード ---------- */
const CH = {
  Cmaj9:[60,64,67,71], Fmaj7:[65,69,72,76], Em7:[64,67,71,74], Am7:[57,60,64,67],
  Dm7:[62,65,69,72],   G7:[55,59,62,65],    Am9:[57,60,64,67],  Dm9:[62,65,69,72],
  Cm9:[60,63,67,70],   Fm7:[65,68,72,75],   Bb7:[58,62,65,68],  Ebmaj7:[63,67,70,74],
  Gm7:[55,58,62,65],   Cmaj7:[60,64,67,71]
};

/* ---------- 時間帯ごとのムード ---------- */
AUDIO.MOODS = {
  early:   { bpm:74,  prog:['Cmaj9','Fmaj7','Em7','Am7'],      hat:0.25, keys:0.35, bright:2600, name:'夜明けのスタジオ' },
  morning: { bpm:106, prog:['Cmaj9','Am7','Dm7','G7'],         hat:0.75, keys:0.60, bright:3800, name:'モーニングワイド' },
  noon:    { bpm:96,  prog:['Fmaj7','Em7','Dm7','G7'],         hat:0.55, keys:0.50, bright:3400, name:'昼下がりのスイング' },
  aftn:    { bpm:88,  prog:['Cmaj9','Em7','Fmaj7','G7'],       hat:0.45, keys:0.45, bright:3200, name:'午後のリクエスト' },
  evening: { bpm:92,  prog:['Am7','Dm7','Cmaj9','G7'],         hat:0.65, keys:0.50, bright:3600, name:'夕暮れドライブ' },
  night:   { bpm:80,  prog:['Am9','Dm9','Em7','Am7'],          hat:0.40, keys:0.55, bright:2900, name:'ナイトジャズ' },
  mid:     { bpm:62,  prog:['Cm9','Fm7','Bb7','Ebmaj7'],       hat:0.15, keys:0.30, bright:2200, name:'オールナイト' }
};

/* =========================================================
   初期化（ユーザー操作の直後に呼ぶ必要がある）
   ========================================================= */
AUDIO.init = function(){
  if(AUDIO.ready) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if(!AC) return;
  const ctx = AUDIO.ctx = new AC();

  AUDIO.master = ctx.createGain();
  AUDIO.master.gain.value = 0.9;
  AUDIO.master.connect(ctx.destination);

  // 音楽バス：AM/FM ラジオらしい帯域に整える
  AUDIO.musicBus = ctx.createGain();
  AUDIO.musicBus.gain.value = AUDIO.vol.bgm;
  const lp = ctx.createBiquadFilter(); lp.type='lowpass';  lp.frequency.value=3200; lp.Q.value=0.5;
  const hp = ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=150;
  AUDIO.radioLP = lp;
  AUDIO.musicBus.connect(hp); hp.connect(lp); lp.connect(AUDIO.master);

  AUDIO.sfxBus = ctx.createGain();
  AUDIO.sfxBus.gain.value = AUDIO.vol.sfx;
  AUDIO.sfxBus.connect(AUDIO.master);

  // 受信ノイズ（常時うっすら。受信品質が悪いほど大きくなる）
  AUDIO.noiseGain = ctx.createGain();
  AUDIO.noiseGain.gain.value = 0.006;
  const nf = ctx.createBiquadFilter(); nf.type='bandpass'; nf.frequency.value=2000; nf.Q.value=0.4;
  AUDIO.noiseGain.connect(nf); nf.connect(AUDIO.master);
  const hiss = ctx.createBufferSource();
  hiss.buffer = AUDIO.noiseBuffer(4); hiss.loop = true;
  hiss.connect(AUDIO.noiseGain); hiss.start();

  AUDIO.ready = true;
  AUDIO.startBGM();
};

AUDIO.resume = function(){
  if(AUDIO.ctx && AUDIO.ctx.state==='suspended') AUDIO.ctx.resume();
};

/* ホワイトノイズのバッファ */
AUDIO.noiseBuffer = function(sec){
  const ctx = AUDIO.ctx, n = Math.floor(ctx.sampleRate*sec);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for(let i=0;i<n;i++) d[i] = Math.random()*2-1;
  return buf;
};

/* =========================================================
   音色プリミティブ
   ========================================================= */
/* エレピ風（FM: サイン搬送波＋倍音モジュレータ） */
function ep(freq, t, dur, gain, dest){
  const ctx = AUDIO.ctx;
  const car = ctx.createOscillator(); car.type='sine'; car.frequency.value=freq;
  const mod = ctx.createOscillator(); mod.type='sine'; mod.frequency.value=freq*2.01;
  const mg  = ctx.createGain(); mg.gain.setValueAtTime(freq*1.6, t);
  mg.gain.exponentialRampToValueAtTime(freq*0.05, t+dur*0.7);
  mod.connect(mg); mg.connect(car.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t+0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  car.connect(g); g.connect(dest||AUDIO.musicBus);
  car.start(t); mod.start(t); car.stop(t+dur+0.05); mod.stop(t+dur+0.05);
}
/* やわらかいパッド */
function pad(freq, t, dur, gain){
  const ctx = AUDIO.ctx;
  const o1 = ctx.createOscillator(); o1.type='triangle'; o1.frequency.value=freq;
  const o2 = ctx.createOscillator(); o2.type='sine';     o2.frequency.value=freq*1.005;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t+dur*0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  o1.connect(g); o2.connect(g); g.connect(AUDIO.musicBus);
  o1.start(t); o2.start(t); o1.stop(t+dur+0.05); o2.stop(t+dur+0.05);
}
/* ウッドベース風 */
function bass(freq, t, dur, gain){
  const ctx = AUDIO.ctx;
  const o = ctx.createOscillator(); o.type='sine'; o.frequency.value=freq;
  const f = ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=520;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t+0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  o.connect(f); f.connect(g); g.connect(AUDIO.musicBus);
  o.start(t); o.stop(t+dur+0.05);
}
/* ブラシ／ハイハット */
function brush(t, gain){
  const ctx = AUDIO.ctx;
  const s = ctx.createBufferSource(); s.buffer = AUDIO.noiseBuffer(0.2);
  const f = ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=6000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t+0.07);
  s.connect(f); f.connect(g); g.connect(AUDIO.musicBus);
  s.start(t); s.stop(t+0.2);
}

/* =========================================================
   BGM シーケンサ（先読みスケジューリング）
   ========================================================= */
AUDIO.setMood = function(moodId){
  if(AUDIO.mood === moodId) return;
  AUDIO.mood = moodId;
  const m = AUDIO.MOODS[moodId];
  if(m && AUDIO.radioLP && AUDIO.ctx){
    AUDIO.radioLP.frequency.setTargetAtTime(m.bright, AUDIO.ctx.currentTime, 1.5);
  }
};

AUDIO.startBGM = function(){
  if(!AUDIO.ready || AUDIO._timer) return;
  AUDIO._next = AUDIO.ctx.currentTime + 0.2;
  AUDIO._step = 0; AUDIO._bar = 0;
  AUDIO._timer = setInterval(AUDIO._schedule, 25);
};
AUDIO.stopBGM = function(){
  if(AUDIO._timer){ clearInterval(AUDIO._timer); AUDIO._timer=null; }
};

AUDIO._schedule = function(){
  if(!AUDIO.ready) return;
  const ctx = AUDIO.ctx;
  const m = AUDIO.MOODS[AUDIO.mood] || AUDIO.MOODS.noon;
  const stepDur = 60/m.bpm/4;                 // 16分音符
  while(AUDIO._next < ctx.currentTime + 0.2){
    if(AUDIO.enabled.bgm) AUDIO._playStep(m, AUDIO._step, AUDIO._next);
    AUDIO._next += stepDur;
    AUDIO._step++;
    if(AUDIO._step>=16){ AUDIO._step=0; AUDIO._bar++; }
  }
};

AUDIO._playStep = function(m, step, t){
  const chord = CH[m.prog[AUDIO._bar % m.prog.length]];
  if(!chord) return;
  const beat = 60/m.bpm;

  // パッド：小節頭
  if(step===0){
    chord.forEach((n,i)=> pad(m2f(n+ (i===0?0:0)), t, beat*3.6, 0.030 - i*0.004));
  }
  // ベース：1拍目と3拍目裏
  if(step===0)  bass(m2f(chord[0]-24), t, beat*0.9, 0.14);
  if(step===6)  bass(m2f(chord[2]-24), t, beat*0.5, 0.09);
  if(step===8)  bass(m2f(chord[0]-24), t, beat*0.8, 0.11);
  if(step===14 && Math.random()<0.5) bass(m2f(chord[1]-24), t, beat*0.4, 0.07);

  // エレピ：確率的にアルペジオ
  if(step%2===0 && Math.random() < m.keys){
    const n = chord[Math.floor(Math.random()*chord.length)] + (Math.random()<0.28?12:0);
    ep(m2f(n), t, beat*1.1, 0.055);
  }
  // ブラシ：裏拍
  if(step%2===1 && Math.random() < m.hat) brush(t, 0.020);
  if(step===4 || step===12) brush(t, 0.028);

  // レコードのパチッというノイズ
  if(Math.random()<0.02) AUDIO._crackle(t);
};

AUDIO._crackle = function(t){
  const ctx = AUDIO.ctx;
  const s = ctx.createBufferSource(); s.buffer = AUDIO.noiseBuffer(0.03);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.05, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t+0.02);
  s.connect(g); g.connect(AUDIO.musicBus);
  s.start(t); s.stop(t+0.04);
};

/* 受信品質に応じてノイズ量を変える */
AUDIO.setSignal = function(q){
  if(!AUDIO.ready) return;
  const v = 0.004 + (1-clamp(q,0,1))*0.030;
  AUDIO.noiseGain.gain.setTargetAtTime(AUDIO.enabled.bgm? v : 0, AUDIO.ctx.currentTime, 0.8);
};

/* =========================================================
   効果音
   ========================================================= */
function tone(freq, t, dur, gain, type){
  const ctx = AUDIO.ctx;
  const o = ctx.createOscillator(); o.type = type||'sine'; o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t+0.008);
  g.gain.setValueAtTime(gain, t+dur*0.75);
  g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  o.connect(g); g.connect(AUDIO.sfxBus);
  o.start(t); o.stop(t+dur+0.03);
}
function noiseBurst(t, dur, gain, type, freq, q){
  const ctx = AUDIO.ctx;
  const s = ctx.createBufferSource(); s.buffer = AUDIO.noiseBuffer(Math.max(0.1,dur));
  const f = ctx.createBiquadFilter(); f.type = type||'bandpass';
  f.frequency.value = freq||1800; f.Q.value = q||1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  s.connect(f); f.connect(g); g.connect(AUDIO.sfxBus);
  s.start(t); s.stop(t+dur+0.05);
}

AUDIO.SFX = {
  /* 時報：440Hzの予備音3つ＋880Hzの正報 */
  timeSignal(t){
    for(let i=0;i<3;i++) tone(440, t+i*0.30, 0.09, 0.16);
    tone(880, t+0.90, 0.42, 0.18);
  },
  /* ステーションジングル：局名を言う前のあれ */
  jingle(t){
    const n=[72,76,79,84];
    n.forEach((v,i)=> ep(m2f(v), t+i*0.075, 0.5, 0.10, AUDIO.sfxBus));
  },
  /* カフを上げる（マイクON）：リレーのカチッ＋ルームトーン */
  micOn(t){
    noiseBurst(t, 0.03, 0.10, 'highpass', 3000, 1);
    tone(140, t+0.01, 0.05, 0.05, 'square');
  },
  /* ボタン */
  click(t){ noiseBurst(t, 0.02, 0.05, 'bandpass', 2600, 3); },
  /* 選局：ヘテロダインのピュルルル＋ノイズ */
  tuning(t){
    const ctx = AUDIO.ctx;
    const o = ctx.createOscillator(); o.type='sine';
    o.frequency.setValueAtTime(2400, t);
    o.frequency.exponentialRampToValueAtTime(380, t+0.42);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t+0.45);
    o.connect(g); g.connect(AUDIO.sfxBus);
    o.start(t); o.stop(t+0.5);
    noiseBurst(t, 0.45, 0.05, 'bandpass', 1400, 0.7);
  },
  /* 建設 */
  build(t){
    tone(180, t, 0.10, 0.10, 'square');
    noiseBurst(t+0.02, 0.14, 0.09, 'lowpass', 900, 1);
  },
  /* 契約成立・入金 */
  cash(t){ tone(880,t,0.10,0.10,'triangle'); tone(1320,t+0.09,0.16,0.09,'triangle'); },
  /* 良い知らせ */
  good(t){ [72,76,79].forEach((n,i)=> tone(m2f(n), t+i*0.09, 0.20, 0.09, 'triangle')); },
  /* 悪い知らせ：低い唸り */
  bad(t){ tone(120, t, 0.5, 0.11, 'sawtooth'); tone(119, t, 0.5, 0.08, 'sawtooth'); },
  /* 災害警報：二音交互（ゲーム用の様式化した警報音） */
  alert(t){
    for(let i=0;i<4;i++){
      tone(i%2? 1024:640, t+i*0.26, 0.24, 0.13, 'square');
    }
  },
  /* 放送事故：無音の落ちる音＋ノイズ */
  deadair(t){
    noiseBurst(t, 0.6, 0.10, 'lowpass', 500, 1);
    const ctx=AUDIO.ctx;
    const o=ctx.createOscillator(); o.type='sine';
    o.frequency.setValueAtTime(600,t); o.frequency.exponentialRampToValueAtTime(60,t+0.5);
    const g=ctx.createGain(); g.gain.setValueAtTime(0.09,t); g.gain.exponentialRampToValueAtTime(0.0001,t+0.55);
    o.connect(g); g.connect(AUDIO.sfxBus); o.start(t); o.stop(t+0.6);
  },
  /* 放送終了（サインオフ） */
  signoff(t){
    tone(1000, t, 1.6, 0.13);
    noiseBurst(t+1.7, 1.8, 0.07, 'bandpass', 2200, 0.4);
  }
};

AUDIO.play = function(name){
  if(!AUDIO.ready || !AUDIO.enabled.sfx) return;
  const fn = AUDIO.SFX[name];
  if(!fn) return;
  AUDIO.resume();
  try{ fn(AUDIO.ctx.currentTime + 0.02); }catch(e){}
};
/* 時報やジングルは、倍速時に鳴りすぎないよう名前ごとに間引く */
AUDIO._gaps = {};
AUDIO.playThrottled = function(name, minGapSec){
  const now = performance.now()/1000;
  if(now - (AUDIO._gaps[name]||0) < (minGapSec||6)) return;
  AUDIO._gaps[name] = now;
  AUDIO.play(name);
};

/* =========================================================
   トグル
   ========================================================= */
AUDIO.toggle = function(kind){
  AUDIO.enabled[kind] = !AUDIO.enabled[kind];
  if(kind==='bgm' && AUDIO.ready){
    AUDIO.musicBus.gain.setTargetAtTime(AUDIO.enabled.bgm?AUDIO.vol.bgm:0, AUDIO.ctx.currentTime, 0.1);
    AUDIO.noiseGain.gain.setTargetAtTime(AUDIO.enabled.bgm?0.008:0, AUDIO.ctx.currentTime, 0.1);
  }
  if(kind==='sfx' && AUDIO.ready){
    AUDIO.sfxBus.gain.setTargetAtTime(AUDIO.enabled.sfx?AUDIO.vol.sfx:0, AUDIO.ctx.currentTime, 0.1);
  }
  return AUDIO.enabled[kind];
};

/* =========================================================
   和文モールス（乱数放送のコールサイン送出）
   総務省告示の和文モールス符号（無線局運用規則 別表第一号）にもとづく。
   濁点・半濁点は簡略化し、清音の符号で代用する。
   ========================================================= */
AUDIO.WABUN = {
  'あ':'--.--','い':'.-','う':'..-','え':'-.---','お':'.-...',
  'か':'.-..','き':'-.-..','く':'...-','け':'-.--','こ':'----',
  'さ':'-.-.-','し':'--.-.','す':'---.-','せ':'.---.','そ':'---.',
  'た':'-.','ち':'..-.','つ':'.--.','て':'.-.--','と':'..-..',
  'な':'.-.','に':'-.-.','ぬ':'....','ね':'--.-','の':'..--',
  'は':'-...','ひ':'--..-','ふ':'--..','へ':'.','ほ':'-..',
  'ま':'-..-','み':'..-.-','む':'-','め':'-...-','も':'-..-.',
  'や':'.--','ゆ':'-..--','よ':'--',
  'ら':'...','り':'--.','る':'-.--.','れ':'---','ろ':'.-.-',
  'わ':'-.-','を':'.---','ん':'.-.-.'
};
AUDIO.WABUN_VOICED = {
  'が':'か','ぎ':'き','ぐ':'く','げ':'け','ご':'こ',
  'ざ':'さ','じ':'し','ず':'す','ぜ':'せ','ぞ':'そ',
  'だ':'た','ぢ':'ち','づ':'つ','で':'て','ど':'と',
  'ば':'は','び':'ひ','ぶ':'ふ','べ':'へ','ぼ':'ほ',
  'ぱ':'は','ぴ':'ひ','ぷ':'ふ','ぺ':'へ','ぽ':'ほ'
};

/* コールサインをCWのタイミングでビープ送出する（実際に届くふりをした演出音） */
AUDIO.playWabunCall = function(text, repeat){
  if(!AUDIO.ready || !AUDIO.enabled.sfx) return;
  AUDIO.resume();
  const ctx = AUDIO.ctx;
  const unit = 0.075, freq = 660;
  let t = ctx.currentTime + 0.05;
  const beep = dur => {
    const o = ctx.createOscillator(); o.type='sine'; o.frequency.value=freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11, t+0.006);
    g.gain.setValueAtTime(0.11, Math.max(t+0.006, t+dur-0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    o.connect(g); g.connect(AUDIO.sfxBus);
    o.start(t); o.stop(t+dur+0.01);
    t += dur;
  };
  const send = ch => {
    const code = AUDIO.WABUN[AUDIO.WABUN_VOICED[ch] || ch];
    if(!code) return;
    for(const sym of code){ beep(sym==='-' ? unit*3 : unit); t += unit; }
    t += unit*2;   // 文字間（符号間+文字間で計3単位）
  };
  for(let r=0; r<(repeat||2); r++){
    for(const ch of text) send(ch);
    t += unit*4;   // 語間（計7単位）
  }
};
