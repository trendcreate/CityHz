/* =========================================================
   CityHz - UI
   ========================================================= */
const UI = {
  view: 'city',
  editing: null,
  prevSpeed: 1
};

const $ = id => document.getElementById(id);
const esc = t => String(t).replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

/* ---------- トースト ---------- */
UI.toast = function(msg, cls){
  const d = document.createElement('div');
  d.className = 'toast ' + (cls||'');
  d.textContent = msg;
  $('toasts').appendChild(d);
  setTimeout(()=>{ d.style.opacity=0; d.style.transition='opacity .4s'; }, 2600);
  setTimeout(()=>d.remove(), 3100);
};

/* ---------- ログ ---------- */
UI.pushLog = function(e){
  const box = $('log');
  const d = document.createElement('div');
  d.className = e.cls || '';
  d.innerHTML = '<span class="time">'+e.t+'</span>'+e.msg;
  box.appendChild(d);
  while(box.children.length>200) box.removeChild(box.firstChild);
  box.scrollTop = box.scrollHeight;
};
UI.rebuildLog = function(){
  $('log').innerHTML='';
  for(const e of (G.state.log||[])) UI.pushLog(e);
};

/* ---------- ビュー切替 ---------- */
UI.setView = function(v){
  if(UI.view !== v) AUDIO.play('click');
  UI.view = v;
  if(typeof TUT!=='undefined') TUT.visited[v] = true;
  document.querySelectorAll('.nav[data-view]').forEach(b=>b.classList.toggle('sel', b.dataset.view===v));
  document.querySelectorAll('.view').forEach(el=>el.classList.add('hidden'));
  $('view-'+v).classList.remove('hidden');
  UI.refresh();
};

/* ---------- トップバー ---------- */
UI.refreshTop = function(){
  const s = G.state; if(!s) return;
  $('hdrName').textContent = s.meta.name;
  $('hdrCall').textContent = s.meta.call + ' / ' + s.meta.freq + 'MHz / '
    + (s.meta.mode==='disaster'?'災害':'通常') + '・' + D.diff(s.meta.diff).name
    + ' / ' + D.market(s.meta.market).name + '・' + D.company(s.meta.company).name;
  $('stMoney').textContent = money(s.money);
  $('stMoney').style.color = s.money<0 ? '#ff4d4d' : '#39d4ff';
  $('stRating').textContent = pct(s.ratingAvg||0);
  $('stTrust').textContent = Math.round(s.trust);
  $('stTrust').style.color = s.trust<35?'#ff4d4d':(s.trust>70?'#4ade80':'#39d4ff');
  $('stMorale').textContent = Math.round(s.morale);
  $('stPop').textContent = (s.coverPop/10000).toFixed(1)+'万人';
  $('stSimul').textContent = Math.round(s.simulAvg||0);
  $('stSimul').style.color = s.licenses.includes('multi') ? 'var(--accent2)' : '#8296a8';
  const t = s.time;
  $('clkDate').textContent = t.y+'年目 '+t.m+'月'+t.d+'日('+D.DAYS[t.dow]+')';
  $('clkTime').textContent = String(t.h).padStart(2,'0')+':00';
  $('clkTime').classList.toggle('onair', D.fmt(G.currentCell(s).fmt).id!=='filler');

  // ON AIR ボックス
  const cell = G.currentCell(s);
  const f = D.fmt(cell.fmt);
  const dj = cell.dj ? s.staff.find(x=>x.id===cell.dj) : null;
  const blk = D.blockAt(t.h);
  $('onairTitle').textContent = f.name + '（'+blk.name+'）';
  $('onairDj').textContent = dj ? dj.name+'（疲労 '+Math.round(dj.fatigue)+'）'
    : (f.need.includes('dj') ? '※ 担当者不在' : '自動送出');
  $('onairMeter').style.width = clamp((s.rating||0)/8*100,0,100)+'%';
  $('onairShare').textContent = '瞬間聴取率 '+pct(s.rating||0)
    + ' / シェア '+((s.curShare||0)*100).toFixed(1)+'%'
    + (s.disasterActive ? ' / 【'+s.disasterActive.name+'】報道中' : '');

  // BGM を時間帯のムードに合わせ、受信品質をノイズ量に反映する
  const mood = AUDIO.MOODS[blk.id];
  $('onairMood').textContent = mood ? '♪ '+mood.name : '';
  AUDIO.setMood(blk.id);
  AUDIO.setSignal(s.signalQ||0);
};

/* ---------- 全体更新 ---------- */
UI.refresh = function(){
  if(!G.state) return;
  UI.refreshTop();
  if(typeof TUT!=='undefined') TUT.check();
  if(UI.view==='city' || UI.view==='studio') MAP.refreshLegend();
  else if(UI['render_'+UI.view]) UI['render_'+UI.view]();
};

/* =========================================================
   編成
   ========================================================= */
UI.render_sched = function(){
  const s = G.state, el = $('view-sched');
  let h = '<h2>番組編成</h2>'
    + '<p class="hint">縦が時間帯、横が曜日です。セルをクリックして番組フォーマットと担当アナウンサーを決めます。'
    + '時間帯に合わないフォーマットは聴取率が伸びません。必要なスタッフがいないと番組の質が落ちます。</p>';

  h += '<div class="sched-grid"><div class="hd">時間帯</div>';
  for(const d of D.DAYS) h += '<div class="hd">'+d+'</div>';
  for(const b of D.BLOCKS){
    h += '<div class="hd" style="text-align:left;padding:8px 4px">'+b.name+'<br><span style="font-size:9px">'+b.range+'</span></div>';
    for(let dw=0; dw<7; dw++){
      const c = s.schedule[dw+'-'+b.id] || {fmt:'filler',dj:null};
      const f = D.fmt(c.fmt);
      const dj = c.dj ? s.staff.find(x=>x.id===c.dj) : null;
      const cls = 'sched-cell' + (c.fmt==='filler'?' empty':'') + (c.fmt==='net'?' net':'');
      const fit = f.fit[b.id]||1;
      const mark = fit>=1.15?'◎':(fit>=1.0?'○':(fit>=0.8?'△':'×'));
      h += '<div class="'+cls+'" data-k="'+dw+'-'+b.id+'">'
         + '<div class="f">'+f.name+' <span style="color:#8296a8">'+mark+'</span></div>'
         + '<div class="d">'+(dj?dj.name:(f.need.includes('dj')?'<span style="color:#ff4d4d">担当なし</span>':(f.guest?'ゲスト回し':'－')))+'</div>'
         + '</div>';
    }
  }
  h += '</div>';

  // 時間帯別の実績
  h += '<h3>時間帯別 平均聴取率</h3><table><tr><th>時間帯</th>'
     + D.BLOCKS.map(b=>'<th class="num">'+b.name+'</th>').join('') + '</tr><tr><td>聴取率</td>'
     + D.BLOCKS.map(b=>'<td class="num">'+pct(s.blockRating[b.id]||0)+'</td>').join('') + '</tr></table>';

  h += '<h3>'+GL.link('simul','サイマル配信')+' 指数</h3>'
     + '<div class="kpi"><div><label>現在の配信指数</label><b>'+Math.round(s.simulAvg||0)+'</b></div>'
     + '<div><label>収益化</label><b class="'+(s.licenses.includes('multi')?'pos':'neg')+'">'
       +(s.licenses.includes('multi')?'マルチメディア放送 許可済':'許可なし（未収益化）')+'</b></div></div>'
     + '<p class="hint">'+GL.link('aniradi','アニラジ')+'や'+GL.link('kikaku','企画枠')+'のようにDJを固定しない番組は、'
     + '通常の聴取率は伸びにくい代わりにこの指数を押し上げます。'
     + '【免許】でマルチメディア放送の許可を取ると、指数がそのまま収益になります。</p>';
  el.innerHTML = h;

  el.querySelectorAll('.sched-cell').forEach(c=>{
    c.onclick = ()=> UI.openSchedEditor(c.dataset.k);
  });
};

