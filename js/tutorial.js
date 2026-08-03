/* =========================================================
   CityHz - チュートリアル
   プレイを止めず、実際の操作で進む常駐型のガイド。
   ========================================================= */
const TUT = {
  active: false,
  i: 0,
  visited: {},
  done: false
};

TUT.STEPS = [
  {
    title:'電波を出す',
    nav:'city',
    body:'まず放送を届ける先を作ります。【市街地】画面の左のメニューから<b>送信所</b>を選び、'
       + '地図をクリックして建ててください。<br><br>'
       + '青く染まったタイルが電波の届く範囲、'+GL.link('denkai','電界')+'です。'
       + GL.link('soshin','送信所')+'は'+GL.link('esupo')+'…ではなく地形に素直で、'
       + '<b>山の上に建てると遮蔽が減って有利</b>、山の裏側には届きません。',
    hint:'送信所(小)なら900万円。まずは人口の多い平地の近くへ。',
    check: s => cityBonus(s).tx >= 1,
    praise:'電波が出ました。カバー人口が画面上部に表示されています。'
  },
  {
    title:'番組を組む',
    nav:'sched',
    body:'電波だけ出しても、流すものがなければ誰も聴きません。【編成】画面を開いてください。'
       + '<br><br>縦が時間帯、横が曜日の'+GL.link('hensei','編成表')+'です。'
       + 'いまは全部'+GL.link('filler','フィラー')+'——自動送出の音楽で埋まっています。'
       + '<br><br>どこかのセルをクリックし、<b>フォーマット</b>と<b>担当アナウンサー</b>を選んでください。'
       + '各フォーマットには時間帯適性（◎○△×）があります。'
       + '通勤帯に'+GL.link('jiho','交通情報')+'、深夜に'+GL.link('request','リクエスト')+'——'
       + 'という配置には理由があります。',
    hint:'「この時間帯を全曜日に適用」を使うと'+GL.link('belt','帯番組')+'になります。',
    check: s => Object.values(s.schedule).some(c => c.fmt!=='filler' && c.dj),
    praise:'番組が始まりました。右上のON AIRに現在の番組と瞬間聴取率が出ます。'
  },
  {
    title:'人を増やす',
    nav:'staff',
    body:'【人事】画面です。'+GL.link('personality','パーソナリティ')+'の<b>話術</b>と<b>知名度</b>が'
       + '聴取率を作ります。誰か一人、採用してみてください。'
       + '<br><br>ここで見落としやすいのが<b>安定感</b>です。これが低い人材は'
       + GL.link('cough','カフ')+'が開いたまま余計なことを言います。'
       + GL.link('kousei','構成作家')+'とディレクターは、その事故を未然に止めるために雇うものです。',
    hint:'採用には契約金（月額の約1.8倍）がかかります。',
    check: (s,st) => s.staff.length > st.baseStaff,
    praise:'採用しました。疲労が溜まると成績が落ちるので、DJは複数そろえて回してください。'
  },
  {
    title:'スポンサーを取る',
    nav:'sales',
    body:'【営業】画面。オファーから契約すると広告収入が入ります。'
       + '<br><br>スポンサーは'+GL.link('time_spot','時間帯のCM枠')+'を買います。'
       + '枠は1時間帯あたり3本まで。<b>保証聴取率</b>に届かないと支払いが減り、続けば打ち切られます。'
       + '<br><br>単価の高い業種ほど、'+GL.link('sashikae','災害時の扱い')+'が難しくなることも覚えておいてください。',
    hint:'収入を伸ばす本筋は枠を増やすことではなく、カバー人口と聴取率を上げて単価を上げることです。',
    check: s => s.sponsors.length >= 1,
    praise:'契約成立。支払いは月次決算のタイミングで入ります。'
  },
  {
    title:'社屋を広げる',
    nav:'studio',
    body:'【社屋】画面は'+GL.link('enso','演奏所')+'——番組を作って送り出す場所です。'
       + '送信所とは法令上も別のものとして扱われます。'
       + '<br><br>部屋を1つ増築してみてください。既存の部屋に<b>隣接</b>させる必要があります。'
       + '<br><br>'+GL.link('master','主調整室')+'は放送事故を大きく減らし、'
       + GL.link('sub','副調整室')+'は音質を上げ、報道フロアは災害報道の質を決めます。'
       + '食堂は深夜番組の生命線です。',
    hint:'部屋の構成がそのまま局の能力値になります。左下の凡例で確認できます。',
    check: (s,st) => s.studio.cells.filter(c=>c).length > st.baseRooms,
    praise:'増築しました。社屋の能力は聴取率と事故率の両方に効きます。'
  },
  {
    title:'決算を読む',
    nav:'finance',
    body:'ひと月経つと決算が出ます。【財務】画面で先月の損益を確認してください。'
       + '<br><br>'+GL.link('denpa_ryo','電波利用料')+'、人件費、設備維持費、番組制作費——'
       + '放送局は黙っていても金が出ていく商売です。'
       + '<br><br>最初の半年は赤字が普通です。CM枠が埋まるまで持ちこたえてください。'
       + '足りなければ借入もできます。',
    hint:'聴取率と信頼度が高いほど、銀行の与信枠が広がります。',
    check: (s,st) => s.lastMonth && TUT.visited.finance,
    praise:'決算の読み方はこれで十分です。あとは黒字にするだけです。'
  },
  {
    title:'免許を意識する',
    nav:'legal',
    body:'【免許】画面を開いてください。ここがこのゲームでいちばん怖い画面です。'
       + '<br><br>放送免許は'+GL.link('saimen','5年ごとに再免許審査')+'があります。'
       + GL.link('shido','行政指導')+'と'+GL.link('bpo','BPO')+'案件が積み上がっていると条件付き再免許、'
       + 'さらに悪化すると<b>免許失効＝放送終了</b>です。'
       + '<br><br>そしてもう一つ。'+GL.link('kishou17','気象業務法第17条')+'により、'
       + '気象庁の許可なく<b>独自の予報</b>を放送することはできません。'
       + GL.link('inyou','気象庁発表をそのまま伝える')+'のは自由ですが、'
       + '「この雨はあと2時間で止むでしょう」と<u>自局の判断を足した瞬間</u>に違法になります。',
    hint:GL.link('yohokyoka','予報業務許可')+'を取るには'+GL.link('yohoshi','気象予報士')+'が2名以上必要です。',
    check: () => TUT.visited.legal,
    praise:'ここまでで基本操作は終わりです。あとは局を大きくしてください。'
  },
  {
    title:'（発展）予報業務許可を取る',
    nav:'legal',
    body:'最後は長期目標です。'+GL.link('yohoshi','気象予報士')+'を<b>2名</b>雇い、'
       + '【免許】画面から'+GL.link('yohokyoka','予報業務許可')+'を申請してください。'
       + '<br><br>取得すれば災害時に「自局の判断で見通しを伝える」という強力な選択肢が解禁され、'
       + '信頼度を大きく伸ばせます。取得せずに同じことをすれば違法です。'
       + '<br><br>注意：取得後に予報士が2名を割ると<b>要件割れ</b>になり、'
       + 'その状態で行使すればやはり違法になります。',
    hint:'気象予報士は採用候補にときどきしか現れません。見かけたら押さえてください。',
    optional:true,
    check: s => s.licenses.includes('forecast'),
    praise:'予報業務許可を取得しました。これで災害時に胸を張って予報が出せます。'
  }
];

