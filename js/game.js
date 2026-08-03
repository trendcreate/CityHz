/* =========================================================
   CityHz - 状態とシミュレーション
   ========================================================= */
const G = {
  state: null,
  speed: 1,
  acc: 0,
  paused: false,
  pendingEvent: null
};

/* ---------- ユーティリティ ---------- */
const rnd  = (a,b) => a + Math.random()*(b-a);
const rint = (a,b) => Math.floor(rnd(a,b+1));
const pick = a => a[Math.floor(Math.random()*a.length)];
const clamp= (v,a,b) => v<a?a:(v>b?b:v);
const money= v => (v>=10000 ? (v/10000).toFixed(2)+'億' : Math.round(v).toLocaleString()) + '万円';
const pct  = v => v.toFixed(2)+'%';
let _uid = 1;
const uid = () => _uid++;

/* =========================================================
   新規ゲーム
   ========================================================= */
G.newGame = function(opts){
  const dif = D.diff(opts.diff);
  const s = {
    meta:{ name:opts.name, call:opts.call, freq:opts.freq, mode:opts.mode, diff:dif.id },
    time:{ y:1, m:4, d:1, h:5, dow:0 },
    money: Math.round(D.CONST.START_MONEY * dif.money),
    debt: 0,
    trust: 50, morale: 62, fame: 12,
    rating: 0, ratingAvg: 0, ratingHist: [],
    simul: 0, simulAvg: 0, simulHist: [],   // サイマル配信の聴取動向
    blockRating: {},          // blockId -> 直近平均聴取率
    admin: 0, bpo: 0, accidents: 0,
    licenses: ['base'],
    network: null, networkMonths: 0,
    staff: [], candidates: [],
    freeMarket: [], agencyBlock: {},
    sponsors: [], offers: [],
    schedule: {},             // "dow-block" -> {fmt, dj}
    city: null, studio: null,
    rivals: D.RIVALS.map(r => ({ ...r, str: r.base * dif.rival })),
    ledger: { adRev:0, netRev:0, salary:0, talent:0, upkeep:0, prod:0, fee:0, misc:0 },
    lastMonth: null,
    log: [],
    disasterActive: null,
    flags: { emergencyOnAir:false, cmSuspended:false, cmSuspendDays:0 },
    stats: { disasters:0, incidents:0, illegalForecast:0, yearsRun:0 }
  };
  G.state = s;
  genCity(s);
  genStudio(s);
  // 初期スタッフ
  const seed = [['dj',70],['dj',55],['mixer',60],['director',58],['sales',60],['reporter',52],['engineer',55]];
  seed.forEach(([r,q]) => s.staff.push(makeStaff(r, q)));
  refreshCandidates(s);
  refreshFreeMarket(s);
  // 初期編成（全部フィラー）
  for(let dw=0; dw<7; dw++) for(const b of D.BLOCKS) s.schedule[dw+'-'+b.id] = { fmt:'filler', dj:null };
  // 初期スポンサーオファー
  refreshOffers(s);
  G.log('開局しました。'+s.meta.call+' '+s.meta.freq+'MHz、放送開始です。','good');
  G.log('まずは【編成】で番組を組み、【市街地】に送信所を建ててください。');
  return s;
};

/* =========================================================
   マップ生成
   ========================================================= */
function genCity(s){
  const W=D.CONST.CITY_W, H=D.CONST.CITY_H;
  const terrain = new Array(W*H).fill(0); // 0平地 1海 2山 3川
  const popv = new Array(W*H).fill(0);
  const build = new Array(W*H).fill(null);
  // 海（南東側）
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const d = (x/W)*0.6 + (y/H)*0.8;
    if(d > 1.02 + Math.sin(x*0.4)*0.05) terrain[y*W+x]=1;
  }
  // 山（北西）
  for(let i=0;i<5;i++){
    const cx=rint(1,14), cy=rint(0,9), r=rint(2,4);
    for(let y=cy-r;y<=cy+r;y++) for(let x=cx-r;x<=cx+r;x++){
      if(x<0||y<0||x>=W||y>=H) continue;
      if((x-cx)**2+(y-cy)**2 <= r*r && terrain[y*W+x]===0) terrain[y*W+x]=2;
    }
  }
  // 川
  let rx = rint(10,20);
  for(let y=0;y<H;y++){
    rx = clamp(rx + rint(-1,1), 1, W-2);
    if(terrain[y*W+rx]===0) terrain[y*W+rx]=3;
  }
  // 人口（都心を数か所）
  const cores = [];
  for(let i=0;i<4;i++){
    let cx,cy,g=0;
    do{ cx=rint(6,W-4); cy=rint(4,H-3); g++; }while(terrain[cy*W+cx]!==0 && g<60);
    cores.push({x:cx,y:cy,p:rnd(2200,4200)});
  }
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const t = terrain[y*W+x];
    if(t===1) continue;
    let p=0;
    for(const c of cores){
      const d = Math.hypot(x-c.x, y-c.y);
      p += c.p * Math.exp(-d*d/28);
    }
    if(t===2) p *= 0.10;
    if(t===3) p *= 0.3;
    popv[y*W+x] = Math.round(p + rnd(0,140));
  }
  s.city = { w:W, h:H, terrain, pop:popv, build, sig:new Array(W*H).fill(0) };
  computeCoverage(s);
}

function genStudio(s){
  const W=D.CONST.STUDIO_W, H=D.CONST.STUDIO_H;
  const cells = new Array(W*H).fill(null);
  const cx = Math.floor(W/2), cy = Math.floor(H/2);
  const put=(x,y,id)=>{ cells[y*W+x]={id}; };
  // 開局時の最低限：ロビー・第2スタジオ・副調整室・廊下
  put(cx,cy+2,'lobby');
  put(cx,cy+1,'corridor'); put(cx,cy,'corridor'); put(cx,cy-1,'corridor');
  put(cx-1,cy,'studioB'); put(cx-2,cy,'sub');
  put(cx+1,cy,'master');
  put(cx-1,cy-1,'planning'); put(cx+1,cy-1,'salesdept');
  s.studio = { w:W, h:H, cells };
}

/* =========================================================
   カバレッジ計算
   ========================================================= */
function computeCoverage(s){
  const c = s.city, W=c.w, H=c.h;
  c.sig.fill(0);
  const txs = [];
  for(let i=0;i<W*H;i++){
    const b = c.build[i]; if(!b) continue;
    const def = D.CITY_BUILD.find(d=>d.id===b.id);
    if(def && def.power) txs.push({ x:i%W, y:Math.floor(i/W), power:def.power, relay:!!def.relay });
  }
  for(const t of txs){
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){
      const d = Math.hypot(x-t.x, y-t.y);
      let sig = t.power - d*2.6;
      // 山による遮蔽（直線上の山タイル数）
      const steps = Math.ceil(d);
      let block=0;
      for(let k=1;k<steps;k++){
        const px = Math.round(t.x + (x-t.x)*k/steps), py = Math.round(t.y + (y-t.y)*k/steps);
        if(c.terrain[py*W+px]===2) block++;
      }
      sig -= block*4.5;
      if(t.relay) sig -= 4;
      if(sig > c.sig[y*W+x]) c.sig[y*W+x] = sig;
    }
  }
  let covered=0, total=0, q=0;
  for(let i=0;i<W*H;i++){
    total += c.pop[i];
    if(c.sig[i] >= 8){
      const grade = clamp(c.sig[i]/34, 0, 1.15);
      covered += c.pop[i]*Math.min(1,grade);
      q += c.pop[i]*grade;
    }
  }
  s.coverPop = Math.round(covered);
  s.totalPop = Math.round(total);
  s.signalQ  = covered>0 ? clamp(q/covered,0,1.15) : 0;
}

/* =========================================================
   社屋の効果集計
   ========================================================= */