UI.openSchedEditor = function(key){
  const s = G.state;
  const [dw, blockId] = [key.split('-')[0], key.split('-')[1]];
  const blk = D.BLOCKS.find(b=>b.id===blockId);
  const cur = s.schedule[key];
  const djs = G.staffOf(s,'dj');

  let body = '<div style="margin-bottom:10px;color:#8296a8">'+D.DAYS[dw]+'曜日 / '+blk.name+'（'+blk.range+'）</div>';
  body += '<label>フォーマット <select id="edFmt">';
  for(const f of D.FORMATS){
    if(f.netOnly && !s.network) continue;
    const fit = f.fit[blockId]||1;
    body += '<option value="'+f.id+'"'+(f.id===cur.fmt?' selected':'')+'>'
          + f.name+'（適性'+(fit>=1.15?'◎':fit>=1.0?'○':fit>=0.8?'△':'×')+' / 制作費'+f.cost+'万）</option>';
  }
  body += '</select></label>';
  body += '<div style="margin-top:10px"><label>担当アナウンサー <select id="edDj"><option value="">－（なし）</option>';
  for(const d of djs){
    body += '<option value="'+d.id+'"'+(d.id===cur.dj?' selected':'')+'>'
          + esc(d.name)+'（話術'+Math.round(d.talk)+' 知名度'+Math.round(d.fame)+' 安定'+Math.round(d.stability)+' 疲労'+Math.round(d.fatigue)+'）</option>';
  }
  body += '</select></label></div>';
  body += '<div id="edDesc" class="hint" style="margin-top:12px"></div>';

  UI.showModal({
    head:'編成表 — '+D.DAYS[dw]+' '+blk.name,
    bodyHtml: body,
    opts:[
      { label:'このコマに設定', fn:()=>{
        s.schedule[key] = { fmt:$('edFmt').value, dj:$('edDj').value?Number($('edDj').value):null };
        UI.render_sched();
      }},
      { label:'この時間帯を全曜日に適用', sub:'月〜日すべて同じ内容にする', fn:()=>{
        const v = { fmt:$('edFmt').value, dj:$('edDj').value?Number($('edDj').value):null };
        for(let i=0;i<7;i++) s.schedule[i+'-'+blockId] = {...v};
        UI.render_sched();
      }},
      { label:'キャンセル', fn:()=>{} }
    ],
    onOpen:()=>{
      const upd = ()=>{
        const f = D.fmt($('edFmt').value);
        const need = f.need.map(r=>{
          const n = G.staffOf(s,r).length;
          return '<span class="tag '+(n?'on':'off')+'">'+D.role(r).name+' '+n+'名</span>';
        }).join('') || (f.guest ? '<span class="tag on">DJ不要（任意でMC可）</span>' : '<span class="tag">スタッフ不要</span>');
        $('edDesc').innerHTML = f.desc + '<br>必要スタッフ：'+need
          + '<br>信頼度 '+(f.trust>=0?'+':'')+f.trust.toFixed(2)+' / 広告単価 ×'+f.ad+' / 事故リスク ×'+f.risk
          + (f.simul ? ' / '+GL.link('simul','サイマル配信')+' ×'+f.simul : '')
          + (f.guest ? '<br><span style="color:#8296a8">ゲストが持ち回りで出演。当たり外れが大きく、構成作家がいると安定する。</span>' : '');
      };
      $('edFmt').onchange = upd; upd();
    }
  });
};

/* =========================================================
   人事
   ========================================================= */
