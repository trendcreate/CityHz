/* =========================================================
   CityHz - マスタデータ
   ========================================================= */
const D = {};

/* ---------- 時間帯 ---------- */
D.BLOCKS = [
  { id:'early',    name:'早朝',   range:'05-07', h0:5,  h1:7,  hours:2, pop:0.45 },
  { id:'morning',  name:'朝',     range:'07-10', h0:7,  h1:10, hours:3, pop:1.00 },
  { id:'noon',     name:'昼',     range:'10-14', h0:10, h1:14, hours:4, pop:0.75 },
  { id:'aftn',     name:'午後',   range:'14-17', h0:14, h1:17, hours:3, pop:0.65 },
  { id:'evening',  name:'夕方',   range:'17-20', h0:17, h1:20, hours:3, pop:0.95 },
  { id:'night',    name:'夜',     range:'20-24', h0:20, h1:24, hours:4, pop:0.60 },
  { id:'mid',      name:'深夜',   range:'24-05', h0:0,  h1:5,  hours:5, pop:0.22 }
];
D.blockAt = h => D.BLOCKS.find(b => b.id==='mid' ? (h<5) : (h>=b.h0 && h<b.h1)) || D.BLOCKS[6];
D.DAYS = ['月','火','水','木','金','土','日'];

/* ---------- 番組フォーマット ----------
   fit  : 時間帯適性 (blockId -> 倍率)
   need : 必要スタッフ役職
   cost : 1回あたり制作費
   trust: 1回あたり信頼度変動
   risk : 問題発言・放送事故の素の発生倍率
   ad   : 広告単価倍率
--------------------------------------- */
D.FORMATS = [
  { id:'music',  name:'音楽',        cost:3,  trust:0.00, risk:0.5, ad:0.9,
    need:['dj'], fit:{early:1.0,morning:0.9,noon:1.0,aftn:1.05,evening:0.9,night:1.05,mid:1.1},
    desc:'選曲とMC。安全牌だが差別化しづらい。' },
  { id:'wide',   name:'情報ワイド',  cost:10, trust:0.04, risk:1.0, ad:1.25,
    need:['dj','director','writer'], fit:{early:0.8,morning:1.25,noon:1.15,aftn:1.0,evening:1.1,night:0.8,mid:0.5},
    desc:'生ワイド番組。編成の看板。人手を食う。' },
  { id:'talk',   name:'トーク',      cost:6,  trust:0.01, risk:1.6, ad:1.1,
    need:['dj','writer'], fit:{early:0.6,morning:0.9,noon:1.0,aftn:1.05,evening:1.05,night:1.2,mid:1.25},
    desc:'喋りで持たせる。当たれば固定客、外せば失言。' },
  { id:'news',   name:'ニュース',    cost:8,  trust:0.12, risk:0.8, ad:0.75,
    need:['dj','reporter'], fit:{early:1.3,morning:1.2,noon:1.0,aftn:0.9,evening:1.15,night:0.9,mid:0.6},
    desc:'信頼度の源泉。単体では稼げない。' },
  { id:'traffic',name:'交通情報',    cost:4,  trust:0.05, risk:0.3, ad:0.85,
    need:['dj'], fit:{early:1.2,morning:1.35,noon:0.7,aftn:0.8,evening:1.3,night:0.6,mid:0.3},
    desc:'通勤帯に強い。地味に固定客がつく。' },
  { id:'request',name:'リクエスト',  cost:5,  trust:0.00, risk:0.9, ad:1.0,
    need:['dj','mixer'], fit:{early:0.5,morning:0.8,noon:0.95,aftn:1.05,evening:1.05,night:1.3,mid:1.35},
    desc:'ハガキとメール。深夜帯の熱量は高い。' },
  { id:'sports', name:'スポーツ中継',cost:18, trust:0.03, risk:0.7, ad:1.5,
    need:['dj','reporter','mixer'], fit:{early:0.3,morning:0.5,noon:0.8,aftn:0.9,evening:1.4,night:1.3,mid:0.4},
    desc:'中継権料が高いが単価も高い。雨天中止のリスク。' },
  { id:'shop',   name:'通販',        cost:2,  trust:-0.08,risk:0.4, ad:1.8,
    need:[], fit:{early:0.9,morning:0.5,noon:0.8,aftn:0.9,evening:0.5,night:0.7,mid:1.1},
    desc:'金にはなる。聴取率と信頼は落ちる。' },
  { id:'net',    name:'ネット受け',  cost:0,  trust:0.02, risk:0.3, ad:0.6,
    need:[], fit:{early:1.0,morning:1.0,noon:1.0,aftn:1.0,evening:1.0,night:1.0,mid:1.0},
    desc:'キー局制作をそのまま流す。自社の手間ゼロ、収入は少ない。', netOnly:true },
  { id:'filler', name:'フィラー',    cost:0,  trust:-0.02,risk:0.1, ad:0.25,
    need:[], fit:{early:0.5,morning:0.3,noon:0.4,aftn:0.4,evening:0.3,night:0.5,mid:0.8},
    desc:'自動送出の音楽。人はいらないが誰も聴かない。' }
];
D.fmt = id => D.FORMATS.find(f => f.id===id);