function studioBonus(s){
  const b = { studio:0, quality:0, news:0, plan:0, sales:0, tech:0, morale:0, accident:0, rooms:0 };
  for(const cell of s.studio.cells){
    if(!cell) continue;
    const def = D.ROOMS.find(r=>r.id===cell.id); if(!def) continue;
    b.rooms++;
    for(const k of ['studio','quality','news','plan','sales','tech','morale','accident'])
      if(def[k]) b[k]+=def[k];
  }
  return b;
}
function cityBonus(s){
  const b = { sales:0, reach:0, mobile:0, tx:0, upkeep:0 };
  for(const cell of s.city.build){
    if(!cell) continue;
    const def = D.CITY_BUILD.find(d=>d.id===cell.id); if(!def) continue;
    b.upkeep += def.up||0;
    if(def.salesBonus) b.sales += def.salesBonus;
    if(def.reachBonus) b.reach += def.reachBonus;
    if(def.mobile) b.mobile += def.mobile;
    if(def.power) b.tx++;
  }
  return b;
}
function studioUpkeep(s){
  let u=0;
  for(const cell of s.studio.cells){
    if(!cell) continue;
    const def = D.ROOMS.find(r=>r.id===cell.id);
    if(def) u += def.up||0;
  }
  return u;
}

/* =========================================================
   スタッフ
   ========================================================= */
function makeStaff(roleId, quality){
  const gender = Math.random()<0.5 ? 'M':'F';
  const name = pick(D.SURNAME) + ' ' + pick(gender==='M'?D.GIVEN_M:D.GIVEN_F);
  const role = D.role(roleId);
  const q = clamp(quality + rnd(-12,12), 8, 99);
  const st = {
    id: uid(), name, gender, role: roleId, age: rint(22,54),
    talk: clamp(role.key==='talk' ? q : q*rnd(0.3,0.6), 5, 99),
    tech: clamp(role.key==='tech' ? q : q*rnd(0.3,0.6), 5, 99),
    plan: clamp(role.key==='plan' ? q : q*rnd(0.3,0.6), 5, 99),
    fame: clamp(q*rnd(0.35,0.9), 2, 98),
    stability: clamp(rnd(25,95), 5, 99),
    stamina: clamp(rnd(40,95), 20, 99),
    fatigue: 0, morale: 60,
    contract: rint(12,36),
    scandalCool: 0
  };
  st.salary = Math.round( (st.talk*0.35 + st.plan*0.25 + st.tech*0.25 + st.fame*0.45) * rnd(0.42,0.62) ) + 14;
  return st;
}
function refreshCandidates(s){
  s.candidates = [];
  const n = 5 + Math.floor(s.fame/25);
  for(let i=0;i<n;i++){
    const role = pick(D.ROLES).id;
    s.candidates.push(makeStaff(role, rnd(20, 45 + s.fame*0.55)));
  }
  // 気象予報士は希少
  if(Math.random()<0.45) s.candidates.push(makeStaff('forecaster', rnd(45,85)));
}
/* =========================================================
   フリーアナウンサー・外部DJ
   社員とは対照的な契約形態：
     社員   … 高い契約金／安い月額／長期契約／士気に貢献
     フリー … 契約金なし／高いギャラ／短期契約／知名度が桁違い
   ========================================================= */
function makeFree(s, quality){
  const role = Math.random()<0.78 ? 'dj' : 'writer';
  const st = makeStaff(role, quality);
  st.free = true;
  st.agency = pick(D.AGENCIES);
  // 表に出ている人間なので知名度が高い。話術も一枚上。
  st.fame = clamp(quality * rnd(0.95,1.40), 20, 99);
  st.talk = clamp(st.talk * rnd(1.05,1.25), 5, 99);
  // ギャラは社員の同等能力の2〜3倍
  st.salary = Math.round(st.salary * rnd(2.0,3.0));
  st.exclusive = false;
  st.contract = rint(6,18);
  st.renewals = 0;
  return st;
}
function refreshFreeMarket(s){
  const n = clamp(2 + Math.round(s.fame/28) + (s.money>20000?1:0), 2, 6);
  s.freeMarket = [];
  for(let i=0;i<n;i++){
    const t = makeFree(s, rnd(38, 55 + s.fame*0.55));
    if(s.agencyBlock && s.agencyBlock[t.agency] > 0) continue;   // 出入り禁止の事務所
    s.freeMarket.push(t);
  }
}
/* 専属料：月額ギャラの上乗せ率 */
G.EXCL_RATE = 0.45;

G.signTalent = function(t, exclusive){
  const s = G.state;
  const upfront = exclusive ? Math.round(t.salary*3) : 0;
  if(s.money < upfront){ UI.toast('専属契約の一時金 '+money(upfront)+' が払えません','bad'); return; }
  s.money -= upfront;
  t.exclusive = !!exclusive;
  if(exclusive) t.salary = Math.round(t.salary*(1+G.EXCL_RATE));
  s.staff.push(t);
  s.freeMarket.splice(s.freeMarket.indexOf(t),1);
  AUDIO.play('cash');
  G.log(t.name+'（'+t.agency+'）と'+(exclusive?'<b>専属</b>':'番組')+'契約。月額ギャラ'+money(t.salary)
      + ' / '+t.contract+'か月'+(upfront?'、一時金'+money(upfront):''), 'good');
  if(!exclusive) G.log('※ 非専属のため他局にも出演します。効果はやや薄まります。','warn');
  UI.refresh();
};

/* 契約解除（フリーは解雇ではなく違約金） */
G.releaseTalent = function(t, quiet){
  const s = G.state;
  const penalty = Math.round(t.salary * Math.max(1,t.contract) * 0.6);
  s.money -= penalty;
  for(const k in s.schedule) if(s.schedule[k].dj===t.id) s.schedule[k].dj=null;
  removeStaff(s, t);
  // 事務所との関係が切れる
  s.agencyBlock = s.agencyBlock || {};
  s.agencyBlock[t.agency] = 12;
  if(!quiet){
    AUDIO.play('bad');
    G.log(t.name+'との契約を解除。違約金'+money(penalty)+'。'+t.agency+'とは当分取引できません。','bad');
  }
  UI.refresh();
};

/* 契約更新交渉（契約満了時） */
function talentRenewal(s, t){
  const hike = 1 + 0.08 + t.fame/320 + (s.ratingAvg>2?0.06:0) + t.renewals*0.02;
  const demand = Math.round(t.salary * hike);
  G.queue({
    head:'契約更改 — '+t.name+'（'+t.agency+'）',
    body:'<b>'+t.name+'</b>との契約が満了します。'+t.agency+'から更改の条件が提示されました。'
       + '<br><br>現在の月額ギャラ '+money(t.salary)+' → <b>'+money(demand)+'</b>'
       + '<br>知名度 '+Math.round(t.fame)+' / 話術 '+Math.round(t.talk)+' / 安定感 '+Math.round(t.stability)
       + '<br>担当枠 '+Object.values(s.schedule).filter(c=>c.dj===t.id).length+'枠'
       + (t.exclusive?'<br><span style="color:#4ade80">専属契約</span>':'<br><span style="color:#8296a8">非専属（他局にも出演）</span>'),
    opts:[
      { label:'条件を飲んで更改する', sub:'月額 '+money(demand)+' / '+'6〜18か月', fn:()=>{
        t.salary = demand; t.contract = rint(6,18); t.renewals++;
        G.log(t.name+'と契約更改。月額'+money(demand)+'。');
      }},
      { label:'値切って交渉する', sub:'成功すれば据え置き。失敗すれば降板される。', risk:true, fn:()=>{
        const p = clamp(0.55 - t.fame/260 + s.trust/400, 0.12, 0.8);
        if(Math.random() < p){
          t.contract = rint(6,12);
          G.log(t.name+'は現状の条件で残ってくれました。','good');
        }else{
          for(const k in s.schedule) if(s.schedule[k].dj===t.id) s.schedule[k].dj=null;
          removeStaff(s, t);
          G.log(t.name+'との交渉は決裂。降板となりました。','bad');
          if(Math.random()<0.4){
            const r = pick(s.rivals); r.str += 4;
            G.log('※ '+t.name+'は'+r.name+'のレギュラーに就いたそうです。','bad');
          }
        }
      }},
      { label:'契約を終了する', sub:'円満に降板。担当枠は空きます。', fn:()=>{
        for(const k in s.schedule) if(s.schedule[k].dj===t.id) s.schedule[k].dj=null;
        removeStaff(s, t);
        G.log(t.name+'との契約を終了しました。');
      }}
    ]
  });
}