function bar(v,max,warnLow){
  const p = clamp(v/max*100,0,100);
  const cls = warnLow ? (v>70?'bad':v>45?'warn':'') : (v<30?'bad':v<55?'warn':'');
  return '<span class="bar '+cls+'"><i style="width:'+p+'%"></i></span> '+Math.round(v);
}
UI.render_staff = function(){
  const s = G.state, el = $('view-staff');
  let h = '<h2>人事</h2>';
  h += '<p class="hint">アナウンサーの<b>話術</b>と<b>知名度</b>が聴取率を作ります。<b>安定感</b>が低い人材は失言・不祥事を起こしやすく、'
     + '<b>構成作家</b>と<b>ディレクター</b>がそのリスクを抑えます。疲労が溜まると成績も落ち、事故率が上がります。</p>';

  const emp = G.employees(s), tal = G.talents(s);
  h += '<div class="kpi">'
     + '<div><label>社員</label><b>'+emp.length+'名</b></div>'
     + '<div><label>月額人件費</label><b>'+money(emp.reduce((a,b)=>a+b.salary,0))+'</b></div>'
     + '<div><label>外部契約</label><b>'+tal.length+'名</b></div>'
     + '<div><label>月額ギャラ</label><b>'+money(tal.reduce((a,b)=>a+b.salary,0))+'</b></div>'
     + '</div>';

  const byRole = {};
  for(const st of s.staff) (byRole[st.role]=byRole[st.role]||[]).push(st);
  h += '<h3>在籍スタッフ</h3>';
  h += '<table><tr><th>氏名</th><th>職種</th><th>区分</th><th class="num">歳</th><th>話術</th><th>技術</th><th>企画</th><th>知名度</th><th>安定感</th><th>疲労</th><th class="num">月額</th><th class="num">契約</th><th></th></tr>';
  for(const r of D.ROLES){
    for(const st of (byRole[r.id]||[])){
      const onair = Object.values(s.schedule).filter(c=>c.dj===st.id).length;
      const kind = st.free
        ? '<span class="tag '+(st.exclusive?'on':'')+'">'+(st.exclusive?'専属':'番組契約')+'</span>'
          + '<br><span style="font-size:10px;color:#8296a8">'+esc(st.agency)+'</span>'
        : '<span class="tag">社員</span>';
      h += '<tr><td>'+esc(st.name)+(onair?' <span class="tag on">'+onair+'枠</span>':'')+'</td>'
        + '<td style="color:'+r.color+'">'+r.name+'</td><td>'+kind+'</td><td class="num">'+st.age+'</td>'
        + '<td>'+bar(st.talk,100)+'</td><td>'+bar(st.tech,100)+'</td><td>'+bar(st.plan,100)+'</td>'
        + '<td>'+bar(st.fame,100)+'</td><td>'+bar(st.stability,100)+'</td><td>'+bar(st.fatigue,100,true)+'</td>'
        + '<td class="num">'+st.salary+'万</td><td class="num">'+st.contract+'月</td>'
        + '<td>'
        + (st.free && !st.exclusive ? '<button class="btn" data-excl="'+st.id+'">専属化</button> ' : '')
        + '<button class="btn dan" data-fire="'+st.id+'">'+(st.free?'契約解除':'解雇')+'</button></td></tr>';
    }
  }
  h += '</table>';

  /* ---- フリー・外部契約市場 ---- */
  h += '<h3>フリーアナウンサー・外部DJ</h3>';
  h += '<p class="hint">事務所に所属するタレントとの契約です。社員採用とは性格が逆になります。'
     + '<br><b>社員</b>＝高い契約金・安い月額・長期契約・士気に貢献　／　'
     + '<b>フリー</b>＝契約金なし・高いギャラ・短期契約・<b>知名度が桁違い</b>'
     + '<br>非専属だと他局にも出演するため、そのタレントの番組への寄与が'
     + Math.round((1-D.CONST.NONEXCL_PENALTY)*100)+'%割り引かれます。'
     + '専属契約なら満額になりますが、一時金とギャラ'+Math.round(G.EXCL_RATE*100)+'%増を負担します。'
     + '<br>契約満了時は<b>更改交渉</b>になり、人気が出ているほど値上げを要求されます。'
     + '問題を起こしても解雇はできず、事務所を通した<b>違約金つきの契約解除</b>になります。</p>';

  const blocked = Object.keys(s.agencyBlock||{}).filter(a=>s.agencyBlock[a]>0);
  if(blocked.length)
    h += '<p class="hint" style="color:#ff8a8a">現在取引できない事務所：'
       + blocked.map(a=>esc(a)+'（あと'+s.agencyBlock[a]+'か月）').join('、')+'</p>';

  h += '<table><tr><th>氏名</th><th>事務所</th><th>職種</th><th class="num">歳</th><th>話術</th><th>企画</th><th>知名度</th><th>安定感</th><th class="num">月額ギャラ</th><th class="num">契約</th><th></th></tr>';
  if(!s.freeMarket.length) h += '<tr><td colspan="11" style="color:#8296a8">現在オファーできるタレントがいません（毎月入れ替わります）。</td></tr>';
  for(const t of s.freeMarket){
    const r = D.role(t.role);
    const exFee = Math.round(t.salary*(1+G.EXCL_RATE));
    h += '<tr><td>'+esc(t.name)+'</td><td style="font-size:11px">'+esc(t.agency)+'</td>'
      + '<td style="color:'+r.color+'">'+r.name+'</td><td class="num">'+t.age+'</td>'
      + '<td>'+bar(t.talk,100)+'</td><td>'+bar(t.plan,100)+'</td>'
      + '<td>'+bar(t.fame,100)+'</td><td>'+bar(t.stability,100)+'</td>'
      + '<td class="num">'+t.salary+'万</td><td class="num">'+t.contract+'月</td>'
      + '<td><button class="btn" data-sign1="'+t.id+'">番組契約</button> '
      + '<button class="btn pri" data-sign2="'+t.id+'" title="一時金'+money(t.salary*3)+' / 以後月額'+exFee+'万">専属契約</button></td></tr>';
  }
  h += '</table>';

  h += '<h3>採用候補（毎月入れ替わり）</h3>';
  h += '<table><tr><th>氏名</th><th>職種</th><th class="num">歳</th><th>話術</th><th>技術</th><th>企画</th><th>知名度</th><th>安定感</th><th class="num">月額</th><th class="num">契約金</th><th></th></tr>';
  for(const c of s.candidates){
    const r = D.role(c.role);
    h += '<tr><td>'+esc(c.name)+'</td><td style="color:'+r.color+'">'+r.name+'</td><td class="num">'+c.age+'</td>'
      + '<td>'+bar(c.talk,100)+'</td><td>'+bar(c.tech,100)+'</td><td>'+bar(c.plan,100)+'</td>'
      + '<td>'+bar(c.fame,100)+'</td><td>'+bar(c.stability,100)+'</td>'
      + '<td class="num">'+c.salary+'万</td><td class="num">'+Math.round(c.salary*1.8)+'万</td>'
      + '<td><button class="btn pri" data-hire="'+c.id+'">採用</button></td></tr>';
  }
  h += '</table>';
  el.innerHTML = h;

  el.querySelectorAll('[data-hire]').forEach(b=>b.onclick=()=>{
    G.hire(s.candidates.find(c=>c.id==b.dataset.hire));
  });
  el.querySelectorAll('[data-fire]').forEach(b=>b.onclick=()=>{
    const st = s.staff.find(c=>c.id==b.dataset.fire);
    if(st.free){
      const pen = Math.round(st.salary*Math.max(1,st.contract)*0.6);
      UI.confirm(st.name+'との契約を解除しますか？',
        '違約金 '+money(pen)+' が必要です。以後'+st.agency+'とは12か月取引できなくなります。',
        ()=>G.releaseTalent(st));
    }else{
      UI.confirm(st.name+'を解雇しますか？',
        '退職金として '+money(st.salary*2)+' が必要です。士気も下がります。', ()=>G.fire(st));
    }
  });
  el.querySelectorAll('[data-sign1]').forEach(b=>b.onclick=()=>{
    G.signTalent(s.freeMarket.find(t=>t.id==b.dataset.sign1), false);
  });
  el.querySelectorAll('[data-sign2]').forEach(b=>b.onclick=()=>{
    const t = s.freeMarket.find(x=>x.id==b.dataset.sign2);
    UI.confirm(t.name+'と専属契約を結びますか？',
      '一時金 '+money(t.salary*3)+'、以後の月額ギャラは '+money(Math.round(t.salary*(1+G.EXCL_RATE)))
      +' になります。他局には出演しなくなるため、効果は満額になります。',
      ()=>G.signTalent(t, true));
  });
  el.querySelectorAll('[data-excl]').forEach(b=>b.onclick=()=>{
    const t = s.staff.find(x=>x.id==b.dataset.excl);
    const up = Math.round(t.salary*3);
    UI.confirm(t.name+'を専属契約に切り替えますか？',
      '一時金 '+money(up)+'、月額ギャラは '+money(Math.round(t.salary*(1+G.EXCL_RATE)))+' に上がります。',
      ()=>{
        if(s.money < up){ UI.toast('一時金が払えません','bad'); return; }
        s.money -= up; t.exclusive = true; t.salary = Math.round(t.salary*(1+G.EXCL_RATE));
        AUDIO.play('cash');
        G.log(t.name+'と専属契約を締結。他局への出演がなくなります。','good');
        UI.refresh();
      });
  });
};

/* =========================================================
   営業
   ========================================================= */