/* ---------- スタッフ職種 ---------- */
D.ROLES = [
  { id:'dj',        name:'アナウンサー(DJ)', key:'talk',  color:'#ffb400',
    desc:'番組の顔。話術と知名度が聴取率を作る。' },
  { id:'mixer',     name:'ミキサー',         key:'tech',  color:'#39d4ff',
    desc:'音の品質。放送事故を減らす。' },
  { id:'director',  name:'ディレクター',     key:'plan',  color:'#4ade80',
    desc:'番組の完成度を底上げし、現場の暴走を止める。' },
  { id:'writer',    name:'構成作家',         key:'plan',  color:'#c084fc',
    desc:'台本を書く。失言リスクを大きく下げる。' },
  { id:'reporter',  name:'記者',             key:'plan',  color:'#f87171',
    desc:'取材網。ニュースと災害報道の質を決める。' },
  { id:'sales',     name:'営業',             key:'plan',  color:'#fbbf24',
    desc:'スポンサー枠の獲得数と単価を上げる。' },
  { id:'engineer',  name:'技術',             key:'tech',  color:'#94a3b8',
    desc:'送信設備の維持。故障率を下げる。' },
  { id:'forecaster',name:'気象予報士',       key:'plan',  color:'#38bdf8',
    desc:'予報業務許可の必須要件。独自予報を合法に出せる。' }
];
D.role = id => D.ROLES.find(r => r.id===id);

/* ---------- 名前生成 ---------- */
D.SURNAME = ['佐藤','鈴木','高橋','田中','伊藤','渡辺','山本','中村','小林','加藤','吉田','山田','佐々木','山口','松本','井上','木村','林','斎藤','清水','山崎','森','池田','橋本','石川','前田','藤田','小川','後藤','岡田','長谷川','村上','近藤','石井','遠藤','坂本','青木','西村','福田','太田','三浦','藤井','岡本','松田','中川','中野','原田','小野','田村','竹内'];
D.GIVEN_M = ['健太','大輔','翔','拓也','雄一','直樹','和也','亮','聡','浩二','俊介','慎一','裕介','智也','光','誠','徹','隆','剛','悠斗'];
D.GIVEN_F = ['さやか','美咲','あかね','恵','由紀','千夏','麻衣','里奈','葵','彩','結衣','奈々','早苗','詩織','遥','真澄','成美','和子','陽子','舞'];

/* ---------- 市街地マップ 建物 ---------- */
D.CITY_BUILD = [
  { id:'tx_s',  name:'送信所(小)',   cost:900,   up:12, color:'#ff6b6b', power:22, size:1,
    desc:'出力100W級。半径は狭いが安い。' },
  { id:'tx_m',  name:'送信所(中)',   cost:2600,  up:34, color:'#ff3b3b', power:38, size:1,
    desc:'出力1kW級。県域をねらえる。' },
  { id:'tx_l',  name:'送信所(大)',   cost:7200,  up:88, color:'#c81e1e', power:58, size:1,
    desc:'出力10kW級。免許と地元調整が要る。', reqLicense:'power' },
  { id:'relay', name:'中継局',       cost:1200,  up:18, color:'#ffa94d', power:20, size:1,
    desc:'山陰の難聴取地域を潰す。親局の電波を中継。', relay:true },
  { id:'branch',name:'支社(営業所)', cost:1800,  up:22, color:'#4ade80', size:1,
    desc:'周辺に営業網。スポンサー獲得数が増える。', salesBonus:1 },
  { id:'sat',   name:'サテライトST', cost:2200,  up:26, color:'#39d4ff', size:1,
    desc:'街角スタジオ。地域密着度と知名度が上がる。', reachBonus:1 },
  { id:'garage',name:'中継車庫',     cost:1400,  up:16, color:'#c084fc', size:1,
    desc:'中継車を配備。災害時の現場報道が可能になる。', mobile:1 },
  { id:'bulldoze',name:'撤去',       cost:120,   color:'#888', bulldoze:true, desc:'建物を撤去する。' }
];

