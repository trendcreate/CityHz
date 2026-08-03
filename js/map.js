/* =========================================================
   CityHz - マップ描画 / 建設
   ========================================================= */
const MAP = {
  citySel: null,
  studioSel: null,
  hover: null,
  showSignal: true
};

const TERRAIN_COLOR = { 0:'#2b3a2a', 1:'#16304a', 2:'#4a4438', 3:'#1f4a6a' };

/* ---------- 共通 ---------- */
function gridOffset(canvas, w, h, tile){
  return { ox: Math.floor((canvas.width - w*tile)/2), oy: Math.floor((canvas.height - h*tile)/2) };
}
function cellFromEvent(canvas, ev, w, h, tile){
  const r = canvas.getBoundingClientRect();
  const sx = canvas.width / r.width, sy = canvas.height / r.height;
  const px = (ev.clientX - r.left)*sx, py = (ev.clientY - r.top)*sy;
  const o = gridOffset(canvas, w, h, tile);
  const x = Math.floor((px-o.ox)/tile), y = Math.floor((py-o.oy)/tile);
  if(x<0||y<0||x>=w||y>=h) return null;
  return {x,y};
}

/* =========================================================
   市街地マップ
   ========================================================= */
MAP.drawCity = function(){
  const s = G.state; if(!s) return;
  const cv = document.getElementById('cityCanvas'), g = cv.getContext('2d');
  const c = s.city, T = D.CONST.CITY_TILE;
  const o = gridOffset(cv, c.w, c.h, T);
  g.fillStyle = '#0a0e12'; g.fillRect(0,0,cv.width,cv.height);

  for(let y=0;y<c.h;y++) for(let x=0;x<c.w;x++){
    const i = y*c.w+x, px = o.ox+x*T, py = o.oy+y*T;
    const t = c.terrain[i];
    g.fillStyle = TERRAIN_COLOR[t];
    g.fillRect(px,py,T,T);

    // 市街地の密度をブロックで表現（昔のSIM風）
    if(t===0 || t===3){
      const p = c.pop[i];
      if(p>200){
        const lv = clamp(Math.floor(p/900),0,4);
        const shade = ['#3c4a3a','#54604a','#6e7458','#8c8a66','#a8a078'][lv];
        g.fillStyle = shade;
        const n = 2+lv;
        for(let k=0;k<n;k++){
          const bx = px + 2 + ((k*7+x*3+y*5)%(T-6));
          const by = py + 2 + ((k*11+y*3+x*7)%(T-6));
          const bs = 2 + (k%2) + Math.floor(lv/2);
          g.fillRect(bx,by,bs,bs);
        }
      }
    }
    if(t===2){ // 山
      g.fillStyle='#5e5546';
      g.beginPath(); g.moveTo(px+T/2,py+3); g.lineTo(px+T-3,py+T-4); g.lineTo(px+3,py+T-4); g.closePath(); g.fill();
    }
    // 電波カバレッジ
    if(MAP.showSignal && c.sig[i]>=8){
      const a = clamp((c.sig[i]-6)/60, 0.05, 0.30);
      g.fillStyle = `rgba(57,212,255,${a})`;
      g.fillRect(px,py,T,T);
    }
    // 建物
    const b = c.build[i];
    if(b){
      const def = D.CITY_BUILD.find(d=>d.id===b.id);
      g.fillStyle = def.color;
      g.fillRect(px+2,py+2,T-4,T-4);
      g.fillStyle = '#000';
      g.font = 'bold 11px sans-serif'; g.textAlign='center'; g.textBaseline='middle';
      g.fillText(def.name[0], px+T/2, py+T/2+1);
      if(def.power){
        g.strokeStyle = 'rgba(255,80,80,.55)'; g.lineWidth=1;
        g.beginPath(); g.arc(px+T/2,py+T/2, def.power*T/2.6, 0, Math.PI*2); g.stroke();
      }
    }
  }
  // グリッド
  g.strokeStyle='rgba(0,0,0,.25)'; g.lineWidth=1;
  for(let x=0;x<=c.w;x++){ g.beginPath(); g.moveTo(o.ox+x*T+.5,o.oy); g.lineTo(o.ox+x*T+.5,o.oy+c.h*T); g.stroke(); }
  for(let y=0;y<=c.h;y++){ g.beginPath(); g.moveTo(o.ox,o.oy+y*T+.5); g.lineTo(o.ox+c.w*T,o.oy+y*T+.5); g.stroke(); }

  // ホバー
  if(MAP.hover && MAP.hover.map==='city'){
    const {x,y} = MAP.hover;
    g.strokeStyle = '#ffb400'; g.lineWidth=2;
    g.strokeRect(o.ox+x*T+1, o.oy+y*T+1, T-2, T-2);
  }
  // 枠
  g.strokeStyle='#3a4a5c'; g.lineWidth=2;
  g.strokeRect(o.ox-1,o.oy-1,c.w*T+2,c.h*T+2);
};