UI.render_sales = function(){
  const s = G.state, el = $('view-sales');
  let h = '<h2>営業 / スポンサー</h2>';
  h += '<p class="hint">スポンサーは<b>特定の時間帯のCM枠</b>を買います。枠は1時間帯あたり'+D.CONST.CM_SLOTS+'本までです。'
     + '約束した聴取率（保証値）に届かないと支払いが減り、続けば打ち切られます。'
     + '<b>遊技場・消費者金融</b>などは単価が高い一方、災害報道中にCMを流すと強い批判を受けます。'
     + '<br>収入を伸ばす本筋は「枠を増やす」ではなく、<b>送信所を建ててカバー人口を増やし、聴取率を上げて単価を上げる</b>ことです。</p>';

  const total = s.sponsors.reduce((a,b)=>a+b.monthly,0);
  h += '<div class="kpi"><div><label>契約数</label><b>'+s.sponsors.length+'</b></div>'
     + '<div><label>月額合計(名目)</label><b>'+money(total)+'</b></div>'
     + '<div><label>営業力</label><b>'+G.salesPower(s).toFixed(1)+'</b></div>'
     + '<div><label>CM編成</label><b>'+(s.flags.cmSuspended?'<span class="neg">差し替え中</span>':'通常')+'</b></div></div>';

  h += '<h3>CM枠の空き</h3><table><tr><th>時間帯</th>'
     + D.BLOCKS.map(b=>'<th class="num">'+b.name+'</th>').join('')+'</tr><tr><td>空き枠</td>'
     + D.BLOCKS.map(b=>{ const f=G.slotsFree(s,b.id);
        return '<td class="num '+(f>0?'pos':'neg')+'">'+f+'</td>'; }).join('')+'</tr></table>';

  h += '<h3>契約中</h3><table><tr><th>スポンサー</th><th>買い枠</th><th class="num">月額</th><th class="num">保証聴取率</th><th class="num">実績</th><th class="num">達成率</th><th class="num">残</th><th>災害時</th></tr>';
  if(!s.sponsors.length) h += '<tr><td colspan="8" style="color:#8296a8">契約なし。下のオファーから獲得してください。</td></tr>';
  for(const sp of s.sponsors){
    const ind = D.INDUSTRY.find(i=>i.id===sp.ind);
    const blk = D.BLOCKS.find(b=>b.id===sp.block);
    const act = s.blockRating[sp.block]||0;
    const perf = clamp(act/Math.max(0.15,sp.promised),0,2);
    h += '<tr><td>'+ind.name+'</td><td>'+blk.name+'('+blk.range+')</td><td class="num">'+money(sp.monthly)+'</td>'
      + '<td class="num">'+pct(sp.promised)+'</td><td class="num">'+pct(act)+'</td>'
      + '<td class="num '+(perf>=1?'pos':'neg')+'">'+(perf*100).toFixed(0)+'%</td>'
      + '<td class="num">'+sp.months+'月</td>'
      + '<td>'+(ind.grief>=2?'<span class="tag off">要差替</span>':(ind.grief?'<span class="tag">注意</span>':'<span class="tag on">問題なし</span>'))+'</td></tr>';
  }
  h += '</table>';

  h += '<h3>オファー</h3><table><tr><th>業種</th><th>買い枠</th><th class="num">月額</th><th class="num">保証聴取率</th><th class="num">期間</th><th>備考</th><th></th></tr>';
  for(const o of s.offers){
    const ind = D.INDUSTRY.find(i=>i.id===o.ind);
    const blk = D.BLOCKS.find(b=>b.id===o.block);
    const act = s.blockRating[o.block]||0;
    const ok = act >= o.promised;
    let note = [];
    if(ind.grief>=3) note.push('<span class="tag off">災害時に強い批判</span>');
    else if(ind.grief>=2) note.push('<span class="tag off">災害時 差替推奨</span>');
    if(ind.trust>0) note.push('<span class="tag on">信頼度↑</span>');
    if(ind.trust<0) note.push('<span class="tag off">信頼度↓</span>');
    const free = G.slotsFree(s,o.block)>0;
    if(!free) note.push('<span class="tag off">枠が満杯</span>');
    h += '<tr><td>'+ind.name+'</td><td>'+blk.name+'</td><td class="num">'+money(o.monthly)+'</td>'
      + '<td class="num '+(ok?'pos':'neg')+'">'+pct(o.promised)+'</td><td class="num">'+o.months+'月</td>'
      + '<td>'+note.join(' ')+'</td>'
      + '<td><button class="btn pri" data-sign="'+o.id+'"'+(free?'':' disabled')+'>契約</button></td></tr>';
  }
  h += '</table>';
  el.innerHTML = h;
  el.querySelectorAll('[data-sign]').forEach(b=>b.onclick=()=>G.signSponsor(s.offers.find(o=>o.id==b.dataset.sign)));
};

/* =========================================================
   系列
   ========================================================= */
