import { roundValue } from './combat.js';
export function changeMorale(state, value, events) {
    const before = state.morale;
    state.morale = roundValue(Math.max(0, Math.min(100, value)));
    events.push({ type: 'MORALE_CHANGED', studentId: state.studentId, before, after: state.morale });
}
export function updateConcentration(state, value, reason, dropoutMoraleLoss, events) {
    const before = state.concentration;
    state.concentration = roundValue(Math.max(0, Math.min(100, value)));
    events.push({ type: 'CONCENTRATION_CHANGED', studentId: state.studentId, before, after: state.concentration, reason });
    if (before > 0 && state.concentration === 0) {
        events.push({ type: 'STUDENT_DROPPED_OUT', studentId: state.studentId });
        changeMorale(state, state.morale - dropoutMoraleLoss, events);
    }
    else if (before === 0 && state.concentration > 0)
        events.push({ type: 'STUDENT_RESUMED', studentId: state.studentId });
}