/* =========================================================
   社屋マップ
   ========================================================= */
MAP.drawStudio = function(){
  const s = G.state; if(!s) return;
  const cv = document.getElementById('studioCanvas'), g = cv.getContext('2d');
  const st = s.studio, T = D.CONST.STUDIO_TILE;
  const o = gridOffset(cv, st.w, st.h, T);
  g.fillStyle='#0a0e12'; g.fillRect(0,0,cv.width,cv.height);
  // 敷地
  g.fillStyle='#161d24'; g.fillRect(o.ox,o.oy,st.w*T,st.h*T);

  for(let y=0;y<st.h;y++) for(let x=0;x<st.w;x++){
    const i=y*st.w+x, px=o.ox+x*T, py=o.oy+y*T;
    const cell = st.cells[i];
    if(!cell){
      g.strokeStyle='#1f2932'; g.lineWidth=1;
      g.strokeRect(px+.5,py+.5,T-1,T-1);
      continue;
    }
    const def = D.ROOMS.find(r=>r.id===cell.id);
    g.fillStyle = def.color;
    g.fillRect(px+1,py+1,T-2,T-2);
    g.fillStyle='rgba(0,0,0,.30)';
    g.fillRect(px+1,py+T-8,T-2,7);
    g.fillStyle='#0b0f14';
    g.font='10px sans-serif'; g.textAlign='center'; g.textBaseline='middle';
    const label = def.name.replace('第1','1').replace('第2','2');
    g.fillText(label.slice(0,4), px+T/2, py+T/2-3);
    // スタジオはON AIRランプ
    if(def.studio && s.flags && D.fmt(G.currentCell(s).fmt).id!=='filler'){
      g.fillStyle = (s.time.h%2===0) ? '#ff3b3b' : '#7a1414';
      g.fillRect(px+T-9, py+3, 6, 4);
    }
  }
  if(MAP.hover && MAP.hover.map==='studio'){
    const {x,y}=MAP.hover;
    g.strokeStyle='#ffb400'; g.lineWidth=2;
    g.strokeRect(o.ox+x*T+1,o.oy+y*T+1,T-2,T-2);
  }
  g.strokeStyle='#3a4a5c'; g.lineWidth=2;
  g.strokeRect(o.ox-1,o.oy-1,st.w*T+2,st.h*T+2);
};

/* =========================================================
   パレット
   ========================================================= */
function buildPalette(el, list, selKey, onSelect){
  el.innerHTML = '<h4>'+ (selKey==='citySel'?'建設メニュー':'増改築メニュー') +'</h4>';
  for(const def of list){
    const d = document.createElement('div');
    d.className = 'pal-item' + (MAP[selKey]===def.id ? ' sel':'');
    d.innerHTML =
      '<span class="pal-swatch" style="background:'+def.color+'"></span>'+
      '<span class="pal-name">'+def.name+'</span>'+
      '<span class="pal-cost">'+(def.bulldoze?'':def.cost+'万')+'</span>';
    d.title = def.desc || '';
    d.onclick = ()=>{ MAP[selKey] = (MAP[selKey]===def.id?null:def.id); onSelect(); };
    el.appendChild(d);
  }
  const info = document.createElement('div');
  info.style.cssText='margin-top:8px;padding-top:6px;border-top:1px solid #3a4a5c;color:#8296a8;font-size:10px;line-height:1.5';
  const cur = list.find(d=>d.id===MAP[selKey]);
  info.innerHTML = cur ? '<b style="color:#ffb400">'+cur.name+'</b><br>'+cur.desc : 'アイテムを選び、マップをクリックして配置します。';
  el.appendChild(info);
}

