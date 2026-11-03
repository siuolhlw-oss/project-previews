(function (scope) {
  function createEngine(data) {
    const teachers = new Map(data.teachers.map(t => [t.name, t]));
    const classes = new Map(data.classes.map(c => [c.id, c]));
    const occupied = new Map();
    const key = (day, period) => `${day}:${period}`;
    function occupy(name, lesson) {
      if (!occupied.has(name)) occupied.set(name, new Set());
      occupied.get(name).add(key(lesson.day, lesson.period));
    }
    data.teachers.forEach(t => t.lessons.forEach(l => occupy(t.name, l)));
    data.classes.forEach(c => c.lessons.forEach(l => l.teachers.forEach(n => occupy(n, l))));
    const at = (lessons, day, period) => lessons.filter(l => l.day === day && l.period === period);
    function findCandidates(name, lesson) {
      const sourceTeacher = teachers.get(name);
      if (sourceTeacher?.scheduleStatus === 'partial') return { status: 'incomplete-data', candidates: [] };
      if (!sourceTeacher || !at(sourceTeacher.lessons, lesson.day, lesson.period).some(
        l => l.subject === lesson.subject && l.classIds.join('|') === lesson.classIds.join('|')
      )) return { status: 'needs-review', candidates: [] };
      if (lesson.classIds.length !== 1) return { status: 'needs-review', candidates: [] };
      const classId = lesson.classIds[0];
      const group = classes.get(classId);
      if (!group) return { status: 'needs-review', candidates: [] };
      const originals = at(group.lessons, lesson.day, lesson.period);
      if (originals.length !== 1 || originals[0].teachers.length !== 1 ||
          originals[0].teachers[0] !== name || originals[0].subject !== lesson.subject) {
        return { status: 'needs-review', candidates: [] };
      }
      const candidates = [];
      for (const other of group.lessons) {
        if (other.teachers.length !== 1 || key(other.day, other.period) === key(lesson.day, lesson.period)) continue;
        if ((lesson.period === 8) !== (other.period === 8)) continue;
        const otherName = other.teachers[0];
        if (otherName === name || !teachers.has(otherName)) continue;
        if (teachers.get(otherName).scheduleStatus === 'partial') continue;
        const confirmations = at(teachers.get(otherName).lessons, other.day, other.period);
        if (confirmations.length !== 1 || confirmations[0].classIds.length !== 1 ||
            confirmations[0].classIds[0] !== classId || confirmations[0].subject !== other.subject) continue;
        if (occupied.get(name)?.has(key(other.day, other.period))) continue;
        if (occupied.get(otherName)?.has(key(lesson.day, lesson.period))) continue;
        candidates.push({ day: other.day, period: other.period, subject: other.subject, teacher: otherName, classId });
      }
      candidates.sort((a, b) => a.day - b.day || a.period - b.period);
      return { status: 'ok', candidates };
    }
    return { teachers, classes, findCandidates };
  }
  scope.TimetableEngine = { createEngine };
  if (typeof module !== 'undefined' && module.exports) module.exports = { createEngine };
})(globalThis);