G.dif = s => D.diff(s.meta.diff);
/* 対象がすでに退社・降板済みの場合に別人を消してしまわないための安全な削除 */
function removeStaff(s, st){
  const i = s.staff.indexOf(st);
  if(i < 0) return false;
  s.staff.splice(i,1);
  return true;
}
G.staffOf = (s,role) => s.staff.filter(x=>x.role===role);
G.employees = s => s.staff.filter(x=>!x.free);
G.talents   = s => s.staff.filter(x=>x.free);
G.bestOf  = (s,role,key) => {
  const a = G.staffOf(s,role);
  if(!a.length) return null;
  return a.reduce((p,c)=> (c[key]||0)*(1-c.fatigue/220) > (p[key]||0)*(1-p.fatigue/220) ? c : p);
};

/* =========================================================
   スポンサー
   ========================================================= */
G.salesPower = s => 1 + cityBonus(s).sales*0.35 + studioBonus(s).sales*0.12 + G.staffOf(s,'sales').length*0.3;

/* 各時間帯に置けるCM枠の数。ここが契約数の上限になる。 */
D.CONST.CM_SLOTS = 3;
G.slotsFree = (s, blockId) =>
  D.CONST.CM_SLOTS + (s.licenses.includes('multi')?1:0)
  - s.sponsors.filter(sp => sp.block===blockId).length;

function refreshOffers(s){
  const salesPower = G.salesPower(s);
  const n = clamp(Math.round(2 + salesPower*0.9 + s.fame/30), 1, 9);
  const open = D.BLOCKS.filter(b => G.slotsFree(s,b.id) > 0).map(b=>b.id);
  s.offers = [];
  if(!open.length) return;
  for(let i=0;i<n;i++){
    const ind = pick(D.INDUSTRY);
    const blk = (Math.random()<0.55 && open.includes(ind.demand)) ? ind.demand : pick(open);
    const bd  = D.BLOCKS.find(b=>b.id===blk);
    const reach = Math.max(3, s.coverPop/10000);   // 万人
    const base = reach * rnd(4.5,6.5) * ind.pay * bd.pop * G.dif(s).pay
               * (1 + s.fame/90) * (1 + s.trust/160);
    const promised = clamp( (s.blockRating[blk]||0.6) * rnd(0.85,1.35), 0.3, 9);
    s.offers.push({
      id: uid(), ind: ind.id, block: blk,
      monthly: Math.round(base*10)/10,
      promised: Math.round(promised*100)/100,
      months: rint(6,24)
    });
  }
}

/* =========================================================
   聴取率シミュレーション
   ========================================================= */
G.currentCell = function(s){
  const b = D.blockAt(s.time.h);
  return s.schedule[s.time.dow+'-'+b.id] || { fmt:'filler', dj:null };
};

G.programScore = function(s, cell, blockId){
  const f = D.fmt(cell.fmt) || D.fmt('filler');
  const sb = studioBonus(s), cb = cityBonus(s);
  let sc = 12;
  const dj = cell.dj ? s.staff.find(x=>x.id===cell.dj) : null;

  if(f.guest){
    // アニラジ・企画枠：固定DJは不要。ゲストのブッキング力と、回ごとの話題性のブレで決まる
    const booking = 7 + s.fame*0.22 + G.staffOf(s,'director').length*2.0 + G.staffOf(s,'writer').length*1.4;
    let host = 0;
    if(dj){
      const fat = 1 - dj.fatigue/230;
      host = (dj.talk*0.22 + dj.fame*0.18) * fat;
      if(dj.free && !dj.exclusive) host *= D.CONST.NONEXCL_PENALTY;
    }
    // 構成作家がいるとブッキングが安定し、大外れを避けやすくなる
    const stabilized = G.staffOf(s,'writer').length > 0;
    const buzz = stabilized ? rnd(0.75,1.55) : rnd(0.45,1.95);
    sc = (booking + host) * buzz;
  } else if(dj){
    const fat = 1 - dj.fatigue/230;
    sc += (dj.talk*0.40 + dj.fame*0.30) * fat;
    // 非専属のフリーは他局にも出ているため、自局の色がつきにくい
    if(dj.free && !dj.exclusive) sc *= D.CONST.NONEXCL_PENALTY;
  } else if(f.need.includes('dj')){
    sc *= 0.45; // 担当不在
  }
  // 必要スタッフの充足
  let missing = 0;
  for(const r of f.need){
    if(r==='dj') continue;
    if(!G.staffOf(s,r).length) missing++;
    else sc += clamp(G.bestOf(s,r,D.role(r).key)[D.role(r).key]*0.10, 0, 12);
  }
  sc *= (1 - missing*0.18);
  // 設備
  sc += sb.studio*2.2 + sb.quality*1.6 + sb.plan*1.1;
  if(f.id==='news') sc += sb.news*2.4 + G.staffOf(s,'reporter').length*2.2;
  // 時間帯適性
  sc *= (f.fit[blockId] || 1);
  // ネットワーク
  if(f.id==='net'){
    if(!s.network) sc *= 0.35;
    else sc = 26 + D.NETWORKS.find(n=>n.id===s.network).prestige*2.1;
  }
  // 信頼度・士気・電波品質
  sc *= (0.80 + s.trust/330);
  sc *= (0.85 + s.morale/430);
  sc *= (0.72 + s.signalQ*0.32);
  sc *= (1 + cb.reach*0.05);
  if(s.licenses.includes('multi')) sc *= 1.07;
  return Math.max(1, sc);
};

G.computeRating = function(s, cell, blockId){
  const blk = D.BLOCKS.find(b=>b.id===blockId);
  const ours = G.programScore(s, cell, blockId);
  let rivalSum = 0;
  for(const r of s.rivals){
    let v = r.str;
    if(r.kind==='nhk' && s.disasterActive) v *= 1.6;
    if(r.kind==='fm' && (blockId==='night'||blockId==='mid')) v *= 1.2;
    if(r.kind==='am' && (blockId==='early'||blockId==='morning')) v *= 1.25;
    rivalSum += v;
  }
  const share = ours / (ours + rivalSum);
  // その時間帯にラジオを聴いている人口の割合(%)
  const totalListening = 13.5 * blk.pop;
  const base = clamp(totalListening * share, 0, 40);
  // 緊急時は聴取が集中する。ただしこの上乗せは営業的な実績には数えない
  // （災害でかさ上げされた数字でスポンサー単価が跳ね上がらないようにするため）
  const rating = s.flags.emergencyOnAir ? clamp(base*2.4,0,40) : base;
  return { rating, base, share, score:ours };
};

/* =========================================================
   時間進行
   ========================================================= */
G.tick = function(){
  const s = G.state; if(!s || s.over || G.pendingEvent) return;
  const t = s.time;
  t.h++;
  if(t.h>=24){
    t.h=0; t.d++; t.dow=(t.dow+1)%7;
    endOfDay(s);
    const dim = [31,28,31,30,31,30,31,31,30,31,30,31][t.m-1];
    if(t.d > dim){
      t.d=1; t.m++;
      endOfMonth(s);
      if(t.m>12){ t.m=1; t.y++; endOfYear(s); }
    }
  }
  hourly(s);
};

