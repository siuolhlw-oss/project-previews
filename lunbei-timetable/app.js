const engine = TimetableEngine.createEngine(timetableData);
const weekdays = ['週一','週二','週三','週四','週五'];
const viewport = matchMedia('(max-width:650px)');
let selectedTarget = null;
let classReturn = null;
let activeLesson = null;
let candidatePreview = null;
function clearCandidatePreview(){candidatePreview?.destroy();candidatePreview=null;}
let viewMode = 'day';
const taipeiDateFormatter = new Intl.DateTimeFormat('en-US', {timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'});
function taipeiToday(now=new Date()){
 const parts=Object.fromEntries(taipeiDateFormatter.formatToParts(now).map(part=>[part.type,part.value]));
 return {date:`${parts.year}-${parts.month}-${parts.day}`,day:Math.max(1,['Mon','Tue','Wed','Thu','Fri'].indexOf(parts.weekday)+1)};
}
const initialToday=taipeiToday();
let chosenDay=initialToday.day;
let observedDate=initialToday.date;
const teacherPanel = document.querySelector('.teacher-panel');
const teacherToggle = document.createElement('button');
teacherToggle.type = 'button';teacherToggle.className = 'teacher-toggle';teacherToggle.textContent = '收起名單';
teacherToggle.setAttribute('aria-expanded','true');teacherToggle.setAttribute('aria-controls','teacher-sections');
document.querySelector('.teacher-head').append(teacherToggle);
const schedule = document.createElement('section');
schedule.id = 'schedule';schedule.hidden = true;schedule.tabIndex = -1;schedule.setAttribute('aria-label','課表');
schedule.innerHTML = `<div class="schedule-head"><div><h2 id="schedule-title"></h2><span class="schedule-status" id="schedule-status" hidden>部分課表</span><p class="schedule-meta">${escapeHTML(timetableData.semester)} · ${escapeHTML(timetableData.version)} 版</p></div><div class="schedule-actions"><button type="button" data-return-class hidden></button><button type="button" id="change-class">更換班級</button><button type="button" id="change-teacher">更換老師</button></div></div><div class="lesson-summary" hidden><p></p><button type="button" id="view-candidates">查看調課候選</button></div><p class="schedule-notice" hidden>完整課表待補，其餘時段標示「未提供」，不代表空堂。</p><nav class="mode-controls" aria-label="課表顯示模式"><button type="button" data-mode="day" aria-pressed="true">單日列表</button><button type="button" data-mode="week" aria-pressed="false">整週課表</button></nav><p class="schedule-helper">點選課程，查看可互換的調課候選</p><nav class="weekday-buttons" aria-label="選擇星期"></nav><div class="schedule-grid"></div><div class="schedule-day"></div><p class="schedule-footer">空白表示原課表未排課；臨時調課及其他行程不在此資料內。</p><section class="candidate-panel" aria-label="調課候選" tabindex="-1" hidden></section>`;
document.querySelector('main').append(schedule);
const quickNav = document.createElement('nav');
quickNav.className='quick-nav';quickNav.hidden=true;quickNav.setAttribute('aria-label','課表快速操作');
quickNav.innerHTML='<button type="button" data-return-class hidden></button><button type="button" data-quick="schedule">回到課表</button><button type="button" data-quick="class">更換班級</button><button type="button" data-quick="teacher">更換老師</button>';
document.body.append(quickNav);
function setQuickNavVisible(visible){quickNav.hidden=!visible;document.body.classList.toggle('has-quick-nav',visible);}
new IntersectionObserver(([entry])=>setQuickNavVisible(!schedule.hidden&&entry.boundingClientRect.bottom<=0)).observe(document.querySelector('.schedule-head'));
function scrollToElement(element){element.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});}
function setCollapsed(collapsed){teacherPanel.classList.toggle('collapsed',collapsed);teacherToggle.textContent=collapsed?'更換老師':'收起名單';teacherToggle.setAttribute('aria-expanded',String(!collapsed));}
function openTeachers(){setQuickNavVisible(false);setCollapsed(false);const search=document.querySelector('#teacher-search');search.value='';search.dispatchEvent(new Event('input'));scrollToElement(teacherPanel);search.focus({preventScroll:true});}
function openClasses(){setQuickNavVisible(false);const panel=document.querySelector('[aria-label="班級選單"]');scrollToElement(panel);panel.querySelector('button').focus({preventScroll:true});}
function returnToSchedule(){clearCandidatePreview();document.querySelector('.candidate-panel').hidden=true;setQuickNavVisible(false);schedule.focus({preventScroll:true});scrollToElement(schedule);}
teacherToggle.onclick=()=>{if(teacherPanel.classList.contains('collapsed'))openTeachers();else setCollapsed(true);};
document.querySelector('#change-teacher').onclick=openTeachers;
document.querySelector('#change-class').onclick=openClasses;
quickNav.querySelector('[data-quick="teacher"]').onclick=openTeachers;
quickNav.querySelector('[data-quick="class"]').onclick=openClasses;
quickNav.querySelector('[data-quick="schedule"]').onclick=returnToSchedule;
document.querySelectorAll('[data-return-class]').forEach(button=>button.onclick=returnToClass);
document.querySelector('#view-candidates').onclick=()=>{if(activeLesson)openLesson(activeLesson);};
function targetLessons(){return selectedTarget.record.lessons;}
function secondary(lesson){return selectedTarget.kind==='teacher'?lesson.classIds.map(id=>/^[789]/.test(id)?id+' 班':engine.classes.get(id)?.label||id).join('、'):lesson.teachers.join('、');}
function courseButton(lesson,index){
 const partial=selectedTarget.kind==='teacher'?selectedTarget.record.scheduleStatus==='partial':lesson.teachers.some(name=>engine.teachers.get(name)?.scheduleStatus==='partial');
 const label=escapeHTML(weekdays[lesson.day-1]+'第'+lesson.period+'節 '+lesson.subject+' '+secondary(lesson));
 const selected=lesson===activeLesson;
 const attributes=`class="lesson-cell${partial&&selectedTarget.kind==='teacher'?' partial-lesson':''}${selected?' selected':''}"${selected?' aria-current="true"':''}`;
 const content=`<strong>${escapeHTML(lesson.subject)}</strong><small>${escapeHTML(secondary(lesson))}</small>`;
 return partial&&selectedTarget.kind==='teacher'?`<div ${attributes} aria-label="${label}，部分課表，暫不提供調課候選">${content}</div>`:`<button type="button" ${attributes} data-lesson="${index}" aria-label="${label}">${content}</button>`;
}
function renderSchedule(){
 document.querySelectorAll('[data-return-class]').forEach(button=>{button.hidden=!classReturn;button.textContent=classReturn?'回到 '+classReturn.id+' 班':'';});
 quickNav.classList.toggle('has-class-origin',!!classReturn);document.body.classList.toggle('has-class-origin',!!classReturn);
 const summary=document.querySelector('.lesson-summary');summary.hidden=!activeLesson;
 if(activeLesson)summary.querySelector('p').textContent='已選取：'+weekdays[activeLesson.day-1]+' 第 '+activeLesson.period+' 節 · '+activeLesson.subject+' · '+secondary(activeLesson);
 const lessons=targetLessons();const title=selectedTarget.kind==='teacher'?selectedTarget.record.name+'老師':selectedTarget.record.id+' 班';
 const partial=selectedTarget.kind==='teacher'&&selectedTarget.record.scheduleStatus==='partial';
 document.querySelector('#schedule-status').hidden=!partial;
 document.querySelector('.schedule-notice').hidden=!partial;
 document.querySelector('.schedule-helper').textContent=partial?'已提供的課程仍可查看；暫不提供調課候選。':selectedTarget.kind==='class'?'點選課程，查看授課老師課表及調課候選':'點選課程，查看可互換的調課候選';
 document.querySelector('.schedule-footer').textContent=partial?'未提供不代表空堂；待完整課表補齊後才能判斷調課。':'空白表示原課表未排課；臨時調課及其他行程不在此資料內。';
 const emptyWeek=partial?'<span class="unknown-class">未提供</span>':'<span class="no-class">—</span>';
 const emptyDay=partial?'未提供':'未排課';
 document.querySelector('#schedule-title').textContent=title;document.querySelector('.teacher-head').dataset.selected=title;
 let grid='<table class="week-table"><thead><tr><th scope="col">節次</th>'+weekdays.map(day=>'<th scope="col">'+day+'</th>').join('')+'</tr></thead><tbody>';
 timetableData.periods.forEach(period=>{if(period.number===5)grid+='<tr class="lunch-row"><td colspan="6">午間休息</td></tr>';grid+=`<tr><td>${period.number}<small class="period-time">${period.start}</small></td>`;for(let day=1;day<=5;day++){const i=lessons.findIndex(l=>l.day===day&&l.period===period.number);grid+='<td>'+(i<0?emptyWeek:courseButton(lessons[i],i))+'</td>';}grid+='</tr>';});
 document.querySelector('.schedule-grid').innerHTML=grid+'</tbody></table>';
 document.querySelector('.weekday-buttons').innerHTML=weekdays.map((day,i)=>`<button type="button" data-day="${i+1}" aria-pressed="${chosenDay===i+1}">${day}</button>`).join('');
 document.querySelector('.schedule-day').innerHTML=timetableData.periods.map(period=>{const i=lessons.findIndex(l=>l.day===chosenDay&&l.period===period.number);return `<div class="day-slot"><div class="day-slot-time">第 ${period.number} 節<small>${period.start}</small></div>${i<0?`<div class="day-empty">${emptyDay}</div>`:courseButton(lessons[i],i)}</div>`;}).join('');
 document.querySelectorAll('.weekday-buttons button').forEach(b=>b.onclick=()=>{chosenDay=Number(b.dataset.day);renderSchedule();});
 document.querySelectorAll('[data-lesson]').forEach(b=>b.onclick=()=>openLesson(lessons[Number(b.dataset.lesson)]));
 schedule.dataset.mode=viewMode;document.querySelectorAll('.mode-controls button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===viewMode)));
}
document.querySelectorAll('.mode-controls button').forEach(b=>b.onclick=()=>{viewMode=b.dataset.mode;renderSchedule();});
function openLesson(lesson){
 if(selectedTarget.kind==='class'&&lesson.teachers.length===1){
  const name=lesson.teachers[0];
  const source=engine.teachers.get(name)?.lessons.find(l=>l.day===lesson.day&&l.period===lesson.period&&l.classIds.includes(selectedTarget.record.id)&&l.subject===lesson.subject);
  if(source){
   const origin={id:selectedTarget.record.id,day:chosenDay,mode:viewMode};
   choose('teacher',name,false,true);classReturn=origin;chosenDay=lesson.day;activeLesson=source;
   renderSchedule();showCandidates(source,false);schedule.focus({preventScroll:true});scrollToElement(schedule);return;
  }
 }
 activeLesson=lesson;renderSchedule();showCandidates(lesson);
}
function returnToClass(){
 if(!classReturn)return;
 const origin=classReturn;
 choose('class',origin.id,false,true);chosenDay=origin.day;viewMode=origin.mode;renderSchedule();
 schedule.focus({preventScroll:true});scrollToElement(schedule);
}
function showCandidates(lesson,move=true){
 clearCandidatePreview();
 let name,source;
 if(selectedTarget.kind==='teacher'){name=selectedTarget.record.name;source=lesson;}
 else if(lesson.teachers.length===1){name=lesson.teachers[0];source=engine.teachers.get(name)?.lessons.find(l=>l.day===lesson.day&&l.period===lesson.period&&l.classIds.includes(selectedTarget.record.id)&&l.subject===lesson.subject);}
 const result=source?engine.findCandidates(name,source):{status:'needs-review',candidates:[]};
 const panel=document.querySelector('.candidate-panel');
 const body=result.status==='incomplete-data'?'<p class="candidate-empty">這位老師的完整課表尚未提供，暫不提供調課候選。</p>':result.status==='needs-review'?'<p class="candidate-empty">本節涉及多人授課或來源差異，需人工確認，暫不提供調課候選。</p>':result.candidates.length?CandidatePreview.renderCards(result.candidates):'<p class="candidate-empty">依目前課表，找不到同班、雙方均無衝堂的直接互換選項。</p>';
 panel.innerHTML=`<div class="candidate-header"><h3>調課候選${result.status==='ok'?' · '+result.candidates.length:''}</h3><button type="button" aria-label="關閉調課候選">×</button></div><p class="selected-lesson">${weekdays[lesson.day-1]} 第 ${lesson.period} 節 · ${escapeHTML(lesson.subject)} · ${escapeHTML(name||lesson.teachers.join('、'))}</p>${body}<p class="candidate-disclaimer">第 1–7 節互調，第 8 節僅與第 8 節互調。候選依固定課表判斷，交換前仍須與對方確認。此處不會修改課表或送出申請。</p>`;
 document.querySelector('#view-candidates').textContent=result.status==='ok'?'查看調課候選（'+result.candidates.length+'）':'查看調課說明';
 if(source&&result.status==='ok'&&result.candidates.length)candidatePreview=CandidatePreview.mount(panel,{engine,name,source,candidates:result.candidates,periods:timetableData.periods});
 panel.querySelector('.candidate-header button').onclick=returnToSchedule;panel.hidden=false;if(move){panel.focus({preventScroll:true});scrollToElement(panel);}
}
function choose(kind,id,move=true,preserveDay=false){
 const record=kind==='teacher'?engine.teachers.get(id):engine.classes.get(id);if(!record)return;
 clearCandidatePreview();
 if(viewport.matches&&!preserveDay){const today=taipeiToday();chosenDay=today.day;observedDate=today.date;}
 classReturn=null;activeLesson=null;setQuickNavVisible(false);selectedTarget={kind,record};clearSelection();document.querySelectorAll('.teacher-button,.class-button').forEach(b=>{const active=kind==='teacher'?b.dataset.name===id:b.dataset.class===id;if(active){b.classList.add('active');b.setAttribute('aria-pressed','true');}});
 document.querySelector('#empty-state').hidden=true;
 setCollapsed(true);schedule.hidden=false;document.querySelector('.candidate-panel').hidden=true;renderSchedule();if(move){schedule.focus({preventScroll:true});scrollToElement(schedule);}
}
function refreshDayOnReturn(){
 if(document.visibilityState!=='visible'||!viewport.matches)return;
 const today=taipeiToday();
 if(today.date===observedDate)return;
 observedDate=today.date;chosenDay=today.day;activeLesson=null;
 const panel=document.querySelector('.candidate-panel');
 const wasShowingCandidates=!panel.hidden;
 const hadHiddenFocus=panel.contains(document.activeElement)||document.querySelector('.lesson-summary').contains(document.activeElement);
 clearCandidatePreview();panel.hidden=true;panel.innerHTML='';
 document.querySelector('#view-candidates').textContent='查看調課候選';
 if(selectedTarget){
  renderSchedule();
  if(hadHiddenFocus)schedule.focus({preventScroll:true});
  if(wasShowingCandidates){setQuickNavVisible(false);scrollToElement(schedule);}
 }
}
// Recheck only on return; a foreground session must not jump at midnight.
document.addEventListener('visibilitychange',refreshDayOnReturn);
window.addEventListener('pageshow',refreshDayOnReturn);
window.addEventListener('focus',refreshDayOnReturn);
document.querySelectorAll('.class-button').forEach(b=>b.onclick=()=>choose('class',b.dataset.class));
document.querySelectorAll('.teacher-button:not(:disabled)').forEach(b=>b.onclick=()=>choose('teacher',b.dataset.name));
clearSelection();
const linkedTeacher=new URLSearchParams(location.search).get('teacher');
if(linkedTeacher)choose('teacher',linkedTeacher,viewport.matches);

document.querySelector('#semester').textContent=timetableData.semester;
document.querySelector('#data-version').textContent='課表版本：'+timetableData.version+'｜適用期間：'+timetableData.validFrom+' 至 '+timetableData.validThrough;

document.querySelector('#manual-link').href=siteConfig.manualPdf;
