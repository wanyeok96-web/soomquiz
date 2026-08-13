/* ============================================================
   SOOM QUIZ — 통합 허브 앱
   과목: 정보검색론(ir) · 도서관·정보센터 경영론(mgmt)
   ============================================================ */
'use strict';

const $  = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const shuffle = a => { a=a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0; [a[i],a[j]]=[a[j],a[i]];} return a; };

let toastTimer;
function toast(msg){
  let t = $('#toast');
  if(!t){ t=document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent = msg;
  requestAnimationFrame(()=>t.classList.add('show'));
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'), 1900);
}

document.documentElement.classList.add('dark');

/* ---------- 과목 데이터 ---------- */
const DATA = {
  ir: {
    mcq: MCQ_FINAL,
    short: SHORT_FINAL,
    notes: NOTES_IR,
  },
  mgmt: {
    ox: OX_DATA,
    mcq: MCQ_DATA,
    short: SHORT_DATA,
    notes: NOTES,
  },
};

const SUB_KEY = 'sq_subject';
const STORE_KEY = 'sq_study_v1';

let curSubject = (()=>{ const s=localStorage.getItem(SUB_KEY); return SUBJECT_BY_ID[s]?s:null; })();

function subMeta(){ return SUBJECT_BY_ID[curSubject]; }
function pack(){ return DATA[curSubject] || {}; }
function oxPool(){ return pack().ox || []; }
function mcqPool(){ return pack().mcq || []; }
function shortPool(){ return pack().short || []; }
function notesOf(){ return pack().notes || []; }

const MODE_META = {
  exam:  { t:'모의고사', d:'실전 · 시간제한', emoji:'⏱️' },
  learn: { t:'핵심 요약', d:'빠른 훑어보기', emoji:'📖' },
  ox:    { t:'OX 퀴즈', d:'참·거짓', emoji:'⭕' },
  mcq:   { t:'객관식', d:'4지선다', emoji:'✅' },
  short: { t:'주관식', d:'단답형', emoji:'✏️' },
  wrong: { t:'오답노트', d:'틀린 문제 다시', emoji:'🔁' },
};

/* ---------- 저장소 ---------- */
const blankRec = ()=>({ seen:{}, wrong:{}, correctCount:0, answeredCount:0 });
const store = {
  all: { ir:blankRec(), mgmt:blankRec() },
  get data(){ return this.all[curSubject] || this.all.ir; },
  load(){
    try{
      const s=JSON.parse(localStorage.getItem(STORE_KEY));
      if(s){
        if(s.ir){
          if(s.ir.final || s.ir.mid) this.all.ir=Object.assign(blankRec(), s.ir.final || s.ir.mid || {});
          else this.all.ir=Object.assign(blankRec(), s.ir);
        }
        if(s.mgmt && (s.mgmt.seen || s.mgmt.wrong || s.mgmt.answeredCount!=null))
          this.all.mgmt=Object.assign(blankRec(), s.mgmt);
        return;
      }
    }catch(e){}
    try{
      const ir=JSON.parse(localStorage.getItem('ir_study_v2'));
      if(ir) this.all.ir=Object.assign(blankRec(), ir.final || ir.mid || {});
    }catch(e){}
    try{
      const lm=JSON.parse(localStorage.getItem('lm_study_v2'));
      if(lm) this.all.mgmt=Object.assign(blankRec(), lm);
      else {
        const old=JSON.parse(localStorage.getItem('lm_study_v1'));
        if(old && old.mid) this.all.mgmt=Object.assign(blankRec(), old.mid);
      }
    }catch(e){}
    this.save();
  },
  save(){ try{ localStorage.setItem(STORE_KEY, JSON.stringify(this.all)); }catch(e){} },
  record(id, ok){
    this.data.seen[id]=true;
    this.data.answeredCount++;
    if(ok){ this.data.correctCount++; delete this.data.wrong[id]; }
    else { this.data.wrong[id]=true; }
    this.save();
  },
  reset(){
    if(curSubject) this.all[curSubject]=blankRec();
    this.save();
  },
};
store.load();

/* ---------- 주관식 채점 ---------- */
function norm(s){
  return String(s||'').toLowerCase()
    .replace(/[\s　]/g,'')
    .replace(/[.,·・`'"’“”()\[\]{}<>!?/\\|:;\-_~]/g,'')
    .replace(/(은|는|이|가|을|를|의|와|과)$/,'')
    .trim();
}
function shortMatch(input, answers){
  const n=norm(input); if(!n) return false;
  return answers.some(a=>{
    const na=norm(a); if(!na) return false;
    if(n===na) return true;
    if(na.length>=3 && (n.includes(na)||na.includes(n))) return true;
    return false;
  });
}
const topicsOf = pool => [...new Set(pool.map(q=>q.topic))];
function poolOf(mode){
  if(mode==='ox') return oxPool();
  if(mode==='mcq') return mcqPool();
  return shortPool();
}

/* OX → 보기 2개 객관식 */
const OX_OPTS = ['맞다 (O)', '아니다 (X)'];
function prep(q, type){
  if(type!=='ox') return {...q, _type:type};
  return {...q, _type:'ox', opts:OX_OPTS, answer: q.answer===true ? 0 : 1};
}
const prepAll = (list, type) => list.map(q=>prep(q,type));

/* ============================================================
   라우터
   ============================================================ */
const ALL_VIEWS=['v-hub','v-subject','v-learn','v-learnDetail','v-setup','v-topics','v-exam','v-run','v-result'];
let stack=[];
let fullscreen=null;

function activeView(){
  if(fullscreen) return fullscreen;
  return stack.length ? stack[stack.length-1].view : (curSubject ? 'v-subject' : 'v-hub');
}
function render(){
  const av=activeView();
  ALL_VIEWS.forEach(v=>{ const el=$('#'+v); if(el) el.classList.toggle('hidden', v!==av); });
  const isFull = !!fullscreen;
  $('#navbar').classList.toggle('hidden', isFull);

  if(!isFull){
    const top = stack[stack.length-1];
    const atRoot = !top;
    $('#navBack').classList.toggle('hidden', atRoot && !curSubject);
    if(atRoot && curSubject){
      $('#navBack').classList.remove('hidden');
      $('#navBackLbl').textContent='홈';
    } else {
      $('#navBackLbl').textContent = top?.backLbl || '뒤로';
    }
    $('#navTitle').textContent = top?.title || (curSubject ? subMeta().name : '');
    const act=$('#navAction');
    if(top?.action){ act.classList.remove('hidden'); act.textContent=top.action.label; act.onclick=top.action.fn; }
    else act.classList.add('hidden');
  }
  window.scrollTo(0,0);
  updateNavOnScroll();
}
function push(view, title, backLbl, action){
  stack.push({view, title, backLbl: backLbl|| (curSubject?subMeta().name:'홈'), action});
  render();
}
function pop(){
  if(stack.length){ stack.pop(); render(); return; }
  if(curSubject) leaveSubject();
}
$('#navBack').onclick = ()=>{
  if(stack.length) pop();
  else if(curSubject) leaveSubject();
};

function updateNavOnScroll(){
  if(fullscreen) return;
  const nav=$('#navbar'), title=$('#navTitle');
  const lt=$('#'+activeView())?.querySelector('.large-title');
  if(!lt){ nav.classList.add('solid'); title.classList.add('show'); return; }
  const collapsed = lt.getBoundingClientRect().bottom < nav.getBoundingClientRect().bottom;
  nav.classList.toggle('solid', collapsed);
  title.classList.toggle('show', collapsed);
}
window.addEventListener('scroll', updateNavOnScroll, {passive:true});

/* ============================================================
   허브 / 과목
   ============================================================ */
function renderHub(){
  const el=$('#hubList'); el.innerHTML='';
  SUBJECTS.forEach((s,i)=>{
    const b=document.createElement('button');
    b.type='button';
    b.className='pick-tile';
    b.style.setProperty('--delay', `${i*55}ms`);
    b.innerHTML=
      `<span class="pick-emoji" aria-hidden="true">${s.emoji}</span>
       <span class="pick-body">
         <span class="pick-t">${s.name}</span>
         <span class="pick-go">${s.examLine||'시작하기 →'}</span>
       </span>`;
    b.onclick=()=>enterSubject(s.id);
    el.appendChild(b);
  });
}

function enterSubject(id){
  curSubject=id;
  localStorage.setItem(SUB_KEY, id);
  stack=[]; fullscreen=null;
  renderSubject();
  render();
}
function leaveSubject(){
  curSubject=null;
  localStorage.removeItem(SUB_KEY);
  stack=[]; fullscreen=null;
  renderHub();
  render();
}

function modeDesc(m){
  const meta=MODE_META[m]; if(!meta) return '';
  if(m==='ox') return `${oxPool().length}문항 · 참/거짓`;
  if(m==='mcq') return `${mcqPool().length}문항 · 개념 확인`;
  if(m==='short') return `${shortPool().length}문항 · 키워드`;
  if(m==='learn') return `${notesOf().length}개 섹션`;
  if(m==='wrong'){
    const n=Object.keys(store.data.wrong).length;
    return n? `${n}문항 · 다시 풀기` : '틀린 문제 다시';
  }
  if(m==='exam'){
    const p=examPlan();
    return p.total? `총 ${p.total}문항 · 시간제한` : '문항 준비 중';
  }
  return meta.d;
}

function renderModeTiles(el, modes){
  el.innerHTML='';
  modes.forEach((m,i)=>{
    const meta=MODE_META[m]; if(!meta) return;
    const b=document.createElement('button');
    b.type='button';
    b.className='pick-tile mode-tile';
    b.style.setProperty('--delay', `${i*45}ms`);
    b.innerHTML=
      `<span class="pick-emoji" aria-hidden="true">${meta.emoji}</span>
       <span class="pick-body">
         <span class="pick-t">${meta.t}</span>
         <span class="pick-go">${modeDesc(m)}</span>
       </span>`;
    b.onclick=()=>openMode(m);
    el.appendChild(b);
  });
}

function renderSubject(){
  const s=subMeta(); if(!s) return;
  $('#subEmoji').textContent=s.emoji;
  $('#subTitle').textContent=s.name;
  $('#subExamLine').textContent=s.examLine||'';
  $('#subCta').textContent = '유형을 골라 연습해 보세요';

  // 진도
  const ox=oxPool(), mcq=mcqPool(), short=shortPool();
  const seenO=ox.filter(q=>store.data.seen[q.id]).length;
  const seenM=mcq.filter(q=>store.data.seen[q.id]).length;
  const seenS=short.filter(q=>store.data.seen[q.id]).length;
  const ans=store.data.answeredCount, cor=store.data.correctCount;
  const total=ox.length+mcq.length+short.length;
  const seen=seenO+seenM+seenS;
  const pct=total? Math.round(seen/total*100):0;
  $('#ringPct').textContent=pct+'%';
  const C=2*Math.PI*41.5;
  $('#ringBar').style.strokeDasharray=C;
  $('#ringBar').style.strokeDashoffset=C*(1-pct/100);

  const stats=$('#heroStats'); stats.innerHTML='';
  const rows=[];
  if(ox.length) rows.push(['OX', `${seenO} / ${ox.length}`]);
  rows.push(['객관식', `${seenM} / ${mcq.length}`]);
  rows.push(['주관식', `${seenS} / ${short.length}`]);
  rows.push(['누적 정답률', ans? Math.round(cor/ans*100)+'%' : '–']);
  rows.forEach(([k,v])=>{
    const d=document.createElement('div'); d.className='hstat';
    d.innerHTML=`<span class="hstat-k">${k}</span><span class="hstat-v">${v}</span>`;
    stats.appendChild(d);
  });

  renderModeTiles($('#modePrimary'), s.primary||[]);
  renderModeTiles($('#modeAux'), s.aux||[]);

  $('#resetFoot').textContent = '이 과목의 진도 · 오답노트만 삭제됩니다.';
}

$('#resetBtn').onclick = ()=>{
  const label = subMeta()?.name || '현재 과목';
  if(confirm(`${label} 학습 기록을 삭제할까요?\n진도 · 오답노트가 초기화되며 되돌릴 수 없습니다.`)){
    store.reset(); renderSubject(); toast('학습 기록을 초기화했어요');
  }
};

function openMode(m){
  if(m==='learn') openLearn();
  else if(m==='exam') openExam();
  else if(m==='wrong') startWrongQuiz();
  else if(m==='ox'||m==='mcq'||m==='short') openSetup(m);
}

/* ============================================================
   학습
   ============================================================ */
function openLearn(){
  const el=$('#learnList'); el.innerHTML='';
  const notes=notesOf();
  if(!notes.length){ toast('학습 요약이 아직 없어요'); return; }
  notes.forEach((n,i)=>{
    const b=document.createElement('button');
    b.type='button';
    b.className='pick-tile mode-tile';
    b.style.setProperty('--delay', `${i*40}ms`);
    b.innerHTML=
      `<span class="pick-emoji">📖</span>
       <span class="pick-body">
         <span class="pick-t">${n.sec}</span>
         <span class="pick-go">${n.cards.length}개 주제</span>
       </span>`;
    b.onclick=()=>openLearnDetail(i);
    el.appendChild(b);
  });
  const range = curSubject==='ir' ? '6~12장' : '시험 범위 요약';
  $('#learnFoot').textContent = `${subMeta().name} · ${range}`;
  push('v-learn', '학습', subMeta().name);
}
function openLearnDetail(i){
  const sec=notesOf()[i];
  const wrap=$('#learnCards'); wrap.innerHTML='';
  sec.cards.forEach(c=>{
    const d=document.createElement('div'); d.className='note';
    const h=document.createElement('h3'); h.textContent=c.title; d.appendChild(h);
    const ul=document.createElement('ul');
    c.points.forEach(p=>{ const li=document.createElement('li'); li.textContent=p; ul.appendChild(li); });
    d.appendChild(ul); wrap.appendChild(d);
  });
  push('v-learnDetail', sec.sec, '학습');
}

/* ============================================================
   퀴즈 설정
   ============================================================ */
let setup={ mode:'mcq', topics:new Set(), count:10, order:'random' };

function openSetup(mode){
  const pool = poolOf(mode);
  if(!pool.length){ toast('문항이 아직 없어요'); return; }
  setup={ mode, topics:new Set(topicsOf(pool)), count:10, order:'random' };

  const counts = mode==='ox'?[10,20,'전체']
               : mode==='mcq'?[10,20,40,'전체']
               :[10,20,50,'전체'];
  const cs=$('#countSeg'); cs.innerHTML='';
  counts.forEach((n,i)=>{
    const b=document.createElement('button');
    b.className='seg'+(i===0?' active':''); b.dataset.v=n;
    b.textContent = n==='전체'?'전체':n;
    cs.appendChild(b);
  });
  setup.count=counts[0];
  $$('#orderSeg .seg').forEach(b=>b.classList.toggle('active', b.dataset.v==='random'));
  updateSetupInfo();
  push('v-setup', MODE_META[mode].t, subMeta().name);
}
$('#countSeg').addEventListener('click', e=>{
  const b=e.target.closest('.seg'); if(!b) return;
  $$('#countSeg .seg').forEach(x=>x.classList.remove('active')); b.classList.add('active');
  setup.count = b.dataset.v==='전체'?'전체':+b.dataset.v;
  updateSetupInfo();
});
$('#orderSeg').addEventListener('click', e=>{
  const b=e.target.closest('.seg'); if(!b) return;
  $$('#orderSeg .seg').forEach(x=>x.classList.remove('active')); b.classList.add('active');
  setup.order=b.dataset.v;
});
function availCount(){
  return poolOf(setup.mode).filter(q=>setup.topics.has(q.topic)).length;
}
function updateSetupInfo(){
  const pool=poolOf(setup.mode);
  const all=topicsOf(pool).length, sel=setup.topics.size, avail=availCount();
  $('#topicVal').textContent = sel===all?'전체':(sel===0?'없음':`${sel}개 주제`);
  const want = setup.count==='전체'?avail:Math.min(setup.count, avail);
  $('#setupInfo').textContent = `출제 가능 ${avail}문항 중 ${want}문항이 출제됩니다.`;
  $('#startQuiz').disabled = avail===0;
}
$('#topicRow').onclick = openTopics;

function openTopics(){
  const pool=poolOf(setup.mode);
  const topics=topicsOf(pool);
  const el=$('#topicList'); el.innerHTML='';
  topics.forEach(tp=>{
    const n=pool.filter(q=>q.topic===tp).length;
    const b=document.createElement('button');
    b.className='row'+(setup.topics.has(tp)?' on':'');
    b.innerHTML=`<span class="row-body"><span class="row-t">${tp}</span><span class="row-d">${n}문항</span></span>
                 <svg class="tick"><use href="#i-tick"/></svg>`;
    b.onclick=()=>{
      if(setup.topics.has(tp)) setup.topics.delete(tp); else setup.topics.add(tp);
      b.classList.toggle('on', setup.topics.has(tp));
      updateSetupInfo(); updateTopicsAction();
    };
    el.appendChild(b);
  });
  push('v-topics', '주제 선택', MODE_META[setup.mode].t, { label:'', fn:toggleAllTopics });
  updateTopicsAction();
}
function updateTopicsAction(){
  const pool=poolOf(setup.mode);
  const all=topicsOf(pool).length;
  const act=$('#navAction');
  act.classList.remove('hidden');
  act.textContent = setup.topics.size===all?'전체 해제':'전체 선택';
  act.onclick=toggleAllTopics;
}
function toggleAllTopics(){
  const pool=poolOf(setup.mode);
  const topics=topicsOf(pool);
  if(setup.topics.size===topics.length) setup.topics.clear();
  else setup.topics=new Set(topics);
  $$('#topicList .row').forEach((b,i)=> b.classList.toggle('on', setup.topics.has(topics[i])));
  updateSetupInfo(); updateTopicsAction();
}

$('#startQuiz').onclick = ()=>{
  const pool=poolOf(setup.mode);
  let qs=pool.filter(q=>setup.topics.has(q.topic));
  if(!qs.length){ toast('주제를 하나 이상 선택하세요'); return; }
  qs = setup.order==='random'?shuffle(qs):qs.slice();
  const n = setup.count==='전체'?qs.length:Math.min(setup.count, qs.length);
  startQuiz(prepAll(qs.slice(0,n), setup.mode), { kind:'practice' });
};

/* ============================================================
   모의고사
   ============================================================ */
let examMin=25;
function examPlan(){
  const cfg=subMeta()?.exam||{};
  const p={ ox:0, mcq:0, short:0, total:0 };
  if(curSubject==='mgmt'){
    p.ox=Math.min(cfg.ox||10, oxPool().length);
    p.mcq=Math.min(cfg.mcq||12, mcqPool().length);
    p.short=Math.min(cfg.short||8, shortPool().length);
  } else {
    p.mcq=Math.min(cfg.mcq||20, mcqPool().length);
    p.short=Math.min(cfg.short||10, shortPool().length);
  }
  p.total=p.ox+p.mcq+p.short;
  return p;
}
function openExam(){
  const p=examPlan();
  if(!p.total){ toast('출제할 문항이 아직 없어요'); return; }
  const parts=[];
  if(p.ox) parts.push(`OX ${p.ox}`);
  if(p.mcq) parts.push(`객관식 ${p.mcq}`);
  if(p.short) parts.push(`주관식 ${p.short}`);
  $('#examIntroSub').textContent = `${parts.join(' + ')} · 총 ${p.total}문항`;
  const def=subMeta().exam?.minutes||25;
  examMin=def;
  $$('#examSeg .seg').forEach(b=>b.classList.toggle('active', +b.dataset.v===def));
  push('v-exam','모의고사', subMeta().name);
}
$('#examSeg').addEventListener('click', e=>{
  const b=e.target.closest('.seg'); if(!b) return;
  $$('#examSeg .seg').forEach(x=>x.classList.remove('active')); b.classList.add('active');
  examMin=+b.dataset.v;
});
$('#startExam').onclick = ()=>{
  const p=examPlan();
  if(!p.total){ toast('출제할 문항이 아직 없어요'); return; }
  const picked=[];
  if(p.ox) picked.push(...prepAll(shuffle(oxPool()).slice(0,p.ox), 'ox'));
  if(p.mcq) picked.push(...prepAll(shuffle(mcqPool()).slice(0,p.mcq), 'mcq'));
  if(p.short) picked.push(...prepAll(shuffle(shortPool()).slice(0,p.short), 'short'));
  startQuiz(shuffle(picked), { kind:'exam', minutes:examMin });
};

/* ============================================================
   오답노트
   ============================================================ */
function startWrongQuiz(){
  const ids=Object.keys(store.data.wrong);
  if(!ids.length){ toast('오답이 없어요. 먼저 문제를 풀어보세요'); return; }
  const map={};
  oxPool().forEach(q=>map[q.id]=prep(q,'ox'));
  mcqPool().forEach(q=>map[q.id]=prep(q,'mcq'));
  shortPool().forEach(q=>map[q.id]=prep(q,'short'));
  const qs=ids.map(id=>map[id]).filter(Boolean);
  if(!qs.length){ toast('오답 데이터를 찾을 수 없어요'); return; }
  startQuiz(shuffle(qs), { kind:'practice' });
}

/* ============================================================
   퀴즈 엔진
   ============================================================ */
let quiz=null, timerInt=null;

function kindLabel(q){
  if(q._type==='ox') return 'OX · 참/거짓';
  if(q._type==='mcq') return '객관식 · 4지선다';
  return '주관식 · 단답형';
}
function isChoice(q){ return q._type==='ox' || q._type==='mcq'; }

function startQuiz(questions, sess){
  quiz={ questions, sess, idx:0, score:0, max:questions.length,
         results:[], answered:false, pending:null, startTs:Date.now(),
         remain: sess.minutes? sess.minutes*60 : 0 };
  $('#runTimer').classList.toggle('hidden', !sess.minutes);
  if(sess.minutes) startTimer(); else stopTimer();
  fullscreen='v-run'; render();
  renderQuestion();
}
function startTimer(){
  stopTimer(); tickLabel();
  timerInt=setInterval(()=>{
    quiz.remain--; tickLabel();
    if(quiz.remain<=0){ stopTimer(); toast('시간 종료! 자동 제출합니다'); finishQuiz(); }
  },1000);
}
function stopTimer(){ if(timerInt){ clearInterval(timerInt); timerInt=null; } }
function tickLabel(){
  const m=Math.floor(quiz.remain/60), s=quiz.remain%60;
  const el=$('#runTimer');
  el.textContent=`${m}:${String(s).padStart(2,'0')}`;
  el.classList.toggle('warn', quiz.remain<=60);
}

function renderQuestion(){
  const q=quiz.questions[quiz.idx];
  const type=q._type;
  const isExam = quiz.sess.kind==='exam';
  quiz.answered=false; quiz.pending=null;

  $('#runCount').textContent=`${quiz.idx+1} / ${quiz.max}`;
  $('#runBar').style.width=`${quiz.idx/quiz.max*100}%`;
  $('#qBadge').textContent=q.topic;
  $('#qKind').textContent = kindLabel(q);
  $('#qText').textContent=q.q;

  $('#qFb').className='fb hidden';
  $('#qExp').classList.add('hidden');
  $('#qExpBtn').textContent='해설 보기';
  $('#qExpBtn').classList.toggle('hidden', isExam);
  $('#qSkip').classList.remove('hidden');
  $('#ftSecondary').classList.remove('hidden');
  $('#ftSelf').classList.add('hidden');
  $('#qNext').classList.add('hidden');
  $('#qSubmit').classList.add('hidden');

  if(isChoice(q)){
    $('#qOpts').classList.remove('hidden');
    $('#qShortBox').classList.add('hidden');
    renderOptions(q, isExam);
  } else {
    $('#qOpts').classList.add('hidden');
    const box=$('#qShortBox'); box.classList.remove('hidden'); box.className='short-box';
    const inp=$('#qShortIn'); inp.value=''; inp.disabled=false;
    if(isExam){ $('#qNext').classList.remove('hidden'); $('#qNext').textContent=lastBtnLabel(); }
    else { $('#qSubmit').classList.remove('hidden'); }
    setTimeout(()=>inp.focus(),150);
  }
  window.scrollTo(0,0);
}

function renderOptions(q, isExam){
  const box=$('#qOpts'); box.innerHTML='';
  const keys=['A','B','C','D'];
  q._order = shuffle(q.opts.map((t,i)=>({t,i})));
  q._order.forEach((o,pos)=>{
    const b=document.createElement('button');
    b.className='opt'; b.type='button';
    b.innerHTML=`<span class="opt-key">${keys[pos]}</span><span class="opt-txt"></span>`;
    b.querySelector('.opt-txt').textContent=o.t;
    b.onclick=()=> isExam ? selectExamOption(q,o.i,pos) : answerMcq(q,o.i);
    box.appendChild(b);
  });
}

function selectExamOption(q, chosen, pos){
  quiz.pending=chosen;
  $$('#qOpts .opt').forEach((b,i)=> b.classList.toggle('sel', i===pos));
  $('#qNext').classList.remove('hidden'); $('#qNext').textContent=lastBtnLabel();
}

function answerMcq(q, chosen){
  if(quiz.answered) return;
  quiz.answered=true;
  const ok = chosen===q.answer;
  const opts=$$('#qOpts .opt');
  opts.forEach(b=>b.disabled=true);
  q._order.forEach((o,pos)=>{
    const b=opts[pos];
    if(o.i===q.answer) b.classList.add('correct');
    else if(o.i===chosen) b.classList.add('wrong');
    else b.classList.add('dim');
  });
  conclude(q, q._type, ok, q.opts[chosen]);
}

$('#qSubmit').onclick = ()=>{
  if(quiz.answered) return;
  const q=quiz.questions[quiz.idx];
  const val=$('#qShortIn').value.trim();
  if(!val){ toast('답을 입력하세요'); return; }
  quiz.answered=true;
  $('#qShortIn').disabled=true; $('#qSubmit').classList.add('hidden');
  const ok=shortMatch(val,q.answers);
  $('#qShortBox').classList.add(ok?'correct':'wrong');
  conclude(q,'short',ok,val,!ok);
};
$('#qShortIn').addEventListener('keydown', e=>{
  if(e.key!=='Enter') return;
  e.preventDefault();
  if(quiz.sess.kind==='exam') $('#qNext').click(); else $('#qSubmit').click();
});

function conclude(q, type, ok, userAns, allowSelf){
  $('#qSkip').classList.add('hidden');
  const fb=$('#qFb'); fb.className='fb '+(ok?'ok':'no');
  const head = ok? '<span class="fb-t">✓ 정답이에요</span>' : '<span class="fb-t">✗ 오답이에요</span>';
  const ans = isChoice(q)
    ? `<span class="fb-a"><span class="k">정답 ·</span> ${q.opts[q.answer]}</span>`
    : `<span class="fb-a"><span class="k">모범답안 ·</span> ${q.answers[0]}${q.answers.length>1?`<br><span class="k">그 외 인정 ·</span> ${q.answers.slice(1).join(', ')}`:''}</span>`;
  fb.innerHTML = head+ans;
  applyResult(q,type,ok,userAns);
  if(allowSelf) $('#ftSelf').classList.remove('hidden');
  $('#qNext').classList.remove('hidden');
  $('#qNext').textContent = lastBtnLabel();
}
function applyResult(q,type,ok,userAns){
  quiz.results.push({q,type,ok,user:userAns});
  if(ok) quiz.score++;
  store.record(q.id, ok);
}

$('#qSelfRight').onclick = ()=>{
  const last=quiz.results[quiz.results.length-1];
  if(!last || last.ok) return;
  last.ok=true; quiz.score++;
  store.data.correctCount++; delete store.data.wrong[last.q.id]; store.save();
  const fb=$('#qFb'); fb.className='fb ok';
  fb.innerHTML=`<span class="fb-t">✓ 정답으로 인정했어요</span><span class="fb-a"><span class="k">모범답안 ·</span> ${last.q.answers[0]}</span>`;
  $('#qShortBox').className='short-box correct';
  $('#ftSelf').classList.add('hidden');
  toast('정답 처리했어요');
};

$('#qExpBtn').onclick = ()=>{
  const q=quiz.questions[quiz.idx], ex=$('#qExp');
  if(ex.classList.contains('hidden')){
    ex.innerHTML=`<span class="exp-t">해설</span>${q.exp}`;
    ex.classList.remove('hidden');
    $('#qExpBtn').textContent='해설 닫기';
    ex.scrollIntoView({behavior:'smooth', block:'nearest'});
  } else { ex.classList.add('hidden'); $('#qExpBtn').textContent='해설 보기'; }
};

$('#qSkip').onclick = ()=>{
  if(!quiz || quiz.answered) return;
  const q=quiz.questions[quiz.idx], type=q._type;
  const isExam=quiz.sess.kind==='exam';
  quiz.answered=true;

  if(isChoice(q)){
    const opts=$$('#qOpts .opt'); opts.forEach(b=>b.disabled=true);
    if(!isExam) q._order.forEach((o,pos)=> opts[pos].classList.add(o.i===q.answer?'correct':'dim'));
  } else {
    $('#qShortIn').disabled=true; $('#qSubmit').classList.add('hidden');
    if(!isExam) $('#qShortBox').classList.add('wrong');
  }

  applyResult(q,type,false,'(건너뜀)');
  $('#qSkip').classList.add('hidden');

  if(!isExam){
    const fb=$('#qFb'); fb.className='fb no';
    const ans = isChoice(q)
      ? `<span class="fb-a"><span class="k">정답 ·</span> ${q.opts[q.answer]}</span>`
      : `<span class="fb-a"><span class="k">모범답안 ·</span> ${q.answers[0]}</span>`;
    fb.innerHTML=`<span class="fb-t">건너뛴 문제예요 · 오답노트에 저장했어요</span>${ans}`;
  } else toast('건너뛴 문제는 오답 처리돼요');

  $('#qNext').classList.remove('hidden');
  $('#qNext').textContent = lastBtnLabel();
};

function lastBtnLabel(){
  if(quiz.idx < quiz.max-1) return '다음';
  return quiz.sess.kind==='exam' ? '제출하기' : '결과 보기';
}

$('#qNext').onclick = ()=>{
  const q=quiz.questions[quiz.idx];
  if(quiz.sess.kind==='exam' && !quiz.answered){
    quiz.answered=true;
    if(isChoice(q)){
      if(quiz.pending===null){ toast('보기를 선택하거나 건너뛰세요'); quiz.answered=false; return; }
      applyResult(q,q._type,quiz.pending===q.answer,q.opts[quiz.pending]);
    } else {
      const val=$('#qShortIn').value.trim();
      applyResult(q,'short',val?shortMatch(val,q.answers):false, val||'(무응답)');
    }
  }
  if(quiz.idx < quiz.max-1){ quiz.idx++; renderQuestion(); }
  else finishQuiz();
};

$('#runClose').onclick = ()=>{
  if(confirm('퀴즈를 종료할까요?\n지금까지 푼 문항의 기록은 저장됩니다.')){
    stopTimer(); fullscreen=null; stack=[]; renderSubject(); render();
  }
};

/* ============================================================
   결과
   ============================================================ */
function finishQuiz(){
  stopTimer();
  const r=quiz, pct = r.max? Math.round(r.score/r.max*100):0;
  $('#resScore').textContent=`${r.score} / ${r.max}`;

  let emoji='🎉', h='훌륭해요!';
  if(pct<40){ emoji='💪'; h='다시 도전해봐요'; }
  else if(pct<70){ emoji='🙂'; h='좋아요, 조금만 더!'; }
  else if(pct<90){ emoji='👍'; h='잘했어요!'; }
  else { emoji='🏆'; h='완벽에 가까워요!'; }
  $('#resEmoji').textContent=emoji; $('#resH').textContent=h;

  const wrong=r.results.filter(x=>!x.ok).length;
  const sec=Math.round((Date.now()-r.startTs)/1000);
  $('#resSub').textContent = `정답률 ${pct}% · 오답 ${wrong}문항 · ${Math.floor(sec/60)}분 ${sec%60}초`;

  const gw=$('#resGradeWrap');
  if(r.sess.kind==='exam'){
    const g = pct>=90?'A':pct>=80?'B':pct>=70?'C':pct>=60?'D':'F';
    gw.innerHTML=`<div class="res-grade">모의고사 등급 ${g}</div>`;
  } else gw.innerHTML='';

  $('#resRetry').classList.toggle('hidden', wrong===0);
  $('#resRetry').onclick = ()=> startQuiz(shuffle(r.results.filter(x=>!x.ok).map(x=>x.q)), { kind:'practice' });

  buildReview(r);
  $('#reviewWrap').classList.add('hidden');
  $('#resReview').textContent='문항별 다시 보기';

  renderSubject();
  fullscreen='v-result'; render();
  $('#navbar').classList.remove('hidden');
  $('#navBack').classList.add('hidden');
  $('#navAction').classList.add('hidden');
  $('#navTitle').textContent='결과'; $('#navTitle').classList.add('show');
  $('#navbar').classList.add('solid');
}
$('#resHome').onclick = ()=>{ fullscreen=null; stack=[]; renderSubject(); render(); };
$('#resReview').onclick = ()=>{
  const w=$('#reviewWrap'); const hid=w.classList.toggle('hidden');
  $('#resReview').textContent = hid?'문항별 다시 보기':'▲ 리뷰 접기';
  if(!hid) w.scrollIntoView({behavior:'smooth'});
};

function buildReview(r){
  const el=$('#reviewList'); el.innerHTML='';
  r.results.forEach((x,i)=>{
    const q=x.q;
    const ans = isChoice(q)
      ? `<div class="rv-a"><span class="k">정답 ·</span> ${q.opts[q.answer]}</div>`
        + (x.ok?'':`<div class="rv-a"><span class="k">내 선택 ·</span> ${x.user??'—'}</div>`)
      : `<div class="rv-a"><span class="k">모범답안 ·</span> ${q.answers[0]}</div>
         <div class="rv-a"><span class="k">내 답 ·</span> ${x.user||'—'}</div>`;
    const d=document.createElement('div'); d.className='rv';
    d.innerHTML=
      `<div class="rv-hd">
         <span class="rv-mark ${x.ok?'ok':'no'}"><svg><use href="#${x.ok?'i-tick':'i-x'}"/></svg></span>
         <span class="rv-n">${i+1}번 · ${q.topic}</span>
       </div>
       <div class="rv-q">${q.q}</div>${ans}
       <div class="rv-e">${q.exp}</div>`;
    el.appendChild(d);
  });
}

/* ---------- 초기화 ---------- */
if(curSubject){ renderSubject(); render(); }
else { renderHub(); render(); }