UI.render_network = function(){
  const s = G.state, el = $('view-network');
  let h = '<h2>ネットワーク / 系列</h2>';
  h += '<p class="hint">系列に加盟すると、キー局制作の番組を<b>ネット受け</b>できます（編成表で「ネット受け」を選択）。'
     + '手間ゼロで一定の聴取率が取れますが、自社の枠と広告収入は減り、災害時も全国中継が優先されます。</p>';
  h += '<h3>加盟状況</h3>';
  if(s.ownNetwork){
    h += '<p class="hint">自社系列を運営しているため、他系列への加盟はできません。</p>';
  } else if(s.network){
    const n = D.NETWORKS.find(x=>x.id===s.network);
    const used = Object.values(s.schedule).filter(c=>c.fmt==='net').length;
    h += '<div class="card"><b>'+n.name+'</b> に加盟中<br>'+n.desc
      + '<br>月額分担金 '+money(n.fee)+' / ネット受け中 '+used+'枠<br>'
      + '<button class="btn dan" id="btnLeave" style="margin-top:8px">脱退する（違約金 '+money(n.fee*4)+'）</button></div>';
  } else {
    h += '<p class="hint">現在どの系列にも属していません（独立局）。編成の自由度は最大です。</p>';
  }
  if(!s.ownNetwork){
    h += '<h3>系列一覧</h3><table><tr><th>ネットワーク</th><th class="num">月額分担金</th><th class="num">加盟金</th><th class="num">格</th><th>特徴</th><th></th></tr>';
    for(const n of D.NETWORKS){
      const mine = s.network===n.id;
      h += '<tr><td>'+n.name+(mine?' <span class="tag on">加盟中</span>':'')+'</td>'
        + '<td class="num">'+money(n.fee)+'</td><td class="num">'+money(n.fee*6)+'</td><td class="num">'+n.prestige+'</td>'
        + '<td style="color:#8296a8;font-size:11px">'+n.desc+'</td>'
        + '<td>'+(mine?'':'<button class="btn pri" data-join="'+n.id+'">加盟</button>')+'</td></tr>';
    }
    h += '</table>';
  }

  /* ---- 自社系列（キー局化） ---- */
  h += '<h3>自社系列の設立</h3>';
  if(s.ownNetwork){
    const on = s.ownNetwork;
    const fee = Math.round(on.affiliates * (7 + on.affiliates*0.25) * G.dif(s).pay);
    h += '<div class="card"><b>'+esc(on.name)+'</b>（'+on.foundedY+'年目'+on.foundedM+'月 設立）<br>'
       + '加盟局 <b>'+on.affiliates+'局</b> / 月間の分担金収入 約'+money(fee)+'<br>'
       + '<span style="color:#8296a8;font-size:11px">知名度・信頼度・聴取率が高いほど加盟局が増えやすくなります。'
       + '逆に数字を落とすと離れていきます。</span></div>';
  } else {
    const e = G.ownNetElig(s);
    h += '<p class="hint">全番組を自社制作にし、局として十分な実績を積めば、逆に系列を立ち上げて'
       + '他局から加盟金を受け取る側になれます。設立費用 '+money(D.CONST.OWN_NET_COST)+'。</p>';
    const chk = (ok,label) => '<span class="tag '+(ok?'on':'off')+'">'+label+'</span>';
    h += '<div class="card">'
       + chk(e.independent,'現在どの系列にも非加盟')+' '
       + chk(e.selfProduced,'ネット受け枠ゼロ')+' '
       + chk(e.fame,'知名度 '+Math.round(s.fame)+'/'+D.CONST.OWN_NET_REQ.fame)+' '
       + chk(e.trust,'信頼度 '+Math.round(s.trust)+'/'+D.CONST.OWN_NET_REQ.trust)+' '
       + chk(e.rating,'聴取率 '+s.ratingAvg.toFixed(2)+'/'+D.CONST.OWN_NET_REQ.rating.toFixed(2))+' '
       + chk(e.money,'資金 '+money(D.CONST.OWN_NET_COST))
       + '<br><button class="btn pri" id="btnFoundNet" style="margin-top:8px"'
       + (G.canFoundNetwork(s)?'':' disabled')+'>系列を設立する</button></div>';
  }

  h += '<h3>競合局</h3><table><tr><th>局</th><th class="num">総合力</th><th>特徴</th></tr>';
  for(const r of s.rivals){
    h += '<tr><td>'+r.name+'</td><td class="num">'+Math.round(r.str)+'</td><td style="color:#8296a8;font-size:11px">'+r.desc+'</td></tr>';
  }
  h += '<tr style="background:#243040"><td><b>'+s.meta.name+'（自局）</b></td><td class="num"><b>'+Math.round(s.curScore||0)+'</b></td><td style="color:#8296a8;font-size:11px">現在オンエア中の番組の強さ</td></tr>';
  h += '</table>';
  el.innerHTML = h;

  el.querySelectorAll('[data-join]').forEach(b=>b.onclick=()=>{
    const n = D.NETWORKS.find(x=>x.id===b.dataset.join);
    UI.confirm(n.name+'に加盟しますか？', '加盟金 '+money(n.fee*6)+'、以後月額 '+money(n.fee)+' の分担金が発生します。'
      + (s.network?'現在の系列は自動的に脱退となり違約金がかかります。':''), ()=>{
      if(s.network) G.leaveNetwork();
      G.joinNetwork(n.id);
    });
  });
  const bl = $('btnLeave'); if(bl) bl.onclick = ()=> UI.confirm('系列を脱退しますか？','違約金が発生し、ネット受け枠はすべてフィラーになります。',()=>G.leaveNetwork());
  const bf = $('btnFoundNet'); if(bf) bf.onclick = ()=> UI.confirm('自社系列を設立しますか？',
    '設立費用 '+money(D.CONST.OWN_NET_COST)+'。以後、他系列への加盟はできなくなります。', ()=>G.foundNetwork());
};

/* =========================================================
   免許・コンプライアンス
   ========================================================= */
UI.render_legal = function(){
  const s = G.state, el = $('view-legal');
  const nextY = Math.ceil(s.time.y/D.CONST.LICENSE_TERM_Y)*D.CONST.LICENSE_TERM_Y;
  const risk = s.admin*2 + s.bpo*4 + s.stats.illegalForecast*6;
  let h = '<h2>免許 / コンプライアンス</h2>';
  h += '<div class="kpi">'
     + '<div><label>行政指導</label><b class="'+(s.admin?'neg':'')+'">'+s.admin+'件</b></div>'
     + '<div><label>BPO審議</label><b class="'+(s.bpo?'neg':'')+'">'+s.bpo+'件</b></div>'
     + '<div><label>無許可予報</label><b class="'+(s.stats.illegalForecast?'neg':'')+'">'+s.stats.illegalForecast+'件</b></div>'
     + '<div><label>次回 再免許審査</label><b>'+nextY+'年目</b></div>'
     + '<div><label>審査リスク</label><b class="'+(risk>=22?'neg':risk>=10?'':'pos')+'">'+(risk>=22?'致命的':risk>=10?'要注意':'良好')+'</b></div>'
     + '</div>';
  h += '<p class="hint">放送免許は'+D.CONST.LICENSE_TERM_Y+'年ごとに再免許審査があります。行政指導とBPO案件が積み上がると'
     + '<b>条件付き再免許</b>、さらに悪化すると<b>免許失効</b>＝ゲームオーバーです。</p>';

  h += '<h3>許認可</h3><table><tr><th>種別</th><th class="num">費用</th><th>要件</th><th>状態</th><th></th></tr>';
  for(const l of D.LICENSES){
    const has = s.licenses.includes(l.id);
    let req = '－', short = false;
    if(l.needRole){
      const n = G.staffOf(s,l.needRole).length;
      short = n < l.needCount;
      req = D.role(l.needRole).name+' '+l.needCount+'名以上 <span class="tag '+(short?'off':'on')+'">現在'+n+'名</span>';
    }
    const status = has
      ? (short ? '<span class="tag off">要件割れ</span>' : '<span class="tag on">取得済</span>')
      : '<span class="tag off">未取得</span>';
    h += '<tr><td><b>'+l.name+'</b><br><span style="color:#8296a8;font-size:11px">'+l.desc+'</span>'
      + (has&&short ? '<br><span style="color:#ff4d4d;font-size:11px">※ 人員が要件を下回っています。この状態で行使すると違法です。</span>' : '')+'</td>'
      + '<td class="num">'+(l.cost?money(l.cost):'－')+'</td><td>'+req+'</td>'
      + '<td>'+status+'</td>'
      + '<td>'+(has||l.auto?'':'<button class="btn pri" data-lic="'+l.id+'">申請</button>')+'</td></tr>';
  }
  h += '</table>';

  h += '<h3>気象業務法について</h3>'
     + '<div class="card">気象庁以外の者が<b>予報業務</b>（現象の予想を発表する業務）を行うには、気象業務法第17条により'
     + '<b>気象庁長官の許可</b>が必要です。許可を受けずに独自の予報を放送すると同法違反となり、罰金・行政指導の対象になります。'
     + '<br><br>災害報道では「気象庁の発表をそのまま伝える」ことは常に適法ですが、'
     + '<b>「この雨はあと2時間で止むでしょう」といった自局の予想</b>を放送するには許可が要ります。'
     + '<br><br>許可を取れば災害時に強力な選択肢が解禁され、信頼度を大きく伸ばせます。</div>';
  el.innerHTML = h;
  el.querySelectorAll('[data-lic]').forEach(b=>b.onclick=()=>G.buyLicense(b.dataset.lic));
};

/* =========================================================
   財務
   ========================================================= */
