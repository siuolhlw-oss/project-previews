(function (scope) {
  const days = ['週一', '週二', '週三', '週四', '週五'];
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function resolvePair(engine, name, source, candidate) {
    const original = engine.teachers.get(name);
    const other = engine.teachers.get(candidate.teacher);
    if (!original || !other || original.scheduleStatus === 'partial' || other.scheduleStatus === 'partial') return null;
    const matches = (teacher, lesson) => teacher.lessons.filter(l =>
      l.day === lesson.day && l.period === lesson.period && l.subject === lesson.subject && l.classIds.includes(candidate.classId));
    const first = matches(original, source), second = matches(other, candidate);
    if (first.length !== 1 || second.length !== 1) return null;
    return {original: {teacher: original, lesson: first[0]}, other: {teacher: other, lesson: second[0]}};
  }

  function course(teacher, day, period, selected, classes) {
    const lesson = teacher.lessons.find(l => l.day === day && l.period === period);
    if (!lesson) return '<span class="compare-empty">未排課</span>';
    const picked = lesson === selected;
    const labels = lesson.classIds.map(id => /^[789]/.test(id) ? id + ' 班' : classes.get(id)?.label || id).join('、');
    return `<div class="compare-course${picked ? ' is-picked' : ''}">${picked ? '<span class="compare-picked-label">調課節次</span>' : ''}<strong>${escape(lesson.subject)}</strong><small>${escape(labels)}</small></div>`;
  }

  function renderWeek(teacher, selected, periods, classes) {
    return `<table class="compare-week-table"><caption>${escape(teacher.name)}老師整週課表</caption><thead><tr><th scope="col">節次</th>${days.map(day => `<th scope="col">${day}</th>`).join('')}</tr></thead><tbody>${periods.map(period =>
      `<tr><th scope="row">${period.number}</th>${days.map((_, i) => `<td>${course(teacher, i + 1, period.number, selected, classes)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  function renderDay(teacher, selected, day, periods, classes) {
    return `<p class="compare-day-title">${days[day - 1]}課表</p>${periods.map(period =>
      `<div class="compare-day-row"><div class="compare-time">第 ${period.number} 節<small>${escape(period.start)}</small></div>${course(teacher, day, period.number, selected, classes)}</div>`).join('')}`;
  }

  function renderCards(candidates) {
    return `<div class="candidate-list">${candidates.map((c, i) => `<article class="candidate-item"><button type="button" class="candidate-toggle" id="candidate-toggle-${i}" data-candidate="${i}" aria-expanded="false" aria-controls="candidate-detail-${i}"><span class="candidate-summary"><strong>候選 ${i + 1} · ${days[c.day - 1]} 第 ${c.period} 節</strong><span>${escape(c.subject)} · ${escape(c.teacher)}</span><small>${escape(c.classId)} 班 · 雙方無衝堂</small></span><span class="candidate-toggle-state">展開課表</span></button><section class="candidate-detail" id="candidate-detail-${i}" aria-labelledby="candidate-toggle-${i}" hidden></section></article>`).join('')}</div>`;
  }

  function mount(panel, {engine, name, source, candidates, periods}) {
    const buttons = [...panel.querySelectorAll('[data-candidate]')];
    let openIndex = null;
    function close(index) {
      if (index === null) return;
      const button = buttons[index], detail = panel.querySelector('#candidate-detail-' + index);
      button.setAttribute('aria-expanded', 'false');
      button.querySelector('.candidate-toggle-state').textContent = '展開課表';
      button.parentElement.classList.remove('is-expanded');
      detail.hidden = true;
      detail.innerHTML = '';
    }
    function open(index) {
      const button = buttons[index], detail = panel.querySelector('#candidate-detail-' + index);
      const candidate = candidates[index], pair = resolvePair(engine, name, source, candidate);
      button.setAttribute('aria-expanded', 'true');
      button.querySelector('.candidate-toggle-state').textContent = '收起課表';
      button.parentElement.classList.add('is-expanded');
      detail.hidden = false;
      detail.dataset.mode = 'day';
      if (!pair) {
        detail.innerHTML = '<p class="candidate-empty">課表資料無法完整對應，請先人工確認。</p>';
        return;
      }
      const heading = (entry, role) => `<p class="compare-role">${role}</p><h4>${escape(entry.teacher.name)}老師</h4><p class="compare-lesson">${days[entry.lesson.day - 1]} 第 ${entry.lesson.period} 節 · ${escape(entry.lesson.subject)} · ${escape(candidate.classId)} 班</p>`;
      detail.innerHTML = `<div class="candidate-comparison"><section class="comparison-source" aria-label="原老師課表">${heading(pair.original, '原老師')}<div class="compare-week">${renderWeek(pair.original.teacher, pair.original.lesson, periods, engine.classes)}</div></section><section class="comparison-target" aria-label="候選老師課表">${heading(pair.other, '候選老師')}<nav class="candidate-mode-controls" aria-label="候選課表顯示模式"><button type="button" data-preview-mode="day" aria-pressed="true">單日列表</button><button type="button" data-preview-mode="week" aria-pressed="false">整週課表</button></nav><nav class="candidate-day-buttons" aria-label="候選課表星期">${days.map((day, i) => `<button type="button" data-preview-day="${i + 1}" aria-pressed="${candidate.day === i + 1}">${day}</button>`).join('')}</nav><div class="compare-day">${renderDay(pair.other.teacher, pair.other.lesson, candidate.day, periods, engine.classes)}</div><div class="compare-week">${renderWeek(pair.other.teacher, pair.other.lesson, periods, engine.classes)}</div></section></div><p class="compare-note">綠色標示雙方原本要交換的課程；此處顯示原課表，尚未變更排課。</p>`;
      detail.querySelectorAll('[data-preview-mode]').forEach(control => {
        control.onclick = () => {
          detail.dataset.mode = control.dataset.previewMode;
          detail.querySelectorAll('[data-preview-mode]').forEach(b => b.setAttribute('aria-pressed', String(b === control)));
        };
      });
      detail.querySelectorAll('[data-preview-day]').forEach(control => {
        control.onclick = () => {
          const day = Number(control.dataset.previewDay);
          detail.querySelector('.compare-day').innerHTML = renderDay(pair.other.teacher, pair.other.lesson, day, periods, engine.classes);
          detail.querySelectorAll('[data-preview-day]').forEach(b => b.setAttribute('aria-pressed', String(b === control)));
        };
      });
    }
    buttons.forEach((button, index) => {
      button.onclick = () => {
        // Keep the clicked row at the same screen position when an earlier panel collapses.
        const before = button.getBoundingClientRect().top;
        const wasOpen = openIndex === index;
        close(openIndex);
        openIndex = wasOpen ? null : index;
        if (!wasOpen) open(index);
        const delta = button.getBoundingClientRect().top - before;
        if (Math.abs(delta) > 1) scope.scrollBy({top: delta, left: 0, behavior: 'instant'});
      };
    });
    return {destroy() {close(openIndex); openIndex = null; buttons.forEach(button => {button.onclick = null;});}};
  }

  const api = {resolvePair, renderWeek, renderDay, renderCards, mount};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else scope.CandidatePreview = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
