/* ============================================================
   정보검색론 스터디 · 퀴즈 — 앱 로직
   데이터: MCQ(객관식), SHORT(주관식), NOTES(학습요약)
   ============================================================ */
'use strict';

/* ---------- 저장소(localStorage) ---------- */
const STORE_KEY = 'ir_study_v1';
const store = {
  data: { seen:{}, wrong:{}, correctCount:0, answeredCount:0 },
  load(){
    try{ const s = JSON.parse(localStorage.getItem(STORE_KEY)); if(s) this.data = Object.assign(this.data, s); }
    catch(e){}
  },
  save(){ try{ localStorage.setItem(STORE_KEY, JSON.stringify(this.data)); }catch(e){} },
  /* 문항 결과 기록: id, 정오답 */
  record(id, ok){
    if(!this.data.seen[id]){ this.data.seen[id]=true; }
    this.data.answeredCount++;
    if(ok){ this.data.correctCount++; delete this.data.wrong[id]; }
    else { this.data.wrong[id]=true; }
    this.save();
  },
  reset(){ this.data={ seen:{}, wrong:{}, correctCount:0, answeredCount:0 }; this.save(); }
};
store.load();

/* ---------- 유틸 ---------- */
const $  = (s,el=document)=>el.querySelector(s);
const $$ = (s,el=document)=>[...el.querySelectorAll(s)];