/* ---------- 社屋(演奏所) 部屋 ---------- */
D.ROOMS = [
  { id:'corridor',name:'廊下',        cost:60,   up:0.4, color:'#5a6b7c', desc:'部屋をつなぐ。効果なし。' },
  { id:'lobby',   name:'ロビー',      cost:180,  up:1.5, color:'#8aa0b4', morale:2, desc:'見学者と来客。士気とイメージ。' },
  { id:'studioA', name:'第1スタジオ', cost:2400, up:22,  color:'#ffb400', studio:3, desc:'メインスタジオ。生ワイドが打てる。' },
  { id:'studioB', name:'第2スタジオ', cost:1200, up:12,  color:'#e0a020', studio:2, desc:'サブスタジオ。同時制作が可能に。' },
  { id:'booth',   name:'ニュースブース',cost:700,up:7,   color:'#f87171', studio:1, news:2, desc:'ニュース専用の小ブース。' },
  { id:'sub',     name:'副調整室',    cost:900,  up:9,   color:'#39d4ff', quality:2, desc:'サブ。音質と安定性が上がる。' },
  { id:'master',  name:'主調整室',    cost:2000, up:20,  color:'#0ea5e9', quality:3, accident:-3, desc:'マスター。送出の要。事故を大きく減らす。' },
  { id:'newsroom',name:'報道フロア',  cost:1500, up:16,  color:'#ef4444', news:3, desc:'記者の拠点。取材網と災害対応。' },
  { id:'planning',name:'編成局',      cost:1100, up:11,  color:'#4ade80', plan:3, desc:'編成の精度が上がる。番組の当たりが増える。' },
  { id:'salesdept',name:'営業局',     cost:1100, up:11,  color:'#fbbf24', sales:3, desc:'スポンサー営業の拠点。' },
  { id:'tech',    name:'技術部',      cost:900,  up:9,   color:'#94a3b8', tech:3, desc:'保守。設備故障を減らす。' },
  { id:'archive', name:'資料室',      cost:600,  up:5,   color:'#a78bfa', plan:1, news:1, desc:'音源とデータ。番組の厚みが出る。' },
  { id:'meeting', name:'会議室',      cost:400,  up:3,   color:'#64748b', plan:1, morale:1, desc:'編成会議とコンプラ研修に使える。' },
  { id:'cafe',    name:'食堂',        cost:500,  up:5,   color:'#84cc16', morale:4, desc:'深夜番組の生命線。疲労回復が速くなる。' },
  { id:'demolish',name:'解体',        cost:40,   color:'#888', bulldoze:true, desc:'部屋を解体する。' }
];

/* ---------- スポンサー業種 ----------
   grief : 災害時に流すと不謹慎とされる度合い (0-3)
--------------------------------------- */
D.INDUSTRY = [
  { id:'auto',   name:'自動車ディーラー', pay:1.15, grief:1, demand:'evening' },
  { id:'drink',  name:'飲料メーカー',     pay:1.20, grief:1, demand:'morning' },
  { id:'super',  name:'地元スーパー',     pay:0.85, grief:0, demand:'noon' },
  { id:'estate', name:'不動産',           pay:1.05, grief:1, demand:'aftn' },
  { id:'telecom',name:'通信キャリア',     pay:1.35, grief:0, demand:'night' },
  { id:'cosme',  name:'化粧品',           pay:1.10, grief:1, demand:'aftn' },
  { id:'city',   name:'自治体広報',       pay:0.70, grief:0, demand:'morning', trust:0.05 },
  { id:'hosp',   name:'病院・薬局',       pay:0.90, grief:0, demand:'noon', trust:0.03 },
  { id:'school', name:'学習塾',           pay:0.95, grief:1, demand:'night' },
  { id:'pachi',  name:'遊技場',           pay:1.60, grief:3, demand:'mid',  trust:-0.06 },
  { id:'loan',   name:'消費者金融',       pay:1.75, grief:3, demand:'mid',  trust:-0.10 },
  { id:'funeral',name:'葬祭業',           pay:1.00, grief:2, demand:'early' },
  { id:'leisure',name:'レジャー施設',     pay:1.25, grief:2, demand:'evening' },
  { id:'sake',   name:'酒造メーカー',     pay:1.30, grief:2, demand:'night' }
];

