import type { CalendarConfig, SchoolCalendar } from '../models/SchoolCalendar.js';

export function validateCalendarConfig(c: CalendarConfig): void {
  const integer = (n: number, min: number, max: number) => Number.isSafeInteger(n) && n >= min && n <= max;
  const unique = (ids: string[]) => ids.every(id => typeof id === 'string' && id.trim()) && new Set(ids).size === ids.length;
  if (!c.id?.trim() || !c.name?.trim() || !integer(c.teachingWeeks, 1, 200) || !integer(c.slotsPerDay, 1, 24)
    || !c.days.length || c.days.length > 14 || !unique(c.days.map(d => d.id)) || c.days.some(d => !d.name?.trim())
    || !c.workingDays.length || !unique(c.workingDays) || c.workingDays.some(id => !c.days.some(d => d.id === id))
    || !c.periods.length || !unique(c.periods.map(p => p.id))
    || c.periods.some(p => !p.name?.trim() || !integer(p.teachingWeeks, 1, 200) || !integer(p.holidayWeeksAfter, 0, 52))
    || c.periods.reduce((sum, p) => sum + p.teachingWeeks, 0) !== c.teachingWeeks
    || !Number.isFinite(c.masteryThreshold) || c.masteryThreshold < 0 || c.masteryThreshold > 100) throw new Error('Configuration du calendrier invalide : vérifiez semaines, périodes, jours et créneaux.');
  const weeks = c.periods.reduce((sum, p) => sum + p.teachingWeeks + p.holidayWeeksAfter, 0);
  if (!unique(c.specialDays.map(d => `${d.week}/${d.dayId}`)) || c.specialDays.some(d => !integer(d.week, 1, weeks) || !c.days.some(day => day.id === d.dayId) || !['school', 'holiday', 'event'].includes(d.status) || typeof d.label !== 'string' || (d.slots !== undefined && (!integer(d.slots, 0, 24) || d.status !== 'school')))) throw new Error('Jours particuliers invalides.');
  for (const d of c.specialDays) {
    let end = 0;
    const period = c.periods.find(p => { end += p.teachingWeeks + p.holidayWeeksAfter; return d.week <= end; })!;
    if (d.status === 'school' && d.week > end - period.holidayWeeksAfter) throw new Error('Une semaine de vacances ne peut pas contenir un jour scolaire.');
  }
}

export function generateSchoolCalendar(config: CalendarConfig): SchoolCalendar {
  validateCalendarConfig(config);
  let number = 0;
  return { id: config.id, name: config.name, periods: config.periods.map(period => ({ id: period.id, name: period.name,
    weeks: Array.from({ length: period.teachingWeeks + period.holidayWeeksAfter }, (_, i) => {
      const week = ++number, id = `${config.id}/week-${week}`, teaching = i < period.teachingWeeks;
      return { id, number: week, periodId: period.id, teaching, days: config.days.map(day => {
        const special = config.specialDays.find(d => d.week === week && d.dayId === day.id);
        const status = special?.status ?? (teaching && config.workingDays.includes(day.id) ? 'school' : 'holiday');
        const dayId = `${id}/${day.id}`;
        return { id: dayId, name: day.name, status, label: special?.label ?? (teaching ? (status === 'school' ? 'Enseignement' : 'Jour non travaillé') : 'Vacances'),
          slots: Array.from({ length: status === 'school' ? (special?.slots ?? config.slotsPerDay) : 0 }, (_, index) => ({ id: `${dayId}/slot-${index + 1}`, index, scope: 'school' as const })) };
      }) };
    }) })) };
}