UI.render_finance = function(){
  const s = G.state, el = $('view-finance');
  const m = s.lastMonth;
  let h = '<h2>財務</h2>';
  h += '<div class="kpi">'
     + '<div><label>現預金</label><b class="'+(s.money<0?'neg':'')+'">'+money(s.money)+'</b></div>'
     + '<div><label>借入残高</label><b>'+money(s.debt)+'</b></div>'
     + '<div><label>先月損益</label><b class="'+(m&&m.profit>=0?'pos':'neg')+'">'+(m?((m.profit>=0?'+':'')+money(m.profit)):'－')+'</b></div>'
     + '<div><label>平均聴取率</label><b>'+pct(s.ratingAvg||0)+'</b></div>'
     + '<div><label>知名度</label><b>'+Math.round(s.fame)+'</b></div>'
     + '</div>';

  h += '<div class="grid2"><div><h3>先月の損益計算</h3>';
  if(m){
    const row=(n,v,neg)=>'<tr><td>'+n+'</td><td class="num '+(neg?'neg':'pos')+'">'+(neg?'-':'+')+money(v)+'</td></tr>';
    h += '<table>'+row('広告収入',m.adRev)+row('ネット配分金',m.netRev)+row('サイマル配信収入',m.simulRev||0)
      + row('系列 加盟局分担金',m.netFee||0)+row('テレビ部門からの補助',m.tvSubsidy||0)
      + row('国際放送 関連収入',m.swRev||0)
      + row('人件費（社員）',m.salary,1)+row('出演料（フリー）',m.talent||0,1)
      + row('設備維持費',m.upkeep,1)+row('番組制作費',m.prod,1)
      + row('電波利用料・著作権料・分担金',m.fee,1)+row('支払利息ほか',m.misc,1)
      + ((m.swCost||0)>0 ? row('短波送信所 運用費',m.swCost,1) : '')
      + '<tr style="background:#243040"><td><b>当期損益</b></td><td class="num '+(m.profit>=0?'pos':'neg')+'"><b>'
      + (m.profit>=0?'+':'')+money(m.profit)+'</b></td></tr></table>';
  } else h += '<p class="hint">まだ決算がありません（1か月経過後に表示されます）。</p>';

  h += '</div><div><h3>資金調達</h3><div class="card">'
     + '与信枠：'+money(6000 + s.ratingAvg*1200 + s.trust*40)+'（聴取率と信頼度で拡大）<br>月利 0.4%<br><br>'
     + '<button class="btn" data-borrow="1000">1,000万 借入</button> '
     + '<button class="btn" data-borrow="3000">3,000万 借入</button> '
     + '<button class="btn" data-borrow="10000">1億 借入</button><br><br>'
     + '<button class="btn" data-repay="1000">1,000万 返済</button> '
     + '<button class="btn" data-repay="99999999">全額返済</button>'
     + '</div>';

  // 聴取率推移
  h += '<h3>聴取率の推移（直近120日）</h3><div class="card">'+sparkline(s.ratingHist)+'</div>';
  h += '</div></div>';

  h += '<h3>固定費の内訳</h3><table><tr><th>項目</th><th class="num">月額</th></tr>'
     + '<tr><td>人件費（社員'+G.employees(s).length+'名）</td><td class="num">'+money(G.employees(s).reduce((a,b)=>a+b.salary,0))+'</td></tr>'
     + (G.talents(s).length?'<tr><td>出演料（外部契約'+G.talents(s).length+'名）</td><td class="num">'+money(G.talents(s).reduce((a,b)=>a+b.salary,0))+'</td></tr>':'')
     + '<tr><td>社屋 維持費</td><td class="num">'+money(studioUpkeep(s))+'</td></tr>'
     + '<tr><td>送信設備 維持費</td><td class="num">'+money(cityBonus(s).upkeep)+'</td></tr>'
     + '<tr><td>電波利用料（送信所'+cityBonus(s).tx+'基）</td><td class="num">'+money(cityBonus(s).tx*D.CONST.SPECTRUM_FEE)+'</td></tr>'
     + (s.network?'<tr><td>系列分担金</td><td class="num">'+money(D.NETWORKS.find(n=>n.id===s.network).fee)+'</td></tr>':'')
     + '</table>';
  el.innerHTML = h;

  el.querySelectorAll('[data-borrow]').forEach(b=>b.onclick=()=>G.borrow(Number(b.dataset.borrow)));
  el.querySelectorAll('[data-repay]').forEach(b=>b.onclick=()=>G.repay(Number(b.dataset.repay)));
};

function sparkline(arr){
  if(!arr || arr.length<2) return '<span style="color:#8296a8">データ蓄積中…</span>';
  const w=340,h=90, max=Math.max(1,...arr), n=arr.length;
  let d='';
  arr.forEach((v,i)=>{ d += (i?'L':'M')+(i/(n-1)*w).toFixed(1)+','+(h-v/max*h).toFixed(1); });
  return '<svg width="'+w+'" height="'+h+'" style="background:#0b0f14;border:1px solid #3a4a5c">'
    + '<path d="'+d+'" fill="none" stroke="#39d4ff" stroke-width="1.5"/></svg>'
    + '<div style="color:#8296a8;font-size:11px">最高 '+pct(max)+' / 現在 '+pct(arr[arr.length-1])+'</div>';
}

/* =========================================================
   国際向け短波放送
   ========================================================= */
