import type { CalendarConfig } from '../models/SchoolCalendar.js';

/** Exemple de campagne, sans dépendance au calendrier civil ni à une zone scolaire. */
export const defaultCalendarConfig: CalendarConfig = {
  id: 'school-year', name: 'Année scolaire', teachingWeeks: 36,
  days: [{ id: 'mon', name: 'Lundi' }, { id: 'tue', name: 'Mardi' }, { id: 'wed', name: 'Mercredi' }, { id: 'thu', name: 'Jeudi' }, { id: 'fri', name: 'Vendredi' }],
  workingDays: ['mon', 'tue', 'wed', 'thu', 'fri'], slotsPerDay: 2,
  periods: [7, 7, 6, 6, 10].map((teachingWeeks, i) => ({ id: `period-${i + 1}`, name: `Période ${i + 1}`, teachingWeeks, holidayWeeksAfter: i < 4 ? 2 : 0 })),
  specialDays: [], masteryThreshold: 80,
};
