import type { Student, StudentLessonState, TemporaryEffect, TemporaryStat } from '../domain.js';
import type { ActionEvent } from '../events.js';
import { roundValue } from './combat.js';

export function validateEffects(state: StudentLessonState): void {
  const ids = new Set<string>();
  if (!Array.isArray(state.effects)) throw new Error('Effets temporaires : liste requise.');
  for (const effect of state.effects) {
    if (!effect.id || ids.has(effect.id) || !effect.sourceId || !effect.abilityId || effect.targetId !== state.studentId ||
        !['intelligence', 'discipline', 'morale', 'complexityReduction', 'disruptionReduction'].includes(effect.stat) ||
        !Number.isFinite(effect.value) || effect.value <= 0 || effect.value > 100 ||
        !Number.isSafeInteger(effect.remainingRounds) || effect.remainingRounds <= 0) {
      throw new Error('Effet temporaire invalide.');
    }
    ids.add(effect.id);
  }
}

// Les bonus ne modifient jamais les statistiques de base. Le plus fort par
// statistique s'applique ; un bonus plus faible peut reprendre après son expiration.
export function effectiveStats(student: Student, state: StudentLessonState): Student {
  const result = { ...student, morale: state.morale, concentration: state.concentration };
  for (const stat of ['intelligence', 'discipline', 'morale'] as const) {
    const bonus = effectBonus(state, stat);
    if (bonus > 0) result[stat] = roundValue(Math.min(100, result[stat] + bonus));
  }
  return result;
}

export function effectBonus(state: StudentLessonState, stat: TemporaryStat): number {
  return state.effects.reduce((max, effect) => effect.stat === stat && effect.remainingRounds > 0 ? Math.max(max, effect.value) : max, 0);
}

export function applyTemporaryEffect(state: StudentLessonState, effect: TemporaryEffect, events: ActionEvent[]): void {
  validateEffects({ ...state, effects: [effect] });
  const existing = state.effects.find(item => item.id === effect.id);
  const applied = structuredClone(effect);
  if (existing) {
    applied.value = Math.max(existing.value, applied.value);
    applied.remainingRounds = Math.max(existing.remainingRounds, applied.remainingRounds);
    state.effects[state.effects.indexOf(existing)] = applied;
  } else state.effects.push(applied);
  events.push({ type: 'TEMPORARY_EFFECT_APPLIED', effect: structuredClone(applied), refreshed: !!existing });
}

// Une décrémentation à la fin du round, jamais par action (bonus compris).
// Un effet reçu entre les rounds couvrira donc tout le prochain round.
export function endRoundEffects(states: Iterable<StudentLessonState>, events: ActionEvent[]): void {
  for (const state of states) {
    for (const effect of state.effects) {
      effect.remainingRounds--;
      events.push({ type: 'TEMPORARY_EFFECT_DECREMENTED', effect: structuredClone(effect) });
      if (effect.remainingRounds === 0) events.push({ type: 'TEMPORARY_EFFECT_EXPIRED', effect: structuredClone(effect) });
    }
    state.effects = state.effects.filter(effect => effect.remainingRounds > 0);
  }
}