UI.render_intl = function(){
  const s = G.state, el = $('view-intl');
  let h = '<h2>国際放送（短波）</h2>';

  if(!G.swActive(s)){
    const hasLic = s.licenses.includes('intl');
    h += '<p class="hint">短波は'+GL.link('denriso','電離層')+'のF層で反射し、'
       + '地上波では絶対に届かない数千km先まで到達します。'
       + '国内のカバー人口には一切寄与せず、直接の儲けもほとんどありません。'
       + 'それでも国際放送を持つ局は、国内では得られない種類の知名度と信頼を積み上げられます。</p>';
    h += '<div class="card"><b>始めるには</b><br>'
       + '<span class="tag '+(hasLic?'on':'off')+'">① 国際放送業務の認定（【免許】で申請）</span> '
       + '<span class="tag off">② 【市街地】に短波送信所を建設</span>'
       + '<br><span style="color:#8296a8;font-size:11px">短波送信所は'
       + money(G.priceOf(s, D.CITY_BUILD.find(d=>d.id==='tx_sw')))
       + '、月額運用費も重い巨大設備です。</span></div>';
    el.innerHTML = h;
    return;
  }

  const t = D.swTarget(s.sw.target);
  const solar = G.solarCycle(s);
  const jammed = s.sw.jam>0 && s.sw.jamTarget===s.sw.target;

  h += '<div class="kpi">'
     + '<div><label>目標方面</label><b>'+t.name+'</b></div>'
     + '<div><label>到達規模</label><b>'+Math.round(s.sw.reach||0)+'</b></div>'
     + '<div><label>国際知名度</label><b>'+Math.round(s.sw.intlFame)+'</b></div>'
     + '<div><label>受信報告書</label><b>'+s.sw.reports+'通</b></div>'
     + '<div><label>未返信</label><b class="'+(s.sw.pending>0?'neg':'')+'">'+Math.floor(s.sw.pending)+'通</b></div>'
     + '<div><label>太陽活動</label><b>'+(solar<0.33?'極小期':solar<0.66?'中間':'極大期')+'</b></div>'
     + '</div>';

  if(jammed)
    h += '<p class="hint" style="color:#ff8a8a">⚠ '+t.name+'方面は現在<b>妨害電波</b>を受けています'
       + '（あと'+s.sw.jam+'か月）。到達規模が30%まで落ちています。方面を変えるのも一手です。</p>';

  h += '<p class="hint">短波の「最適な周波数」は<b>昼夜・季節・太陽活動</b>で刻々と変わります。'
     + '昼は電離層が高い周波数まで反射できるので高いバンドを、夜は低いバンドを使うのが原則です。'
     + '下の表で時間帯ごとにバンドを選んでください。'
     + '<b>◎</b>が最適、<b>×</b>は電波が突き抜けるか吸収されて届きません。</p>';

  /* 時間帯 × バンドの適合表 */
  h += '<h3>周波数の割り当て</h3>';
  h += '<div style="overflow-x:auto"><table><tr><th>時間帯</th><th>現地時刻</th><th class="num">最適</th>';
  for(const b of D.SW_BANDS) h += '<th class="num">'+b.name+'</th>';
  h += '<th>選択中</th></tr>';
  for(const blk of D.BLOCKS){
    const mid = blk.id==='mid' ? 2 : Math.floor((blk.h0+blk.h1)/2);
    const opt = G.swOptimalMHz(s, s.sw.target, mid);
    const local = ((mid + t.tz)%24+24)%24;
    const cur = s.sw.bands[blk.id];
    h += '<tr><td>'+blk.name+'<br><span style="font-size:10px;color:#8296a8">'+blk.range+'</span></td>'
       + '<td style="font-size:11px">'+String(Math.floor(local)).padStart(2,'0')+':'
       + (local%1?'30':'00')+'</td>'
       + '<td class="num">'+opt.toFixed(1)+'MHz</td>';
    for(const b of D.SW_BANDS){
      const sc = G.swScore(s, s.sw.target, b.id, mid);
      const mark = sc>=0.85?'◎':sc>=0.6?'○':sc>=0.3?'△':'×';
      const col = sc>=0.85?'#4ade80':sc>=0.6?'#39d4ff':sc>=0.3?'#ffb400':'#5a6b7c';
      const sel = cur===b.id;
      h += '<td class="num" style="padding:2px">'
         + '<button class="btn sw-cell'+(sel?' pri':'')+'" data-blk="'+blk.id+'" data-band="'+b.id+'"'
         + ' style="width:100%;color:'+(sel?'#20180a':col)+'" title="'+b.name+' '+b.mhz+'MHz / 伝搬 '
         + Math.round(sc*100)+'%">'+mark+'</button></td>';
    }
    h += '<td>'+(cur?D.swBand(cur).name+'<br><span style="font-size:10px;color:#8296a8">'
       + Math.round(G.swScore(s,s.sw.target,cur,mid)*100)+'%</span>'
       : '<span style="color:#ff4d4d">未設定</span>')+'</td></tr>';
  }
  h += '</table></div>';
  h += '<p class="hint">セルをクリックするとその時間帯のバンドを設定します。'
     + '同じセルをもう一度押すと解除（休止）になります。</p>';

  /* ベリカード */
  h += '<h3>'+GL.link('qsl','ベリカード')+'（受信確認証）</h3>';
  const pend = Math.floor(s.sw.pending);
  const vcost = Math.round(pend * D.CONST.SW_VERI_COST * G.costMul(s));
  h += '<div class="card">海外のリスナーは受信した日時・周波数・受信状況を書いた'
     + '<b>受信報告書</b>を送ってきます。局がそれを確認して返す証明書がベリカードです。'
     + '<br><br>未返信 <b>'+pend+'通</b> / これまでの発送 '+s.sw.veri+'通'
     + '<br><button class="btn pri" id="btnVeri" style="margin-top:8px"'+(pend?'':' disabled')+'>'
     + 'ベリカードを発送する（'+money(vcost)+'）</button>'
     + '<br><span style="color:#8296a8;font-size:11px">きちんと返すほど国際知名度が上がり、'
     + '海外の企業や公的機関が枠を買ってくれるようになります。</span></div>';

  /* 目標方面 */
  h += '<h3>目標方面</h3><div style="overflow-x:auto"><table>'
     + '<tr><th>方面</th><th class="num">時差</th><th class="num">潜在規模</th><th>妨害</th><th>特徴</th><th></th></tr>';
  for(const tt of D.SW_TARGETS){
    const mine = s.sw.target===tt.id;
    h += '<tr><td>'+tt.name+(mine?' <span class="tag on">送信中</span>':'')+'</td>'
      + '<td class="num">'+(tt.tz>=0?'+':'')+tt.tz+'h</td>'
      + '<td class="num">'+tt.pop+'</td>'
      + '<td>'+(tt.jam>=0.2?'<span class="tag off">高</span>':tt.jam>=0.05?'<span class="tag">中</span>':'<span class="tag on">低</span>')+'</td>'
      + '<td style="color:#8296a8;font-size:11px">'+tt.desc+'</td>'
      + '<td>'+(mine?'':'<button class="btn" data-swt="'+tt.id+'">切替</button>')+'</td></tr>';
  }
  h += '</table></div>';
  el.innerHTML = h;

  el.querySelectorAll('.sw-cell').forEach(b=>b.onclick=()=>{
    const blk=b.dataset.blk, band=b.dataset.band;
    G.setSwBand(blk, s.sw.bands[blk]===band ? null : band);
  });
  el.querySelectorAll('[data-swt]').forEach(b=>b.onclick=()=>G.setSwTarget(b.dataset.swt));
  const bv=$('btnVeri'); if(bv) bv.onclick=()=>G.sendVeriCards();
};

/* =========================================================
   用語辞典
   ========================================================= */
UI.glCat = 'all';
UI.glQuery = '';
UI.glOpen = {};

UI.render_glossary = function(){
  const el = $('view-glossary');
  const q = UI.glQuery.trim().toLowerCase();
  const list = GL.TERMS.filter(t=>{
    if(UI.glCat!=='all' && t.cat!==UI.glCat) return false;
    if(!q) return true;
    return (t.term+t.kana+t.body+(t.game||'')).toLowerCase().includes(q);
  });

  let h = '<h2>ラジオ用語辞典</h2>'
    + '<p class="hint">放送業界の言葉と、このゲームのルールの対応表でもあります。'
    + '黄色い枠は<b>ゲーム内での扱い</b>。本文中の<a class="gl-link">青い語</a>をクリックすると、その項目へ飛びます。</p>';

  h += '<div class="gl-bar">';
  for(const c of GL.CATS)
    h += '<button class="gl-cat'+(UI.glCat===c.id?' sel':'')+'" data-cat="'+c.id+'">'+c.name+'</button>';
  h += '<input type="text" id="glSearch" placeholder="検索（例：予報、Eスポ、カフ）" value="'+esc(UI.glQuery)+'">'
     + '<span class="gl-count">'+list.length+' 件</span></div>';

  if(!list.length) h += '<p class="hint">該当する用語がありません。</p>';

  for(const t of list){
    const open = !!UI.glOpen[t.id];
    const cat = GL.CATS.find(c=>c.id===t.cat);
    h += '<div class="gl-item'+(open?' open':'')+'" id="gl-'+t.id+'">'
       + '<div class="gl-t" data-tgl="'+t.id+'"><b>'+t.term+'</b>'
       + '<span class="gl-kana">'+t.kana+'</span>'
       + '<span class="gl-cat-tag">'+(cat?cat.name:'')+'</span></div>';
    if(open){
      h += '<div class="gl-d"><p>'+t.body+'</p>';
      if(t.game) h += '<div class="gl-game"><b>このゲームでは：</b>'+t.game+'</div>';
      if(t.rel && t.rel.length){
        const rels = t.rel.map(r=>GL.byId(r)).filter(Boolean);
        if(rels.length) h += '<div class="gl-rel">関連： '+rels.map(r=>GL.link(r.id)).join(' / ')+'</div>';
      }
      h += '</div>';
    }
    h += '</div>';
  }
  el.innerHTML = h;

  el.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{
    UI.glCat = b.dataset.cat; UI.render_glossary();
  });
  el.querySelectorAll('[data-tgl]').forEach(b=>b.onclick=()=>{
    const id = b.dataset.tgl;
    UI.glOpen[id] = !UI.glOpen[id];
    UI.render_glossary();
  });
  const si = $('glSearch');
  if(si){
    si.oninput = ()=>{ UI.glQuery = si.value; UI.render_glossary();
      const n = $('glSearch'); if(n){ n.focus(); n.selectionStart = n.value.length; } };
  }
};

