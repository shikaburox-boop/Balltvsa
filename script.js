(()=>{
'use strict';
/* =====================================================================
   กระดานไร้ขอบ — วาดร่วมกันแบบเรียลไทม์ (Supabase Realtime) + รูปแบบส่วนตัว
   - วัตถุที่วาด: เก็บในตาราง strokes และส่งสดผ่าน Broadcast
   - รูปแบบ (reference images): เก็บในเครื่องผู้ใช้ (IndexedDB) ไม่ส่งให้ใคร
   ===================================================================== */

/* ---------- helpers ---------- */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const r2=v=>Math.round(v*100)/100;
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const lsGet=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:v;}catch(e){return d;}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}};
const num=(v,d=0)=>(typeof v==='number'&&Number.isFinite(v))?v:d;
const CFG=window.APP_CONFIG||{};

/* ---------- constants ---------- */
const ICONS={
  select:'<path d="M5 3.5l14 7.2-6 1.9-2 6.4z"/>',
  hand:'<path d="M12 3.5v17M3.5 12h17M12 3.5L9.5 6M12 3.5L14.5 6M12 20.5L9.5 18M12 20.5L14.5 18M3.5 12L6 9.5M3.5 12L6 14.5M20.5 12L18 9.5M20.5 12L18 14.5"/>',
  pen:'<path d="M4 20l1.2-4.2L16.6 4.4a2 2 0 012.8 0l.2.2a2 2 0 010 2.8L8.2 18.8z"/><path d="M14.5 6.5l3 3"/>',
  hl:'<path d="M14.5 4.5l5 5-8.5 8.5H7.5v-3.5z"/><path d="M4 20.5h8"/>',
  eraser:'<path d="M9 19.5H20"/><path d="M5.2 14.8l8.6-8.6a2 2 0 012.8 0l3 3a2 2 0 010 2.8l-7.4 7.4H8.9l-3.7-3.7a1 1 0 010-1.4z"/>',
  line:'<path d="M5 19L19 5"/>',
  arrow:'<path d="M5 19L19 5M9.5 5H19v9.5"/>',
  rect:'<rect x="4" y="6" width="16" height="12" rx="1.5"/>',
  ellipse:'<ellipse cx="12" cy="12" rx="8.5" ry="6.5"/>',
  diamond:'<path d="M12 3.5l8.5 8.5-8.5 8.5L3.5 12z"/>',
  text:'<path d="M5.5 6.5v-2h13v2M12 4.5v15M9.5 19.5h5"/>',
  image:'<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/>',
  layers:'<path d="M12 4l8.5 4.5L12 13 3.5 8.5z"/><path d="M3.5 12.5L12 17l8.5-4.5"/><path d="M3.5 16.5L12 21l8.5-4.5"/>',
  undo:'<path d="M9 14L4.5 9.5 9 5M4.5 9.5H14a5.5 5.5 0 010 11h-3"/>',
  redo:'<path d="M15 14l4.5-4.5L15 5M19.5 9.5H10a5.5 5.5 0 000 11h3"/>',
  minus:'<path d="M5 12h14"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  fit:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  grid:'<path d="M4 4h16v16H4zM4 12h16M12 4v16"/>',
  file:'<path d="M12 4v10M7.5 9.5L12 14l4.5-4.5M5 19.5h14"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.6 9.6a2.5 2.5 0 114 2c-.9.6-1.6 1.1-1.6 2.2M12 17h.01"/>',
  sliders:'<path d="M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>'
};
const svg=(n,s=20)=>`<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

const PALETTE=[['ink','อัตโนมัติ (ตามธีม)'],['#e5484d','แดง'],['#f08a24','ส้ม'],['#e9b800','เหลือง'],['#2fa84f','เขียว'],['#12a5a8','เขียวน้ำทะเล'],['#2f6bed','น้ำเงิน'],['#7c4dff','ม่วง'],['#e5489b','ชมพู'],['#8a93a3','เทา']];
const USER_COLORS=['#d6403f','#d9730d','#2b8a3e','#0b7f82','#2f6bed','#7c4dff','#c2327f'];
const WIDTHS=[2,4,7,12];
// พู่กัน: bw = ตัวคูณขนาดจริงของรอยเส้น, pr = ใช้แรงกด/ความเร็วเปลี่ยนความหนา
const BRUSHES={
  pen:{n:'ปากกา',bw:1},
  ink:{n:'ปากกาหมึก',bw:1.15,pr:1},
  brush:{n:'พู่กัน',bw:1.5,pr:1},
  callig:{n:'หัวตัด (คัดลายมือ)',bw:1.2},
  marker:{n:'มาร์กเกอร์',bw:1.7},
  pencil:{n:'ดินสอ',bw:1.1},
  charcoal:{n:'ถ่าน',bw:1.6},
  air:{n:'แอร์บรัช',bw:2.4},
  water:{n:'สีน้ำ',bw:2.4},
  spray:{n:'สเปรย์',bw:2.6}
};
const BRUSH_IDS=Object.keys(BRUSHES);
const SWATCHES=[
  ['พื้นฐาน',['#000000','#3b3b3b','#6b6b6b','#9a9a9a','#c9c9c9','#ffffff','#7a4a21','#b8743a','#e7b98a','#f5e0c3']],
  ['สดใส',['#e5484d','#f08a24','#f5c400','#8bd135','#2fa84f','#12a5a8','#2f9bef','#2f6bed','#7c4dff','#e5489b']],
  ['พาสเทล',['#ffb3ba','#ffd6a5','#fdffb6','#caffbf','#9bf6e0','#a0c4ff','#bdb2ff','#ffc6ff','#e8d5c4','#d4e2f4']],
  ['เอิร์ธโทน',['#5c3d2e','#8c5a3c','#c08552','#d9a76a','#a3a380','#6b705c','#3a5a40','#2f4858','#9c6644','#cb997e']],
  ['ผิวและผม',['#fde4d0','#f6cfb0','#e6b08c','#c98b64','#a96a45','#7d4a2d','#4a2c1a','#2a1a10','#d8a657','#b5651d']]
];
const SIZES=[[20,'S'],[32,'M'],[52,'L'],[84,'XL']];
const DASHES=['solid','dashed','dotted'];
const FONTS={sans:'"IBM Plex Sans Thai",system-ui,sans-serif',hand:'"Mali","IBM Plex Sans Thai",cursive'};
const TYPES=['pen','hl','line','arrow','rect','ellipse','diamond','text'];
const COLOR_RE=/^(ink|#[0-9a-fA-F]{3,8})$/;
const TOOL_INFO={
  select:['เลือก / ย้าย','V','KeyV'], hand:['เลื่อนจอ','H','KeyH'],
  pen:['ปากกา','P','KeyP'], hl:['ปากกาเน้นข้อความ','M','KeyM'], eraser:['ยางลบ','E','KeyE'],
  line:['เส้นตรง','L','KeyL'], arrow:['ลูกศร','A','KeyA'], rect:['สี่เหลี่ยม','R','KeyR'], ellipse:['วงรี','O','KeyO'], diamond:['ข้าวหลามตัด','D','KeyD'],
  text:['ข้อความ','T','KeyT']
};
const GROUPS=[['select','hand'],['pen','hl','eraser'],['line','arrow','rect','ellipse','diamond'],['text']];
const LS='gr-state-v2';

/* ---------- identity, board, theme ---------- */
const clientId=(()=>{ let v=lsGet('gr-client',''); if(!v){ v=uid()+uid(); lsSet('gr-client',v); } return v; })();
// clientId = เจ้าของผลงาน (คงที่ในเบราว์เซอร์), tabId = ตัวตนบนช่องเรียลไทม์ (ต่างกันทุกแท็บ จะได้เห็นงานจากอีกแท็บของตัวเอง)
const tabId=uid()+uid();
const BOARD=((new URLSearchParams(location.search).get('board'))||CFG.DEFAULT_BOARD||'main')
  .toLowerCase().replace(/[^\p{L}\p{M}\p{N}_-]/gu,'').slice(0,40)||'main';
const me={
  name:(lsGet('gr-name','')||('ผู้วาด '+Math.floor(1000+Math.random()*9000))).slice(0,24),
  color:USER_COLORS.includes(lsGet('gr-color',''))?lsGet('gr-color',''):USER_COLORS[Math.floor(Math.random()*USER_COLORS.length)]
};
lsSet('gr-name',me.name); lsSet('gr-color',me.color);
function applyTheme(){
  const t=lsGet('gr-theme','auto'), r=document.documentElement;
  if(t==='light'||t==='dark') r.setAttribute('data-theme',t); else r.removeAttribute('data-theme');
}
applyTheme();

/* ---------- state ---------- */
const stage=$('#stage'), canvas=$('#cv'), ctx=canvas.getContext('2d');
const ted=$('#ted'), hint=$('#hint'), P=$('#props'), ptoggle=$('#ptoggle'), refsPanel=$('#refs'), refsList=$('#refsList');
let objs=[]; const byId=new Map();
let sel=new Set(), selImg=null, liveMap=null, draft=null, erasing=new Set();
let cam={x:-400,y:-300,z:1};
let tool='pen', spaceDown=false, grid=true, wheelZoom=false, ready=false;
const defaults={stroke:'ink',fill:'none',sw:4,op:1,dash:'solid',size:32,font:'hand',br:'pen',stab:0};
let undoStack=[], redoStack=[];
let drag=null, lastTap=null, clip=null, pasteN=0, lastZ=0;
const pointers=new Map(); let ignoreTouch=false;
let editing=null, editingId=null, hlSwap=null;
const imgs=[];
let T={bg:'#f5f6f8',dot:'#cdd2db',ink:'#1b2130',accent:'#0b7f82',panel:'#fff'}, themeKey='', inkOverride=null;
const net={sb:null,ch:null,joined:false,status:'local',online:new Map(),cursors:new Map(),drafts:new Map(),pending:[],flushing:null};

function nextZ(){ lastZ=Math.max(Date.now(),lastZ+1); return lastZ; }

/* ---------- theme tokens for canvas ---------- */
const mqDark=window.matchMedia?window.matchMedia('(prefers-color-scheme: dark)'):null;
function readTheme(){
  const cs=getComputedStyle(document.documentElement), g=n=>cs.getPropertyValue(n).trim();
  T={bg:g('--canvas')||T.bg,dot:g('--dot')||T.dot,ink:g('--ink')||T.ink,accent:g('--accent')||T.accent,panel:g('--panel')||T.panel};
}
function checkTheme(){
  const k=(document.documentElement.getAttribute('data-theme')||'')+(mqDark&&mqDark.matches?'d':'l');
  if(k!==themeKey){themeKey=k;readTheme();}
}
const col=c=>c==='ink'?(inkOverride||T.ink):c;

/* ---------- geometry ---------- */
let bbCache=new WeakMap();
const mcache=new Map();
const fontStr=o=>`${o.size}px ${FONTS[o.font]||FONTS.sans}`;
const strokeW=o=>o.type==='hl'?o.sw*3:o.type==='pen'?o.sw*((BRUSHES[o.br]||BRUSHES.pen).bw):o.sw;
function measureText(o){
  const key=o.font+'|'+o.size+'|'+o.text;
  let m=mcache.get(key);
  if(!m){
    ctx.save(); ctx.font=fontStr(o);
    const lines=o.text.split('\n'); let w=0;
    for(const l of lines) w=Math.max(w,ctx.measureText(l).width);
    ctx.restore();
    m={w:Math.max(w,o.size*0.5),h:lines.length*o.size*1.3,lines};
    if(mcache.size>2000) mcache.clear();
    mcache.set(key,m);
  }
  return m;
}
function bboxOf(o){
  let b=bbCache.get(o); if(b) return b;
  switch(o.type){
    case 'pen': case 'hl': {
      let a=Infinity,c=Infinity,d=-Infinity,e=-Infinity;
      for(const p of o.pts){ if(p[0]<a)a=p[0]; if(p[0]>d)d=p[0]; if(p[1]<c)c=p[1]; if(p[1]>e)e=p[1]; }
      const h=strokeW(o)/2; b=[a-h,c-h,d+h,e+h]; break;
    }
    case 'line': case 'arrow': {
      const h=o.sw/2+(o.type==='arrow'?10+o.sw*3:0);
      b=[Math.min(o.x1,o.x2)-h,Math.min(o.y1,o.y2)-h,Math.max(o.x1,o.x2)+h,Math.max(o.y1,o.y2)+h]; break;
    }
    case 'text': { const m=measureText(o); b=[o.x,o.y,o.x+m.w,o.y+m.h]; break; }
    default: { const h=o.sw/2; b=[o.x-h,o.y-h,o.x+o.w+h,o.y+o.h+h]; }
  }
  bbCache.set(o,b); return b;
}
function unionBBox(list){
  let b=null;
  for(const o of list){ const x=bboxOf(o); b=b?[Math.min(b[0],x[0]),Math.min(b[1],x[1]),Math.max(b[2],x[2]),Math.max(b[3],x[3])]:x.slice(); }
  return b;
}
function distSeg(px,py,x1,y1,x2,y2){
  const dx=x2-x1,dy=y2-y1,l2=dx*dx+dy*dy;
  let t=l2?((px-x1)*dx+(py-y1)*dy)/l2:0; t=clamp(t,0,1);
  return Math.hypot(px-(x1+t*dx),py-(y1+t*dy));
}
function hitObj(o,px,py,tol){
  const bb=bboxOf(o);
  if(px<bb[0]-tol||px>bb[2]+tol||py<bb[1]-tol||py>bb[3]+tol) return false;
  switch(o.type){
    case 'pen': case 'hl': {
      const t=tol+strokeW(o)/2, p=o.pts;
      if(p.length===1) return Math.hypot(px-p[0][0],py-p[0][1])<=t;
      for(let i=1;i<p.length;i++) if(distSeg(px,py,p[i-1][0],p[i-1][1],p[i][0],p[i][1])<=t) return true;
      return false;
    }
    case 'line': case 'arrow': return distSeg(px,py,o.x1,o.y1,o.x2,o.y2)<=tol+o.sw/2+(o.type==='arrow'?o.sw:0);
    case 'text': return true;
    case 'rect': {
      const t=tol+o.sw/2;
      const inside=px>=o.x&&px<=o.x+o.w&&py>=o.y&&py<=o.y+o.h;
      if(!inside) return true;
      if(o.fill!=='none') return true;
      return Math.min(Math.abs(px-o.x),Math.abs(px-o.x-o.w),Math.abs(py-o.y),Math.abs(py-o.y-o.h))<=t;
    }
    case 'ellipse': {
      const a=Math.max(o.w/2,0.5),b=Math.max(o.h/2,0.5),cx=o.x+o.w/2,cy=o.y+o.h/2;
      const nd=Math.hypot((px-cx)/a,(py-cy)/b);
      if(nd<=1&&o.fill!=='none') return true;
      return Math.abs(nd-1)*Math.min(a,b)<=tol+o.sw/2;
    }
    case 'diamond': {
      const cx=o.x+o.w/2,cy=o.y+o.h/2,a=Math.max(o.w/2,0.5),b=Math.max(o.h/2,0.5);
      if(Math.abs(px-cx)/a+Math.abs(py-cy)/b<=1&&o.fill!=='none') return true;
      const t=tol+o.sw/2;
      return distSeg(px,py,cx,o.y,o.x+o.w,cy)<=t||distSeg(px,py,o.x+o.w,cy,cx,o.y+o.h)<=t||distSeg(px,py,cx,o.y+o.h,o.x,cy)<=t||distSeg(px,py,o.x,cy,cx,o.y)<=t;
    }
  }
  return false;
}
function moveObj(o,dx,dy){
  switch(o.type){
    case 'pen': case 'hl': return {...o,pts:o.pts.map(p=>p.length>2?[p[0]+dx,p[1]+dy,p[2]]:[p[0]+dx,p[1]+dy])};
    case 'line': case 'arrow': return {...o,x1:o.x1+dx,y1:o.y1+dy,x2:o.x2+dx,y2:o.y2+dy};
    default: return {...o,x:o.x+dx,y:o.y+dy};
  }
}
function scaleObj(o,ax,ay,sx,sy){
  const fx=x=>ax+(x-ax)*sx, fy=y=>ay+(y-ay)*sy;
  switch(o.type){
    case 'pen': case 'hl': return {...o,pts:o.pts.map(p=>p.length>2?[fx(p[0]),fy(p[1]),p[2]]:[fx(p[0]),fy(p[1])])};
    case 'line': case 'arrow': return {...o,x1:fx(o.x1),y1:fy(o.y1),x2:fx(o.x2),y2:fy(o.y2)};
    case 'text': {
      const m=measureText(o);
      const s=Math.abs(sx-1)>Math.abs(sy-1)?Math.abs(sx):Math.abs(sy);
      return {...o,size:clamp(Math.round(o.size*s),6,600),x:Math.min(fx(o.x),fx(o.x+m.w)),y:Math.min(fy(o.y),fy(o.y+m.h))};
    }
    default: {
      const x0=fx(o.x),x1=fx(o.x+o.w),y0=fy(o.y),y1=fy(o.y+o.h);
      return {...o,x:Math.min(x0,x1),y:Math.min(y0,y1),w:Math.abs(x1-x0),h:Math.abs(y1-y0)};
    }
  }
}
const eff=o=>(liveMap&&liveMap.has(o.id))?liveMap.get(o.id):o;

/* ---------- validation of objects (local, saved, or remote) ---------- */
function cleanObj(o){
  if(!o||typeof o!=='object'||!TYPES.includes(o.type)) return null;
  const r={
    id:(typeof o.id==='string'&&o.id)?o.id.slice(0,40):uid(), type:o.type,
    stroke:COLOR_RE.test(o.stroke)?o.stroke:'ink', op:clamp(num(o.op,1),0.05,1),
    z:Math.round(num(o.z,0)), by:typeof o.by==='string'?o.by.slice(0,40):''
  };
  const sw=clamp(num(o.sw,4),0.5,80), dash=DASHES.includes(o.dash)?o.dash:'solid';
  switch(o.type){
    case 'pen': case 'hl':
      if(!Array.isArray(o.pts)||!o.pts.length) return null;
      r.sw=sw; if(o.type==='pen') r.br=BRUSHES[o.br]?o.br:'pen';
      r.pts=o.pts.slice(0,60000).filter(p=>Array.isArray(p)).map(p=>p.length>2?[num(p[0]),num(p[1]),clamp(num(p[2],0.6),0.05,1)]:[num(p[0]),num(p[1])]);
      return r.pts.length?r:null;
    case 'line': case 'arrow':
      Object.assign(r,{sw,dash,x1:num(o.x1),y1:num(o.y1),x2:num(o.x2),y2:num(o.y2)}); return r;
    case 'text':
      r.text=String(o.text==null?'':o.text).slice(0,5000); if(!r.text) return null;
      r.size=clamp(num(o.size,32),4,600); r.font=o.font==='sans'?'sans':'hand'; r.x=num(o.x); r.y=num(o.y); return r;
    default:
      Object.assign(r,{sw,dash,fill:COLOR_RE.test(o.fill)?o.fill:'none',x:num(o.x),y:num(o.y),w:Math.abs(num(o.w)),h:Math.abs(num(o.h))}); return r;
  }
}
function slimObj(o){
  if((o.type==='pen'||o.type==='hl')&&o.pts.length>9000){
    const k=Math.ceil(o.pts.length/9000), pts=o.pts.filter((_,i)=>i%k===0||i===o.pts.length-1);
    return {...o,pts};
  }
  return o;
}

/* ---------- object store: ops, history ---------- */
function insertSorted(o){
  let lo=0,hi=objs.length;
  while(lo<hi){ const m=(lo+hi)>>1; if(objs[m].z<=o.z) lo=m+1; else hi=m; }
  objs.splice(lo,0,o);
}
function upsertObj(o){
  const old=byId.get(o.id);
  if(old){
    const i=objs.indexOf(old);
    if(i>=0&&old.z===o.z){ objs[i]=o; byId.set(o.id,o); return; }
    if(i>=0) objs.splice(i,1);
  }
  insertSorted(o); byId.set(o.id,o);
}
function applyOp(op){
  if(op.t==='del'){
    const old=byId.get(op.id); if(!old) return false;
    const i=objs.indexOf(old); if(i>=0) objs.splice(i,1);
    byId.delete(op.id); sel.delete(op.id); net.drafts.delete(op.id); return true;
  }
  const o=op.o; if(!o) return false;
  if(op.t==='upd'&&!byId.has(o.id)) return false;
  upsertObj(o); if(o.z>lastZ) lastZ=o.z;
  return true;
}
function pruneSel(){ sel=new Set([...sel].filter(id=>byId.has(id))); }
function replaceAll(list){
  list.sort((a,b)=>a.z-b.z);
  objs=list; byId.clear();
  for(const o of list){ byId.set(o.id,o); if(o.z>lastZ) lastZ=o.z; }
  pruneSel();
}
function commitOps(list){
  const fwd=[],inv=[];
  for(const op of list){
    if(op.t==='add'){ if(byId.has(op.o.id)) continue; fwd.push({t:'add',o:slimObj(op.o)}); inv.unshift({t:'del',id:op.o.id}); }
    else if(op.t==='upd'){ const prev=byId.get(op.o.id); if(!prev) continue; fwd.push({t:'upd',o:slimObj(op.o)}); inv.unshift({t:'upd',o:prev}); }
    else if(op.t==='del'){ const prev=byId.get(op.id); if(!prev) continue; fwd.push(op); inv.unshift({t:'add',o:prev}); }
  }
  if(!fwd.length) return;
  fwd.forEach(applyOp);
  undoStack.push({fwd,inv}); if(undoStack.length>200) undoStack.shift();
  redoStack=[];
  syncOps(fwd); changed();
}
function runHistory(ops){
  const ok=ops.filter(op=>op.t==='upd'?byId.has(op.o.id):op.t==='del'?byId.has(op.id):true);
  ok.forEach(applyOp); syncOps(ok); changed();
}
function undo(){ if(editing) commitText(); const h=undoStack.pop(); if(!h) return; redoStack.push(h); runHistory(h.inv); }
function redo(){ if(editing) commitText(); const h=redoStack.pop(); if(!h) return; undoStack.push(h); runHistory(h.fwd); }
function changed(){ updateUI(); invalidate(); }

/* ---------- local persistence (no-Supabase mode + viewport/settings) ---------- */
let saveT=0;
function saveSoon(){
  clearTimeout(saveT);
  saveT=setTimeout(()=>{
    const d={v:2,cam,defaults,grid,wheelZoom};
    lsSet(LS+':'+BOARD,JSON.stringify(d));
    if(!net.sb) lsSet('gr-local-objs:'+BOARD,JSON.stringify(objs));
  },500);
}
function loadLocal(){
  try{
    const raw=lsGet(LS+':'+BOARD,'');
    if(raw){
      const d=JSON.parse(raw);
      if(d.cam&&[d.cam.x,d.cam.y,d.cam.z].every(Number.isFinite)){ cam={x:d.cam.x,y:d.cam.y,z:clamp(d.cam.z,0.02,40)}; hadCam=true; }
      const f=d.defaults;
      if(f&&typeof f==='object'){
        if(COLOR_RE.test(f.stroke)) defaults.stroke=f.stroke;
        if(f.fill==='none'||COLOR_RE.test(f.fill)) defaults.fill=f.fill;
        if(Number.isFinite(f.sw)) defaults.sw=clamp(f.sw,1,80);
        if(BRUSHES[f.br]) defaults.br=f.br;
        if(Number.isFinite(f.stab)) defaults.stab=clamp(f.stab,0,0.92);
        if(Number.isFinite(f.op)) defaults.op=clamp(f.op,0.1,1);
        if(DASHES.includes(f.dash)) defaults.dash=f.dash;
        if(SIZES.some(s=>s[0]===f.size)) defaults.size=f.size;
        if(f.font in FONTS) defaults.font=f.font;
      }
      grid=d.grid!==false; wheelZoom=!!d.wheelZoom;
    }
    if(!net.sb){
      const ro=lsGet('gr-local-objs:'+BOARD,'');
      if(ro){ const a=JSON.parse(ro); if(Array.isArray(a)) replaceAll(a.map(cleanObj).filter(Boolean)); }
    }
  }catch(e){}
}
let hadCam=false;

/* ---------- networking (Supabase) ---------- */
const ST_TEXT={
  local:'โหมดวาดคนเดียว: ยังไม่ได้ตั้งค่า Supabase ใน config.js งานบันทึกไว้ในเครื่องนี้เท่านั้น',
  connecting:'กำลังเชื่อมต่อ…',
  online:'เชื่อมต่อแล้ว ทุกคนในห้องเห็นเส้นของกันและกันสดๆ',
  offline:'หลุดการเชื่อมต่อ กำลังลองใหม่อัตโนมัติ',
  error:'มีปัญหา'
};
function setStatus(s,msg){
  net.status=s;
  $('#stDot').dataset.s=s;
  $('#stText').textContent=(ST_TEXT[s]||'')+(msg?(' — '+msg):'');
  $('#peopleBtn').title=(ST_TEXT[s]||'')+(msg?(' — '+msg):'');
}
function netSend(event,payload){
  if(!net.ch||!net.joined) return;
  try{
    const p=net.ch.send({type:'broadcast',event,payload:{...payload,from:tabId}});
    if(p&&p.catch) p.catch(()=>{});
  }catch(e){}
}
function connect(){
  setStatus('connecting');
  const ch=net.sb.channel('board:'+BOARD,{config:{broadcast:{self:false},presence:{key:tabId}}});
  ch.on('broadcast',{event:'ops'},m=>onRemoteOps(m.payload))
    .on('broadcast',{event:'draft'},m=>onRemoteDraft(m.payload))
    .on('broadcast',{event:'dx'},m=>onRemoteDraftEnd(m.payload))
    .on('broadcast',{event:'cur'},m=>onRemoteCursor(m.payload))
    .on('presence',{event:'sync'},()=>onPresence())
    .subscribe(async status=>{
      if(status==='SUBSCRIBED'){
        net.joined=true; setStatus('online');
        try{ await ch.track({name:me.name,color:me.color}); }catch(e){}
        await loadBoard();
      } else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){
        net.joined=false; setStatus('offline');
      }
    });
  net.ch=ch;
}
async function loadBoard(){
  if(!net.sb) return;
  try{
    if(net.pending.length) await flush();
    if(net.pending.length){ ready=true; updateUI(); return; }
    const rows=[]; let from=0;
    for(;;){
      const {data,error}=await net.sb.from('strokes').select('id,z,data').eq('board',BOARD).order('z',{ascending:true}).order('id',{ascending:true}).range(from,from+999);
      if(error) throw error;
      rows.push(...data); if(data.length<1000) break; from+=1000;
    }
    const list=[];
    for(const r of rows){ const o=cleanObj({...(r.data||{}),id:r.id,z:r.z}); if(o) list.push(o); }
    replaceAll(list);
    if(!hadCam&&list.length) fitView();
    ready=true; setStatus('online');
  }catch(e){
    console.warn('load failed',e); ready=true;
    setStatus('error','โหลดกระดานไม่ได้ (เช็กว่ารัน supabase.sql แล้ว)');
  }
  changed();
}
function toRows(ops){
  const last=new Map();
  for(const op of ops){ if(op.t==='del') last.set(op.id,{del:true}); else last.set(op.o.id,{o:op.o}); }
  const ups=[],dels=[];
  for(const [id,v] of last){
    if(v.del) dels.push(id);
    else ups.push({id,board:BOARD,z:v.o.z,data:v.o,author:clientId});
  }
  return {ups,dels};
}
function persist(ops){
  if(!net.sb){ saveSoon(); return Promise.resolve(); }
  const b=toRows(ops);
  if(!b.ups.length&&!b.dels.length) return Promise.resolve();
  net.pending.push(b);
  return flush();
}
function flush(){
  if(net.flushing) return net.flushing;
  const run=async()=>{
    while(net.pending.length){
      const b=net.pending[0];
      try{
        for(let i=0;i<b.ups.length;i+=50){
          const {error}=await net.sb.from('strokes').upsert(b.ups.slice(i,i+50)); if(error) throw error;
        }
        for(let i=0;i<b.dels.length;i+=100){
          const {error}=await net.sb.from('strokes').delete().eq('board',BOARD).in('id',b.dels.slice(i,i+100)); if(error) throw error;
        }
        net.pending.shift();
      }catch(e){
        console.warn('save failed',e);
        setStatus('error','บันทึกลงฐานข้อมูลไม่ได้ จะลองใหม่');
        setTimeout(flush,4000);
        return;
      }
    }
    if(net.status==='error') setStatus(net.joined?'online':'offline');
  };
  net.flushing=run().finally(()=>{net.flushing=null;});
  return net.flushing;
}
function syncOps(ops){
  const p=persist(ops);
  if(!net.joined||!ops.length) return;
  for(let i=0;i<ops.length;i+=60){
    const chunk=ops.slice(i,i+60);
    let size=0; try{ size=JSON.stringify(chunk).length; }catch(e){}
    if(size>180000){
      const dels=chunk.filter(o=>o.t==='del'), fetchOps=chunk.filter(o=>o.t!=='del').map(o=>({t:'fetch',id:o.o.id}));
      p.then(()=>netSend('ops',{ops:dels.concat(fetchOps)}));
    } else netSend('ops',{ops:chunk});
  }
}
async function fetchRows(ids){
  if(!net.sb||!ids.length) return;
  try{
    const {data,error}=await net.sb.from('strokes').select('id,z,data').eq('board',BOARD).in('id',ids.slice(0,100));
    if(error) throw error;
    for(const r of data){ const o=cleanObj({...(r.data||{}),id:r.id,z:r.z}); if(o){ applyOp({t:'add',o}); } }
    changed();
  }catch(e){ console.warn(e); }
}
function onRemoteOps(p){
  if(!p||p.from===tabId||!Array.isArray(p.ops)) return;
  const fetchIds=[];
  for(const op of p.ops.slice(0,300)){
    if(!op||typeof op!=='object') continue;
    if(op.t==='del'&&typeof op.id==='string') applyOp({t:'del',id:op.id});
    else if(op.t==='fetch'&&typeof op.id==='string') fetchIds.push(op.id);
    else if(op.t==='add'||op.t==='upd'){
      const o=cleanObj(op.o); if(!o) continue;
      net.drafts.delete(o.id); applyOp({t:'add',o});
    }
  }
  if(fetchIds.length) fetchRows(fetchIds);
  changed();
}
function onRemoteDraft(p){
  if(!p||p.from===tabId) return;
  if(Array.isArray(p.pts)){
    let d=net.drafts.get(p.id);
    const pts=p.pts.filter(q=>Array.isArray(q)).map(q=>q.length>2?[num(q[0]),num(q[1]),clamp(num(q[2],0.6),0.05,1)]:[num(q[0]),num(q[1])]);
    if(!d||p.i===0){
      const base=cleanObj({id:p.id,type:p.type,br:p.br,stroke:p.stroke,sw:p.sw,op:p.op,pts:pts.length?pts:[[0,0]]});
      if(!base) return; d={...base,_from:p.from,_t:performance.now()}; net.drafts.set(p.id,d);
    } else if(p.i===d.pts.length){ d.pts=d.pts.concat(pts); d._t=performance.now(); bbCache.delete(d); }
    else return;
  } else if(p.o){
    const o=cleanObj(p.o); if(!o) return;
    net.drafts.set(o.id,{...o,_from:p.from,_t:performance.now()});
  }
  invalidate();
}
function onRemoteDraftEnd(p){ if(p&&typeof p.id==='string'){ net.drafts.delete(p.id); invalidate(); } }
function onRemoteCursor(p){
  if(!p||p.from===tabId) return;
  if(p.x==null){ net.cursors.delete(p.from); }
  else net.cursors.set(p.from,{x:num(p.x),y:num(p.y),name:String(p.name||'').slice(0,24),color:COLOR_RE.test(p.color)?p.color:'#2f6bed',t:performance.now()});
  invalidate();
}
function onPresence(){
  if(!net.ch) return;
  const st=net.ch.presenceState(), m=new Map();
  for(const k in st){ const meta=(st[k]&&st[k][0])||{}; m.set(k,{name:String(meta.name||'ผู้ร่วมวาด').slice(0,24),color:COLOR_RE.test(meta.color)?meta.color:'#2f6bed'}); }
  net.online=m;
  for(const k of [...net.cursors.keys()]) if(!m.has(k)) net.cursors.delete(k);
  for(const [id,d] of [...net.drafts]) if(d._from&&!m.has(d._from)) net.drafts.delete(id);
  updatePeopleUI(); invalidate();
}
let curTimer=0, lastCur=0, draftTimer=0, draftSent=0;
function sendCursor(wx,wy){
  if(!net.joined) return;
  const now=performance.now();
  if(now-lastCur<50) return; lastCur=now;
  netSend('cur',{x:r2(wx),y:r2(wy),name:me.name,color:me.color});
}
function scheduleDraft(){
  if(!net.joined||draftTimer) return;
  draftTimer=setTimeout(()=>{ draftTimer=0; sendDraft(); },60);
}
function sendDraft(){
  if(!draft||!net.joined) return;
  if(draft.type==='pen'||draft.type==='hl'){
    const pts=draft.pts.slice(draftSent);
    if(!pts.length) return;
    netSend('draft',{id:draft.id,type:draft.type,br:draft.br,stroke:draft.stroke,sw:draft.sw,op:draft.op,pts,i:draftSent});
    draftSent=draft.pts.length;
  } else netSend('draft',{o:draft});
}
function endDraftBroadcast(id){
  clearTimeout(draftTimer); draftTimer=0; draftSent=0;
  if(net.joined&&id) netSend('dx',{id});
}
setInterval(()=>{
  const now=performance.now(); let dirty=false;
  for(const [k,c] of net.cursors) if(now-c.t>8000){ net.cursors.delete(k); dirty=true; }
  for(const [k,d] of net.drafts) if(now-(d._t||0)>15000){ net.drafts.delete(k); dirty=true; }
  if(dirty) invalidate();
},2000);

/* ---------- reference images (private, stored in this browser) ---------- */
const idb={db:null};
function idbOpen(){
  return new Promise(res=>{
    try{
      const r=indexedDB.open('gr-refs',1);
      r.onupgradeneeded=()=>{ r.result.createObjectStore('refs',{keyPath:'key'}); };
      r.onsuccess=()=>res(r.result); r.onerror=()=>res(null); r.onblocked=()=>res(null);
    }catch(e){ res(null); }
  });
}
function idbPut(rec){ if(!idb.db) return; try{ idb.db.transaction('refs','readwrite').objectStore('refs').put(rec); }catch(e){} }
function idbDel(key){ if(!idb.db) return; try{ idb.db.transaction('refs','readwrite').objectStore('refs').delete(key); }catch(e){} }
function idbAll(){
  return new Promise(res=>{
    if(!idb.db) return res([]);
    try{ const q=idb.db.transaction('refs','readonly').objectStore('refs').getAll(); q.onsuccess=()=>res(q.result||[]); q.onerror=()=>res([]); }
    catch(e){ res([]); }
  });
}
const imgKey=im=>BOARD+':'+im.id;
const saveImgTimers=new Map();
function saveImg(im){
  clearTimeout(saveImgTimers.get(im.id));
  saveImgTimers.set(im.id,setTimeout(()=>{
    idbPut({key:imgKey(im),board:BOARD,id:im.id,name:im.name,blob:im.blob,nw:im.nw,nh:im.nh,x:im.x,y:im.y,w:im.w,h:im.h,op:im.op,locked:im.locked,hidden:im.hidden,over:im.over,order:im.order});
  },400));
}
function loadImageEl(blob){
  return new Promise((res,rej)=>{
    const url=URL.createObjectURL(blob), el=new Image();
    el.onload=()=>res({el,url,nw:el.naturalWidth,nh:el.naturalHeight});
    el.onerror=()=>{ URL.revokeObjectURL(url); rej(new Error('image')); };
    el.src=url;
  });
}
async function downscale(el,nw,nh,type){
  const k=2560/Math.max(nw,nh), c=document.createElement('canvas');
  c.width=Math.max(1,Math.round(nw*k)); c.height=Math.max(1,Math.round(nh*k));
  c.getContext('2d').drawImage(el,0,0,c.width,c.height);
  const t=type==='image/png'?'image/png':'image/jpeg';
  return new Promise(res=>c.toBlob(b=>res(b),t,0.9));
}
async function importImage(file,at){
  if(!file||!/^image\//.test(file.type)){ toast('ไฟล์นี้ไม่ใช่รูปภาพ'); return; }
  try{
    let blob=file, info=await loadImageEl(file);
    if(Math.max(info.nw,info.nh)>2560||file.size>6e6){
      const nb=await downscale(info.el,info.nw,info.nh,file.type);
      if(nb){ URL.revokeObjectURL(info.url); blob=nb; info=await loadImageEl(nb); }
    }
    const W=stage.clientWidth,H=stage.clientHeight;
    const s=Math.min((W*0.6/cam.z)/info.nw,(H*0.6/cam.z)/info.nh);
    const w=info.nw*s,h=info.nh*s;
    const cx=at?at.wx:cam.x+W/cam.z/2, cy=at?at.wy:cam.y+H/cam.z/2;
    const im={id:uid(),name:(file.name||'รูปแบบ').slice(0,60),blob,el:info.el,url:info.url,nw:info.nw,nh:info.nh,x:cx-w/2,y:cy-h/2,w,h,op:0.5,locked:false,hidden:false,over:false,order:Date.now()};
    imgs.push(im); saveImg(im);
    openRefs(true); renderRefs(); invalidate();
    toast('เพิ่มรูปแบบแล้ว ปรับความโปร่งใสและขนาดได้ในแผง “รูปแบบ”');
  }catch(e){ toast('เปิดรูปนี้ไม่ได้'); }
}
async function loadImages(){
  idb.db=await idbOpen();
  const recs=(await idbAll()).filter(r=>r.board===BOARD).sort((a,b)=>(a.order||0)-(b.order||0));
  for(const r of recs){
    try{
      const info=await loadImageEl(r.blob);
      imgs.push({id:r.id,name:r.name||'รูปแบบ',blob:r.blob,el:info.el,url:info.url,nw:info.nw,nh:info.nh,x:num(r.x),y:num(r.y),w:num(r.w,info.nw),h:num(r.h,info.nh),op:clamp(num(r.op,0.5),0.05,1),locked:!!r.locked,hidden:!!r.hidden,over:!!r.over,order:r.order||0});
    }catch(e){}
  }
  if(imgs.length){ renderRefs(); invalidate(); }
}
function removeImg(im){
  const i=imgs.indexOf(im); if(i<0) return;
  imgs.splice(i,1); idbDel(imgKey(im)); try{ URL.revokeObjectURL(im.url); }catch(e){}
  if(selImg===im.id) selImg=null;
  renderRefs(); updateUI(); invalidate();
}
const getImg=id=>imgs.find(i=>i.id===id);
const imgHit=(im,x,y)=>!im.locked&&!im.hidden&&x>=im.x&&x<=im.x+im.w&&y>=im.y&&y<=im.y+im.h;
function scaleImg(im,s){
  const cx=im.x+im.w/2, cy=im.y+im.h/2, ar=im.h/im.w;
  im.w=im.nw*s; im.h=im.w*ar; im.x=cx-im.w/2; im.y=cy-im.h/2;
}

/* ---------- painting ---------- */
function setDash(c,o){
  if(o.dash==='dashed') c.setLineDash([o.sw*3.2,o.sw*2.4]);
  else if(o.dash==='dotted') c.setLineDash([0.01,o.sw*2.2]);
  else c.setLineDash([]);
}
/* ---------- brush engine ---------- */
function seedOf(id){ let h=2166136261; for(let i=0;i<id.length;i++){ h^=id.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function rngOf(seed){ let a=seed||1; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function smoothPath(c,p){
  c.moveTo(p[0][0],p[0][1]);
  if(p.length===2){ c.lineTo(p[1][0],p[1][1]); return; }
  for(let i=1;i<p.length-1;i++) c.quadraticCurveTo(p[i][0],p[i][1],(p[i][0]+p[i+1][0])/2,(p[i][1]+p[i+1][1])/2);
  c.lineTo(p[p.length-1][0],p[p.length-1][1]);
}
function resample(p,step,maxN){
  const out=[[p[0][0],p[0][1]]]; let carry=0, total=0;
  for(let i=1;i<p.length;i++) total+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);
  step=Math.max(step,total/maxN);
  for(let i=1;i<p.length;i++){
    const x0=p[i-1][0],y0=p[i-1][1],dx=p[i][0]-x0,dy=p[i][1]-y0,d=Math.hypot(dx,dy);
    if(!d) continue;
    let t=step-carry;
    while(t<=d){ out.push([x0+dx*t/d,y0+dy*t/d]); t+=step; }
    carry=d-(t-step);
  }
  return out;
}
// เส้นความหนาไม่เท่ากัน: สร้างเป็นรูปปิดแล้วเติมสีครั้งเดียว ความทึบจึงสม่ำเสมอ
function ribbon(c,p,half){
  const n=p.length, L=[], R=[];
  for(let i=0;i<n;i++){
    const a=p[Math.max(0,i-1)], b=p[Math.min(n-1,i+1)];
    let dx=b[0]-a[0], dy=b[1]-a[1]; const d=Math.hypot(dx,dy)||1; dx/=d; dy/=d;
    const h=half(i); L.push([p[i][0]-dy*h,p[i][1]+dx*h]); R.push([p[i][0]+dy*h,p[i][1]-dx*h]);
  }
  c.beginPath(); c.moveTo(L[0][0],L[0][1]);
  for(let i=1;i<n;i++) c.lineTo(L[i][0],L[i][1]);
  for(let i=n-1;i>=0;i--) c.lineTo(R[i][0],R[i][1]);
  c.closePath(); c.fill();
  c.beginPath(); c.arc(p[0][0],p[0][1],half(0),0,Math.PI*2); c.arc(p[n-1][0],p[n-1][1],half(n-1),0,Math.PI*2); c.fill();
}
function paintPen(c,o,a,stroke){
  const w=o.sw, p=o.pts, br=o.br||'pen', B=BRUSHES[br]||BRUSHES.pen, n=p.length;
  c.strokeStyle=stroke; c.fillStyle=stroke; c.lineCap='round'; c.lineJoin='round';
  const R=rngOf(seedOf(o.id||'x'));
  const dot=(r,al)=>{ c.globalAlpha=al; c.beginPath(); c.arc(p[0][0],p[0][1],r,0,Math.PI*2); c.fill(); };
  switch(br){
    case 'ink': case 'brush': {
      const k=br==='ink'?[0.22,0.95,0.3]:[0.18,1.15,0.15];
      const half=i=>{
        const pr=p[i].length>2?p[i][2]:0.6, ramp=Math.min(1,(i+1)/5,(n-i)/6), t=k[2]+(1-k[2])*ramp;
        return Math.max(0.2,w*B.bw*(k[0]+k[1]*pr)*t/2);
      };
      c.globalAlpha=a*(br==='brush'?0.94:1);
      if(n===1){ c.beginPath(); c.arc(p[0][0],p[0][1],half(0),0,Math.PI*2); c.fill(); return; }
      ribbon(c,p,half);
      if(br==='brush'){ // ขนพู่กัน: เส้นบางจางๆ ขนานไปตามรอย
        c.globalAlpha=a*0.12; c.lineWidth=Math.max(0.5,w*0.12);
        for(let s=-2;s<=2;s++){ if(!s) continue; const off=s*w*0.2; c.beginPath();
          for(let i=0;i<n;i++){ const q=p[Math.max(0,i-1)], r=p[Math.min(n-1,i+1)]; let dx=r[0]-q[0],dy=r[1]-q[1]; const d=Math.hypot(dx,dy)||1;
            const x=p[i][0]-dy/d*off*(0.4+(p[i][2]||0.6)), y=p[i][1]+dx/d*off*(0.4+(p[i][2]||0.6)); if(i) c.lineTo(x,y); else c.moveTo(x,y); }
          c.stroke(); }
      }
      return;
    }
    case 'callig': {
      const ang=-Math.PI/4.5, hx=Math.cos(ang)*w*B.bw/2, hy=Math.sin(ang)*w*B.bw/2;
      c.globalAlpha=a; c.beginPath();
      const quad=(x0,y0,x1,y1)=>{
        const q=[[x0+hx,y0+hy],[x1+hx,y1+hy],[x1-hx,y1-hy],[x0-hx,y0-hy]];
        let s=0; for(let i=0;i<4;i++){ const u=q[i],v=q[(i+1)%4]; s+=u[0]*v[1]-v[0]*u[1]; }
        if(s<0) q.reverse();
        c.moveTo(q[0][0],q[0][1]); for(let i=1;i<4;i++) c.lineTo(q[i][0],q[i][1]); c.closePath();
      };
      if(n===1) quad(p[0][0],p[0][1],p[0][0]+0.01,p[0][1]); else for(let i=1;i<n;i++) quad(p[i-1][0],p[i-1][1],p[i][0],p[i][1]);
      c.fill(); return;
    }
    case 'marker':
      c.globalAlpha=a*0.7; c.lineWidth=w*B.bw; c.lineCap='square';
      if(n===1){ c.fillRect(p[0][0]-w*B.bw/2,p[0][1]-w*B.bw/2,w*B.bw,w*B.bw); return; }
      c.beginPath(); smoothPath(c,p); c.stroke(); return;
    case 'pencil': {
      if(n===1){ dot(w*0.4,a*0.8); return; }
      const lw=Math.max(0.6,w*0.38);
      for(let k=0;k<3;k++){
        c.globalAlpha=a*0.42; c.lineWidth=lw; c.beginPath();
        const j=w*0.18;
        const q=p.map(v=>[v[0]+(R()-0.5)*j*2,v[1]+(R()-0.5)*j*2]);
        smoothPath(c,q.length>1?q:[q[0],q[0]]); c.stroke();
      }
      return;
    }
    case 'air': {
      const W=w*B.bw;
      for(let k=0;k<6;k++){
        c.globalAlpha=a*0.075; c.lineWidth=W*(1-k*0.15);
        c.beginPath(); smoothPath(c,n>1?p:[p[0],[p[0][0]+0.01,p[0][1]]]); c.stroke();
      }
      return;
    }
    case 'water': {
      const W=w*B.bw;
      const path=(m)=>{ c.beginPath(); smoothPath(c,n>1?p.map(v=>[v[0]+(R()-0.5)*m,v[1]+(R()-0.5)*m]):[p[0],[p[0][0]+0.01,p[0][1]]]); };
      for(const [f,al] of [[1,0.1],[0.8,0.11],[0.55,0.12]]){ c.globalAlpha=a*al; c.lineWidth=W*f; path(W*0.08); c.stroke(); }
      c.globalAlpha=a*0.06; c.lineWidth=W*1.1; path(W*0.2); c.stroke();
      return;
    }
    case 'charcoal': case 'spray': {
      const W=w*B.bw, sp=br==='spray', pts=n===1?[p[0]]:resample(p,Math.max(0.7,W*(sp?0.12:0.1)),sp?1400:2600);
      const per=sp?5:3, batches=sp?1:3;
      for(let b=0;b<batches;b++){
        c.globalAlpha=a*(sp?0.85:0.33); c.beginPath();
        for(const q of pts) for(let i=0;i<per;i++){
          const ang=R()*Math.PI*2, rad=(sp?(R()+R())/2:Math.sqrt(R()))*W/2;
          const x=q[0]+Math.cos(ang)*rad, y=q[1]+Math.sin(ang)*rad, s=sp?Math.max(0.5,W*0.035)*(0.6+R()*0.8):Math.max(0.7,W*0.07)*(0.5+R());
          c.rect(x-s/2,y-s/2,s,s);
        }
        c.fill();
      }
      return;
    }
    default: {
      c.globalAlpha=a; c.lineWidth=w;
      if(n===1){ dot(w/2,a); return; }
      c.beginPath(); smoothPath(c,p); c.stroke();
    }
  }
}
function paintObj(c,o,extra){
  const a=(o.op==null?1:o.op)*(extra==null?1:extra);
  c.save(); c.lineCap='round'; c.lineJoin='round';
  const stroke=col(o.stroke);
  switch(o.type){
    case 'pen': paintPen(c,o,a,stroke); break;
    case 'hl': {
      const w=strokeW(o), p=o.pts;
      c.strokeStyle=stroke; c.fillStyle=stroke; c.lineWidth=w; c.globalAlpha=a*0.38; c.lineCap='square';
      if(p.length===1){ c.beginPath(); c.arc(p[0][0],p[0][1],w/2,0,Math.PI*2); c.fill(); break; }
      c.beginPath(); smoothPath(c,p); c.stroke(); break;
    }
    case 'line': case 'arrow': {
      c.strokeStyle=stroke; c.lineWidth=o.sw; c.globalAlpha=a; setDash(c,o);
      c.beginPath(); c.moveTo(o.x1,o.y1); c.lineTo(o.x2,o.y2); c.stroke();
      if(o.type==='arrow'){
        c.setLineDash([]);
        const ang=Math.atan2(o.y2-o.y1,o.x2-o.x1), L=10+o.sw*3, sp=Math.PI/7;
        c.beginPath();
        c.moveTo(o.x2-L*Math.cos(ang-sp),o.y2-L*Math.sin(ang-sp)); c.lineTo(o.x2,o.y2); c.lineTo(o.x2-L*Math.cos(ang+sp),o.y2-L*Math.sin(ang+sp));
        c.stroke();
      }
      break;
    }
    case 'rect': case 'ellipse': case 'diamond': {
      c.beginPath();
      if(o.type==='rect') c.rect(o.x,o.y,o.w,o.h);
      else if(o.type==='ellipse') c.ellipse(o.x+o.w/2,o.y+o.h/2,Math.max(o.w/2,0.01),Math.max(o.h/2,0.01),0,0,Math.PI*2);
      else{ c.moveTo(o.x+o.w/2,o.y); c.lineTo(o.x+o.w,o.y+o.h/2); c.lineTo(o.x+o.w/2,o.y+o.h); c.lineTo(o.x,o.y+o.h/2); c.closePath(); }
      if(o.fill!=='none'){ c.globalAlpha=a*0.3; c.fillStyle=col(o.fill); c.fill(); }
      c.globalAlpha=a; c.strokeStyle=stroke; c.lineWidth=o.sw; setDash(c,o); c.stroke();
      break;
    }
    case 'text': {
      const m=measureText(o);
      c.font=fontStr(o); c.textBaseline='top'; c.fillStyle=stroke; c.globalAlpha=a;
      m.lines.forEach((l,i)=>c.fillText(l,o.x,o.y+i*o.size*1.3+o.size*0.15));
      break;
    }
  }
  c.restore();
}
function paintImages(c,over){
  for(const im of imgs){
    if(im.hidden||im.over!==over||!im.el) continue;
    c.save(); c.globalAlpha=im.op;
    try{ c.drawImage(im.el,im.x,im.y,im.w,im.h); }catch(e){}
    c.restore();
  }
}
function drawGrid(W,H,dpr){
  let s=24; while(s*cam.z<14) s*=2; while(s*cam.z>60) s/=2;
  const z=cam.z, x0=Math.floor(cam.x/s)*s, y0=Math.floor(cam.y/s)*s, rr=Math.max(1,1.3*dpr);
  ctx.fillStyle=T.dot;
  for(let x=x0;(x-cam.x)*z<=W;x+=s){
    const px=Math.round((x-cam.x)*z*dpr);
    for(let y=y0;(y-cam.y)*z<=H;y+=s) ctx.fillRect(px-rr/2,Math.round((y-cam.y)*z*dpr)-rr/2,rr,rr);
  }
}
function selBounds(){
  if(selImg){ const im=getImg(selImg); return (im&&!im.hidden)?[im.x,im.y,im.x+im.w,im.y+im.h]:null; }
  const l=[]; for(const id of sel){ const o=byId.get(id); if(o) l.push(eff(o)); }
  return l.length?unionBBox(l):null;
}
const PAD=7;
function handlePositions(b){
  const z=cam.z,x0=(b[0]-cam.x)*z-PAD,y0=(b[1]-cam.y)*z-PAD,x1=(b[2]-cam.x)*z+PAD,y1=(b[3]-cam.y)*z+PAD,mx=(x0+x1)/2,my=(y0+y1)/2;
  return {nw:[x0,y0],n:[mx,y0],ne:[x1,y0],e:[x1,my],se:[x1,y1],s:[mx,y1],sw:[x0,y1],w:[x0,my]};
}
function hitHandle(sx,sy,type){
  if(tool!=='select') return null;
  const b=selBounds(); if(!b) return null;
  const r=type==='touch'?18:8, H=handlePositions(b);
  for(const k of ['nw','ne','se','sw','n','e','s','w']) if(Math.abs(sx-H[k][0])<=r&&Math.abs(sy-H[k][1])<=r) return k;
  return null;
}
function drawCursor(c,x,y,color,name){
  c.save(); c.translate(x,y);
  c.fillStyle=color; c.strokeStyle='#fff'; c.lineWidth=1.5; c.lineJoin='round';
  c.beginPath(); c.moveTo(0,0); c.lineTo(0,16); c.lineTo(4.5,12); c.lineTo(7.5,18.5); c.lineTo(10,17.4); c.lineTo(7.1,11); c.lineTo(12.5,11); c.closePath();
  c.fill(); c.stroke();
  if(name){
    c.font='500 12px "IBM Plex Sans Thai",system-ui,sans-serif'; c.textBaseline='middle';
    const w=c.measureText(name).width+12;
    c.fillStyle=color; c.beginPath();
    if(c.roundRect) c.roundRect(12,16,w,20,6); else c.rect(12,16,w,20);
    c.fill(); c.fillStyle='#fff'; c.fillText(name,18,26.5);
  }
  c.restore();
}
let queued=false;
function invalidate(){ if(queued) return; queued=true; requestAnimationFrame(()=>{queued=false;render();}); }
function render(){
  checkTheme();
  const dpr=window.devicePixelRatio||1, W=stage.clientWidth, H=stage.clientHeight;
  const cw=Math.max(1,Math.round(W*dpr)), ch=Math.max(1,Math.round(H*dpr));
  if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}
  ctx.setTransform(1,0,0,1,0,0); ctx.fillStyle=T.bg; ctx.fillRect(0,0,cw,ch);
  if(grid) drawGrid(W,H,dpr);
  ctx.setTransform(dpr*cam.z,0,0,dpr*cam.z,-cam.x*cam.z*dpr,-cam.y*cam.z*dpr);
  const vx0=cam.x,vy0=cam.y,vx1=cam.x+W/cam.z,vy1=cam.y+H/cam.z;
  paintImages(ctx,false);
  for(const o0 of objs){
    if(o0.id===editingId) continue;
    const o=eff(o0), bb=bboxOf(o);
    if(bb[2]<vx0||bb[0]>vx1||bb[3]<vy0||bb[1]>vy1) continue;
    paintObj(ctx,o,erasing.has(o.id)?0.25:1);
  }
  paintImages(ctx,true);
  for(const d of net.drafts.values()) paintObj(ctx,d,1);
  if(draft) paintObj(ctx,draft,1);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  if(tool==='select'&&(sel.size||selImg)&&!editing){
    if(sel.size>1){
      ctx.strokeStyle=T.accent; ctx.globalAlpha=.35; ctx.lineWidth=1;
      for(const id of sel){ const o=byId.get(id); if(!o) continue; const b=bboxOf(eff(o)); ctx.strokeRect((b[0]-cam.x)*cam.z,(b[1]-cam.y)*cam.z,(b[2]-b[0])*cam.z,(b[3]-b[1])*cam.z); }
      ctx.globalAlpha=1;
    }
    const b=selBounds();
    if(b){
      const H8=handlePositions(b), x0=H8.nw[0],y0=H8.nw[1];
      ctx.strokeStyle=T.accent; ctx.lineWidth=1.25; ctx.setLineDash([5,4]);
      ctx.strokeRect(x0,y0,H8.se[0]-x0,H8.se[1]-y0); ctx.setLineDash([]);
      ctx.fillStyle=T.panel;
      for(const k in H8){ ctx.beginPath(); ctx.rect(H8[k][0]-4.5,H8[k][1]-4.5,9,9); ctx.fill(); ctx.stroke(); }
    }
  }
  if(drag&&drag.kind==='marquee'&&drag.rect){
    const q=drag.rect,x=(Math.min(q.x0,q.x1)-cam.x)*cam.z,y=(Math.min(q.y0,q.y1)-cam.y)*cam.z,w=Math.abs(q.x1-q.x0)*cam.z,h=Math.abs(q.y1-q.y0)*cam.z;
    ctx.fillStyle=T.accent; ctx.globalAlpha=.1; ctx.fillRect(x,y,w,h); ctx.globalAlpha=1;
    ctx.strokeStyle=T.accent; ctx.lineWidth=1; ctx.strokeRect(x,y,w,h);
  }
  const now=performance.now();
  for(const c of net.cursors.values()){
    if(now-c.t>8000) continue;
    const sx=(c.x-cam.x)*cam.z, sy=(c.y-cam.y)*cam.z;
    if(sx<-40||sy<-40||sx>W+40||sy>H+40) continue;
    drawCursor(ctx,sx,sy,c.color,c.name);
  }
}

/* ---------- view ---------- */
function onViewChange(){ layoutEditor(); $('#zoomlbl').textContent=Math.round(cam.z*100)+'%'; invalidate(); saveSoon(); }
function zoomAt(k,sx,sy){
  const nz=clamp(cam.z*k,0.02,40), wx=cam.x+sx/cam.z, wy=cam.y+sy/cam.z;
  cam.z=nz; cam.x=wx-sx/nz; cam.y=wy-sy/nz; onViewChange();
}
function fitView(){
  const W=stage.clientWidth,H=stage.clientHeight;
  let b=objs.length?unionBBox(objs):null;
  for(const im of imgs){ if(im.hidden) continue; const ib=[im.x,im.y,im.x+im.w,im.y+im.h]; b=b?[Math.min(b[0],ib[0]),Math.min(b[1],ib[1]),Math.max(b[2],ib[2]),Math.max(b[3],ib[3])]:ib; }
  if(!b){ cam={x:-W/2,y:-H/2,z:1}; onViewChange(); return; }
  const bw=Math.max(b[2]-b[0],1), bh=Math.max(b[3]-b[1],1);
  const px=Math.min(120,W*0.1), pt=100, pb=84;
  const z=clamp(Math.min((W-2*px)/bw,(H-pt-pb)/bh),0.02,1.5);
  cam.z=z; cam.x=(b[0]+b[2])/2-W/z/2; cam.y=(b[1]+b[3])/2-H/z/2; onViewChange();
}

/* ---------- tools ---------- */
function setTool(t){
  if(editing) commitText();
  if(tool==='hl'&&t!=='hl'&&hlSwap){ if(hlSwap.changed&&defaults.stroke==='#e9b800') defaults.stroke=hlSwap.prev; hlSwap=null; }
  tool=t;
  if(t==='hl'&&!hlSwap){ hlSwap={prev:defaults.stroke,changed:false}; if(defaults.stroke==='ink'){ defaults.stroke='#e9b800'; hlSwap.changed=true; } }
  if(t!=='select'){ sel=new Set(); selImg=null; }
  updateCursor(); updateUI(); invalidate();
}
function updateCursor(){
  let c='default';
  if(drag&&drag.kind==='pan') c='grabbing';
  else if(spaceDown||tool==='hand') c='grab';
  else if(tool==='text') c='text';
  else if(tool!=='select') c='crosshair';
  canvas.style.cursor=c;
}
const CURS={nw:'nwse-resize',se:'nwse-resize',ne:'nesw-resize',sw:'nesw-resize',n:'ns-resize',s:'ns-resize',e:'ew-resize',w:'ew-resize'};
function topObj(wx,wy,type){
  const tol=(type==='touch'?12:6)/cam.z;
  for(let i=objs.length-1;i>=0;i--) if(hitObj(objs[i],wx,wy,tol)) return objs[i];
  return null;
}
function hitAny(wx,wy,type){
  const tol=(type==='touch'?12:6)/cam.z;
  for(let i=imgs.length-1;i>=0;i--){ const im=imgs[i]; if(im.over&&imgHit(im,wx,wy)) return {kind:'img',im}; }
  for(let i=objs.length-1;i>=0;i--) if(hitObj(objs[i],wx,wy,tol)) return {kind:'obj',o:objs[i]};
  for(let i=imgs.length-1;i>=0;i--){ const im=imgs[i]; if(!im.over&&imgHit(im,wx,wy)) return {kind:'img',im}; }
  return null;
}
function grabOffset(h,b,p){
  return {ox:h.includes('e')?p.wx-b[2]:h.includes('w')?p.wx-b[0]:0, oy:h.includes('s')?p.wy-b[3]:h.includes('n')?p.wy-b[1]:0};
}
function ptr(e){
  const r=canvas.getBoundingClientRect(), sx=e.clientX-r.left, sy=e.clientY-r.top;
  return {sx,sy,wx:cam.x+sx/cam.z,wy:cam.y+sy/cam.z};
}
function eraseAt(p,last){
  const tol=9/cam.z;
  const test=(wx,wy)=>{ for(const o of objs) if(!erasing.has(o.id)&&hitObj(o,wx,wy,tol)) erasing.add(o.id); };
  if(last){
    const d=Math.hypot(p.sx-last.sx,p.sy-last.sy), n=Math.max(1,Math.ceil(d/4));
    for(let i=1;i<=n;i++){ const t=i/n; test(last.wx+(p.wx-last.wx)*t,last.wy+(p.wy-last.wy)*t); }
  } else test(p.wx,p.wy);
  invalidate();
}
function newShape(type,wx,wy){
  const base={id:uid(),type,stroke:defaults.stroke,sw:defaults.sw,op:defaults.op,dash:defaults.dash};
  if(type==='line'||type==='arrow') return {...base,x1:wx,y1:wy,x2:wx,y2:wy};
  return {...base,fill:defaults.fill,x:wx,y:wy,w:0,h:0};
}
function finishNew(o){ return {...o,z:nextZ(),by:clientId}; }

/* ---------- pointer input ---------- */
function startPinch(){
  if(draft){ endDraftBroadcast(draft.id); }
  draft=null; liveMap=null; erasing=new Set(); drag=null;
  const [a,b]=[...pointers.values()], r=canvas.getBoundingClientRect();
  const mx=(a.x+b.x)/2-r.left, my=(a.y+b.y)/2-r.top;
  drag={kind:'pinch',d0:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),z0:cam.z,wx:cam.x+mx/cam.z,wy:cam.y+my/cam.z};
  ignoreTouch=true; invalidate();
}
function updatePinch(){
  const arr=[...pointers.values()]; if(arr.length<2) return;
  const [a,b]=arr, r=canvas.getBoundingClientRect();
  const mx=(a.x+b.x)/2-r.left, my=(a.y+b.y)/2-r.top;
  const z=clamp(drag.z0*Math.hypot(a.x-b.x,a.y-b.y)/drag.d0,0.02,40);
  cam.z=z; cam.x=drag.wx-mx/z; cam.y=drag.wy-my/z; onViewChange();
}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerleave',()=>{ if(net.joined) netSend('cur',{x:null}); });
canvas.addEventListener('pointerdown',e=>{
  if(editing) commitText();
  if(document.activeElement&&document.activeElement!==document.body) document.activeElement.blur();
  try{canvas.setPointerCapture(e.pointerId);}catch(_){}
  if(e.pointerType==='touch'){
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size>=2){ startPinch(); return; }
    if(ignoreTouch) return;
  }
  e.preventDefault();
  const p=ptr(e);
  if(pickMode||(e.altKey&&e.button===0&&tool!=='hand'&&!spaceDown)){
    const hx=pickColorAt(p), prop=pickMode||'stroke'; pickMode=null; updateCursor();
    if(hx){ applyProp(prop,hx); addRecent(hx); toast('ดูดสีแล้ว '+hx); } else toast('ดูดสีตรงนี้ไม่ได้');
    return;
  }
  if(e.button===1||e.button===2||tool==='hand'||spaceDown){
    drag={kind:'pan',sx:p.sx,sy:p.sy,cx:cam.x,cy:cam.y}; updateCursor(); return;
  }
  if(e.button!==0) return;
  switch(tool){
    case 'select': {
      const h=hitHandle(p.sx,p.sy,e.pointerType);
      if(h){
        if(selImg){
          const im=getImg(selImg);
          drag={kind:'imgresize',h,im,o:{x:im.x,y:im.y,w:im.w,h:im.h},start:p,...grabOffset(h,[im.x,im.y,im.x+im.w,im.y+im.h],p)};
        } else { const b=selBounds(); drag={kind:'resize',h,b,start:p,...grabOffset(h,b,p)}; }
        return;
      }
      const hit=hitAny(p.wx,p.wy,e.pointerType);
      if(hit&&hit.kind==='img'){
        sel=new Set(); selImg=hit.im.id;
        drag={kind:'imgmove',im:hit.im,start:p,ox:hit.im.x,oy:hit.im.y,moved:false};
        updateUI(); invalidate(); break;
      }
      selImg=null;
      if(hit){
        const o=hit.o;
        if(e.shiftKey){ if(sel.has(o.id)) sel.delete(o.id); else sel.add(o.id); updateUI(); invalidate(); return; }
        if(!sel.has(o.id)) sel=new Set([o.id]);
        drag={kind:'move',start:p,moved:false};
      } else {
        if(!e.shiftKey) sel=new Set();
        drag={kind:'marquee',start:p,base:new Set(sel),rect:null};
      }
      updateUI(); invalidate(); break;
    }
    case 'pen': case 'hl':
      if(sel.size||selImg){ sel=new Set(); selImg=null; updateUI(); }
      {
        const br=tool==='pen'?defaults.br:undefined, pr=!!(br&&BRUSHES[br].pr);
        const p0=pr?(e.pointerType==='pen'&&e.pressure>0?clamp(e.pressure,0.1,1):0.55):0;
        draft={id:uid(),type:tool,stroke:defaults.stroke,sw:defaults.sw,op:defaults.op,pts:[pr?[r2(p.wx),r2(p.wy),r2(p0)]:[r2(p.wx),r2(p.wy)]]};
        if(br) draft.br=br;
        draftSent=0; drag={kind:'draw',pr,sx:p.wx,sy:p.wy,lp:p0,lt:e.timeStamp,lsx:p.sx,lsy:p.sy};
        scheduleDraft(); invalidate();
      }
      break;
    case 'line': case 'arrow': case 'rect': case 'ellipse': case 'diamond':
      draft=newShape(tool,p.wx,p.wy); drag={kind:'shape',x0:p.wx,y0:p.wy}; invalidate(); break;
    case 'text': drag={kind:'textclick',start:p}; break;
    case 'eraser': erasing=new Set(); drag={kind:'erase',last:p}; eraseAt(p,null); break;
  }
});
canvas.addEventListener('pointermove',e=>{
  if(e.pointerType==='touch'&&pointers.has(e.pointerId)) pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(drag&&drag.kind==='pinch'){ updatePinch(); return; }
  const p=ptr(e);
  if(e.pointerType!=='touch') sendCursor(p.wx,p.wy);
  if(!drag){
    if(tool==='select'&&!spaceDown){
      const h=hitHandle(p.sx,p.sy,e.pointerType);
      canvas.style.cursor=h?CURS[h]:(hitAny(p.wx,p.wy,e.pointerType)?'move':'default');
    }
    return;
  }
  switch(drag.kind){
    case 'pan': cam.x=drag.cx-(p.sx-drag.sx)/cam.z; cam.y=drag.cy-(p.sy-drag.sy)/cam.z; onViewChange(); break;
    case 'draw': {
      const evs=(e.getCoalescedEvents&&e.getCoalescedEvents())||[], list=evs.length?evs:[e], minD=1.2/cam.z;
      const k=1-clamp(defaults.stab,0,0.92);
      for(const ev of list){
        const q=ptr(ev), last=draft.pts[draft.pts.length-1];
        let pr=0;
        if(drag.pr){
          if(ev.pointerType==='pen'&&ev.pressure>0) pr=clamp(ev.pressure,0.1,1);
          else{ // เมาส์/นิ้ว: ช้า = หนา เร็ว = บาง
            const dt=Math.max(1,ev.timeStamp-drag.lt), v=Math.hypot(q.sx-drag.lsx,q.sy-drag.lsy)/dt;
            pr=drag.lp*0.8+clamp(1.05-v*0.4,0.25,1)*0.2;
          }
          drag.lp=pr; drag.lt=ev.timeStamp; drag.lsx=q.sx; drag.lsy=q.sy;
        }
        drag.sx+=(q.wx-drag.sx)*k; drag.sy+=(q.wy-drag.sy)*k;
        const wx=k<1?drag.sx:q.wx, wy=k<1?drag.sy:q.wy;
        if(Math.hypot(wx-last[0],wy-last[1])>=minD) draft.pts.push(drag.pr?[r2(wx),r2(wy),r2(pr)]:[r2(wx),r2(wy)]);
      }
      scheduleDraft(); invalidate(); break;
    }
    case 'shape': {
      let x2=p.wx,y2=p.wy; const x1=drag.x0,y1=drag.y0;
      if(e.shiftKey){
        if(draft.type==='line'||draft.type==='arrow'){
          const d=Math.hypot(x2-x1,y2-y1), a=Math.round(Math.atan2(y2-y1,x2-x1)/(Math.PI/12))*(Math.PI/12);
          x2=x1+d*Math.cos(a); y2=y1+d*Math.sin(a);
        } else {
          const d=Math.max(Math.abs(x2-x1),Math.abs(y2-y1));
          x2=x1+(x2<x1?-d:d); y2=y1+(y2<y1?-d:d);
        }
      }
      if(draft.type==='line'||draft.type==='arrow'){ draft.x2=x2; draft.y2=y2; }
      else{ draft.x=Math.min(x1,x2); draft.y=Math.min(y1,y2); draft.w=Math.abs(x2-x1); draft.h=Math.abs(y2-y1); }
      scheduleDraft(); invalidate(); break;
    }
    case 'move': {
      if(!drag.moved&&Math.hypot(p.sx-drag.start.sx,p.sy-drag.start.sy)<3) return;
      drag.moved=true;
      const dx=p.wx-drag.start.wx, dy=p.wy-drag.start.wy;
      liveMap=new Map(); for(const id of sel){ const o=byId.get(id); if(o) liveMap.set(id,moveObj(o,dx,dy)); }
      invalidate(); break;
    }
    case 'resize': {
      const b=drag.b, h=drag.h, w0=b[2]-b[0], h0=b[3]-b[1], px=p.wx-drag.ox, py=p.wy-drag.oy;
      let sx=1,sy=1,ax=b[0],ay=b[1];
      if(h.includes('e')&&w0>1e-6){ ax=b[0]; sx=(px-ax)/w0; }
      else if(h.includes('w')&&w0>1e-6){ ax=b[2]; sx=(ax-px)/w0; }
      if(h.includes('s')&&h0>1e-6){ ay=b[1]; sy=(py-ay)/h0; }
      else if(h.includes('n')&&h0>1e-6){ ay=b[3]; sy=(ay-py)/h0; }
      if(e.shiftKey&&h.length===2){ const s=Math.max(Math.abs(sx),Math.abs(sy)); sx=(sx<0?-1:1)*s; sy=(sy<0?-1:1)*s; }
      if(Math.abs(sx)<0.01) sx=(sx<0?-1:1)*0.01;
      if(Math.abs(sy)<0.01) sy=(sy<0?-1:1)*0.01;
      liveMap=new Map(); for(const id of sel){ const o=byId.get(id); if(o) liveMap.set(id,scaleObj(o,ax,ay,sx,sy)); }
      invalidate(); break;
    }
    case 'marquee': {
      drag.rect={x0:drag.start.wx,y0:drag.start.wy,x1:p.wx,y1:p.wy};
      const q=drag.rect, a=Math.min(q.x0,q.x1), b=Math.min(q.y0,q.y1), c=Math.max(q.x0,q.x1), d=Math.max(q.y0,q.y1);
      const ns=new Set(drag.base);
      for(const o of objs){ const bb=bboxOf(o); if(bb[2]>=a&&bb[0]<=c&&bb[3]>=b&&bb[1]<=d) ns.add(o.id); }
      sel=ns; invalidate(); break;
    }
    case 'imgmove': {
      if(!drag.moved&&Math.hypot(p.sx-drag.start.sx,p.sy-drag.start.sy)<3) return;
      drag.moved=true; drag.im.x=drag.ox+(p.wx-drag.start.wx); drag.im.y=drag.oy+(p.wy-drag.start.wy); invalidate(); break;
    }
    case 'imgresize': {
      const o=drag.o, h=drag.h, im=drag.im, MIN=8, px=p.wx-drag.ox, py=p.wy-drag.oy;
      if(h.length===2){
        const ax=h.includes('w')?o.x+o.w:o.x, ay=h.includes('n')?o.y+o.h:o.y;
        const dx=px-ax, dy=py-ay;
        if(e.shiftKey){
          im.x=Math.min(ax,px); im.y=Math.min(ay,py); im.w=Math.max(MIN,Math.abs(dx)); im.h=Math.max(MIN,Math.abs(dy));
        } else {
          const s=Math.max(Math.abs(dx)/o.w,Math.abs(dy)/o.h,MIN/Math.min(o.w,o.h));
          const nw=o.w*s, nh=o.h*s;
          im.w=nw; im.h=nh; im.x=h.includes('w')?ax-nw:ax; im.y=h.includes('n')?ay-nh:ay;
        }
      } else {
        let x0=o.x,y0=o.y,x1=o.x+o.w,y1=o.y+o.h;
        if(h==='e') x1=Math.max(x0+MIN,px); if(h==='w') x0=Math.min(x1-MIN,px);
        if(h==='s') y1=Math.max(y0+MIN,py); if(h==='n') y0=Math.min(y1-MIN,py);
        im.x=x0; im.y=y0; im.w=x1-x0; im.h=y1-y0;
      }
      invalidate(); break;
    }
    case 'erase': eraseAt(p,drag.last); drag.last=p; break;
  }
});
function tapSelect(p,type){
  const now=performance.now(), prev=lastTap;
  lastTap={t:now,x:p.sx,y:p.sy};
  if(prev&&now-prev.t<380&&Math.hypot(p.sx-prev.x,p.sy-prev.y)<14){
    lastTap=null;
    const hit=hitAny(p.wx,p.wy,type);
    if(hit&&hit.kind==='obj'&&hit.o.type==='text') openEditor(hit.o.x,hit.o.y,hit.o);
    else if(!hit) openEditor(p.wx,p.wy,null);
  }
}
function endPointer(e,cancel){
  if(e.pointerType==='touch'){
    pointers.delete(e.pointerId);
    if(drag&&drag.kind==='pinch'){ if(pointers.size<2) drag=null; if(pointers.size===0) ignoreTouch=false; return; }
    if(ignoreTouch){ if(pointers.size===0) ignoreTouch=false; return; }
  }
  if(!drag) return;
  const d=drag, p=ptr(e); drag=null;
  if(cancel){
    if(draft) endDraftBroadcast(draft.id);
    draft=null; liveMap=null; erasing=new Set(); updateCursor(); updateUI(); invalidate();
    if(d.kind==='imgmove'||d.kind==='imgresize') updateRefsUI();
    return;
  }
  switch(d.kind){
    case 'pan': updateCursor(); break;
    case 'draw':
      if(draft){ const o=finishNew(draft); draft=null; endDraftBroadcast(o.id); commitOps([{t:'add',o}]); }
      break;
    case 'shape': {
      const o=draft; draft=null; endDraftBroadcast(o&&o.id);
      if(o){
        const min=3/cam.z;
        const ok=(o.type==='line'||o.type==='arrow')?Math.hypot(o.x2-o.x1,o.y2-o.y1)>min:(o.w>min||o.h>min);
        if(ok) commitOps([{t:'add',o:finishNew(o)}]); else invalidate();
      }
      break;
    }
    case 'move':
      if(d.moved&&liveMap){ const ops=[...liveMap.values()].map(o=>({t:'upd',o})); liveMap=null; commitOps(ops); }
      else { liveMap=null; tapSelect(p,e.pointerType); invalidate(); }
      break;
    case 'resize':
      if(liveMap){ const ops=[...liveMap.values()].map(o=>({t:'upd',o})); liveMap=null; commitOps(ops); }
      break;
    case 'marquee':
      if(Math.hypot(p.sx-d.start.sx,p.sy-d.start.sy)<4) tapSelect(p,e.pointerType);
      updateUI(); invalidate(); break;
    case 'imgmove':
      if(d.moved) saveImg(d.im); else tapSelect(p,e.pointerType);
      updateRefsUI(); break;
    case 'imgresize': saveImg(d.im); updateRefsUI(); break;
    case 'erase':
      if(erasing.size){ const ids=[...erasing]; erasing=new Set(); commitOps(ids.map(id=>({t:'del',id}))); } else invalidate();
      break;
    case 'textclick':
      if(Math.hypot(p.sx-d.start.sx,p.sy-d.start.sy)<6){
        const o=topObj(p.wx,p.wy,e.pointerType);
        if(o&&o.type==='text') openEditor(o.x,o.y,o); else openEditor(p.wx,p.wy,null);
      }
      break;
  }
}
canvas.addEventListener('pointerup',e=>endPointer(e,false));
canvas.addEventListener('pointercancel',e=>endPointer(e,true));
canvas.addEventListener('wheel',e=>{
  e.preventDefault();
  const p=ptr(e), mul=e.deltaMode===1?16:1, dx=e.deltaX*mul, dy=e.deltaY*mul;
  if(e.ctrlKey||e.metaKey||wheelZoom){
    const f=(e.ctrlKey&&Math.abs(dy)<40)?0.01:0.0016;
    zoomAt(Math.exp(-dy*f),p.sx,p.sy);
  } else {
    if(e.shiftKey&&!dx){ cam.x+=dy/cam.z; } else { cam.x+=dx/cam.z; cam.y+=dy/cam.z; }
    onViewChange();
  }
},{passive:false});

/* ---------- text editing ---------- */
function openEditor(x,y,existing){
  commitText();
  editing={x,y,orig:existing||null,size:existing?existing.size:defaults.size,font:existing?existing.font:defaults.font,stroke:existing?existing.stroke:defaults.stroke,op:existing?(existing.op==null?1:existing.op):defaults.op};
  editingId=existing?existing.id:null;
  ted.value=existing?existing.text:'';
  ted.hidden=false; layoutEditor(); invalidate(); updateUI();
  setTimeout(()=>{ ted.focus(); },0);
}
function layoutEditor(){
  if(!editing) return;
  const z=cam.z, m=measureText({font:editing.font,size:editing.size,text:ted.value||' '});
  ted.style.left=((editing.x-cam.x)*z)+'px'; ted.style.top=((editing.y-cam.y)*z)+'px';
  ted.style.fontSize=(editing.size*z)+'px'; ted.style.fontFamily=FONTS[editing.font]||FONTS.sans; ted.style.lineHeight='1.3';
  ted.style.color=col(editing.stroke); ted.style.opacity=String(editing.op);
  ted.style.width=(m.w*z+editing.size*z*0.8+4)+'px'; ted.style.height=(m.h*z+4)+'px';
}
function commitText(){
  if(!editing) return;
  const e=editing; editing=null; editingId=null;
  const text=ted.value.replace(/\s+$/,''); ted.hidden=true; ted.value='';
  if(e.orig){
    const cur=byId.get(e.orig.id);
    if(cur){
      if(!text) commitOps([{t:'del',id:cur.id}]);
      else if(text!==cur.text) commitOps([{t:'upd',o:{...cur,text}}]);
    }
  } else if(text){
    commitOps([{t:'add',o:{id:uid(),type:'text',x:e.x,y:e.y,text,size:e.size,font:e.font,stroke:e.stroke,op:e.op,z:nextZ(),by:clientId}}]);
  }
  invalidate(); updateUI();
}
ted.addEventListener('input',layoutEditor);
ted.addEventListener('blur',commitText);

/* ---------- style panel ---------- */
function sections(){
  const types=new Set();
  for(const id of sel){ const o=byId.get(id); if(o) types.add(o.type); }
  const has=(...a)=>a.some(x=>types.has(x)||(!sel.size&&!selImg&&tool===x));
  const shapes=['rect','ellipse','diamond'];
  const stroke=has('pen','hl','line','arrow','text',...shapes);
  return {
    stroke, onlyText:stroke&&has('text')&&!has('pen','hl','line','arrow',...shapes),
    brush:has('pen'), size:has('pen','hl'), stab:!sel.size&&!selImg&&(tool==='pen'||tool==='hl'),
    fill:has(...shapes), width:has('line','arrow',...shapes),
    dash:has('line','arrow',...shapes), text:has('text'), op:stroke, actions:sel.size>0
  };
}
function curVal(key){
  for(const id of sel){ const o=byId.get(id); if(o&&o[key]!==undefined) return o[key]; }
  return defaults[key];
}
function applyProp(key,val){
  defaults[key]=val;
  if(editing){ if(key in editing) editing[key]=val; layoutEditor(); }
  if(sel.size){
    const ops=[];
    for(const id of sel){ const o=byId.get(id); if(o&&o[key]!==undefined&&o[key]!==val) ops.push({t:'upd',o:{...o,[key]:val}}); }
    if(ops.length) commitOps(ops);
  }
  updateUI(); invalidate(); saveSoon();
}
function selectedObjs(){ const l=[]; for(const o of objs) if(sel.has(o.id)) l.push(o); return l; }
function act(a){
  if(!sel.size) return;
  const list=selectedObjs();
  if(a==='del') commitOps(list.map(o=>({t:'del',id:o.id})));
  else if(a==='dup') dupSelected(24);
  else if(a==='front') commitOps(list.map(o=>({t:'upd',o:{...o,z:nextZ()}})));
  else if(a==='back'){ const minZ=objs.length?objs[0].z:Date.now(); commitOps(list.map((o,i)=>({t:'upd',o:{...o,z:minZ-list.length+i}}))); }
}
function dupSelected(off){
  const src=selectedObjs(); if(!src.length) return;
  const copies=src.map(o=>({...moveObj(o,off,off),id:uid(),z:nextZ(),by:clientId}));
  commitOps(copies.map(o=>({t:'add',o}))); sel=new Set(copies.map(o=>o.id)); updateUI(); invalidate();
}
/* ---------- color wheel / swatches / eyedropper ---------- */
let recents=[]; try{ recents=JSON.parse(lsGet('gr-recent','[]')).filter(c=>/^#[0-9a-f]{6}$/.test(c)).slice(0,12); }catch(e){ recents=[]; }
function addRecent(hex){
  if(!/^#[0-9a-f]{6}$/.test(hex)) return;
  recents=[hex,...recents.filter(c=>c!==hex)].slice(0,12); lsSet('gr-recent',JSON.stringify(recents)); renderRecents();
}
function renderRecents(){
  const row=$('#recentRow'); if(!row) return;
  const key=recents.join(',')+'|'+curVal('stroke'); if(row.dataset.k===key) return; row.dataset.k=key;
  row.innerHTML=recents.map(c=>`<button type="button" class="sw sm" data-prop="stroke" data-val="${c}" title="${c}" aria-label="สี ${c}" aria-pressed="${c===curVal('stroke')}" style="--c:${c}"></button>`).join('');
}
const hex2=n=>Math.round(clamp(n,0,255)).toString(16).padStart(2,'0');
function hsv2hex(h,s,v){
  const f=(n,k=(n+h/60)%6)=>v-v*s*Math.max(0,Math.min(k,4-k,1));
  return '#'+hex2(f(5)*255)+hex2(f(3)*255)+hex2(f(1)*255);
}
function hex2hsv(hex){
  let h=String(hex).replace('#',''); if(h.length===3) h=h.split('').map(x=>x+x).join('');
  const r=parseInt(h.slice(0,2),16)/255,g=parseInt(h.slice(2,4),16)/255,b=parseInt(h.slice(4,6),16)/255;
  if([r,g,b].some(Number.isNaN)) return null;
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn; let hh=0;
  if(d){ if(mx===r) hh=((g-b)/d)%6; else if(mx===g) hh=(b-r)/d+2; else hh=(r-g)/d+4; hh*=60; if(hh<0) hh+=360; }
  return {h:hh,s:mx?d/mx:0,v:mx};
}
const wheel={el:null,prop:'stroke',h:200,s:0.7,v:0.9,pick:null};
function buildWheel(){
  const el=document.createElement('div'); el.id='cpop'; el.className='bar'; el.hidden=true; el.setAttribute('role','dialog'); el.setAttribute('aria-label','จานสี');
  el.innerHTML=`
    <header><b id="cpTitle">จานสี</b><button type="button" class="btn sm" id="cpClose" aria-label="ปิดจานสี"><span data-icon="x"></span></button></header>
    <canvas id="cpSV" width="228" height="150" aria-label="เลือกความสดและความสว่าง"></canvas>
    <input id="cpHue" type="range" min="0" max="359" value="200" aria-label="เฉดสี">
    <div class="cprow"><i id="cpPrev"></i><input id="cpHex" class="field" type="text" maxlength="7" spellcheck="false" aria-label="รหัสสี hex" value="#000000">
      <button type="button" class="tbtn" id="cpEye" title="ดูดสีจากกระดาน (หรือกด Alt ค้างแล้วคลิก)">ดูดสี</button></div>
    <div class="cpsw" id="cpSw">${SWATCHES.map(([n,l])=>`<div class="small">${n}</div><div class="sw-row">${l.map(c=>`<button type="button" class="sw sm" data-hex="${c}" title="${c}" aria-label="${c}" style="--c:${c}"></button>`).join('')}</div>`).join('')}</div>`;
  document.body.appendChild(el); wheel.el=el;
  $('#cpClose').innerHTML=svg('x',18);
  const sv=$('#cpSV'), hue=$('#cpHue'), hexIn=$('#cpHex');
  const apply=(live)=>{
    const hx=hsv2hex(wheel.h,wheel.s,wheel.v);
    hexIn.value=hx; $('#cpPrev').style.background=hx; drawSV();
    if(wheel.prop==='stroke'||wheel.prop==='fill') liveProp(wheel.prop,hx);
    if(!live) endLive(hx);
  };
  const svPos=e=>{ const r=sv.getBoundingClientRect(); wheel.s=clamp((e.clientX-r.left)/r.width,0,1); wheel.v=1-clamp((e.clientY-r.top)/r.height,0,1); apply(true); };
  sv.addEventListener('pointerdown',e=>{ sv.setPointerCapture(e.pointerId); wheel.drag=true; svPos(e); });
  sv.addEventListener('pointermove',e=>{ if(wheel.drag) svPos(e); });
  const up=()=>{ if(wheel.drag){ wheel.drag=false; apply(false); } };
  sv.addEventListener('pointerup',up); sv.addEventListener('pointercancel',up);
  hue.addEventListener('input',()=>{ wheel.h=Number(hue.value); apply(true); });
  hue.addEventListener('change',()=>apply(false));
  hexIn.addEventListener('change',()=>{
    let v=hexIn.value.trim(); if(v[0]!=='#') v='#'+v;
    const q=hex2hsv(v); if(!q||!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)){ hexIn.value=hsv2hex(wheel.h,wheel.s,wheel.v); return; }
    wheel.h=q.h; wheel.s=q.s; wheel.v=q.v; hue.value=String(Math.round(q.h)); apply(false);
  });
  $('#cpSw').addEventListener('click',e=>{
    const b=e.target.closest('[data-hex]'); if(!b) return;
    const q=hex2hsv(b.dataset.hex); wheel.h=q.h; wheel.s=q.s; wheel.v=q.v; hue.value=String(Math.round(q.h)); hexIn.value=b.dataset.hex; $('#cpPrev').style.background=b.dataset.hex; drawSV();
    liveProp(wheel.prop,b.dataset.hex); endLive(b.dataset.hex);
  });
  $('#cpClose').addEventListener('click',closeWheel);
  $('#cpEye').addEventListener('click',()=>{ closeWheel(); startPick(wheel.prop); });
}
function drawSV(){
  const cv=$('#cpSV'), c=cv.getContext('2d'), w=cv.width, h=cv.height;
  c.fillStyle=hsv2hex(wheel.h,1,1); c.fillRect(0,0,w,h);
  let g=c.createLinearGradient(0,0,w,0); g.addColorStop(0,'#fff'); g.addColorStop(1,'rgba(255,255,255,0)'); c.fillStyle=g; c.fillRect(0,0,w,h);
  g=c.createLinearGradient(0,0,0,h); g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'#000'); c.fillStyle=g; c.fillRect(0,0,w,h);
  const x=wheel.s*w, y=(1-wheel.v)*h;
  c.lineWidth=2; c.strokeStyle='#fff'; c.beginPath(); c.arc(x,y,7,0,Math.PI*2); c.stroke();
  c.lineWidth=1; c.strokeStyle='rgba(0,0,0,.55)'; c.beginPath(); c.arc(x,y,8.5,0,Math.PI*2); c.stroke();
}
function liveProp(key,val){
  defaults[key]=val;
  if(editing){ if(key in editing) editing[key]=val; layoutEditor(); }
  if(sel.size){ liveMap=new Map(); for(const id of sel){ const o=byId.get(id); if(o&&o[key]!==undefined) liveMap.set(id,{...o,[key]:val}); } }
  invalidate(); $('#curStroke i').style.background=col(defaults.stroke);
}
function endLive(hex){ commitLive(); addRecent(hex); updateUI(); saveSoon(); }
function openWheel(prop,anchor){
  if(!wheel.el) buildWheel();
  wheel.prop=prop; $('#cpTitle').textContent=prop==='fill'?'จานสี · สีพื้น':'จานสี · สีเส้น';
  const cur=curVal(prop), hx=(cur&&cur!=='ink'&&cur!=='none')?cur:col('ink');
  const q=hex2hsv(/^#[0-9a-f]{3,6}$/i.test(hx)?hx:'#1b2130')||{h:200,s:0.7,v:0.9};
  wheel.h=q.h; wheel.s=q.s; wheel.v=q.v; $('#cpHue').value=String(Math.round(q.h));
  $('#cpHex').value=hsv2hex(q.h,q.s,q.v); $('#cpPrev').style.background=$('#cpHex').value;
  wheel.el.hidden=false; drawSV();
  const r=P.getBoundingClientRect(), W=innerWidth;
  if(W<=720){ wheel.el.style.left='8px'; wheel.el.style.right='8px'; wheel.el.style.top='auto'; wheel.el.style.bottom='64px'; }
  else{ wheel.el.style.right='auto'; wheel.el.style.bottom='auto'; wheel.el.style.left=Math.min(r.right+10,W-270)+'px'; wheel.el.style.top=Math.max(8,r.top)+'px'; }
}
function closeWheel(){ if(wheel.el) wheel.el.hidden=true; }
let pickMode=null;
function startPick(prop){ pickMode=prop||'stroke'; canvas.style.cursor='crosshair'; toast('คลิกบนกระดานเพื่อดูดสี (Esc ยกเลิก)'); }
function pickColorAt(p){
  const dpr=window.devicePixelRatio||1;
  try{
    const d=ctx.getImageData(Math.round(p.sx*dpr),Math.round(p.sy*dpr),1,1).data;
    if(d[3]<255) return null;
    return '#'+hex2(d[0])+hex2(d[1])+hex2(d[2]);
  }catch(e){ return null; }
}
function buildPanel(){
  const sw=(prop,val,label,cls)=>`<button type="button" class="sw ${cls||''}" data-prop="${prop}" data-val="${val}" title="${label}" aria-label="${label}" aria-pressed="false" style="--c:${val==='ink'||val==='none'?'transparent':val}"></button>`;
  P.innerHTML=`
  <section data-sec="brush"><h4>พู่กัน <span id="brushLbl" class="val"></span></h4><div class="brushes" id="brushGrid">${BRUSH_IDS.map(b=>`<button type="button" class="brush" data-brush="${b}" aria-pressed="false" title="${BRUSHES[b].n}" aria-label="${BRUSHES[b].n}"><canvas width="96" height="34"></canvas><span>${BRUSHES[b].n}</span></button>`).join('')}</div></section>
  <section data-sec="stroke"><h4 id="strokeLbl">สีเส้น</h4>
    <div class="colrow"><button type="button" class="curcol" id="curStroke" data-wheel="stroke" title="เปิดจานสี" aria-label="เปิดจานสีสำหรับสีเส้น"><i></i></button><div class="sw-row" id="quickStroke">${PALETTE.map(([c,n])=>sw('stroke',c,n,c==='ink'?'ink':'')).join('')}</div></div>
    <div class="sw-row recent" id="recentRow" aria-label="สีที่ใช้ล่าสุด"></div></section>
  <section data-sec="fill"><h4>สีพื้น</h4><div class="sw-row">${sw('fill','none','ไม่มีสีพื้น','none')}${PALETTE.map(([c,n])=>sw('fill',c,n,c==='ink'?'ink':'')).join('')}<button type="button" class="sw more" data-wheel="fill" title="เลือกสีอื่น" aria-label="เลือกสีพื้นจากจานสี">+</button></div></section>
  <section data-sec="size"><h4>ขนาดพู่กัน <span id="swLbl" class="val">4</span></h4><input id="swIn" class="rng" type="range" min="1" max="80" step="1" value="4" aria-label="ขนาดพู่กัน"><div class="sizeprev"><i id="sizeDot"></i></div></section>
  <section data-sec="stab"><h4>ความนิ่งของเส้น <span id="stabLbl" class="val">0%</span></h4><input id="stabIn" class="rng" type="range" min="0" max="90" step="5" value="0" aria-label="ความนิ่งของเส้น"></section>
  <section data-sec="width"><h4>ความหนาเส้น</h4><div class="seg">${WIDTHS.map(w=>`<button type="button" data-prop="sw" data-val="${w}" aria-pressed="false" aria-label="หนา ${w}" title="หนา ${w}"><svg width="28" height="14" aria-hidden="true"><line x1="4" y1="7" x2="24" y2="7" stroke="currentColor" stroke-width="${Math.max(1.2,w*0.8)}" stroke-linecap="round"/></svg></button>`).join('')}</div></section>
  <section data-sec="dash"><h4>ลายเส้น</h4><div class="seg">${[['solid','ทึบ',''],['dashed','ประ','6 5'],['dotted','จุด','0.1 5']].map(([v,n,da])=>`<button type="button" data-prop="dash" data-val="${v}" aria-pressed="false" aria-label="${n}" title="${n}"><svg width="28" height="14" aria-hidden="true"><line x1="3" y1="7" x2="25" y2="7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" ${da?`stroke-dasharray="${da}"`:''}/></svg></button>`).join('')}</div></section>
  <section data-sec="text"><h4>ขนาดตัวอักษร</h4><div class="seg">${SIZES.map(([v,n])=>`<button type="button" data-prop="size" data-val="${v}" aria-pressed="false">${n}</button>`).join('')}</div>
    <h4 style="margin-top:12px">แบบอักษร</h4><div class="seg"><button type="button" data-prop="font" data-val="hand" aria-pressed="false" style="font-family:${FONTS.hand}">ลายมือ Aa</button><button type="button" data-prop="font" data-val="sans" aria-pressed="false" style="font-family:${FONTS.sans}">ปกติ Aa</button></div></section>
  <section data-sec="op"><h4>ความทึบ <span id="opLbl" class="val">100%</span></h4><input id="opIn" type="range" min="10" max="100" step="5" value="100" aria-label="ความทึบ"></section>
  <section data-sec="actions"><h4>จัดการวัตถุที่เลือก</h4><div class="acts">
    <button type="button" class="tbtn" data-act="dup">ทำซ้ำ</button><button type="button" class="tbtn danger" data-act="del">ลบ</button>
    <button type="button" class="tbtn" data-act="front">นำขึ้นหน้า</button><button type="button" class="tbtn" data-act="back">ส่งไปหลัง</button></div></section>`;
  P.addEventListener('click',e=>{
    const b=e.target.closest('button'); if(!b) return;
    if(b.dataset.prop){ let v=b.dataset.val; if(b.dataset.prop==='sw'||b.dataset.prop==='size') v=Number(v); applyProp(b.dataset.prop,v); }
    else if(b.dataset.brush){ applyProp('br',b.dataset.brush); }
    else if(b.dataset.wheel){ openWheel(b.dataset.wheel,b); }
    else if(b.dataset.act) act(b.dataset.act);
    b.blur();
  });
  // ตัวเลื่อนแบบสดๆ: ค่าที่เลื่อนจะเห็นผลทันที แล้วบันทึกประวัติตอนปล่อย
  const liveSlider=(el,lbl,key,conv,fmt)=>{
    el.addEventListener('input',()=>{
      const v=conv(Number(el.value)); defaults[key]=v; lbl.textContent=fmt(v);
      if(sel.size){ liveMap=new Map(); for(const id of sel){ const o=byId.get(id); if(o&&o[key]!==undefined) liveMap.set(id,{...o,[key]:v}); } }
      updateSizeDot(); invalidate();
    });
    el.addEventListener('change',()=>{ commitLive(); saveSoon(); });
  };
  liveSlider($('#swIn'),$('#swLbl'),'sw',v=>v,v=>String(v));
  const stabIn=$('#stabIn'), stabLbl=$('#stabLbl');
  stabIn.addEventListener('input',()=>{ defaults.stab=Number(stabIn.value)/100; stabLbl.textContent=stabIn.value+'%'; });
  stabIn.addEventListener('change',saveSoon);
  const opIn=$('#opIn'), opLbl=$('#opLbl');
  opIn.addEventListener('input',()=>{
    const v=Number(opIn.value)/100; defaults.op=v; opLbl.textContent=opIn.value+'%';
    if(editing){ editing.op=v; layoutEditor(); }
    if(sel.size){ liveMap=new Map(); for(const id of sel){ const o=byId.get(id); if(o) liveMap.set(id,{...o,op:v}); } }
    invalidate();
  });
  opIn.addEventListener('change',()=>{ commitLive(); saveSoon(); });
}
function commitLive(){
  if(liveMap){ const ops=[...liveMap.values()].map(o=>({t:'upd',o})); liveMap=null; commitOps(ops); }
}
let prevKey='';
function updateSizeDot(){
  const d=$('#sizeDot'); if(!d) return;
  const s=Math.min(46,Math.max(2,curVal('sw')*((BRUSHES[curVal('br')]||BRUSHES.pen).bw)));
  d.style.width=d.style.height=s+'px'; d.style.background=col(curVal('stroke')==='none'?'ink':curVal('stroke'));
}
function drawBrushPreviews(){
  const color=col(curVal('stroke'));
  $$('.brush canvas',P).forEach(cv=>{
    const b=cv.parentNode.dataset.brush, c=cv.getContext('2d'), dpr=2;
    c.setTransform(1,0,0,1,0,0); c.clearRect(0,0,cv.width,cv.height); c.scale(cv.width/96,cv.height/34);
    const pts=[]; for(let i=0;i<=24;i++){ const t=i/24; pts.push([8+t*80,17+Math.sin(t*Math.PI*2)*7,0.25+0.7*Math.sin(t*Math.PI)]); }
    paintObj(c,{id:'pv'+b,type:'pen',br:b,stroke:color,sw:7,op:1,pts:BRUSHES[b].pr?pts:pts.map(q=>[q[0],q[1]])});
  });
}
function updatePanel(){
  const s=sections(), any=s.stroke||s.actions;
  P.hidden=!any; ptoggle.hidden=!any;
  $$('section',P).forEach(el=>{ el.hidden=!s[el.dataset.sec]; });
  $('#strokeLbl').textContent=s.onlyText?'สีตัวอักษร':'สีเส้น';
  $$('[data-prop]',P).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.val===String(curVal(b.dataset.prop)))));
  const op=Math.round(curVal('op')*100);
  $('#opIn').value=String(op); $('#opLbl').textContent=op+'%';
  const cb=curVal('br'), cs=curVal('stroke');
  $$('[data-brush]',P).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.brush===cb)));
  $('#brushLbl').textContent=(BRUSHES[cb]||BRUSHES.pen).n;
  const sw=Math.round(curVal('sw')); $('#swIn').value=String(sw); $('#swLbl').textContent=String(sw);
  $('#stabIn').value=String(Math.round(defaults.stab*100)); $('#stabLbl').textContent=Math.round(defaults.stab*100)+'%';
  $('#curStroke i').style.background=col(cs); $('#curStroke').classList.toggle('ink',cs==='ink');
  $$('#quickStroke [data-prop]',P).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.val===cs)));
  renderRecents(); updateSizeDot();
  if(s.brush){ const k=cs+themeKey; if(k!==prevKey){ prevKey=k; drawBrushPreviews(); } }
}

/* ---------- reference panel ---------- */
function openRefs(open){
  refsPanel.hidden=!open; $('#refsbtn').setAttribute('aria-pressed',String(open));
  if(open) P.classList.remove('open');
}
function renderRefs(){
  $('#refsTitle').textContent='รูปแบบ ('+imgs.length+')';
  refsList.innerHTML='';
  if(!imgs.length){
    const p=document.createElement('p'); p.className='small';
    p.textContent='ยังไม่มีรูปแบบ กด “เพิ่มรูป” ลากไฟล์มาวาง หรือกด Ctrl + V ตอนคัดลอกรูปไว้';
    refsList.appendChild(p); return;
  }
  for(const im of imgs){
    const el=document.createElement('div'); el.className='ref'; el.dataset.id=im.id;
    el.innerHTML=`<div class="ref-head"><img class="thumb" alt=""><span class="nm"></span></div>
      <label class="ref-row"><span>ความโปร่งใส</span><input type="range" min="0" max="95" step="5" data-k="tr"><output data-o="tr"></output></label>
      <label class="ref-row"><span>ขนาด</span><input type="range" min="5" max="400" step="1" data-k="sz"><output data-o="sz"></output></label>
      <div class="ref-btns">
        <button type="button" class="tbtn" data-a="sel">เลือก</button>
        <button type="button" class="tbtn" data-a="lock" aria-pressed="false">ล็อก</button>
        <button type="button" class="tbtn" data-a="hide" aria-pressed="false">ซ่อน</button>
        <button type="button" class="tbtn" data-a="over" aria-pressed="false">ทับเส้น</button>
        <button type="button" class="tbtn danger" data-a="del">ลบ</button>
      </div>`;
    $('.thumb',el).src=im.url; $('.nm',el).textContent=im.name;
    refsList.appendChild(el);
  }
  updateRefsUI();
}
function updateRefsUI(){
  for(const el of $$('.ref',refsList)){
    const im=getImg(el.dataset.id); if(!im) continue;
    el.classList.toggle('on',selImg===im.id);
    const tr=$('[data-k="tr"]',el), sz=$('[data-k="sz"]',el);
    const trv=Math.round((1-im.op)*100), szv=Math.round(im.w/im.nw*100);
    if(document.activeElement!==tr) tr.value=String(trv);
    if(document.activeElement!==sz) sz.value=String(clamp(szv,5,400));
    $('[data-o="tr"]',el).textContent=trv+'%'; $('[data-o="sz"]',el).textContent=szv+'%';
    $('[data-a="lock"]',el).setAttribute('aria-pressed',String(im.locked));
    $('[data-a="hide"]',el).setAttribute('aria-pressed',String(im.hidden));
    $('[data-a="over"]',el).setAttribute('aria-pressed',String(im.over));
  }
}
refsList.addEventListener('input',e=>{
  const r=e.target; if(!r.dataset||!r.dataset.k) return;
  const im=getImg(r.closest('.ref').dataset.id); if(!im) return;
  if(r.dataset.k==='tr') im.op=clamp(1-Number(r.value)/100,0.05,1);
  else scaleImg(im,Number(r.value)/100);
  updateRefsUI(); invalidate();
});
refsList.addEventListener('change',e=>{
  const r=e.target; if(!r.dataset||!r.dataset.k) return;
  const im=getImg(r.closest('.ref').dataset.id); if(im) saveImg(im);
});
refsList.addEventListener('click',e=>{
  const b=e.target.closest('button[data-a]'); if(!b) return;
  const im=getImg(b.closest('.ref').dataset.id); if(!im) return;
  const a=b.dataset.a;
  if(a==='sel'){
    if(im.locked){ toast('รูปนี้ล็อกอยู่ ปลดล็อกก่อนจึงจะย้ายหรือปรับขนาดได้'); }
    else{ setTool('select'); sel=new Set(); selImg=im.id; updateUI(); invalidate(); }
  }
  else if(a==='lock'){ im.locked=!im.locked; if(im.locked&&selImg===im.id) selImg=null; saveImg(im); }
  else if(a==='hide'){ im.hidden=!im.hidden; if(im.hidden&&selImg===im.id) selImg=null; saveImg(im); }
  else if(a==='over'){ im.over=!im.over; saveImg(im); }
  else if(a==='del'){ removeImg(im); toast('ลบรูปแบบแล้ว'); return; }
  updateRefsUI(); updateUI(); invalidate();
  b.blur();
});
$('#refsAdd').addEventListener('click',()=>$('#imgIn').click());
$('#refsClose').addEventListener('click',()=>openRefs(false));
$('#refsbtn').addEventListener('click',e=>{ openRefs(refsPanel.hidden); e.currentTarget.blur(); });
$('#imgIn').addEventListener('change',async e=>{
  const files=[...(e.target.files||[])]; e.target.value='';
  for(const f of files.slice(0,10)) await importImage(f,null);
});

/* ---------- people / room UI ---------- */
function initial(name){
  const w=String(name||'?').trim().split(/\s+/), last=w[w.length-1];
  if(/^\d+$/.test(last)) return last.slice(-2);
  return (Array.from(w[0])[0]||'?').toUpperCase();
}
function avatar(name,color){
  const d=document.createElement('span'); d.className='av'; d.style.background=color; d.textContent=initial(name); d.title=name; return d;
}
function updatePeopleUI(){
  const all=[{id:tabId,name:me.name,color:me.color,you:true}];
  for(const [id,p] of net.online) if(id!==tabId) all.push({id,name:p.name,color:p.color});
  const n=net.sb?all.length:1;
  $('#cnt').textContent=n+' คน';
  const avs=$('#avs'); avs.innerHTML='';
  all.slice(0,4).forEach(p=>avs.appendChild(avatar(p.name,p.color)));
  const who=$('#whoList'); if(who){
    who.innerHTML='';
    all.forEach(p=>{ const li=document.createElement('li'); li.appendChild(avatar(p.name,p.color)); const s=document.createElement('span'); s.textContent=p.name+(p.you?' (คุณ)':''); li.appendChild(s); who.appendChild(li); });
  }
}
function buildRoomModal(){
  const row=$('#colorRow');
  row.innerHTML=USER_COLORS.map(c=>`<button type="button" class="sw" data-ucolor="${c}" aria-label="สี ${c}" aria-pressed="false" style="--c:${c}"></button>`).join('');
  row.addEventListener('click',e=>{
    const b=e.target.closest('[data-ucolor]'); if(!b) return;
    me.color=b.dataset.ucolor; lsSet('gr-color',me.color); syncMe();
  });
  $('#nameIn').addEventListener('input',e=>{
    const v=e.target.value.trim().slice(0,24); if(!v) return;
    me.name=v; lsSet('gr-name',v); syncMe();
  });
  $('#boardGo').addEventListener('click',goBoard);
  $('#boardIn').addEventListener('keydown',e=>{ if(e.key==='Enter') goBoard(); });
  $('#linkCopy').addEventListener('click',async()=>{
    const box=$('#linkIn');
    try{ await navigator.clipboard.writeText(box.value); toast('คัดลอกลิงก์แล้ว ส่งให้เพื่อนได้เลย'); }
    catch(e){ box.focus(); box.select(); toast('กด Ctrl+C เพื่อคัดลอกลิงก์'); }
  });
  $('#clearMine').addEventListener('click',()=>{
    const mine=objs.filter(o=>o.by===clientId);
    if(!mine.length){ toast('ยังไม่มีเส้นที่คุณวาด'); return; }
    commitOps(mine.map(o=>({t:'del',id:o.id}))); closeModals(); toast('ลบเส้นของคุณแล้ว '+mine.length+' ชิ้น');
  });
}
function syncMe(){
  $$('[data-ucolor]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.ucolor===me.color)));
  if(net.ch&&net.joined){ try{ net.ch.track({name:me.name,color:me.color}); }catch(e){} }
  updatePeopleUI();
}
function goBoard(){
  const v=$('#boardIn').value.toLowerCase().replace(/[^\p{L}\p{M}\p{N}_-]/gu,'').slice(0,40);
  if(!v||v===BOARD){ closeModals(); return; }
  const u=new URL(location.href); u.searchParams.set('board',v); location.href=u.toString();
}
function openRoom(){
  openModal('roomM');
  $('#nameIn').value=me.name; $('#boardIn').value=BOARD;
  const u=new URL(location.href); u.searchParams.set('board',BOARD); u.hash='';
  $('#linkIn').value=u.toString();
  syncMe();
}

/* ---------- export ---------- */
function exportCanvas(transparent,withRefs){
  const list=objs.slice(), us=withRefs?imgs.filter(i=>!i.hidden&&i.el):[];
  if(!list.length&&!us.length) return null;
  let b=list.length?unionBBox(list):null;
  for(const im of us){ const ib=[im.x,im.y,im.x+im.w,im.y+im.h]; b=b?[Math.min(b[0],ib[0]),Math.min(b[1],ib[1]),Math.max(b[2],ib[2]),Math.max(b[3],ib[3])]:ib; }
  const pad=32, w=b[2]-b[0]+pad*2, h=b[3]-b[1]+pad*2, scale=Math.min(3,4096/Math.max(w,h));
  const c=document.createElement('canvas');
  c.width=Math.max(1,Math.round(w*scale)); c.height=Math.max(1,Math.round(h*scale));
  const x=c.getContext('2d');
  if(!transparent){ x.fillStyle=T.bg; x.fillRect(0,0,c.width,c.height); }
  x.setTransform(scale,0,0,scale,(-b[0]+pad)*scale,(-b[1]+pad)*scale);
  inkOverride=transparent?'#1b2130':null;
  try{
    if(withRefs) for(const im of us) if(!im.over){ x.save(); x.globalAlpha=im.op; x.drawImage(im.el,im.x,im.y,im.w,im.h); x.restore(); }
    for(const o of list) paintObj(x,o,1);
    if(withRefs) for(const im of us) if(im.over){ x.save(); x.globalAlpha=im.op; x.drawImage(im.el,im.x,im.y,im.w,im.h); x.restore(); }
  } finally { inkOverride=null; }
  return c;
}
function refreshExport(){
  const c=exportCanvas($('#transChk').checked,$('#refsChk').checked), img=$('#expimg');
  if(c){ try{ img.src=c.toDataURL('image/png'); img.hidden=false; $('#expEmpty').hidden=true; }catch(e){ img.hidden=true; } }
  else { img.hidden=true; img.removeAttribute('src'); $('#expEmpty').hidden=false; }
  $('#copyImg').disabled=!c; $('#dlImg').disabled=!c;
}
function toBlob(c){ return new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error('blob')),'image/png')); }

/* ---------- modals / toast ---------- */
let toastT=0;
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('on'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('on'),2800); }
function openModal(id){
  if(editing) commitText();
  closeModals();
  const m=$('#'+id); m.hidden=false;
  const c=$('[data-close]',m); if(c) c.focus();
}
function closeModals(){ $$('.modal').forEach(m=>{ m.hidden=true; }); }
$$('.modal').forEach(m=>{
  m.addEventListener('pointerdown',e=>{ if(e.target===m) closeModals(); });
  $('[data-close]',m).addEventListener('click',closeModals);
});

/* ---------- ui state ---------- */
function updateUI(){
  $$('#tools [data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool)));
  $('#undo').disabled=!undoStack.length; $('#redo').disabled=!redoStack.length;
  $('#gridbtn').setAttribute('aria-pressed',String(grid));
  $('#zoomlbl').textContent=Math.round(cam.z*100)+'%';
  hint.hidden=!ready||objs.length>0||imgs.length>0||!!editing||tool==='text';
  updatePanel(); updateRefsUI(); updatePeopleUI();
}

/* ---------- keyboard / paste / drop ---------- */
window.addEventListener('keydown',e=>{
  const t=e.target, tag=t&&t.tagName;
  if(e.key==='Escape'&&$$('.modal').some(m=>!m.hidden)){ closeModals(); return; }
  if(t===ted){
    if(e.key==='Escape'){ e.preventDefault(); commitText(); }
    else if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){ e.preventDefault(); commitText(); }
    return;
  }
  if(tag==='INPUT'||tag==='TEXTAREA') return;
  if($$('.modal').some(m=>!m.hidden)) return;
  const mod=e.ctrlKey||e.metaKey, W=stage.clientWidth, H=stage.clientHeight;
  if(e.code==='Space'){ e.preventDefault(); if(!spaceDown){ spaceDown=true; updateCursor(); } return; }
  if(mod){
    switch(e.code){
      case 'KeyZ': e.preventDefault(); if(e.shiftKey) redo(); else undo(); return;
      case 'KeyY': e.preventDefault(); redo(); return;
      case 'KeyA': e.preventDefault(); setTool('select'); sel=new Set(objs.map(o=>o.id)); updateUI(); invalidate(); return;
      case 'KeyD': e.preventDefault(); dupSelected(24); return;
      case 'KeyC': case 'KeyX':
        if(sel.size){ clip=selectedObjs(); pasteN=0; if(e.code==='KeyX') act('del'); e.preventDefault(); }
        return;
      case 'Digit0': e.preventDefault(); zoomAt(1/cam.z,W/2,H/2); return;
    }
    return;
  }
  for(const k in TOOL_INFO) if(TOOL_INFO[k][2]===e.code){ setTool(k); return; }
  switch(e.code){
    case 'KeyI': $('#imgIn').click(); return;
    case 'KeyG': grid=!grid; updateUI(); invalidate(); saveSoon(); return;
    case 'Delete': case 'Backspace':
      if(selImg){ const im=getImg(selImg); if(im){ e.preventDefault(); removeImg(im); toast('ลบรูปแบบแล้ว'); } }
      else if(sel.size){ e.preventDefault(); act('del'); }
      return;
    case 'KeyB': setTool('pen'); return;
    case 'Escape': if(pickMode){ pickMode=null; updateCursor(); return; } if(wheel.el&&!wheel.el.hidden){ closeWheel(); return; } if(sel.size||selImg){ sel=new Set(); selImg=null; updateUI(); invalidate(); } else setTool('select'); return;
    case 'Equal': case 'NumpadAdd': zoomAt(1.25,W/2,H/2); return;
    case 'Minus': case 'NumpadSubtract': zoomAt(1/1.25,W/2,H/2); return;
    case 'Digit1': if(e.shiftKey){ fitView(); } return;
    case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown': {
      if(!sel.size||tool!=='select') return;
      e.preventDefault();
      const s=e.shiftKey?20:2, dx=e.code==='ArrowLeft'?-s:e.code==='ArrowRight'?s:0, dy=e.code==='ArrowUp'?-s:e.code==='ArrowDown'?s:0;
      commitOps(selectedObjs().map(o=>({t:'upd',o:moveObj(o,dx,dy)}))); return;
    }
  }
});
window.addEventListener('keyup',e=>{ if(e.code==='Space'){ spaceDown=false; updateCursor(); } });
window.addEventListener('blur',()=>{ spaceDown=false; updateCursor(); });
window.addEventListener('paste',e=>{
  const t=e.target, tag=t&&t.tagName;
  if(t===ted||tag==='INPUT'||tag==='TEXTAREA') return;
  const items=[...((e.clipboardData&&e.clipboardData.items)||[])].filter(i=>i.kind==='file'&&/^image\//.test(i.type));
  if(items.length){ e.preventDefault(); items.slice(0,5).forEach(i=>{ const f=i.getAsFile(); if(f) importImage(f,null); }); return; }
  if(clip&&clip.length){
    e.preventDefault(); pasteN++;
    const copies=clip.map(o=>({...moveObj(o,24*pasteN,24*pasteN),id:uid(),z:nextZ(),by:clientId}));
    setTool('select'); commitOps(copies.map(o=>({t:'add',o}))); sel=new Set(copies.map(o=>o.id)); updateUI(); invalidate();
  }
});
window.addEventListener('dragover',e=>{ if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
window.addEventListener('drop',e=>{
  const files=[...((e.dataTransfer&&e.dataTransfer.files)||[])].filter(f=>/^image\//.test(f.type));
  if(!files.length) return;
  e.preventDefault();
  const p=ptr(e);
  files.slice(0,10).forEach((f,i)=>importImage(f,{wx:p.wx+i*30,wy:p.wy+i*30}));
});

/* ---------- ui wiring ---------- */
function buildToolbar(){
  const bar=$('#tools'); let html='';
  GROUPS.forEach((g,i)=>{
    if(i) html+='<span class="sep" aria-hidden="true"></span>';
    g.forEach(k=>{ const [n,key]=TOOL_INFO[k]; html+=`<button class="btn" type="button" data-tool="${k}" title="${n} (${key})" aria-label="${n}" aria-pressed="false">${svg(k)}</button>`; });
  });
  html+='<span class="sep" aria-hidden="true"></span>';
  html+=`<button class="btn" type="button" id="imgBtn" title="เพิ่มรูปแบบ (I)" aria-label="เพิ่มรูปแบบ">${svg('image')}</button>`;
  bar.innerHTML=html;
  bar.addEventListener('click',e=>{
    const b=e.target.closest('button'); if(!b) return;
    if(b.dataset.tool) setTool(b.dataset.tool); else if(b.id==='imgBtn') $('#imgIn').click();
    b.blur();
  });
}
$$('[data-icon]').forEach(el=>{ el.innerHTML=svg(el.dataset.icon,el.dataset.icon==='x'?18:20); });
$('#keyList').innerHTML=Object.values(TOOL_INFO).map(([n,k])=>`<li><span>${n}</span><kbd>${k}</kbd></li>`).join('')
  +'<li><span>เพิ่มรูปแบบ</span><kbd>I</kbd></li><li><span>เลิกทำ</span><kbd>Ctrl Z</kbd></li><li><span>ทำซ้ำ</span><kbd>Ctrl Shift Z</kbd></li><li><span>ทำซ้ำวัตถุ</span><kbd>Ctrl D</kbd></li><li><span>เลือกทั้งหมด</span><kbd>Ctrl A</kbd></li><li><span>ลบ</span><kbd>Delete</kbd></li><li><span>จุดตาราง</span><kbd>G</kbd></li><li><span>ดูงานทั้งหมด</span><kbd>Shift 1</kbd></li><li><span>ซูม 100%</span><kbd>Ctrl 0</kbd></li>';
$('#undo').addEventListener('click',e=>{ undo(); e.currentTarget.blur(); });
$('#redo').addEventListener('click',e=>{ redo(); e.currentTarget.blur(); });
$('#zin').addEventListener('click',e=>{ zoomAt(1.25,stage.clientWidth/2,stage.clientHeight/2); e.currentTarget.blur(); });
$('#zout').addEventListener('click',e=>{ zoomAt(1/1.25,stage.clientWidth/2,stage.clientHeight/2); e.currentTarget.blur(); });
$('#zoomlbl').addEventListener('click',e=>{ zoomAt(1/cam.z,stage.clientWidth/2,stage.clientHeight/2); e.currentTarget.blur(); });
$('#fit').addEventListener('click',e=>{ fitView(); e.currentTarget.blur(); });
$('#gridbtn').addEventListener('click',e=>{ grid=!grid; updateUI(); invalidate(); saveSoon(); e.currentTarget.blur(); });
$('#helpbtn').addEventListener('click',()=>{ $('#wheelChk').checked=wheelZoom; syncThemeSeg(); openModal('helpM'); });
$('#wheelChk').addEventListener('change',e=>{ wheelZoom=e.target.checked; saveSoon(); });
function syncThemeSeg(){ const t=lsGet('gr-theme','auto'); $$('[data-theme-set]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.themeSet===t))); }
$('#themeSeg').addEventListener('click',e=>{
  const b=e.target.closest('[data-theme-set]'); if(!b) return;
  lsSet('gr-theme',b.dataset.themeSet); applyTheme(); syncThemeSeg(); invalidate();
});
ptoggle.addEventListener('click',e=>{ P.classList.toggle('open'); if(P.classList.contains('open')) openRefs(false); e.currentTarget.blur(); });
$('#peopleBtn').addEventListener('click',openRoom);
$('#filebtn').addEventListener('click',()=>{ openModal('fileM'); refreshExport(); });
$('#transChk').addEventListener('change',refreshExport);
$('#refsChk').addEventListener('change',refreshExport);
$('#dlImg').addEventListener('click',async()=>{
  const c=exportCanvas($('#transChk').checked,$('#refsChk').checked); if(!c) return;
  try{
    const blob=await toBlob(c), url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url; a.download='กระดานไร้ขอบ-'+BOARD+'.png'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
  }catch(e){ toast('บันทึกรูปไม่สำเร็จ'); }
});
$('#copyImg').addEventListener('click',async()=>{
  const c=exportCanvas($('#transChk').checked,$('#refsChk').checked); if(!c) return;
  try{
    await navigator.clipboard.write([new ClipboardItem({'image/png':await toBlob(c)})]);
    toast('คัดลอกรูปแล้ว');
  }catch(e){ toast('คัดลอกรูปไม่ได้ ลองกดดาวน์โหลดแทน'); }
});
if(window.ResizeObserver) new ResizeObserver(()=>{ layoutEditor(); invalidate(); }).observe(stage);
window.addEventListener('resize',()=>{ layoutEditor(); invalidate(); });
if(document.fonts&&document.fonts.addEventListener) document.fonts.addEventListener('loadingdone',()=>{ mcache.clear(); bbCache=new WeakMap(); invalidate(); });
new MutationObserver(()=>invalidate()).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
if(mqDark&&mqDark.addEventListener) mqDark.addEventListener('change',()=>invalidate());
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'&&net.sb&&net.joined&&!net.pending.length) loadBoard(); });

/* ---------- start ---------- */
const configured=!!(CFG.SUPABASE_URL&&CFG.SUPABASE_ANON_KEY&&window.supabase&&window.supabase.createClient);
if(configured){
  try{ net.sb=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY,{realtime:{params:{eventsPerSecond:30}}}); }
  catch(e){ console.warn(e); net.sb=null; }
}
loadLocal();
if(!hadCam) cam={x:-stage.clientWidth/2,y:-stage.clientHeight/2,z:1};
buildToolbar(); buildPanel(); buildRoomModal(); readTheme();
$('#boardIn').value=BOARD;
ready=!net.sb;
if(net.sb){ connect(); } else {
  setStatus('local');
  if(!configured) setTimeout(()=>toast('ยังไม่ได้ตั้งค่า Supabase ตอนนี้วาดได้คนเดียว (ดู README)'),1200);
}
if(window.matchMedia&&matchMedia('(pointer: coarse)').matches) hint.innerHTML='<b>พื้นที่ว่างไม่มีที่สิ้นสุด</b>ลากนิ้วเพื่อวาด · ใช้สองนิ้วเพื่อเลื่อนและซูม';
updateCursor(); updateUI(); onViewChange(); syncMe();
loadImages().then(()=>{ updateUI(); });
})();