function hourly(s){
  const blk = D.blockAt(s.time.h);
  const cell = G.currentCell(s);
  // ラジオらしい合図：0時の時報と、番組の切り替わりのジングル
  if(s.time.h===0) AUDIO.playThrottled('timeSignal', 18);
  if(s._lastBlock !== blk.id){
    s._lastBlock = blk.id;
    AUDIO.setMood(blk.id);
    if(D.fmt(cell.fmt).id !== 'filler') AUDIO.playThrottled('jingle', 7);
  }
  const r = G.computeRating(s, cell, blk.id);
  s.rating = r.rating;
  s.curShare = r.share;
  s.curScore = r.score;
  // 時間帯別の移動平均（スポンサーとの約束はこの数字で評価される）
  const prev = s.blockRating[blk.id] ?? r.base;
  s.blockRating[blk.id] = prev*0.92 + r.base*0.08;

  const f = D.fmt(cell.fmt);
  // サイマル配信（radikoのような同時配信）の聴取動向。
  // 電波の競合とは別物として扱うので、時間帯シェアではなく番組そのものの魅力(r.score)を使う。
  const simulMult = (f.simul||1.0) * (s.licenses.includes('multi') ? 1.6 : 1.0);
  const simulRaw = clamp(r.score * simulMult * 0.55, 0, 100);
  s.simul = (s.simul ?? simulRaw)*0.90 + simulRaw*0.10;
  // 制作費（1枠あたりの費用を、その枠の時間数で割って毎時「計上」する。
  //   現金の増減は月次決算でまとめて処理するので、ここでは s.money を触らない）
  s.ledger.prod += f.cost / blk.hours;
  // 信頼度（高いほど積み増しが難しい）
  const tg = f.trust>0 ? f.trust * (1 - s.trust/100) * 1.6 : f.trust;
  s.trust = clamp(s.trust + tg, 0, 100);
  // 疲労
  const dj = cell.dj ? s.staff.find(x=>x.id===cell.dj) : null;
  if(dj) dj.fatigue = clamp(dj.fatigue + clamp(2.2 - dj.stamina/70, 0.5, 2.2), 0, 100);
  // ネットワークのネット受け収入
  if(f.id==='net' && s.network){
    const net = D.NETWORKS.find(n=>n.id===s.network);
    s.ledger.netRev += net.share*2.2;   // 現金化は月次決算で
  }
  // 事故・不祥事判定
  checkIncident(s, cell, f, blk);
}

function endOfDay(s){
  // 疲労回復
  const sb = studioBonus(s);
  const rec = 8 + sb.morale*1.1 + (s.morale-50)*0.06;
  for(const st of s.staff){
    st.fatigue = clamp(st.fatigue - rec, 0, 100);
    if(st.scandalCool>0) st.scandalCool--;
    st.morale = clamp(st.morale + (s.morale>60?0.4:-0.3), 0, 100);
  }
  // 士気は資金と労働環境で動く（放っておくと55前後に戻る）
  const overwork = s.staff.filter(x=>x.fatigue>70).length;
  let dm = (55 - s.morale)*0.03 + sb.morale*0.10 - overwork*0.35;
  if(s.money < 0) dm -= 0.5;
  if(s.money < -3000) dm -= 0.8;
  s.morale = clamp(s.morale + clamp(dm,-2.0,1.5), 0, 100);
  // 信頼度は緩やかに中央へ
  s.trust = clamp(s.trust + (52 - s.trust)*0.004, 0, 100);
  // 知名度（サイマル配信は若年層のリーチとして効いてくる）
  s.fame = clamp(s.fame + (s.ratingAvg-1.2)*0.06 + cityBonus(s).reach*0.02 + s.simulAvg*0.014, 0, 100);
  // 日次の聴取率平均
  let sum=0; for(const b of D.BLOCKS) sum += (s.blockRating[b.id]||0)*b.pop;
  let wsum=0; for(const b of D.BLOCKS) wsum += b.pop;
  s.ratingAvg = sum/wsum;
  s.ratingHist.push(s.ratingAvg);
  if(s.ratingHist.length>120) s.ratingHist.shift();
  // サイマル配信の日次平均
  s.simulAvg = (s.simulAvg||0)*0.85 + s.simul*0.15;
  s.simulHist.push(s.simulAvg);
  if(s.simulHist.length>120) s.simulHist.shift();
  // CM差し替え期間
  if(s.flags.cmSuspendDays>0){
    s.flags.cmSuspendDays--;
    if(s.flags.cmSuspendDays===0){ s.flags.cmSuspended=false; G.log('CMの通常編成に戻しました。'); }
  }
  // 災害の収束
  if(s.disasterActive){
    s.disasterActive.days--;
    if(s.disasterActive.days<=0){
      G.log('【'+s.disasterActive.name+'】報道体制を解除、通常編成に復帰します。','good');
      s.disasterActive = null;
      s.flags.emergencyOnAir = false;
    }
  }
  // 設備故障
  const tech = G.staffOf(s,'engineer').length + studioBonus(s).tech*0.4;
  if(Math.random() < clamp(0.012 - tech*0.0016, 0.001, 0.02)){
    const cost = rint(120,600);
    s.money -= cost;
    G.log('送信設備が故障。緊急修理に'+money(cost)+'。','bad');
  }
  // 日次イベント
  maybeDisaster(s);
}