/* 用語リンクをどこからでも開けるようにする */
UI.openTerm = function(id){
  if(!GL.byId(id)) return;
  UI.glOpen[id] = true;
  UI.glCat = 'all';
  UI.glQuery = '';
  UI.setView('glossary');
  const el = $('gl-'+id);
  if(el) el.scrollIntoView({ block:'center' });
  AUDIO.play('click');
};
document.addEventListener('click', ev=>{
  const a = ev.target.closest && ev.target.closest('.gl-link');
  if(a && a.dataset.gl){ ev.preventDefault(); UI.openTerm(a.dataset.gl); }
});

/* =========================================================
   モーダル
   ========================================================= */
UI.showModal = function(cfg){
  AUDIO.play(cfg.sfx || (cfg.urgent ? 'alert' : 'micOn'));
  UI.prevSpeed = G.speed;
  G.speed = 0;
  document.querySelectorAll('.speed button').forEach(b=>b.classList.toggle('sel', b.dataset.speed==='0'));
  $('modalHead').textContent = cfg.head;
  $('modalHead').classList.toggle('urgent', !!cfg.urgent);
  $('modalBody').innerHTML = cfg.bodyHtml || cfg.body || '';
  const o = $('modalOpts'); o.innerHTML='';
  cfg.opts.forEach(op=>{
    const b = document.createElement('button');
    b.className = 'opt' + (op.risk?' risk':'');
    b.innerHTML = '<b>'+op.label+'</b>' + (op.sub?'<small>'+op.sub+'</small>':'');
    b.onclick = ()=>{
      $('modal').classList.add('hidden');
      // 先に現在のイベントを消化してから処理を走らせる
      // （処理の中で後続イベントが積まれても消えないようにするため）
      if(cfg.isEvent) G.resolveEvent();
      op.fn && op.fn();
      G.speed = UI.prevSpeed;
      document.querySelectorAll('.speed button').forEach(x=>x.classList.toggle('sel', Number(x.dataset.speed)===G.speed));
      UI.refresh();
      if(G.pendingEvent) UI.showEvent();
    };
    o.appendChild(b);
  });
  $('modal').classList.remove('hidden');
  cfg.onOpen && cfg.onOpen();
};
UI.showEvent = function(){
  const ev = G.pendingEvent; if(!ev) return;
  UI.showModal({ ...ev, isEvent:true });
};
/* セーブ／ロードのスロット選択 */
UI.slotDialog = function(kind){
  const list = G.listSaves();
  const opts = [];
  for(const e of list){
    if(e.slot==='legacy') continue;
    if(kind==='save' && e.slot==='auto') continue;      // オートセーブには手動保存しない
    if(kind==='load' && e.empty) continue;
    const label = e.slot==='auto' ? 'オートセーブ' : 'スロット '+(e.slot+1);
    let sub;
    if(e.empty) sub = '空き';
    else{
      const m = e.meta;
      sub = m.name+'（'+(m.mode==='disaster'?'災害':'通常')+'・'+D.diff(m.diff).name+'） '
          + m.y+'年目'+m.m+'月'+m.d+'日 / '+money(m.money)+' / 聴取率'+m.rating+'%';
    }
    opts.push({ label: label + (kind==='save'&&!e.empty ? '（上書き）':''), sub, fn:()=>{
      if(kind==='save') G.saveTo(e.slot);
      else if(G.loadFrom(e.slot)){ UI.setView(UI.view); UI.refresh(); }
    }});
  }
  if(!opts.length){
    UI.showModal({ head:'読み込み', body:'保存データがありません。', opts:[{label:'閉じる',fn:()=>{}}] });
    return;
  }
  opts.push({ label:'キャンセル', fn:()=>{} });
  UI.showModal({
    head: kind==='save' ? 'ゲームを保存' : 'ゲームを再開',
    body: kind==='save'
      ? '保存先のスロットを選んでください。月が変わるたびにオートセーブも行われています。'
      : '読み込むデータを選んでください。<b>現在の進行状況は失われます。</b>',
    opts
  });
};

/* 設定：ゲーム途中で災害モードのON/OFFを切り替える */
UI.settingsDialog = function(){
  const s = G.state; if(!s) return;
  const onNow = s.meta.mode==='disaster';
  const body =
    '<label class="chk" style="font-size:13px">'
    + '<input type="checkbox" id="setDisaster"'+(onNow?' checked':'')+'> 災害モードを有効にする'
    + '（地震・台風などが発生するようになる）</label>'
    + '<p class="hint" style="margin-top:10px">オフにすると、以後は新しい災害が発生しなくなります。'
    + '現在進行中の災害があれば、それはそのまま収束するまで続きます。'
    + 'オンに戻せば、いつからでも通常の確率で再び発生し始めます。</p>'
    + (s.disasterActive ? '<p class="hint" style="color:#ff8a8a">現在【'+s.disasterActive.name+'】報道体制が進行中です。</p>' : '')
    + '<p class="hint">現在の難易度：<b>'+D.diff(s.meta.diff).name+'</b>'
    + '（難易度は開局時に固定され、途中では変更できません）</p>';
  UI.showModal({
    head:'設定',
    bodyHtml: body,
    opts:[
      { label:'適用する', fn:()=>{
        const on = $('setDisaster').checked;
        const was = s.meta.mode;
        s.meta.mode = on ? 'disaster' : 'normal';
        if(was !== s.meta.mode){
          G.log(on ? '設定変更：災害モードを<b>有効</b>にしました。' : '設定変更：災害モードを<b>無効</b>にしました。以後、新規の災害は発生しません。',
                on ? 'warn' : '');
          UI.toast('設定を更新しました','good');
          UI.refreshTop();
        }
      }},
      { label:'閉じる', fn:()=>{} }
    ]
  });
};

UI.confirm = function(head, body, fn){
  UI.showModal({ head, body, opts:[
    { label:'実行する', fn },
    { label:'やめる', fn:()=>{} }
  ]});
};
