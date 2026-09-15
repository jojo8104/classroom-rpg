export type DayStatus = 'school' | 'holiday' | 'event';
export interface CalendarConfig {
  id: string;
  name: string;
  teachingWeeks: number;
  days: { id: string; name: string }[];
  workingDays: string[];
  slotsPerDay: number;
  periods: { id: string; name: string; teachingWeeks: number; holidayWeeksAfter: number }[];
  specialDays: { week: number; dayId: string; status: DayStatus; label: string; slots?: number }[];
  masteryThreshold: number;
}
export interface CalendarSlot { id: string; index: number; scope: 'school' | 'teacher' }
export interface CalendarDay { id: string; name: string; status: DayStatus; label: string; slots: CalendarSlot[] }
export interface CalendarWeek { id: string; number: number; periodId: string; teaching: boolean; days: CalendarDay[] }
export interface SchoolCalendar { id: string; name: string; periods: { id: string; name: string; weeks: CalendarWeek[] }[] }
/** Le contenu pédagogique reste exclusivement dans Curriculum. */
export interface Session { id: string; slotId: string; lessonId: string; type: string; status: 'planned' | 'completed' }
export interface AgendaSave { version: 1; config: CalendarConfig; sessions: Session[]; cursor: number; nextId: number }
