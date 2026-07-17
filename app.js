/* ============================================================
   정보검색론 — 앱 로직 (iOS 스타일 내비게이션)
   데이터: MCQ / SHORT / NOTES
   ============================================================ */
'use strict';

const $  = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const shuffle = a => { a=a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0; [a[i],a[j]]=[a[j],a[i]];} return a; };
const icon = id => `<svg class="tick"><use href="#${id}"/></svg>`;

/* ---------- 토스트 ---------- */
let toastTimer;
function toast(msg){
  let t = $('#toast');
  if(!t){ t=document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent = msg;
  requestAnimationFrame(()=>t.classList.add('show'));
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'), 1900);
}

/* ---------- 저장소 ---------- */
const STORE_KEY='ir_study_v1';
const store={
  data:{ seen:{}, wrong:{}, correctCount:0, answeredCount:0 },
  load(){ try{ const s=JSON.parse(localStorage.getItem(STORE_KEY)); if(s) this.data=Object.assign(this.data,s); }catch(e){} },
  save(){ try{ localStorage.setItem(STORE_KEY, JSON.stringify(this.data)); }catch(e){} },
  record(id, ok){
    this.data.seen[id]=true;
    this.data.answeredCount++;
    if(ok){ this.data.correctCount++; delete this.data.wrong[id]; }
    else { this.data.wrong[id]=true; }
    this.save();
  },
  reset(){ this.data={ seen:{}, wrong:{}, correctCount:0, answeredCount:0 }; this.save(); }
};
store.load();

/* ---------- 테마 ---------- */
const THEME_KEY='ir_theme';
const THEMES=['auto','light','dark'];
function getTheme(){ const t=localStorage.getItem(THEME_KEY); return THEMES.includes(t)?t:'auto'; }
function applyTheme(){
  const pref=getTheme();
  const dark = pref==='dark' || (pref==='auto' && matchMedia('(prefers-color-scheme:dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  const meta=$('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content', dark?'#000000':'#F2F2F7');
  $$('#themeSeg .seg').forEach(b=>b.classList.toggle('active', b.dataset.v===pref));
}
matchMedia('(prefers-color-scheme:dark)').addEventListener('change', applyTheme);
$('#themeSeg').addEventListener('click', e=>{
  const b=e.target.closest('.seg'); if(!b) return;
  localStorage.setItem(THEME_KEY, b.dataset.v); applyTheme();
});
applyTheme();

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

/* ============================================================
   라우터 (탭 + 푸시 스택)
   ============================================================ */
const TABS={ home:'v-home', learn:'v-learn', quizTab:'v-quizTab', settings:'v-settings' };
const ALL_VIEWS=['v-home','v-learn','v-learnDetail','v-quizTab','v-setup','v-topics','v-exam','v-settings','v-run','v-result'];
let curTab='home';
let stack=[];          // [{view, title, backLbl, action}]
let fullscreen=null;   // 'v-run' | 'v-result' | null

function activeView(){
  if(fullscreen) return fullscreen;
  return stack.length ? stack[stack.length-1].view : TABS[curTab];
}
function render(){
  const av=activeView();
  ALL_VIEWS.forEach(v=>{ const el=$('#'+v); if(el) el.classList.toggle('hidden', v!==av); });

  const isFull = !!fullscreen;
  $('#tabbar').classList.toggle('hidden', isFull);
  $('#navbar').classList.toggle('hidden', isFull);

  if(!isFull){
    const top = stack[stack.length-1];
    $('#navBack').classList.toggle('hidden', !top);
    $('#navBackLbl').textContent = top?.backLbl || '뒤로';
    $('#navTitle').textContent = top?.title || rootTitle();
    // 액션 버튼
    const act=$('#navAction');
    if(top?.action){ act.classList.remove('hidden'); act.textContent=top.action.label; act.onclick=top.action.fn; }
    else act.classList.add('hidden');
  }
  window.scrollTo(0,0);
  updateNavOnScroll();
}
function rootTitle(){
  return { home:'정보검색론', learn:'학습', quizTab:'문제', settings:'설정' }[curTab];
}
function setTab(tab){
  curTab=tab; stack=[]; fullscreen=null;
  $$('.tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===tab));
  if(tab==='home') renderHome();
  if(tab==='learn') renderLearnList();
  if(tab==='quizTab') renderQuizTab();
  if(tab==='settings') renderSettings();
  render();
}
function push(view, title, backLbl, action){
  stack.push({view, title, backLbl: backLbl||rootTitle(), action});
  render();
}
function pop(){ stack.pop(); render(); }
function closeFullscreen(){ fullscreen=null; render(); }

$('#navBack').onclick = pop;
$$('.tab').forEach(t=> t.onclick = ()=>setTab(t.dataset.tab));

/* 라지 타이틀 축소 — 내비바 하단선을 지나면 작은 제목으로 전환 */
function updateNavOnScroll(){
  if(fullscreen) return;
  const nav=$('#navbar'), title=$('#navTitle');
  const lt=$('#'+activeView())?.querySelector('.large-title');
  if(!lt){ nav.classList.add('solid'); title.classList.add('show'); return; }   // 푸시된 화면
  const collapsed = lt.getBoundingClientRect().bottom < nav.getBoundingClientRect().bottom;
  nav.classList.toggle('solid', collapsed);
  title.classList.toggle('show', collapsed);
}
window.addEventListener('scroll', updateNavOnScroll, {passive:true});

/* 리스트 행 라우팅 */
document.addEventListener('click', e=>{
  const el=e.target.closest('[data-go]'); if(!el) return;
  const go=el.dataset.go;
  if(go==='mcq')   openSetup('mcq');
  if(go==='short') openSetup('short');
  if(go==='exam')  openExam();
  if(go==='wrong') startWrongQuiz();
});

/* ============================================================
   홈
   ============================================================ */
function renderHome(){
  const seenM=MCQ.filter(q=>store.data.seen[q.id]).length;
  const seenS=SHORT.filter(q=>store.data.seen[q.id]).length;
  const wrong=Object.keys(store.data.wrong).length;
  const ans=store.data.answeredCount, cor=store.data.correctCount;

  $('#stMcq').textContent   = `${seenM} / ${MCQ.length}`;
  $('#stShort').textContent = `${seenS} / ${SHORT.length}`;
  $('#stAcc').textContent   = ans? Math.round(cor/ans*100)+'%' : '–';

  const total=MCQ.length+SHORT.length, seen=seenM+seenS;
  const pct = total? Math.round(seen/total*100):0;
  $('#ringPct').textContent = pct+'%';
  const C=2*Math.PI*41.5;
  $('#ringBar').style.strokeDasharray = C;
  $('#ringBar').style.strokeDashoffset = C*(1-pct/100);

  const wd = wrong? `${wrong}문항 · 다시 풀기` : '틀린 문제 다시 풀기';
  $('#homeWrongD').textContent = wd;
  $('#homeFoot').textContent = seen
    ? `전체 ${total}문항 중 ${seen}문항 학습 · 누적 정답 ${cor}/${ans}`
    : '아직 푼 문제가 없어요. 위에서 시작해 보세요.';
}
function renderQuizTab(){
  const wrong=Object.keys(store.data.wrong).length;
  $('#quizWrongD').textContent = wrong? `${wrong}문항 · 다시 풀기` : '틀린 문제 다시 풀기';
}
function renderSettings(){
  const seen=Object.keys(store.data.seen).length;
  const ans=store.data.answeredCount, cor=store.data.correctCount;
  $('#setSeen').textContent = `${seen} / ${MCQ.length+SHORT.length}`;
  $('#setAcc').textContent  = ans? `${Math.round(cor/ans*100)}%  (${cor}/${ans})` : '–';
  $('#setWrong').textContent = Object.keys(store.data.wrong).length;
}
$('#resetBtn').onclick = ()=>{
  if(confirm('학습 기록을 모두 삭제할까요?\n진도 · 오답노트 · 점수가 초기화되며 되돌릴 수 없습니다.')){
    store.reset(); renderSettings(); renderHome(); renderQuizTab(); toast('학습 기록을 초기화했어요');
  }
};

/* ============================================================
   학습
   ============================================================ */
function renderLearnList(){
  const el=$('#learnList'); el.innerHTML='';
  NOTES.forEach((n,i)=>{
    const b=document.createElement('button');
    b.className='row has-icon';
    b.innerHTML =
      `<span class="row-ico ic-blue"><svg><use href="#i-book"/></svg></span>
       <span class="row-body"><span class="row-t">${n.sec}</span>
       <span class="row-d">${n.cards.length}개 주제</span></span>
       <svg class="chev"><use href="#i-chev"/></svg>`;
    b.onclick=()=>openLearnDetail(i);
    el.appendChild(b);
  });
}
function openLearnDetail(i){
  const sec=NOTES[i];
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
  const pool = mode==='mcq'?MCQ:SHORT;
  setup={ mode, topics:new Set(topicsOf(pool)), count:10, order:'random' };

  // 문항 수 세그먼트
  const counts = mode==='mcq'?[10,20,40,'전체']:[10,20,50,'전체'];
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
  push('v-setup', mode==='mcq'?'객관식':'주관식', mode==='mcq'?'문제':'문제');
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
  const pool=setup.mode==='mcq'?MCQ:SHORT;
  return pool.filter(q=>setup.topics.has(q.topic)).length;
}
function updateSetupInfo(){
  const pool=setup.mode==='mcq'?MCQ:SHORT;
  const all=topicsOf(pool).length, sel=setup.topics.size, avail=availCount();
  $('#topicVal').textContent = sel===all?'전체':(sel===0?'없음':`${sel}개 주제`);
  const want = setup.count==='전체'?avail:Math.min(setup.count, avail);
  $('#setupInfo').textContent = `출제 가능 ${avail}문항 중 ${want}문항이 출제됩니다.`;
  $('#startQuiz').disabled = avail===0;
}
$('#topicRow').onclick = openTopics;

function openTopics(){
  const pool=setup.mode==='mcq'?MCQ:SHORT;
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
  push('v-topics', '주제 선택', setup.mode==='mcq'?'객관식':'주관식',
       { label:'', fn:toggleAllTopics });
  updateTopicsAction();
}
function updateTopicsAction(){
  const pool=setup.mode==='mcq'?MCQ:SHORT;
  const all=topicsOf(pool).length;
  const act=$('#navAction');
  act.classList.remove('hidden');
  act.textContent = setup.topics.size===all?'전체 해제':'전체 선택';
  act.onclick=toggleAllTopics;
}
function toggleAllTopics(){
  const pool=setup.mode==='mcq'?MCQ:SHORT;
  const topics=topicsOf(pool);
  if(setup.topics.size===topics.length) setup.topics.clear();
  else setup.topics=new Set(topics);
  $$('#topicList .row').forEach((b,i)=> b.classList.toggle('on', setup.topics.has(topics[i])));
  updateSetupInfo(); updateTopicsAction();
}

$('#startQuiz').onclick = ()=>{
  const pool=setup.mode==='mcq'?MCQ:SHORT;
  let qs=pool.filter(q=>setup.topics.has(q.topic));
  if(!qs.length){ toast('주제를 하나 이상 선택하세요'); return; }
  qs = setup.order==='random'?shuffle(qs):qs.slice();
  const n = setup.count==='전체'?qs.length:Math.min(setup.count, qs.length);
  startQuiz(qs.slice(0,n).map(q=>({...q, _type:setup.mode})), { kind:'practice' });
};

/* ============================================================
   모의고사
   ============================================================ */
let examMin=25;
function openExam(){ push('v-exam','모의고사','문제'); }
$('#examSeg').addEventListener('click', e=>{
  const b=e.target.closest('.seg'); if(!b) return;
  $$('#examSeg .seg').forEach(x=>x.classList.remove('active')); b.classList.add('active');
  examMin=+b.dataset.v;
});
$('#startExam').onclick = ()=>{
  const m=shuffle(MCQ).slice(0,20).map(q=>({...q,_type:'mcq'}));
  const s=shuffle(SHORT).slice(0,10).map(q=>({...q,_type:'short'}));
  startQuiz(shuffle([...m,...s]), { kind:'exam', minutes:examMin });
};

/* ============================================================
   오답노트
   ============================================================ */
function startWrongQuiz(){
  const ids=Object.keys(store.data.wrong);
  if(!ids.length){ toast('오답이 없어요. 먼저 문제를 풀어보세요 👍'); return; }
  const map={}; MCQ.forEach(q=>map[q.id]={...q,_type:'mcq'}); SHORT.forEach(q=>map[q.id]={...q,_type:'short'});
  const qs=ids.map(id=>map[id]).filter(Boolean);
  if(!qs.length){ toast('오답 데이터를 찾을 수 없어요'); return; }
  startQuiz(shuffle(qs), { kind:'practice' });
}

/* ============================================================
   퀴즈 엔진
   ============================================================ */
let quiz=null, timerInt=null;

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
  $('#qKind').textContent = type==='mcq'?'객관식 · 4지선다':'주관식 · 단답형';
  $('#qText').textContent=q.q;

  $('#qFb').className='fb hidden';
  $('#qExp').classList.add('hidden');
  $('#qExpBtn').textContent='💡 해설 보기';
  $('#qExpBtn').classList.toggle('hidden', isExam);   // 시험 중 해설 비공개
  $('#qSkip').classList.remove('hidden');
  $('#ftSecondary').classList.remove('hidden');
  $('#ftSelf').classList.add('hidden');
  $('#qNext').classList.add('hidden');
  $('#qSubmit').classList.add('hidden');

  if(type==='mcq'){
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

/* 시험: 선택만(변경 가능), 다음에서 확정 */
function selectExamOption(q, chosen, pos){
  quiz.pending=chosen;
  $$('#qOpts .opt').forEach((b,i)=> b.classList.toggle('sel', i===pos));
  $('#qNext').classList.remove('hidden'); $('#qNext').textContent=lastBtnLabel();
}

/* 연습: 즉시 채점 + 공개 */
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
  conclude(q,'mcq',ok,q.opts[chosen]);
}

/* 주관식 확인(연습) */
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

/* 문항 마무리(연습) */
function conclude(q, type, ok, userAns, allowSelf){
  $('#qSkip').classList.add('hidden');
  const fb=$('#qFb'); fb.className='fb '+(ok?'ok':'no');
  const head = ok? '<span class="fb-t">✓ 정답이에요</span>' : '<span class="fb-t">✗ 오답이에요</span>';
  const ans = type==='mcq'
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

/* 자가채점 */
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

/* 해설 */
$('#qExpBtn').onclick = ()=>{
  const q=quiz.questions[quiz.idx], ex=$('#qExp');
  if(ex.classList.contains('hidden')){
    ex.innerHTML=`<span class="exp-t">해설</span>${q.exp}`;
    ex.classList.remove('hidden');
    $('#qExpBtn').textContent='💡 해설 닫기';
    ex.scrollIntoView({behavior:'smooth', block:'nearest'});
  } else { ex.classList.add('hidden'); $('#qExpBtn').textContent='💡 해설 보기'; }
};

/* 모름 · 넘기기 */
$('#qSkip').onclick = ()=>{
  if(!quiz || quiz.answered) return;
  const q=quiz.questions[quiz.idx], type=q._type;
  const isExam=quiz.sess.kind==='exam';
  quiz.answered=true;

  if(type==='mcq'){
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
    const ans = type==='mcq'
      ? `<span class="fb-a"><span class="k">정답 ·</span> ${q.opts[q.answer]}</span>`
      : `<span class="fb-a"><span class="k">모범답안 ·</span> ${q.answers[0]}</span>`;
    fb.innerHTML=`<span class="fb-t">건너뛴 문제예요 · 오답노트에 저장했어요</span>${ans}`;
  } else toast('건너뛴 문제는 오답 처리돼요');

  $('#qNext').classList.remove('hidden');
  $('#qNext').textContent = lastBtnLabel();
};

/* 마지막 문항의 버튼 문구 */
function lastBtnLabel(){
  if(quiz.idx < quiz.max-1) return '다음';
  return quiz.sess.kind==='exam' ? '제출하기' : '결과 보기';
}

/* 다음 */
$('#qNext').onclick = ()=>{
  const q=quiz.questions[quiz.idx];
  // 시험 모드: 여기서 확정 채점
  if(quiz.sess.kind==='exam' && !quiz.answered){
    quiz.answered=true;
    if(q._type==='mcq'){
      if(quiz.pending===null){ toast('보기를 선택하거나 건너뛰세요'); quiz.answered=false; return; }
      applyResult(q,'mcq',quiz.pending===q.answer,q.opts[quiz.pending]);
    } else {
      const val=$('#qShortIn').value.trim();
      applyResult(q,'short',val?shortMatch(val,q.answers):false, val||'(무응답)');
    }
  }
  if(quiz.idx < quiz.max-1){ quiz.idx++; renderQuestion(); }
  else finishQuiz();
};

/* 나가기 */
$('#runClose').onclick = ()=>{
  if(confirm('퀴즈를 종료할까요?\n지금까지 푼 문항의 기록은 저장됩니다.')){
    stopTimer(); fullscreen=null; setTab(curTab);
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
  $('#resReview').textContent='📋 문항별 다시 보기';

  renderHome(); renderQuizTab(); renderSettings();
  fullscreen='v-result'; render();
  $('#navbar').classList.remove('hidden');
  $('#navBack').classList.add('hidden');
  $('#navAction').classList.add('hidden');
  $('#navTitle').textContent='결과'; $('#navTitle').classList.add('show');
  $('#navbar').classList.add('solid');
}
$('#resHome').onclick = ()=>{ fullscreen=null; setTab(curTab==='home'?'home':curTab); };
$('#resReview').onclick = ()=>{
  const w=$('#reviewWrap'); const hid=w.classList.toggle('hidden');
  $('#resReview').textContent = hid?'📋 문항별 다시 보기':'▲ 리뷰 접기';
  if(!hid) w.scrollIntoView({behavior:'smooth'});
};

function buildReview(r){
  const el=$('#reviewList'); el.innerHTML='';
  r.results.forEach((x,i)=>{
    const q=x.q;
    const ans = x.type==='mcq'
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
setTab('home');