/* ---------- 系列ネットワーク ---------- */
D.NETWORKS = [
  { id:'zenkoku', name:'全国民放ラジオ網', fee:220, share:0.34, slots:2, prestige:14,
    desc:'最大手。ネット受け枠は多いが、編成の自由が減る。災害時は全国中継を優先される。' },
  { id:'nippon',  name:'日本ラジオ連盟',   fee:150, share:0.28, slots:2, prestige:10,
    desc:'中堅。スポーツ中継の権利を共有できる。' },
  { id:'fmjapan', name:'FMジャパン系',     fee:180, share:0.30, slots:1, prestige:12,
    desc:'音楽番組に強い。若年層の聴取率が伸びる。' },
  { id:'local',   name:'地方独立局協議会', fee:40,  share:0.10, slots:0, prestige:4,
    desc:'ゆるい相互協定。番組販売と災害時の応援が受けられる。' }
];

/* ---------- 許認可・免許 ---------- */
D.LICENSES = [
  { id:'base',     name:'放送局免許',        cost:0,    need:0,   auto:true,
    desc:'開局時に交付済み。5年ごとに再免許審査がある。' },
  { id:'power',    name:'大電力設備の変更許可', cost:1500, need:0,
    desc:'10kW級送信所を建てるための無線局変更許可。' },
  { id:'forecast', name:'予報業務許可',      cost:2200, needRole:'forecaster', needCount:2,
    desc:'気象業務法第17条。<b>気象予報士2名以上</b>の配置が条件。これ無しに独自の予報を放送すると違法。' },
  { id:'emerg',    name:'緊急警報放送(EWS)設備', cost:1800, need:0,
    desc:'受信機を起動させる緊急警報信号の送出設備。災害時の到達率が跳ね上がる。' },
  { id:'multi',    name:'マルチメディア放送', cost:3000, need:0,
    desc:'データ放送・アプリ同時配信。若年層のリーチが伸びる。' }
];

/* ---------- 災害 ---------- */
D.DISASTERS = [
  { id:'quake',   name:'地震',           sev:[3,7], icon:'震',
    lead:'{area}を震源とする地震。当局管内で最大震度{sev}を観測。',
    forecastTemptation:'余震の見通し' },
  { id:'tsunami', name:'津波警報',       sev:[4,7], icon:'津',
    lead:'{area}沖の地震により、沿岸部に津波警報が発表された。',
    forecastTemptation:'到達時刻と波高の独自予測' },
  { id:'typhoon', name:'台風接近',       sev:[3,6], icon:'台',
    lead:'大型の台風{num}号が管内に接近。暴風域に入る見込み。',
    forecastTemptation:'進路と上陸時刻の独自予測' },
  { id:'rain',    name:'記録的大雨',     sev:[3,7], icon:'雨',
    lead:'{area}に大雨特別警報。線状降水帯が発生している。',
    forecastTemptation:'雨のピークが過ぎる時刻' },
  { id:'snow',    name:'記録的大雪',     sev:[2,5], icon:'雪',
    lead:'管内平野部で記録的な積雪。幹線道路で立ち往生が発生。',
    forecastTemptation:'降り止む時刻' },
  { id:'volcano', name:'火山噴火',       sev:[3,6], icon:'噴',
    lead:'{area}の火山が噴火。噴火警戒レベルが引き上げられた。',
    forecastTemptation:'降灰範囲の独自予測' },
  { id:'blackout',name:'大規模停電',     sev:[2,5], icon:'停',
    lead:'管内広域で停電が発生。復旧の見通しは立っていない。',
    forecastTemptation:'復旧時刻の見通し' },
  { id:'fire',    name:'大規模火災',     sev:[2,5], icon:'火',
    lead:'{area}の市街地で大規模な火災が発生。延焼中。',
    forecastTemptation:'鎮火の見込み時刻' }
];
D.AREAS = ['港区','沿岸北部','中央区','西部丘陵','旧市街','東部平野','南部半島','山手','河口地区','北部山間'];