function endOfMonth(s){
  const L = { adRev:0, netRev:0, simulRev:0, salary:0, talent:0, upkeep:0, prod:s.ledger.prod, fee:0, misc:0 };
  // 広告収入
  const drop = [];
  for(const sp of s.sponsors){
    const ind = D.INDUSTRY.find(i=>i.id===sp.ind);
    const actual = s.blockRating[sp.block]||0;
    let perf = clamp(actual/Math.max(0.15,sp.promised), 0.35, 1.35);
    let pay = sp.monthly*perf;
    if(s.flags.cmSuspended && ind.grief>=2){ pay*=0.25; }
    L.adRev += pay;
    if(ind.trust) s.trust = clamp(s.trust + ind.trust*3, 0, 100);
    sp.months--;
    sp.lastPerf = perf;
    if(perf<0.55 && Math.random()<0.35){ drop.push(sp); }
    else if(sp.months<=0){ drop.push(sp); }
  }
  for(const sp of drop){
    const ind = D.INDUSTRY.find(i=>i.id===sp.ind);
    s.sponsors.splice(s.sponsors.indexOf(sp),1);
    G.log('スポンサー契約終了：'+ind.name+'（'+(sp.months<=0?'契約満了':'成果未達で打ち切り')+'）', sp.months<=0?'':'bad');
  }
  // 人件費（社員）とギャラ（フリー）は分けて計上する
  const dif = G.dif(s);
  for(const st of s.staff){
    if(st.free) L.talent += st.salary; else L.salary += st.salary;
  }
  L.salary *= dif.cost;
  L.talent *= dif.cost;
  // 維持費
  L.upkeep = (studioUpkeep(s) + cityBonus(s).upkeep) * dif.cost;
  // 電波利用料・著作権料
  L.fee = cityBonus(s).tx * D.CONST.SPECTRUM_FEE + L.adRev*D.CONST.COPYRIGHT_RATE;
  if(s.network) L.fee += D.NETWORKS.find(n=>n.id===s.network).fee;
  // 借入利息
  if(s.debt>0){ const i = s.debt*0.004; L.misc += i; s.debt += i; }
  // サイマル配信の広告収入。聴取自体はライセンスがなくても伸びるが、
  // 収益化にはマルチメディア放送の許可（データ放送・アプリ配信の正式な仕組み）が要る。
  L.simulRev = s.licenses.includes('multi') ? s.simulAvg * 2.1 * dif.pay : 0;

  const income = L.adRev + s.ledger.netRev + L.simulRev;
  const cost = L.salary + L.talent + L.upkeep + L.prod + L.fee + L.misc;
  s.money += income - cost;
  s.lastMonth = { ...L, netRev:s.ledger.netRev, income, cost, profit:income-cost };
  s.ledger = { adRev:0, netRev:0, salary:0, talent:0, upkeep:0, prod:0, fee:0, misc:0 };

  AUDIO.playThrottled(income-cost>=0?'cash':'bad', 4);
  G.log('【月次決算】収入'+money(income)+' / 支出'+money(cost)+' → '+(income-cost>=0?'+':'')+money(income-cost),
        income-cost>=0?'good':'bad');

  // 事務所との出入り禁止期間
  for(const a in s.agencyBlock) if(s.agencyBlock[a]>0) s.agencyBlock[a]--;

  // 契約更新
  for(const st of s.staff.slice()){
    st.contract--;
    if(st.contract<=0){
      if(st.free){
        talentRenewal(s, st);   // フリーは更改交渉のイベントになる
        st.contract = 1;        // 交渉が済むまで繰り返し発火させない
      }
      else if(st.fame>55 && Math.random()<0.30 && s.morale<58){
        const slots = Object.keys(s.schedule).filter(k=>s.schedule[k].dj===st.id);
        for(const k of slots) s.schedule[k].dj = null;
        removeStaff(s, st);
        G.log(st.name+'が他局へ移籍しました。'
          + (slots.length ? '<b>'+slots.length+'枠が担当者不在</b>になっています。編成を組み直してください。' : ''), 'bad');
      }else{
        st.contract = rint(12,30);
        const up = Math.round(st.salary*rnd(0.03,0.14));
        st.salary += up;
        G.log(st.name+'と契約更新（月額 +'+up+'万円）。');
      }
    }
  }
  refreshCandidates(s);
  refreshFreeMarket(s);
  refreshOffers(s);
  // ライバル局の動き
  for(const r of s.rivals){
    r.str = clamp(r.str + rnd(-2.2, 2.4)*dif.rival + (s.ratingAvg>2.5?0.5:-0.15), 12, 150);
  }
  G.autosave();
  // 破綻判定
  if(s.money < G.dif(s).floor){ G.gameOver('債務超過により経営破綻。'+s.meta.name+'は放送を停止しました。'); }
}

function endOfYear(s){
  s.stats.yearsRun++;
  G.log('════ '+s.time.y+'年目の期末 ════');
  // 再免許審査
  if(s.time.y % D.CONST.LICENSE_TERM_Y === 0){
    licenseRenewal(s);
  }
  // 年次表彰
  if(s.ratingAvg>3.2 && s.trust>70){
    s.fame = clamp(s.fame+6,0,100);
    G.log('日本民間放送連盟賞を受賞。局の知名度が大きく上がりました。','good');
  }
}

function licenseRenewal(s){
  const risk = (s.admin*2 + s.bpo*4 + s.stats.illegalForecast*6) / G.dif(s).renew;
  let head, body, tone;
  if(risk >= 22){
    G.queue({
      head:'総務省 電波監理審議会 — 再免許審査',
      urgent:true,
      body:'放送法および電波法に基づく再免許審査の結果、貴局はこの5年間で<b>行政指導'+s.admin+'件・BPO'+s.bpo+'件</b>を受けており、放送事業者としての適格性に重大な疑義があると判断されました。',
      opts:[{ label:'処分を受け入れる', sub:'免許は更新されない', fn:()=>{
        G.gameOver('再免許が拒否されました。'+s.meta.name+'は免許失効により放送を終了します。');
      }}]
    });
    return;
  }
  if(risk >= 10){
    s.trust = clamp(s.trust-8,0,100);
    G.log('再免許は交付されましたが、<b>条件付き</b>です。総務省から改善報告を求められました。','bad');
  }else{
    s.trust = clamp(s.trust+4,0,100);
    G.log('再免許が無事交付されました。今後5年、放送を継続できます。','good');
  }
  s.admin = Math.max(0, s.admin-2);
  s.bpo = Math.max(0, s.bpo-1);
}

/* =========================================================
   災害
   ========================================================= */
function maybeDisaster(s){
  if(s.meta.mode==='normal') return;
  if(s.disasterActive) return;
  const base = 0.018 * G.dif(s).disaster;
  if(Math.random() > base) return;
  const d = pick(D.DISASTERS);
  const sev = rint(d.sev[0], d.sev[1]);
  const area = pick(D.AREAS);
  const lead = d.lead.replace('{area}',area).replace('{sev}',sev).replace('{num}',rint(3,24));
  s.stats.disasters++;
  s.disasterActive = { id:d.id, name:d.name, sev, area, days: clamp(Math.round(sev/2),1,4), handled:false };
  G.queue(buildDisasterEvent(s, d, sev, area, lead));
}