/* ---------- 制御 ---------- */
TUT.start = function(s){
  TUT.active = true;
  TUT.i = 0;
  TUT.done = false;
  TUT.visited = {};
  TUT.base = { baseStaff: s.staff.length, baseRooms: s.studio.cells.filter(c=>c).length };
  TUT.render();
};
TUT.stop = function(){
  TUT.active = false;
  TUT.render();
};
TUT.cur = () => TUT.active && !TUT.done ? TUT.STEPS[TUT.i] : null;

TUT.check = function(){
  if(!TUT.active || TUT.done) return;
  const s = G.state; if(!s) return;
  let advanced = false;

  // 次のステップの条件がすでに満たされている場合もあるので、
  // 進めなくなるまで連続で判定する（1回の呼び出しで1歩しか進まないと詰まる）
  for(let guard=0; guard<TUT.STEPS.length+1; guard++){
    if(TUT.done) break;
    const step = TUT.STEPS[TUT.i];
    if(!step) break;
    let ok = false;
    try{ ok = !!step.check(s, TUT.base); }catch(e){ ok = false; }
    if(!ok) break;

    G.log('<b style="color:#4ade80">✓ '+step.title+'</b> — '+step.praise, 'good');
    UI.toast('チュートリアル：'+step.title+' 完了', 'good');
    advanced = true;
    TUT.i++;
    if(TUT.i >= TUT.STEPS.length){
      TUT.done = true;
      G.log('<b style="color:#4ade80">チュートリアルは以上です。</b>あとは自由に局を経営してください。','good');
    }
  }
  if(advanced){ AUDIO.play('good'); TUT.render(); }
};

TUT.skip = function(){
  const step = TUT.STEPS[TUT.i];
  if(!step) return;
  TUT.i++;
  if(TUT.i >= TUT.STEPS.length) TUT.done = true;
  TUT.render();
};

/* ---------- 表示 ---------- */
TUT.render = function(){
  const box = document.getElementById('tutbox');
  if(!box) return;
  const step = TUT.cur();
  if(!step){ box.classList.add('hidden'); TUT.highlight(null); return; }
  box.classList.remove('hidden');
  box.innerHTML =
    '<div class="tut-head">'
      + '<span class="tut-no">'+(TUT.i+1)+'/'+TUT.STEPS.length+'</span>'
      + '<b>'+step.title+'</b>'
      + (step.optional?'<span class="tag">任意</span>':'')
      + '<button class="tut-x" id="tutClose" title="チュートリアルを終了">×</button>'
    + '</div>'
    + '<div class="tut-body">'+step.body+'</div>'
    + '<div class="tut-hint">💡 '+step.hint+'</div>'
    + '<div class="tut-foot">'
      + '<button class="btn" id="tutGo">'+navName(step.nav)+'を開く</button>'
      + '<button class="btn" id="tutSkip">このステップを飛ばす</button>'
    + '</div>';
  document.getElementById('tutClose').onclick = ()=>{
    UI.confirm('チュートリアルを終了しますか？','【用語辞典】画面からいつでも操作の説明を読めます。',()=>TUT.stop());
  };
  document.getElementById('tutGo').onclick = ()=>{ UI.setView(step.nav); };
  document.getElementById('tutSkip').onclick = ()=> TUT.skip();
  TUT.highlight(step.nav);
};

function navName(v){
  const map = { city:'市街地', studio:'社屋', sched:'編成', staff:'人事',
                sales:'営業', network:'系列', legal:'免許', finance:'財務', glossary:'用語辞典' };
  return map[v]||v;
}

TUT.highlight = function(nav){
  document.querySelectorAll('.nav[data-view]').forEach(b=>{
    b.classList.toggle('tut-target', !!nav && b.dataset.view===nav);
  });
};