/* ---------- 테마(자동/라이트/다크) ---------- */
const THEME_KEY = 'ir_theme';
const THEME_ORDER = ['auto','light','dark'];
const THEME_LABEL = { auto:'🌓 자동', light:'☀️ 라이트', dark:'🌙 다크' };
function getTheme(){ const t=localStorage.getItem(THEME_KEY); return THEME_ORDER.includes(t)?t:'auto'; }
function applyTheme(){
  const pref = getTheme();
  const dark = pref==='dark' || (pref==='auto' && window.matchMedia('(prefers-color-scheme:dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  const btn = document.getElementById('themeBtn');
  if(btn) btn.textContent = THEME_LABEL[pref];
}
window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change', applyTheme);
document.getElementById('themeBtn').onclick = ()=>{
  const next = THEME_ORDER[(THEME_ORDER.indexOf(getTheme())+1)%THEME_ORDER.length];
  localStorage.setItem(THEME_KEY, next);
  applyTheme();
  toast('테마: '+THEME_LABEL[next]);
};
applyTheme();
const shuffle = a => { a=a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0; [a[i],a[j]]=[a[j],a[i]];} return a; };

/* 주관식 채점용 정규화: 소문자, 공백/구두점/조사성 기호 제거 */
function norm(s){
  return String(s||'')
    .toLowerCase()
    .replace(/[\s ]/g,'')
    .replace(/[.,·・`'"’“”()\[\]{}<>!?/\\|:;\-_~]/g,'')
    .replace(/은|는|이|가|을|를|의|와|과$/,'') // 흔한 조사 꼬리 하나 제거(관대 채점)
    .trim();
}
function shortMatch(input, answers){
  const n = norm(input);
  if(!n) return false;
  return answers.some(a=>{
    const na = norm(a);
    if(!na) return false;
    if(n===na) return true;
    // 한글 답이 3자 이상이면 포함관계도 허용 (관대)
    if(na.length>=3 && (n.includes(na)||na.includes(n))) return true;
    return false;
  });
}

/* 전체 문항 풀에서 주제 목록 */
function topicsOf(pool){ return [...new Set(pool.map(q=>q.topic))]; }

/* ---------- 뷰 전환 ---------- */
const views = ['home','learn','setup','examIntro','quiz','result'];
function show(view){
  views.forEach(v=> $('#view-'+v).classList.toggle('hidden', v!==view));
  window.scrollTo(0,0);
}

/* ---------- 토스트 ---------- */
let toastTimer;
function toast(msg){
  let t = $('#toast');
  if(!t){ t=document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),1800);
}

/* ============================================================
   홈 대시보드
   ============================================================ */
function renderHome(){
  const totalMcq = MCQ.length, totalShort = SHORT.length;
  const seenMcq = MCQ.filter(q=>store.data.seen[q.id]).length;
  const seenShort = SHORT.filter(q=>store.data.seen[q.id]).length;
  const wrongCnt = Object.keys(store.data.wrong).length;
  $('#statMcq').textContent   = seenMcq+'/'+totalMcq;
  $('#statShort').textContent = seenShort+'/'+totalShort;
  $('#statWrong').textContent = wrongCnt;
  const ans = store.data.answeredCount, cor = store.data.correctCount;
  $('#statAcc').textContent = ans? Math.round(cor/ans*100)+'%' : '–';

  const totalAll = totalMcq+totalShort, seenAll = seenMcq+seenShort;
  const pct = totalAll? Math.round(seenAll/totalAll*100):0;
  $('#homeProgress').style.width = pct+'%';
  $('#homeProgressTxt').textContent = seenAll
    ? `전체 ${totalAll}문항 중 ${seenAll}문항 학습 (${pct}%) · 누적 정답 ${cor}/${ans}`
    : '아직 푼 문제가 없어요. 아래 메뉴에서 시작하세요!';
}

/* ============================================================
   학습 모드
   ============================================================ */
let learnSecIdx = 0;
function renderLearn(){
  const chipsEl = $('#learnSecChips');
  chipsEl.innerHTML='';
  NOTES.forEach((n,i)=>{
    const c=document.createElement('div');
    c.className='chip sec'+(i===learnSecIdx?' active':'');
    c.textContent=n.sec;
    c.onclick=()=>{ learnSecIdx=i; renderLearn(); };
    chipsEl.appendChild(c);
  });
  const wrap = $('#learnCards'); wrap.innerHTML='';
  const sec = NOTES[learnSecIdx];
  const t=document.createElement('div'); t.className='note-sec-title'; t.textContent=sec.sec+' 핵심 요약'; wrap.appendChild(t);
  sec.cards.forEach(card=>{
    const el=document.createElement('div'); el.className='note-card';
    const h=document.createElement('h3'); h.textContent=card.title; el.appendChild(h);
    const ul=document.createElement('ul');
    card.points.forEach(p=>{ const li=document.createElement('li'); li.textContent=p; ul.appendChild(li); });
    el.appendChild(ul); wrap.appendChild(el);
  });
}

/* ============================================================
   퀴즈 설정 (객관식/주관식 공용)
   ============================================================ */
let setupMode = 'mcq';           // 'mcq' | 'short'
let selectedTopics = new Set();
let selectedCount = 10;
let selectedOrder = 'random';

function openSetup(mode){
  setupMode = mode;
  const pool = mode==='mcq'?MCQ:SHORT;
  $('#setupTitle').textContent = mode==='mcq'?'객관식 퀴즈 설정':'주관식 퀴즈 설정';
  // 주제 칩
  const topics = topicsOf(pool);
  selectedTopics = new Set(topics);
  const tc = $('#topicChips'); tc.innerHTML='';
  topics.forEach(tp=>{
    const c=document.createElement('div'); c.className='chip active'; c.textContent=tp;
    c.onclick=()=>{ c.classList.toggle('active');
      if(c.classList.contains('active')) selectedTopics.add(tp); else selectedTopics.delete(tp);
      updateSetupInfo();
    };
    tc.appendChild(c);
  });
  // 문항수 칩
  const counts = mode==='mcq'?[10,20,40,'전체']:[10,20,50,'전체'];
  selectedCount = counts[0];
  const cc = $('#countChips'); cc.innerHTML='';
  counts.forEach((n,i)=>{
    const c=document.createElement('div'); c.className='chip'+(i===0?' active':''); c.textContent = n==='전체'?'전체':n+'문항';
    c.dataset.count = n;
    c.onclick=()=>{ $$('.chip',cc).forEach(x=>x.classList.remove('active')); c.classList.add('active');
      selectedCount = n; updateSetupInfo(); };
    cc.appendChild(c);
  });
  // 순서 칩
  selectedOrder='random';
  $$('#orderChips .chip').forEach(c=>{
    c.classList.toggle('active', c.dataset.order==='random');
    c.onclick=()=>{ $$('#orderChips .chip').forEach(x=>x.classList.remove('active')); c.classList.add('active'); selectedOrder=c.dataset.order; };
  });
  updateSetupInfo();
  show('setup');
}
function updateSetupInfo(){
  const pool = setupMode==='mcq'?MCQ:SHORT;
  const avail = pool.filter(q=>selectedTopics.has(q.topic)).length;
  const want = selectedCount==='전체'?avail:Math.min(selectedCount, avail);
  $('#setupInfo').textContent = `선택 주제 ${selectedTopics.size}개 · 출제 가능 ${avail}문항 · 이번 퀴즈 ${want}문항`;
}
$('#topicAll').onclick =()=>{ $$('#topicChips .chip').forEach(c=>c.classList.add('active')); selectedTopics=new Set(topicsOf(setupMode==='mcq'?MCQ:SHORT)); updateSetupInfo(); };
$('#topicNone').onclick=()=>{ $$('#topicChips .chip').forEach(c=>c.classList.remove('active')); selectedTopics=new Set(); updateSetupInfo(); };

$('#startQuizBtn').onclick=()=>{
  const pool = setupMode==='mcq'?MCQ:SHORT;
  let qs = pool.filter(q=>selectedTopics.has(q.topic));
  if(!qs.length){ toast('주제를 하나 이상 선택하세요'); return; }
  qs = selectedOrder==='random'?shuffle(qs):qs.slice();
  const n = selectedCount==='전체'?qs.length:Math.min(selectedCount,qs.length);
  qs = qs.slice(0,n);
  startQuiz(qs, { mode:setupMode, kind:'practice' });
};

/* ============================================================
   모의고사
   ============================================================ */
let examMinutes = 25;
$$('#examTimeChips .chip').forEach(c=>{
  c.onclick=()=>{ $$('#examTimeChips .chip').forEach(x=>x.classList.remove('active')); c.classList.add('active'); examMinutes=+c.dataset.min; };
});
$('#startExamBtn').onclick=()=>{
  const mcq = shuffle(MCQ).slice(0,20).map(q=>({...q,_type:'mcq'}));
  const sh  = shuffle(SHORT).slice(0,10).map(q=>({...q,_type:'short'}));
  const qs = shuffle([...mcq,...sh]);
  startQuiz(qs, { mode:'mixed', kind:'exam', minutes:examMinutes });
};

/* ============================================================
   퀴즈 엔진
   ============================================================ */
let quiz = null;
let timerInt = null;

function typeOf(q, sess){
  if(sess.mode==='mixed') return q._type;      // 모의고사: 문항에 표시
  return sess.mode;                              // 연습: 세션 모드
}

function startQuiz(questions, sess){
  quiz = {
    questions, sess,
    idx:0, score:0, max:questions.length,
    results:[],           // {q, type, ok, user}
    answered:false,
    startTs:Date.now(),
    remain: sess.minutes? sess.minutes*60 : 0,
  };
  // 상단바
  $('#quizTimer').classList.toggle('hidden', !sess.minutes);
  $('#quizScoreBadge').classList.toggle('hidden', sess.kind==='exam'); // 시험은 실시간 점수 숨김
  if(sess.minutes) startTimer();
  else stopTimer();
  renderQuestion();
  show('quiz');
}

function startTimer(){
  stopTimer();
  updateTimerLabel();
  timerInt = setInterval(()=>{
    quiz.remain--;
    updateTimerLabel();
    if(quiz.remain<=0){ stopTimer(); toast('시간 종료! 자동 제출합니다'); finishQuiz(); }
  },1000);
}
function stopTimer(){ if(timerInt){ clearInterval(timerInt); timerInt=null; } }
function updateTimerLabel(){
  const m=Math.floor(quiz.remain/60), s=quiz.remain%60;
  const el=$('#quizTimer');
  el.textContent = m+':'+String(s).padStart(2,'0');
  el.classList.toggle('warn', quiz.remain<=60);
}

function renderQuestion(){
  const q = quiz.questions[quiz.idx];
  const type = typeOf(q, quiz.sess);
  quiz.answered=false;

  // 진행 표시
  $('#quizProgressLbl').textContent = (quiz.idx+1)+' / '+quiz.max;
  $('#quizBarFill').style.width = (quiz.idx/quiz.max*100)+'%';
  $('#quizScoreBadge').textContent = quiz.score+'점';

  $('#qTopic').textContent = q.topic;
  $('#qType').textContent = type==='mcq'?'객관식 · 4지선다':'주관식 · 단답형';
  $('#qText').textContent = q.q;

  // 공통 초기화
  $('#qFeedback').classList.add('hidden'); $('#qFeedback').className='feedback hidden';
  $('#qExplain').classList.add('hidden');
  $('#qExplainBtn').classList.remove('hidden');
  $('#qNext').classList.add('hidden');
  $('#qSelfRight').classList.add('hidden');
  $('#qSelfWrong').classList.add('hidden');
  $('#qSkip').classList.remove('hidden');

  if(type==='mcq'){
    $('#qOpts').classList.remove('hidden');
    $('#qShortWrap').classList.add('hidden');
    renderMcqOptions(q);
  } else {
    $('#qOpts').classList.add('hidden');
    $('#qShortWrap').classList.remove('hidden');
    const inp=$('#qShortInput');
    inp.value=''; inp.className='short-input'; inp.disabled=false;
    $('#qShortSubmit').disabled=false;
    setTimeout(()=>inp.focus(),100);
  }
}

/* 객관식 보기 렌더 (보기 순서 셔플) */
function renderMcqOptions(q){
  const box=$('#qOpts'); box.innerHTML='';
  const keys=['A','B','C','D'];
  const order = shuffle(q.opts.map((t,i)=>({t,i})));
  q._order = order; // 저장
  order.forEach((o,pos)=>{
    const b=document.createElement('button');
    b.className='opt'; b.type='button';
    b.innerHTML = `<span class="opt-key">${keys[pos]}</span><span class="opt-txt"></span>`;
    b.querySelector('.opt-txt').textContent = o.t;
    b.onclick=()=>answerMcq(q, o.i, b);
    box.appendChild(b);
  });
}

function answerMcq(q, chosenIdx, btnEl){
  if(quiz.answered) return;
  quiz.answered=true;
  const ok = chosenIdx===q.answer;
  const opts=$$('#qOpts .opt');
  opts.forEach(b=>b.disabled=true);
  // 정답/오답 색칠
  opts.forEach(b=>{
    const key=b.querySelector('.opt-key').textContent;
  });
  // 위치 기준으로 정답/선택 찾기
  q._order.forEach((o,pos)=>{
    const b=opts[pos];
    if(o.i===q.answer) b.classList.add('correct');
    if(o.i===chosenIdx && !ok) b.classList.add('wrong');
    if(o.i!==q.answer && o.i!==chosenIdx) b.classList.add('dim');
  });
  concludeQuestion(q,'mcq',ok, q.opts[chosenIdx]);
}

$('#qShortSubmit').onclick = submitShort;
$('#qShortInput').addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); submitShort(); } });

function submitShort(){
  if(quiz.answered) return;
  const q = quiz.questions[quiz.idx];
  const inp=$('#qShortInput');
  const val=inp.value.trim();
  if(!val){ toast('답을 입력하세요'); return; }
  quiz.answered=true;
  inp.disabled=true; $('#qShortSubmit').disabled=true;
  const ok = shortMatch(val, q.answers);
  inp.classList.add(ok?'correct':'wrong');
  concludeQuestion(q,'short',ok,val, /*allowSelf=*/!ok);
}

/* 문항 마무리: 피드백/점수/버튼 */
function concludeQuestion(q, type, ok, userAns, allowSelf){
  $('#qSkip').classList.add('hidden');
  // 피드백
  const fb=$('#qFeedback'); fb.classList.remove('hidden');
  fb.className='feedback '+(ok?'ok':'no');
  if(type==='mcq'){
    fb.innerHTML = ok?'정답입니다! 🎉':'아쉬워요. 오답입니다.'
      + `<span class="ans">정답: ${['①','②','③','④'][q.answer]} ${q.opts[q.answer]}</span>`;
  } else {
    fb.innerHTML = (ok?'정답으로 인정! 🎉':'자동채점 결과: 오답')
      + `<span class="ans">모범답안: ${q.answers[0]}${q.answers.length>1?` (그 외 인정: ${q.answers.slice(1).join(', ')})`:''}</span>`;
  }

  // 점수/기록
  applyResult(q, type, ok, userAns);

  // 주관식 오답 → 자가채점 허용(관대 채점 보완)
  if(allowSelf && quiz.sess.kind!=='exam'){
    $('#qSelfRight').classList.remove('hidden');
    $('#qSelfWrong').classList.add('hidden');
    $('#qNext').classList.add('hidden');
    $('#qSelfRight').onclick=()=>{ overrideSelf(q,true); };
    // "그냥 넘어가기"는 다음 버튼으로
    $('#qNext').classList.remove('hidden');
  } else {
    $('#qNext').classList.remove('hidden');
  }

  // 시험 모드에서는 해설 자동 숨김 유지(제출 후 리뷰에서 확인). 연습은 버튼으로.
  $('#quizScoreBadge').textContent = quiz.score+'점';
}

/* 결과 반영(중복 방지 위해 results에 저장) */
function applyResult(q, type, ok, userAns){
  quiz.results.push({ q, type, ok, user:userAns });
  if(ok) quiz.score++;
  store.record(q.id, ok);
}

/* 자가채점: 오답→정답 정정 */
function overrideSelf(q, toCorrect){
  const last = quiz.results[quiz.results.length-1];
  if(!last || last.q!==q) return;
  if(toCorrect && !last.ok){
    last.ok=true; quiz.score++;
    // store 재보정
    store.data.correctCount++; delete store.data.wrong[q.id]; store.save();
    const fb=$('#qFeedback'); fb.className='feedback ok';
    fb.innerHTML='정답 처리했습니다 ✓ <span class="ans">모범답안: '+q.answers[0]+'</span>';
    $('#qShortInput').className='short-input correct';
  }
  $('#qSelfRight').classList.add('hidden');
  $('#quizScoreBadge').textContent = quiz.score+'점';
}

/* 해설 보기 */
$('#qExplainBtn').onclick=()=>{
  const q=quiz.questions[quiz.idx];
  const ex=$('#qExplain');
  if(ex.classList.contains('hidden')){
    ex.innerHTML = '<b>해설</b> · '+q.exp;
    ex.classList.remove('hidden');
    $('#qExplainBtn').textContent='💡 해설 닫기';
  } else {
    ex.classList.add('hidden');
    $('#qExplainBtn').textContent='💡 해설 보기';
  }
};

/* 모름 · 건너뛰기: 정답 공개 + 오답 처리(오답노트 저장) 후 다음으로 */
$('#qSkip').onclick=()=>{
  if(!quiz || quiz.answered) return;
  const q = quiz.questions[quiz.idx];
  const type = typeOf(q, quiz.sess);
  quiz.answered = true;

  if(type==='mcq'){
    const opts = $$('#qOpts .opt');
    opts.forEach(b=>b.disabled=true);
    q._order.forEach((o,pos)=>{
      const b=opts[pos];
      if(o.i===q.answer) b.classList.add('correct');
      else b.classList.add('dim');
    });
  } else {
    const inp=$('#qShortInput');
    inp.disabled=true; $('#qShortSubmit').disabled=true;
    inp.classList.add('wrong');
  }

  // 피드백: 정답 공개
  const fb=$('#qFeedback'); fb.classList.remove('hidden');
  fb.className='feedback no';
  if(type==='mcq'){
    fb.innerHTML = '건너뛴 문제예요. 오답노트에 저장했어요.'
      + `<span class="ans">정답: ${['①','②','③','④'][q.answer]} ${q.opts[q.answer]}</span>`;
  } else {
    fb.innerHTML = '건너뛴 문제예요. 오답노트에 저장했어요.'
      + `<span class="ans">모범답안: ${q.answers[0]}${q.answers.length>1?` (그 외 인정: ${q.answers.slice(1).join(', ')})`:''}</span>`;
  }

  applyResult(q, type, false, '(건너뜀)');
  $('#qSkip').classList.add('hidden');
  $('#qNext').classList.remove('hidden');
  $('#quizScoreBadge').textContent = quiz.score+'점';
};

/* 다음 문항 */
$('#qNext').onclick=()=>{
  $('#qExplainBtn').textContent='💡 해설 보기';
  if(quiz.idx < quiz.max-1){ quiz.idx++; renderQuestion(); }
  else finishQuiz();
};

/* 나가기 */
$('#quizQuit').onclick=()=>{
  if(confirm('퀴즈를 종료하고 홈으로 나갈까요? (현재까지 기록은 저장됩니다)')){
    stopTimer(); goHome();
  }
};

/* ============================================================
   결과 화면
   ============================================================ */
function finishQuiz(){
  stopTimer();
  const r=quiz;
  const pct = r.max? Math.round(r.score/r.max*100):0;
  $('#resultScore').textContent = r.score+' / '+r.max;
  $('#resultPct').textContent = pct+'%';
  let emoji='🎉', h='훌륭해요!';
  if(pct<40){ emoji='💪'; h='다시 도전해봐요'; }
  else if(pct<70){ emoji='🙂'; h='좋아요, 조금만 더!'; }
  else if(pct<90){ emoji='👍'; h='잘했어요!'; }
  else { emoji='🏆'; h='완벽에 가까워요!'; }
  $('#resultEmoji').textContent=emoji; $('#resultH').textContent=h;

  const wrongInThis = r.results.filter(x=>!x.ok).length;
  const usedSec = Math.round((Date.now()-r.startTs)/1000);
  const mm=Math.floor(usedSec/60), ss=usedSec%60;
  let detail = `정답 ${r.score}문항 · 오답 ${wrongInThis}문항 · 소요 ${mm}분 ${ss}초`;
  if(r.sess.kind==='exam'){
    const grade = pct>=90?'A':pct>=80?'B':pct>=70?'C':pct>=60?'D':'F';
    detail += `<br><b style="color:var(--brand);font-size:20px">모의고사 등급: ${grade}</b>`;
  }
  $('#resultDetail').innerHTML = detail;

  // 틀린 문제 다시 풀기 버튼
  $('#resultRetryWrong').classList.toggle('hidden', wrongInThis===0);
  $('#resultRetryWrong').onclick=()=>{
    const qs = r.results.filter(x=>!x.ok).map(x=>x.q);
    startQuiz(shuffle(qs), { mode:r.sess.mode, kind:'practice' });
  };

  // 리뷰
  buildReview(r);
  $('#reviewList').classList.add('hidden');
  $('#resultReview').textContent='📋 문항별 다시 보기';

  renderHome();
  show('result');
}

$('#resultReview').onclick=()=>{
  const rl=$('#reviewList');
  rl.classList.toggle('hidden');
  $('#resultReview').textContent = rl.classList.contains('hidden')?'📋 문항별 다시 보기':'▲ 리뷰 접기';
  if(!rl.classList.contains('hidden')) rl.scrollIntoView({behavior:'smooth'});
};

function buildReview(r){
  const rl=$('#reviewList'); rl.innerHTML='';
  r.results.forEach((x,i)=>{
    const q=x.q;
    const el=document.createElement('div'); el.className='review-item';
    const type = x.type;
    let ansHtml, userHtml;
    if(type==='mcq'){
      ansHtml = `<div class="review-a"><span class="lbl">정답:</span> ${['①','②','③','④'][q.answer]} ${q.opts[q.answer]}</div>`;
      userHtml = x.ok?'' : `<div class="review-a"><span class="lbl">내 선택:</span> ${x.user??'—'}</div>`;
    } else {
      ansHtml = `<div class="review-a"><span class="lbl">모범답안:</span> ${q.answers[0]}</div>`;
      userHtml = `<div class="review-a"><span class="lbl">내 답:</span> ${x.user||'—'}</div>`;
    }
    el.innerHTML =
      `<div class="review-q"><span class="review-mark ${x.ok?'ok':'no'}">${x.ok?'정답':'오답'}</span>${i+1}. ${q.q}</div>`
      + ansHtml + userHtml
      + `<div class="review-exp">💡 ${q.exp}</div>`;
    rl.appendChild(el);
  });
}

/* ============================================================
   오답노트
   ============================================================ */
function startWrongQuiz(){
  const wrongIds = Object.keys(store.data.wrong);
  if(!wrongIds.length){ toast('오답이 없어요! 먼저 퀴즈를 풀어보세요 👍'); return; }
  const pool=[...MCQ,...SHORT];
  const map={}; pool.forEach(q=>map[q.id]=q);
  let qs = wrongIds.map(id=>{
    const q=map[id]; if(!q) return null;
    // 모의고사 혼합처럼 각 문항 타입 지정
    return {...q, _type: MCQ.some(m=>m.id===q.id)?'mcq':'short'};
  }).filter(Boolean);
  if(!qs.length){ toast('오답 데이터를 찾을 수 없어요'); return; }
  startQuiz(shuffle(qs), { mode:'mixed', kind:'practice' });
}

/* ============================================================
   네비게이션
   ============================================================ */
function goHome(){ renderHome(); show('home'); }

function route(dest){
  switch(dest){
    case 'home': goHome(); break;
    case 'learn': learnSecIdx=0; renderLearn(); show('learn'); break;
    case 'mcqSetup': openSetup('mcq'); break;
    case 'shortSetup': openSetup('short'); break;
    case 'examIntro': $('#examMinLbl').textContent=examMinutes; show('examIntro'); break;
    case 'wrong': startWrongQuiz(); break;
    case 'reset':
      if(confirm('모든 학습 기록(진도·오답·점수)을 삭제할까요?')){ store.reset(); renderHome(); toast('기록을 초기화했어요'); }
      break;
  }
}
document.addEventListener('click', e=>{
  const el=e.target.closest('[data-go]');
  if(el){ route(el.dataset.go); }
});

/* 초기 렌더 */
renderHome();
show('home');
