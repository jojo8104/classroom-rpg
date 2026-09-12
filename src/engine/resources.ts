import type { StudentLessonState } from '../domain.js';
import type { ActionEvent, ConcentrationReason } from '../events.js';
import { roundValue } from './combat.js';

export function changeMorale(state: StudentLessonState, value: number, events: ActionEvent[], reason?: 'success' | 'retaliation' | 'dropout'): void {
  const before = state.morale;
  state.morale = roundValue(Math.max(0, Math.min(100, value)));
  events.push({ type: 'MORALE_CHANGED', studentId: state.studentId, before, after: state.morale, ...(reason ? { reason } : {}) });
}

export function updateConcentration(state: StudentLessonState, value: number, reason: ConcentrationReason,
  dropoutMoraleLoss: number, events: ActionEvent[]): void {
  const before = state.concentration;
  state.concentration = roundValue(Math.max(0, Math.min(100, value)));
  events.push({ type: 'CONCENTRATION_CHANGED', studentId: state.studentId, before, after: state.concentration, reason });
  if (before > 0 && state.concentration === 0) {
    events.push({ type: 'STUDENT_DROPPED_OUT', studentId: state.studentId });
    changeMorale(state, state.morale - dropoutMoraleLoss, events, 'dropout');
  } else if (before === 0 && state.concentration > 0) events.push({ type: 'STUDENT_RESUMED', studentId: state.studentId });
}