function buildDisasterEvent(s, d, sev, area, lead){
  const hasCar = cityBonus(s).mobile>0;
  const hasForecastLic = s.licenses.includes('forecast');
  const forecasters = G.staffOf(s,'forecaster').length;
  const hasEws = s.licenses.includes('emerg');
  const reporters = G.staffOf(s,'reporter').length;
  const opts = [];

  opts.push({ label:'通常編成を継続する', sub:'CMも番組もそのまま。営業的な損失はゼロ。', risk:true, fn:()=>{
    const dmg = 6 + sev*2.2;
    s.trust = clamp(s.trust - dmg, 0, 100);
    G.log('災害報道を行わず通常編成を継続。リスナーからの抗議が殺到しています。','bad');
    if(sev>=5){ s.admin++; G.log('総務省から「放送法第108条に定める災害放送の努力義務を果たしていない」として<b>行政指導</b>。','bad'); }
    afterDisasterChoice(s, false);
  }});

  opts.push({ label:'臨時ニュースを随時挿入する', sub:'番組は続けつつ、5分の枠を差し込む。無難な線。', fn:()=>{
    s.trust = clamp(s.trust + 2 + sev*0.4, 0, 100);
    s.money -= 30;
    G.log('臨時ニュースを挿入。気象庁発表を随時お伝えしています。');
    afterDisasterChoice(s, true);
  }});

  opts.push({ label:'特別番組に切り替える', sub:'終日、災害報道特番。CM収入は飛ぶが信頼は積み上がる。', fn:()=>{
    const gain = 5 + sev*1.6 + reporters*1.2 + studioBonus(s).news*0.8;
    s.trust = clamp(s.trust + gain, 0, 100);
    s.flags.emergencyOnAir = true;
    s.money -= 120 + sev*40;
    for(const st of s.staff) st.fatigue = clamp(st.fatigue+18,0,100);
    G.log('特別番組編成に切替。全スタッフ非常呼集。','good');
    afterDisasterChoice(s, true);
  }});

  if(hasCar) opts.push({ label:'中継車を現場へ出す', sub:'一次情報を自局で取る。特番＋現地中継。', fn:()=>{
    const gain = 9 + sev*2.0 + reporters*1.6;
    s.trust = clamp(s.trust + gain, 0, 100);
    s.fame = clamp(s.fame + 2.5, 0, 100);
    s.flags.emergencyOnAir = true;
    s.money -= 260;
    for(const st of s.staff) st.fatigue = clamp(st.fatigue+24,0,100);
    if(Math.random()<0.12){
      s.morale = clamp(s.morale-10,0,100);
      G.log('中継クルーが現場で孤立、一時連絡が取れなくなりました。社内に動揺が広がっています。','bad');
    }
    G.log('中継車が'+area+'に到着。現場から生中継しています。','good');
    afterDisasterChoice(s, true);
  }});

  if(hasEws) opts.push({ label:'緊急警報放送(EWS)を発報する', sub:'待機中の受信機を自動起動させる。到達率は最大。', fn:()=>{
    if(sev>=4){
      s.trust = clamp(s.trust + 12 + sev*1.5, 0, 100);
      s.flags.emergencyOnAir = true;
      G.log('緊急警報信号を送出。管内の受信機が一斉に起動しました。','good');
    }else{
      s.trust = clamp(s.trust - 7, 0, 100);
      s.admin++;
      G.log('この規模でのEWS発報は要件を満たしません。<b>過剰発報として行政指導</b>を受けました。','bad');
    }
    afterDisasterChoice(s, true);
  }});

  // ★ 予報業務許可の核心
  opts.push({
    label:'自局の判断で「'+d.forecastTemptation+'」を放送する',
    sub: (hasForecastLic && forecasters>=2)
        ? '予報業務許可あり。気象予報士'+forecasters+'名の監修で合法に出せる。'
        : (hasForecastLic
            ? '⚠ 許可は持っているが、気象予報士が'+forecasters+'名しかいない。許可の要件（2名以上）を満たしておらず違法。'
            : '⚠ 予報業務許可なし。気象業務法第17条違反にあたる。'),
    risk: !(hasForecastLic && forecasters>=2),
    fn:()=>{
      if(hasForecastLic && forecasters>=2){
        const gain = 14 + sev*2.2;
        s.trust = clamp(s.trust + gain, 0, 100);
        s.fame = clamp(s.fame+4,0,100);
        s.flags.emergencyOnAir = true;
        G.log('気象予報士の監修のもと独自予報を放送。「他局より早い」と評価されています。','good');
      }else{
        s.stats.illegalForecast++;
        s.admin++;
        const fine = 500 + sev*120;
        s.money -= fine;
        s.trust = clamp(s.trust - (16 + sev*2), 0, 100);
        s.morale = clamp(s.morale - 8, 0, 100);
        G.queue({
          head:'気象庁 / 総務省 — 気象業務法違反',
          urgent:true,
          body:'貴局は<b>予報業務の許可を受けずに独自の予報を放送</b>しました。気象業務法第17条第1項に違反します（同法第46条：罰金）。'
             + '<br><br>さらに、誤った見通しを信じて避難を遅らせた住民がいたとの報道があり、局への批判が集中しています。'
             + '<br><br>罰金 '+money(fine)+'、<b>行政指導1件</b>、信頼度が大きく低下しました。',
          opts:[
            { label:'謝罪放送を行い、再発防止策を公表する', sub:'信頼を一部回復。以後、予報業務許可の申請が可能になる。', fn:()=>{
              s.trust = clamp(s.trust+6,0,100);
              s.flags.canApplyForecast = true;
              G.log('謝罪放送を実施。予報業務許可の申請準備に入ります。');
              afterDisasterChoice(s, true);
            }},
            { label:'「気象庁発表の引用の範囲」と主張する', sub:'BPO案件になる可能性がある。', risk:true, fn:()=>{
              if(Math.random()<0.6){ s.bpo++; s.trust=clamp(s.trust-8,0,100);
                G.log('BPO放送倫理検証委員会が審議入り。','bad'); }
              else G.log('釈明は一応受け入れられましたが、局の評判は落ちたままです。','bad');
              afterDisasterChoice(s, true);
            }}
          ]
        });
        return;
      }
      afterDisasterChoice(s, true);
    }
  });

  return {
    head:'【'+d.name+'】緊急 — 報道判断',
    urgent:true,
    body:'<b>'+lead+'</b><br><br>報道フロアから判断を求められています。現在オンエア中の番組は「'
        + (D.fmt(G.currentCell(s).fmt)||{}).name + '」です。'
        + (hasForecastLic?'':'<br><br><span style="color:#ff8a8a">※ 当局は予報業務許可を取得していません。気象庁発表の引用を超える独自の予報を放送することはできません。</span>'),
    opts
  };
}

function afterDisasterChoice(s, responded){
  s.disasterActive.handled = responded;
  // 不謹慎CMの判断
  const risky = s.sponsors.filter(sp => (D.INDUSTRY.find(i=>i.id===sp.ind).grief>=2));
  if(responded && risky.length){
    const loss = risky.reduce((a,b)=>a+b.monthly,0);
    G.queue({
      head:'編成部 — CM素材の取り扱い',
      body:'災害報道中です。現在、'+risky.map(r=>D.INDUSTRY.find(i=>i.id===r.ind).name).join('・')
          +' のCMが編成に入っています。この状況で流し続ければ「不謹慎だ」との批判は避けられません。',
      opts:[
        { label:'該当CMを差し替える（数日間）', sub:'月額 約'+money(loss)+'相当の収入が一時的に25%まで落ちる。', fn:()=>{
          s.flags.cmSuspended = true;
          s.flags.cmSuspendDays = clamp(s.disasterActive?s.disasterActive.days+1:2,1,5);
          s.trust = clamp(s.trust+4,0,100);
          G.log('該当CMを公共広告に差し替えました。','good');
        }},
        { label:'そのまま流す', sub:'収入は守れるが、批判は局に向かう。', risk:true, fn:()=>{
          s.trust = clamp(s.trust-9,0,100);
          G.log('CMをそのまま送出。「この状況で流すのか」と苦情が相次いでいます。','bad');
        }}
      ]
    });
  }
}

/* =========================================================
   不祥事・放送上の問題
   ========================================================= */
function checkIncident(s, cell, f, blk){
  if(G.pendingEvent) return;
  const dj = cell.dj ? s.staff.find(x=>x.id===cell.dj) : null;
  const sb = studioBonus(s);
  let p = 0.0011 * f.risk * G.dif(s).incident;
  if(dj){
    p *= (1 + (100-dj.stability)/70);
    p *= (1 + dj.fatigue/110);
    if(dj.scandalCool>0) p *= 0.15;
  }
  // 抑止要因
  const writers = G.staffOf(s,'writer').length;
  const dirs = G.staffOf(s,'director').length;
  p *= clamp(1 - writers*0.18 - dirs*0.12 - sb.plan*0.02, 0.15, 1);
  if(s.morale<35) p *= 1.6;
  if(Math.random() > p) return;

  const inc = pick(D.INCIDENTS.filter(i => !i.election));
  fireIncident(s, inc, dj);
}

