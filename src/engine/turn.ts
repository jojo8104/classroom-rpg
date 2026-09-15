import { difficultyLoss } from './social.js';
import type { LearningRules } from '../data/learningRules.js';
import { changeMorale } from './resources.js';
import type { Lesson, Student, StudentLessonState } from '../domain.js';
import type { ActionRules } from '../data/rules.js';
import type { ActionEvent, ReactionWindow } from '../events.js';
import { combinedGain, pressureDamage, roundValue, workGain } from './combat.js';
import type { SeededRandom } from './random.js';
import { effectiveStats } from './effects.js';

export interface WorkTurnContext {
  social?: boolean;
  learningRules?: LearningRules | undefined;
  modifiers?: AttackModifiers;
  student: Student;
  state: StudentLessonState;
  lesson: Lesson;
  rules: ActionRules;
  random: SeededRandom;
  events: ActionEvent[];
  changeConcentration: (state: StudentLessonState, value: number, reason: 'pressure' | 'effort') => void;
}

export interface AttackModifiers {
  combined?: { partner: Student; synergyRatio: number; abilityId?: string };
}

function resolveProgress(context: WorkTurnContext, gain: number): void {
  const { state, lesson, events } = context;
  const before = state.lessonUnderstanding;
  state.progress = Math.min(lesson.requiredProgress, roundValue(state.progress + gain));
  state.lessonUnderstanding = roundValue(Math.min(100, 100 * state.progress / lesson.requiredProgress));
  events.push({ type: 'LESSON_PROGRESS_CHANGED', studentId: state.studentId, progress: state.progress, missedRounds: state.missedRounds });
  events.push({ type: 'UNDERSTANDING_CHANGED', studentId: state.studentId, before,
    after: state.lessonUnderstanding, amount: roundValue(state.lessonUnderstanding - before) });
}

function resolveRetaliation(context: WorkTurnContext): void {
  const { student, state, lesson, rules, events } = context;
  const effective = effectiveStats(student, state);
  const damage = Math.min(state.concentration, pressureDamage(effective, effective.morale, lesson, rules));
  events.push({ type: 'LESSON_RETALIATED', studentId: student.id, damage });
  context.changeConcentration(state, state.concentration - damage, 'pressure');
  if (context.learningRules && damage > 0) {
    const loss = roundValue(Math.min(context.learningRules.maxRetaliationMoraleLoss, damage * context.learningRules.damageMoraleRatio));
    if (loss > 0) changeMorale(state, state.morale - (context.social ? difficultyLoss(student, loss) : loss), events, 'retaliation');
  }
}

// Chaque yield suspend réellement le tour. L'appelant pourra résoudre les réactions
// bornées de cette fenêtre avant de demander l'étape suivante, sans récursion.
export function* resolveWorkTurn(context: WorkTurnContext): Generator<ReactionWindow, void> {
  const { student, state, lesson, rules, random, events } = context;
  if (state.progress >= lesson.requiredProgress) return;

  yield 'BEFORE_STUDENT_ATTACK';
  yield 'DURING_STUDENT_ATTACK';
  const critical = random.next() < rules.criticalChance;
  const effective = effectiveStats(student, state);
  const variation = random.next();
  const multiplier = critical ? rules.criticalMultiplier : 1;
  const gain = workGain(effective, effective.morale, lesson, rules, variation) * multiplier;
  if (critical) events.push({ type: 'CRITICAL_HIT', studentId: student.id });
  const progressBefore = state.progress;
  const combination = context.modifiers?.combined;
  if (combination) {
    // Les deux contributions utilisent le même tirage et la même complexité.
    // Le partenaire n'obtient pas de progression pendant le tour de l'élève actif.
    const partner = combination.partner;
    const result = combinedGain(gain, workGain(partner, partner.morale, lesson, rules, variation) * multiplier, combination.synergyRatio);
    const before = state.progress;
    resolveProgress(context, result.potentialGain);
    events.push({ type: 'COMBINED_ATTACK_RESOLVED', sourceId: partner.id, targetId: student.id,
      ...result, appliedProgress: roundValue(state.progress - before) });
    if (combination.abilityId) events.push({ type: 'ABILITY_USED', studentId: partner.id, targetId: student.id, abilityId: combination.abilityId, effective: state.progress > before });
  } else resolveProgress(context, gain);
  if (context.learningRules) {
    if (state.progress > progressBefore && context.learningRules.successMorale > 0)
      changeMorale(state, state.morale + context.learningRules.successMorale, events, 'success');
    if (context.learningRules.effortConcentration > 0)
      context.changeConcentration(state, state.concentration - context.learningRules.effortConcentration, 'effort');
  }
  yield 'AFTER_STUDENT_ATTACK';

  // Les exemptions de riposte de Roadmap 1.1 restent prioritaires.
  if (state.concentration <= 0 || critical || state.progress >= lesson.requiredProgress) return;
  yield 'BEFORE_LESSON_ATTACK';
  yield 'DURING_LESSON_ATTACK';
  resolveRetaliation(context);
  yield 'AFTER_LESSON_ATTACK';
}