MAP.refreshPalettes = function(){
  buildPalette(document.getElementById('cityPalette'), D.CITY_BUILD, 'citySel', MAP.refreshPalettes);
  buildPalette(document.getElementById('studioPalette'), D.ROOMS, 'studioSel', MAP.refreshPalettes);
  MAP.refreshLegend();
};

MAP.refreshLegend = function(){
  const s = G.state; if(!s) return;
  const cb = cityBonus(s), sb = studioBonus(s);
  document.getElementById('cityLegend').innerHTML =
    '<b style="color:#ffb400">受信エリア</b><br>'+
    'カバー人口 <b>'+(s.coverPop/10000).toFixed(1)+'万人</b> / 総人口 '+(s.totalPop/10000).toFixed(1)+'万人<br>'+
    'カバー率 <b>'+(s.totalPop?(s.coverPop/s.totalPop*100).toFixed(1):0)+'%</b>　受信品質 '+(s.signalQ*100).toFixed(0)+'<br>'+
    '送信所 '+cb.tx+'基 / 中継車 '+(cb.mobile?'あり':'なし')+'<br>'+
    '<span style="color:#8296a8">青いタイル＝電波が届く範囲。山は電波を遮る。</span>';
  document.getElementById('studioLegend').innerHTML =
    '<b style="color:#ffb400">演奏所の能力</b><br>'+
    'スタジオ '+sb.studio+' / 音質 '+sb.quality+' / 報道 '+sb.news+'<br>'+
    '編成 '+sb.plan+' / 営業 '+sb.sales+' / 技術 '+sb.tech+'<br>'+
    '福利 '+sb.morale+'　部屋数 '+sb.rooms+'<br>'+
    '<span style="color:#8296a8">部屋は既存の部屋に隣接して増設します。</span>';
};

/* =========================================================
   入力
   ========================================================= */
MAP.init = function(){
  const cc = document.getElementById('cityCanvas');
  const sc = document.getElementById('studioCanvas');

  cc.addEventListener('mousemove', ev=>{
    const s=G.state; if(!s) return;
    const p = cellFromEvent(cc, ev, s.city.w, s.city.h, D.CONST.CITY_TILE);
    MAP.hover = p ? {map:'city',...p} : null;
    if(p){
      const i=p.y*s.city.w+p.x;
      const b=s.city.build[i];
      cc.title = (b ? D.CITY_BUILD.find(d=>d.id===b.id).name+' / ' : '')
        + '人口'+s.city.pop[i]+'人 / 電界'+Math.max(0,Math.round(s.city.sig[i]))
        + ' / '+['平地','海','山','川'][s.city.terrain[i]];
    }
  });
  cc.addEventListener('mouseleave', ()=>{ MAP.hover=null; });
  cc.addEventListener('click', ev=>{
    const s=G.state; if(!s||!MAP.citySel) return;
    const p = cellFromEvent(cc, ev, s.city.w, s.city.h, D.CONST.CITY_TILE);
    if(p) G.buildCity(p.x,p.y,MAP.citySel);
  });

  sc.addEventListener('mousemove', ev=>{
    const s=G.state; if(!s) return;
    const p = cellFromEvent(sc, ev, s.studio.w, s.studio.h, D.CONST.STUDIO_TILE);
    MAP.hover = p ? {map:'studio',...p} : null;
    if(p){
      const cell = s.studio.cells[p.y*s.studio.w+p.x];
      sc.title = cell ? D.ROOMS.find(r=>r.id===cell.id).name : '空きスペース';
    }
  });
  sc.addEventListener('mouseleave', ()=>{ MAP.hover=null; });
  sc.addEventListener('click', ev=>{
    const s=G.state; if(!s||!MAP.studioSel) return;
    const p = cellFromEvent(sc, ev, s.studio.w, s.studio.h, D.CONST.STUDIO_TILE);
    if(p) G.buildRoom(p.x,p.y,MAP.studioSel);
  });

  MAP.refreshPalettes();
};