function fireIncident(s, inc, djHint){
  s.stats.incidents++;
  let target = djHint;
  if(inc.staff){
    const pool = G.staffOf(s, inc.staff);
    if(pool.length) target = pick(pool);
  }
  if(!target) target = s.staff.length ? pick(s.staff) : null;
  if(target) target.scandalCool = 45;

  const body = inc.body
    .replace('{staff}', target ? target.name+'（'+D.role(target.role).name+'）' : '当局社員')
    .replace('{min}', rint(2,11));

  const sev = inc.sev;
  const opts = [];

  opts.push({ label:'番組内で訂正・お詫びを放送する', sub:'最小限の対応。軽微な案件なら十分。', fn:()=>{
    if(sev<=1){ s.trust=clamp(s.trust-1.5,0,100); G.log('番組内でお詫び。事なきを得ました。'); }
    else { s.trust=clamp(s.trust-sev*3.2,0,100);
      if(Math.random()<0.35*sev/3){ s.bpo++; G.log('対応が不十分としてBPOに視聴者意見が寄せられました。','bad'); }
      G.log('番組内でお詫び放送を行いました。','bad'); }
    if(target) target.morale = clamp(target.morale-4,0,100);
  }});

  opts.push({ label:'記者会見を開き、社長が謝罪する', sub:'コストと恥。だが炎上の芽は摘める。', fn:()=>{
    s.money -= 60 + sev*90;
    s.trust = clamp(s.trust - sev*1.2 + 2, 0, 100);
    s.morale = clamp(s.morale - 3, 0, 100);
    G.log('記者会見を実施。頭を下げて幕引きを図りました。');
  }});

  if(target) opts.push({ label:target.name+'を番組から降板させる', sub:'責任を明確化。ただし戦力と士気を失う。', fn:()=>{
    for(const k in s.schedule) if(s.schedule[k].dj===target.id) s.schedule[k].dj=null;
    s.trust = clamp(s.trust - sev*1.0 + 3, 0, 100);
    s.morale = clamp(s.morale - 7, 0, 100);
    target.fame = clamp(target.fame-12,0,100);
    G.log(target.name+'を全番組から降板。編成に穴が空きました。','bad');
  }});

  if(target && !target.free) opts.push({ label:target.name+'を解雇する', sub:'切り捨てる。社内の空気は確実に冷える。', risk:true, fn:()=>{
    for(const k in s.schedule) if(s.schedule[k].dj===target.id) s.schedule[k].dj=null;
    removeStaff(s, target);
    s.money -= target.salary*3;
    s.trust = clamp(s.trust - sev*0.6 + 4, 0, 100);
    s.morale = clamp(s.morale - 14, 0, 100);
    G.log(target.name+'を懲戒解雇。退職金'+money(target.salary*3)+'。','bad');
  }});

  // フリーは「解雇」できない。事務所を通した契約解除になる。
  if(target && target.free) opts.push({
    label:target.name+'との契約を解除する',
    sub:'違約金 約'+money(Math.round(target.salary*Math.max(1,target.contract)*0.6))
       +'。'+target.agency+'とは当分取引できなくなる。',
    risk:true, fn:()=>{
      G.releaseTalent(target, true);
      s.trust = clamp(s.trust - sev*0.5 + 4, 0, 100);
      s.morale = clamp(s.morale - 4, 0, 100);
      G.log(target.name+'との契約を解除。'+target.agency+'は態度を硬化させています。','bad');
    }});

  opts.push({ label:'公表せず、社内処理で収める', sub:'発覚すれば倍返しになる。', risk:true, fn:()=>{
    if(Math.random() < 0.30 + sev*0.13){
      s.bpo++; s.admin++;
      s.trust = clamp(s.trust - sev*6.5, 0, 100);
      s.morale = clamp(s.morale-12,0,100);
      s.money -= 200;
      G.log('隠蔽が週刊誌にすっぱ抜かれました。「隠していた」ことがより大きな問題に。','bad');
    }else{
      G.log('社内処理で収束。今のところ表には出ていません。');
    }
  }});

  G.queue({
    head:'【'+inc.name+'】 — 局内対応',
    urgent: sev>=3,
    sfx: inc.id==='accident' ? 'deadair' : 'bad',
    body: body + '<br><br>広報部が判断を待っています。',
    opts
  });
}

/* =========================================================
   イベントキュー / ログ / ゲームオーバー
   ========================================================= */
G.queue = function(ev){
  if(G.pendingEvent) G._q = (G._q||[]).concat([ev]);
  else G.pendingEvent = ev;
};
G.resolveEvent = function(){
  G.pendingEvent = null;
  if(G._q && G._q.length) G.pendingEvent = G._q.shift();
};
G.log = function(msg, cls){
  const s = G.state;
  const t = s ? `${s.time.m}/${s.time.d} ${String(s.time.h).padStart(2,'0')}:00` : '';
  const e = { t, msg, cls:cls||'' };
  if(s){ s.log.push(e); if(s.log.length>300) s.log.shift(); }
  if(typeof UI!=='undefined' && UI.pushLog) UI.pushLog(e);
};
G.gameOver = function(msg){
  G.speed = 0;
  G.state.over = true;
  G.queue({ head:'放送終了', urgent:true, sfx:'signoff', body:'<b>'+msg+'</b><br><br>総放送年数：'+G.state.time.y+'年<br>最高聴取率：'
    + pct(Math.max(0,...G.state.ratingHist,0)) + '<br>災害対応：'+G.state.stats.disasters+'件 / 不祥事：'+G.state.stats.incidents+'件',
    opts:[{ label:'最初からやり直す', fn:()=>location.reload() }] });
};

/* =========================================================
   アクション
   ========================================================= */
G.hire = function(cand){
  const s = G.state;
  const fee = Math.round(cand.salary*1.8);
  if(s.money < fee){ UI.toast('資金が足りません（契約金 '+money(fee)+'）','bad'); return; }
  s.money -= fee;
  s.staff.push(cand);
  s.candidates.splice(s.candidates.indexOf(cand),1);
  AUDIO.play('good');
  G.log(cand.name+'（'+D.role(cand.role).name+'）を採用。契約金'+money(fee)+'。','good');
  UI.refresh();
};
G.fire = function(st){
  const s = G.state;
  const sev = st.salary*2;
  s.money -= sev;
  for(const k in s.schedule) if(s.schedule[k].dj===st.id) s.schedule[k].dj=null;
  removeStaff(s, st);
  s.morale = clamp(s.morale-5,0,100);
  AUDIO.play('bad');
  G.log(st.name+'と契約を解除。'+money(sev)+'を支払いました。');
  UI.refresh();
};
G.signSponsor = function(off){
  const s = G.state;
  if(G.slotsFree(s, off.block) <= 0){
    UI.toast(D.BLOCKS.find(b=>b.id===off.block).name+'のCM枠が埋まっています','bad'); return;
  }
  s.sponsors.push({ ...off });
  s.offers.splice(s.offers.indexOf(off),1);
  const ind = D.INDUSTRY.find(i=>i.id===off.ind);
  AUDIO.play('cash');
  G.log('スポンサー契約：'+ind.name+'（月額'+money(off.monthly)+' / '+off.months+'か月）','good');
  if(ind.grief>=3) G.log('※ '+ind.name+'は災害時に取り扱いが問題になりやすい業種です。','warn');
  UI.refresh();
};
G.joinNetwork = function(netId){
  const s = G.state;
  const net = D.NETWORKS.find(n=>n.id===netId);
  const init = net.fee*6;
  if(s.money<init){ UI.toast('加盟一時金 '+money(init)+' が払えません','bad'); return; }
  s.money -= init;
  s.network = netId;
  s.networkMonths = 0;
  s.fame = clamp(s.fame + net.prestige*0.4,0,100);
  G.log(net.name+'に加盟しました。加盟金'+money(init)+'。','good');
  UI.refresh();
};
G.leaveNetwork = function(){
  const s = G.state;
  const net = D.NETWORKS.find(n=>n.id===s.network);
  s.money -= net.fee*4;
  s.network = null;
  for(const k in s.schedule) if(s.schedule[k].fmt==='net') s.schedule[k]={fmt:'filler',dj:null};
  G.log(net.name+'を脱退。違約金'+money(net.fee*4)+'。','bad');
  UI.refresh();
};
G.buyLicense = function(id){
  const s = G.state;
  const lic = D.LICENSES.find(l=>l.id===id);
  if(s.licenses.includes(id)) return;
  if(lic.needRole){
    const n = G.staffOf(s,lic.needRole).length;
    if(n < lic.needCount){
      UI.toast(D.role(lic.needRole).name+'が'+lic.needCount+'名必要です（現在'+n+'名）','bad'); return;
    }
  }
  if(s.money < lic.cost){ UI.toast('資金不足','bad'); return; }
  s.money -= lic.cost;
  s.licenses.push(id);
  AUDIO.play('good');
  G.log('【'+lic.name+'】を取得しました。','good');
  UI.refresh();
};
G.borrow = function(amt){
  const s = G.state;
  const cap = 6000 + s.ratingAvg*1200 + s.trust*40;
  if(s.debt + amt > cap){ UI.toast('与信枠を超えています（上限 '+money(cap)+'）','bad'); return; }
  s.debt += amt; s.money += amt;
  G.log('銀行から'+money(amt)+'を借り入れました。月利0.4%。');
  UI.refresh();
};
G.repay = function(amt){
  const s = G.state;
  amt = Math.min(amt, s.debt, s.money);
  if(amt<=0) return;
  s.debt -= amt; s.money -= amt;
  G.log(money(amt)+'を返済しました。');
  UI.refresh();
};

