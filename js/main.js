/* =========================================================
   CityHz - 起動とメインループ
   ========================================================= */
(function(){

  /* ---------- タイトル ---------- */
  let bootMode = 'normal';
  let bootDiff = 'normal';

  document.querySelectorAll('.mode-btn').forEach(b=>{
    b.onclick = ()=>{
      document.querySelectorAll('.mode-btn').forEach(x=>x.classList.remove('selected'));
      b.classList.add('selected');
      bootMode = b.dataset.mode;
    };
  });

  // 難易度ボタン
  const diffWrap = document.getElementById('bootDiffs');
  D.DIFFS.forEach(d=>{
    const b = document.createElement('button');
    b.className = 'diff-btn' + (d.id===bootDiff ? ' selected' : '');
    b.textContent = d.name;
    b.dataset.diff = d.id;
    b.onclick = ()=>{
      bootDiff = d.id;
      diffWrap.querySelectorAll('.diff-btn').forEach(x=>x.classList.toggle('selected', x.dataset.diff===d.id));
      showDiffDesc();
    };
    diffWrap.appendChild(b);
  });
  function showDiffDesc(){
    const d = D.diff(bootDiff);
    document.getElementById('bootDiffDesc').innerHTML =
      d.desc + '<br>開局資金 ' + money(Math.round(D.CONST.START_MONEY*d.money))
      + '　広告単価 ×' + d.pay + '　固定費 ×' + d.cost
      + '　事故率 ×' + d.incident + '　競合 ×' + d.rival;
  }
  showDiffDesc();

  // 新規／続きから のタブ
  document.querySelectorAll('.boot-tab').forEach(b=>{
    b.onclick = ()=>{
      document.querySelectorAll('.boot-tab').forEach(x=>x.classList.toggle('sel', x===b));
      const isNew = b.dataset.boot==='new';
      document.getElementById('bootNew').classList.toggle('hidden', !isNew);
      document.getElementById('bootContinue').classList.toggle('hidden', isNew);
      if(!isNew) renderSaves();
    };
  });

  function renderSaves(){
    const box = document.getElementById('bootSaves');
    const list = G.listSaves();
    let h = '';
    for(const e of list){
      const label = e.slot==='auto' ? 'AUTO' : (e.slot==='legacy' ? '旧' : 'SLOT '+(e.slot+1));
      if(e.empty){
        h += '<div class="save-row empty"><span class="save-slot">'+label+'</span>'
           + '<div class="save-info"><b>空きスロット</b><span>'
           + (e.broken?'データが壊れています':'保存データはありません')+'</span></div></div>';
        continue;
      }
      const m = e.meta;
      const mode = m.mode==='disaster' ? '災害' : '通常';
      const dif = D.diff(m.diff).name;
      const dt = new Date(m.at||0);
      const stamp = m.at ? (dt.getFullYear()+'/'+(dt.getMonth()+1)+'/'+dt.getDate()+' '
                    + String(dt.getHours()).padStart(2,'0')+':'+String(dt.getMinutes()).padStart(2,'0')) : '';
      h += '<div class="save-row"><span class="save-slot'+(e.slot==='auto'?' auto':'')+'">'+label+'</span>'
         + '<div class="save-info"><b>'+esc(m.name)+'</b>'
         + '<span>'+esc(m.call)+' '+m.freq+'MHz / '+mode+'・'+dif
         + ' / '+m.y+'年目'+m.m+'月'+m.d+'日'
         + ' / '+money(m.money)+' / 聴取率'+m.rating+'%'
         + (m.over?' <b style="color:#ff4d4d">［放送終了］</b>':'')+'</span>'
         + '<span style="font-size:10px">'+stamp+'</span></div>'
         + '<div class="save-acts">'
         + '<button class="btn pri" data-resume="'+e.slot+'">再開</button>'
         + '<button class="btn dan" data-del="'+e.slot+'">削除</button>'
         + '</div></div>';
    }
    box.innerHTML = h;
    box.querySelectorAll('[data-resume]').forEach(b=>b.onclick=()=>{
      const slot = b.dataset.resume==='auto' ? 'auto'
                 : (b.dataset.resume==='legacy' ? 'legacy' : Number(b.dataset.resume));
      resume(slot);
    });
    box.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{
      const slot = b.dataset.del==='auto' ? 'auto'
                 : (b.dataset.del==='legacy' ? 'legacy' : Number(b.dataset.del));
      G.deleteSave(slot); renderSaves();
    });
  }

  function resume(slot){
    const wantAudio = document.getElementById('bootAudio').checked;
    if(wantAudio){ AUDIO.init(); AUDIO.resume(); }
    else { AUDIO.enabled.bgm = AUDIO.enabled.sfx = false; syncAudioButtons(); }
    if(!G.loadFrom(slot)) return;
    document.getElementById('boot').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    MAP.init();
    TUT.render();
    UI.setView('city');
    UI.refresh();
    AUDIO.play('jingle');
    if(!started){ started = true; requestAnimationFrame(loop); }
  }

  // タイトル起動時、保存データがあれば「続きから」を既定タブにする
  if(G.listSaves().some(e=>!e.empty)){
    document.querySelector('.boot-tab[data-boot="continue"]').click();
  }

  let started = false;

  document.getElementById('bootStart').onclick = ()=>{
    const name = document.getElementById('bootName').value.trim() || 'シティ放送';
    const call = document.getElementById('bootCall').value.trim() || 'JOZZ-FM';
    const freq = parseFloat(document.getElementById('bootFreq').value) || 79.5;
    const wantTut   = document.getElementById('bootTut').checked;
    const wantAudio = document.getElementById('bootAudio').checked;
    // AudioContext はユーザー操作の直後でないと開始できないので、ここで初期化する
    if(wantAudio){ AUDIO.init(); AUDIO.resume(); }
    else { AUDIO.enabled.bgm = AUDIO.enabled.sfx = false; syncAudioButtons(); }
    document.getElementById('boot').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    start({ name, call, freq: freq.toFixed(1), mode: bootMode, diff: bootDiff }, wantTut);
  };

  function start(opts, wantTut){
    G.newGame(opts);
    MAP.init();
    UI.rebuildLog();
    UI.setView('city');
    if(wantTut) TUT.start(G.state); else TUT.render();
    AUDIO.play('jingle');
    UI.refresh();
    if(opts.mode !== 'normal'){
      G.queue({
        head:'開局にあたって — 報道局長より',
        body:'このモードでは災害が発生します。放送法は災害時の放送を放送事業者の努力義務としています。'
          +'<br><br>ただし注意してください。<b>気象業務法第17条</b>により、気象庁の許可なく「予報」を発表することはできません。'
          +'気象庁発表の<u>引用</u>は自由ですが、<b>自局の判断による今後の見通し</b>を放送すれば違法です。'
          +'<br><br>許可を取るには<b>気象予報士を2名以上</b>雇用したうえで【免許】画面から申請します。'
          +'<br><br>そして——マイクの前で人は失言します。構成作家とディレクターを軽視しないことです。'
          +'<br><br><span style="color:#8296a8">※ 災害モードのON/OFFは、サイドバーの【設定】からいつでも切り替えられます。</span>',
        opts:[{ label:'了解した', fn:()=>{} }]
      });
    }
    if(!started){ started = true; requestAnimationFrame(loop); }
  }

  /* ---------- 速度 ---------- */
  document.querySelectorAll('.speed button').forEach(b=>{
    b.onclick = ()=>{
      G.speed = Number(b.dataset.speed);
      document.querySelectorAll('.speed button').forEach(x=>x.classList.remove('sel'));
      b.classList.add('sel');
    };
  });

  /* ---------- ナビ ---------- */
  document.querySelectorAll('.nav[data-view]').forEach(b=>{
    b.onclick = ()=> UI.setView(b.dataset.view);
  });
  document.getElementById('btnSave').onclick = ()=> UI.slotDialog('save');
  document.getElementById('btnLoad').onclick = ()=> UI.slotDialog('load');
  document.getElementById('btnTut').onclick = ()=>{
    if(!G.state) return;
    if(TUT.active && !TUT.done) TUT.stop();
    else TUT.start(G.state);
  };
  document.getElementById('btnSettings').onclick = ()=> UI.settingsDialog();

  /* ---------- 音量トグル ---------- */
  function syncAudioButtons(){
    document.getElementById('btnBgm').classList.toggle('on', AUDIO.enabled.bgm);
    document.getElementById('btnSfx').classList.toggle('on', AUDIO.enabled.sfx);
  }
  document.getElementById('btnBgm').onclick = ()=>{
    AUDIO.init(); AUDIO.resume(); AUDIO.toggle('bgm'); syncAudioButtons();
  };
  document.getElementById('btnSfx').onclick = ()=>{
    AUDIO.init(); AUDIO.resume(); AUDIO.toggle('sfx'); syncAudioButtons();
    AUDIO.play('click');
  };

  /* ---------- キーボード ---------- */
  window.addEventListener('keydown', e=>{
    if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT') return;
    const map = {'1':'city','2':'studio','3':'sched','4':'staff','5':'sales',
                 '6':'network','7':'legal','8':'finance','9':'glossary'};
    if(map[e.key]) UI.setView(map[e.key]);
    if(e.key===' '){ e.preventDefault();
      const sp = G.speed===0 ? 1 : 0;
      G.speed = sp;
      document.querySelectorAll('.speed button').forEach(x=>x.classList.toggle('sel', Number(x.dataset.speed)===sp));
    }
  });

  /* ---------- メインループ ---------- */
  let last = performance.now();
  let uiAcc = 0;
  function loop(now){
    const dt = Math.min(200, now - last); last = now;

    if(G.state && G.speed>0 && !G.pendingEvent){
      G.acc += dt * G.speed;
      const step = D.CONST.TICK_MS;
      let guard = 0;
      while(G.acc >= step && guard++ < 12){
        G.acc -= step;
        G.tick();
        if(G.pendingEvent) break;
      }
    }
    // イベント表示
    if(G.pendingEvent && document.getElementById('modal').classList.contains('hidden')){
      UI.showEvent();
    }
    // 描画
    if(G.state){
      if(UI.view==='city') MAP.drawCity();
      else if(UI.view==='studio') MAP.drawStudio();
      uiAcc += dt;
      if(uiAcc > 200){
        uiAcc = 0;
        UI.refreshTop();
        // パネルは日付が変わったときだけ再描画（操作中のちらつきを防ぐ）
        const stamp = G.state.time.y+'/'+G.state.time.m+'/'+G.state.time.d;
        if(stamp !== UI.dayStamp){
          UI.dayStamp = stamp;
          TUT.check();
          if(UI.view!=='city' && UI.view!=='studio' && UI.view!=='glossary') UI.refresh();
        }
      }
    }
    requestAnimationFrame(loop);
  }
})();