/* ---------- 不祥事・放送上の問題 ---------- */
D.INCIDENTS = [
  { id:'slur',    name:'生放送での差別的発言', staff:'dj', sev:3,
    body:'{staff}が生放送中、リスナーの職業を揶揄する発言を行いました。SNSで切り抜きが拡散しています。' },
  { id:'politics',name:'選挙期間中の偏向発言', staff:'dj', sev:3, election:true,
    body:'{staff}が特定候補を持ち上げる発言。放送法第4条の政治的公平性に抵触するとの指摘が来ています。' },
  { id:'stealth', name:'ステルスマーケティング', staff:'sales', sev:2,
    body:'スポンサー表記のない紹介コーナーが「広告であることを隠している」と指摘されました。' },
  { id:'dui',     name:'社員の飲酒運転',       staff:null, sev:3,
    body:'{staff}が飲酒運転で検挙されました。夕刊各紙が局名を出して報じています。' },
  { id:'expense', name:'経費の不正処理',       staff:'sales', sev:2,
    body:'{staff}による架空の接待費計上が内部監査で発覚しました。' },
  { id:'accident',name:'放送事故(無音)',       staff:'mixer', sev:1,
    body:'送出系のミスにより{min}分間の無音が発生。総務省へ放送事故報告が必要です。' },
  { id:'wrongcm', name:'CM素材の誤送出',       staff:'mixer', sev:2,
    body:'差し替え前の古いCMを送出。スポンサーから抗議が入っています。' },
  { id:'fake',    name:'裏取り不足の誤報',     staff:'reporter', sev:3,
    body:'{staff}のニュース原稿に事実誤認。無関係の企業を加害者として報じてしまいました。' },
  { id:'harass',  name:'ハラスメント告発',     staff:'director', sev:3,
    body:'{staff}によるパワーハラスメントが匿名で告発され、週刊誌が取材に来ています。' },
  { id:'leak',    name:'リスナー個人情報の流出',staff:null, sev:2,
    body:'プレゼント応募者の名簿が外部流出。個人情報保護委員会への報告事案です。' },
  { id:'music',   name:'権利未処理の楽曲使用', staff:'dj', sev:1,
    body:'放送で使用した音源が権利未処理でした。権利者から使用料と謝罪を求められています。' }
];

/* ---------- ライバル局 ---------- */
D.RIVALS = [
  { name:'県域AM 東洋放送',   base:62, kind:'am',  desc:'老舗。中高年層に絶対的な強さ。' },
  { name:'FMベイエリア',      base:48, kind:'fm',  desc:'音楽編成。若年層を握っている。' },
  { name:'公共放送 地域局',   base:55, kind:'nhk', desc:'災害報道の信頼度が桁違い。' },
  { name:'コミュニティFM みなと', base:22, kind:'cfm', desc:'超地域密着。侮ると足元をすくわれる。' }
];

/* ---------- 難易度 ----------
   モード（災害の有無）とは独立した軸。数値は倍率。
--------------------------------------- */
D.DIFFS = [
  { id:'easy',   name:'見習い',
    money:1.55, pay:1.28, cost:0.85, incident:0.55, disaster:0.65, rival:0.82, floor:-9000, renew:1.4,
    desc:'開局資金に余裕があり、スポンサー単価も高い。事故も災害も少なめ。仕組みを覚えるのに向く。' },
  { id:'normal', name:'標準',
    money:1.00, pay:1.00, cost:1.00, incident:1.00, disaster:1.00, rival:1.00, floor:-6000, renew:1.0,
    desc:'標準的な地方局の経営環境。半年は赤字、そこから立て直す。' },
  { id:'hard',   name:'厳しい',
    money:0.68, pay:0.85, cost:1.16, incident:1.55, disaster:1.40, rival:1.14, floor:-4500, renew:0.8,
    desc:'資金が薄く固定費が重い。競合も強く、失言と事故が目に見えて増える。' },
  { id:'brutal', name:'地獄',
    money:0.42, pay:0.70, cost:1.32, incident:2.30, disaster:1.95, rival:1.28, floor:-3000, renew:0.6,
    desc:'開局初月から資金繰りに追われる。マイクの前の人間は信用できない。' }
];
D.diff = id => D.DIFFS.find(d=>d.id===id) || D.DIFFS[1];

/* ---------- タレント事務所 ---------- */
D.AGENCIES = [
  'オフィス蒼', 'クレール企画', 'ボイスワークス', 'ミナトプロダクション',
  'アーツ音響', 'フリー（個人）', '藤木事務所', 'サウンドピープル'
];

/* ---------- 定数 ---------- */
D.CONST = {
  CITY_W:40, CITY_H:26, CITY_TILE:24,
  STUDIO_W:22, STUDIO_H:15, STUDIO_TILE:38,
  TICK_MS:900,          // 1ゲーム時間あたりの実時間(1x)
  START_MONEY:9000,     // 難易度倍率をかける前の開局資金
  SPECTRUM_FEE:14,      // 電波利用料 / 月 / 送信所
  COPYRIGHT_RATE:0.035, // 著作権使用料(売上比)
  LICENSE_TERM_Y:5,
  NONEXCL_PENALTY:0.87, // 非専属タレントの効果減
  SAVE_SLOTS:3
};