/* ---------- 建設 ---------- */
G.buildCity = function(x,y,defId){
  const s = G.state, c = s.city, i = y*c.w+x;
  const def = D.CITY_BUILD.find(d=>d.id===defId);
  if(def.bulldoze){
    if(!c.build[i]){ UI.toast('撤去するものがありません'); return false; }
    if(s.money<def.cost){ UI.toast('資金不足','bad'); return false; }
    s.money -= def.cost; c.build[i]=null; computeCoverage(s); UI.refresh(); return true;
  }
  if(c.terrain[i]===1){ UI.toast('海上には建てられません','bad'); return false; }
  if(c.build[i]){ UI.toast('すでに建物があります','bad'); return false; }
  if(def.reqLicense && !s.licenses.includes(def.reqLicense)){
    UI.toast('【'+D.LICENSES.find(l=>l.id===def.reqLicense).name+'】が必要です','bad'); return false;
  }
  if(s.money<def.cost){ UI.toast('資金不足（'+money(def.cost)+'）','bad'); return false; }
  s.money -= def.cost;
  c.build[i] = { id:defId };
  if(def.power && c.terrain[i]===2) UI.toast('山上に設置。見通しが良く効率的です','good');
  computeCoverage(s);
  AUDIO.play('build');
  G.log(def.name+'を建設（'+money(def.cost)+'）');
  UI.refresh();
  return true;
};
G.buildRoom = function(x,y,defId){
  const s = G.state, st = s.studio, i = y*st.w+x;
  const def = D.ROOMS.find(d=>d.id===defId);
  if(def.bulldoze){
    if(!st.cells[i]){ UI.toast('解体するものがありません'); return false; }
    if(s.money<def.cost) { UI.toast('資金不足','bad'); return false; }
    s.money -= def.cost; st.cells[i]=null; UI.refresh(); return true;
  }
  if(st.cells[i]){ UI.toast('すでに部屋があります','bad'); return false; }
  // 隣接必須
  const adj = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>{
    const nx=x+dx, ny=y+dy;
    return nx>=0&&ny>=0&&nx<st.w&&ny<st.h && st.cells[ny*st.w+nx];
  });
  if(!adj){ UI.toast('既存の部屋に隣接させてください','bad'); return false; }
  if(s.money<def.cost){ UI.toast('資金不足（'+money(def.cost)+'）','bad'); return false; }
  s.money -= def.cost;
  st.cells[i] = { id:defId };
  AUDIO.play('build');
  G.log(def.name+'を増設（'+money(def.cost)+'）');
  UI.refresh();
  return true;
};

/* =========================================================
   セーブ／ロード（3スロット＋オートセーブ）
   ========================================================= */
G.SAVE_VER = 2;
G.slotKey = i => (i==='auto' ? 'cityhz_auto' : 'cityhz_slot_'+i);

function saveMeta(s){
  return {
    ver: G.SAVE_VER,
    name: s.meta.name, call: s.meta.call, freq: s.meta.freq,
    mode: s.meta.mode, diff: s.meta.diff,
    y: s.time.y, m: s.time.m, d: s.time.d,
    money: Math.round(s.money), rating: +(s.ratingAvg||0).toFixed(2),
    trust: Math.round(s.trust), over: !!s.over,
    at: Date.now()
  };
}

G.saveTo = function(slot, quiet){
  if(!G.state) return false;
  try{
    localStorage.setItem(G.slotKey(slot),
      JSON.stringify({ ver:G.SAVE_VER, meta:saveMeta(G.state), s:G.state, uid:_uid }));
    if(!quiet) UI.toast((slot==='auto'?'オートセーブ':'スロット'+(slot+1)+'に保存')+'しました','good');
    return true;
  }catch(e){
    if(!quiet) UI.toast('保存に失敗しました（容量不足の可能性）','bad');
    return false;
  }
};
G.autosave = function(){ G.saveTo('auto', true); };

G.loadFrom = function(slot){
  // 旧・単一スロット時代のセーブは 'cityhz_save' に入っている（G.slotKey は対応しない）
  const raw = localStorage.getItem(slot==='legacy' ? 'cityhz_save' : G.slotKey(slot));
  if(!raw){ UI.toast('このスロットは空です','bad'); return false; }
  try{
    const o = JSON.parse(raw);
    const s = o.s || o;               // 旧形式との互換
    migrate(s);
    G.state = s;
    _uid = o.uid || 100000;
    G.pendingEvent = null; G._q = [];
    computeCoverage(G.state);
    UI.rebuildLog();
    UI.toast('再開しました：'+s.meta.name+'（'+s.time.y+'年目'+s.time.m+'月）','good');
    return true;
  }catch(e){ UI.toast('読み込みに失敗しました','bad'); return false; }
};

/* セーブ一覧（タイトル画面用） */
G.listSaves = function(){
  const out = [];
  const slots = ['auto'];
  for(let i=0;i<D.CONST.SAVE_SLOTS;i++) slots.push(i);
  for(const slot of slots){
    const raw = localStorage.getItem(G.slotKey(slot));
    if(!raw){ out.push({ slot, empty:true }); continue; }
    try{
      const o = JSON.parse(raw);
      out.push({ slot, empty:false, meta: o.meta || saveMetaFromLegacy(o) });
    }catch(e){ out.push({ slot, empty:true, broken:true }); }
  }
  // 旧単一スロットのデータが残っていれば拾う
  const legacy = localStorage.getItem('cityhz_save');
  if(legacy){
    try{
      const o = JSON.parse(legacy);
      out.push({ slot:'legacy', empty:false, meta: saveMetaFromLegacy(o) });
    }catch(e){}
  }
  return out;
};
function saveMetaFromLegacy(o){
  const s = o.s || o;
  migrate(s);
  return saveMeta(s);
}
G.deleteSave = function(slot){
  localStorage.removeItem(slot==='legacy' ? 'cityhz_save' : G.slotKey(slot));
};

/* 旧バージョンのセーブを現行の形に寄せる */
function migrate(s){
  if(!s || !s.meta) return;
  // 旧「受難モード」は 災害モード×難易度hard に分解された
  if(s.meta.mode === 'hard'){ s.meta.mode = 'disaster'; s.meta.diff = s.meta.diff || 'hard'; }
  if(!s.meta.diff) s.meta.diff = 'normal';
  if(!s.freeMarket) s.freeMarket = [];
  if(!s.agencyBlock) s.agencyBlock = {};
  if(s.ledger && s.ledger.talent === undefined) s.ledger.talent = 0;
  if(s.lastMonth && s.lastMonth.talent === undefined) s.lastMonth.talent = 0;
  for(const st of (s.staff||[])) if(st.free && st.exclusive === undefined) st.exclusive = false;
  // サイマル配信（アニラジ・企画枠の追加時）
  if(s.simul === undefined) s.simul = 0;
  if(s.simulAvg === undefined) s.simulAvg = 0;
  if(!s.simulHist) s.simulHist = [];
  if(s.lastMonth && s.lastMonth.simulRev === undefined) s.lastMonth.simulRev = 0;
}
G._migrate = migrate;

/* 旧APIとの互換（サイドバーのボタンから使う） */
G.save = function(){ G.saveTo(0); };
G.load = function(){
  if(!G.loadFrom(0)) return false;
  UI.refresh();
  return true;
};
