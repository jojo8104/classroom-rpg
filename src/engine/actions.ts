import type { Lesson, Student, StudentLessonState } from '../domain.js';
import type { ActionEvent, ActionKind, ActionLimitReason, ReactionLimitReason } from '../events.js';
import type { ActionRules } from '../data/rules.js';
import { statBounds } from '../data/rules.js';
import { SeededRandom } from './random.js';
import { chapterCapacity, roundValue } from './combat.js';

import { resolveWorkTurn, type AttackModifiers } from './turn.js';
import { endRoundEffects, validateEffects } from './effects.js';
import { resolveReactionWindow, validateReactionSetup, type QueuedReaction, type ReactionSetup } from './reactions.js';

export interface QueuedAction {
  actorId: string;
  kind: ActionKind;
  depth: number;
}

// Une instance par round. Le budget compte toutes les actions acceptées, même déjà sorties.
export class ActionQueue {
  private pending: QueuedAction[] = [];
  private reactions: QueuedReaction[] = [];
  private reactionCounts = new Map<string, number>();
  private accepted = 0;
  private extras = new Map<string, number>();
  private limits: Pick<ActionRules, 'maxActionsPerRound' | 'maxExtraActionsPerStudent' | 'maxChainDepth'>;

  constructor(limits: Pick<ActionRules, 'maxActionsPerRound' | 'maxExtraActionsPerStudent' | 'maxChainDepth'>,
    private readonly maxReactionsPerStudent = 1) {
    if (!Number.isSafeInteger(maxReactionsPerStudent) || maxReactionsPerStudent < 0) throw new Error('Limite de réaction invalide.');
    for (const value of [limits.maxActionsPerRound, limits.maxExtraActionsPerStudent, limits.maxChainDepth]) {
      if (!Number.isSafeInteger(value) || value < 0) throw new Error('Limite de file invalide.');
    }
    this.limits = { ...limits };
  }

  enqueue(action: QueuedAction): ActionLimitReason | undefined {
    if (!Number.isSafeInteger(action.depth) || action.depth < 0) throw new Error('Profondeur invalide.');
    if (action.depth > this.limits.maxChainDepth) return 'maxChainDepth';
    if (this.accepted >= this.limits.maxActionsPerRound) return 'maxActionsPerRound';
    const count = this.extras.get(action.actorId) ?? 0;
    if (action.depth > 0 && count >= this.limits.maxExtraActionsPerStudent) return 'maxExtraActionsPerStudent';
    if (action.depth > 0) this.extras.set(action.actorId, count + 1);
    this.pending.push({ ...action });
    this.accepted++;
    return undefined;
  }

  dequeue(): QueuedAction | undefined {
    return this.pending.shift();
  }

  // Même budget total, voie dédiée vidée avant la reprise du tour suspendu.
  enqueueReaction(reaction: QueuedReaction): ReactionLimitReason | undefined {
    if (!Number.isSafeInteger(reaction.depth) || reaction.depth < 1) throw new Error('Profondeur de réaction invalide.');
    if (reaction.depth > this.limits.maxChainDepth) return 'maxChainDepth';
    if (this.accepted >= this.limits.maxActionsPerRound) return 'maxActionsPerRound';
    const count = this.reactionCounts.get(reaction.actorId) ?? 0;
    if (count >= this.maxReactionsPerStudent) return 'maxReactionsPerStudent';
    this.reactions.push(structuredClone(reaction));
    this.reactionCounts.set(reaction.actorId, count + 1);
    this.accepted++;
    return undefined;
  }

  dequeueReaction(): QueuedReaction | undefined {
    return this.reactions.shift();
  }
}

export interface ActionRoundResult {
  students: StudentLessonState[];
  events: ActionEvent[];
}

export function validateActionRules(rules: ActionRules, studentCount: number): void {
  for (const value of [rules.maxActionsPerRound, rules.maxExtraActionsPerStudent, rules.maxChainDepth, rules.maxReactionsPerStudent]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Limite de file invalide.');
  }
  for (const value of [rules.workScale, rules.pressureScale, rules.supportBonus, rules.dropoutMoraleLoss]) {
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error('Paramètre d’effet invalide.');
  }
  if (!Number.isFinite(rules.defenseReference) || rules.defenseReference <= 0 ||
      !Number.isFinite(rules.recovery) || rules.recovery <= 0 || rules.recovery > 100 ||
      !Number.isFinite(rules.criticalMultiplier) || rules.criticalMultiplier < 1 || rules.criticalMultiplier > 10) {
    throw new Error('Paramètre de combat invalide.');
  }
  for (const chance of [rules.extraActionChance, rules.criticalChance, rules.workVariation, ...Object.values(rules.supportChanceByArchetype)]) {
    if (!Number.isFinite(chance) || chance < 0 || chance > 1) throw new Error('Probabilité invalide.');
  }
  if (rules.maxActionsPerRound < studentCount) throw new Error('Le budget doit permettre toutes les actions principales.');
}

// Les états sont copiés en profondeur : les acquis des chapitres passés sont conservés.
export function resolveActionRound(
  students: readonly Student[], initialStates: readonly StudentLessonState[],
  random: SeededRandom, rules: ActionRules, lesson: Lesson, chapterId: string,
  reactionSetup?: ReactionSetup,
): ActionRoundResult {
  validateActionRules(rules, students.length);
  if (reactionSetup) {
    const errors = validateReactionSetup(students, reactionSetup);
    if (errors.length) throw new Error(errors.join('\n'));
  }
  if (!lesson.chapters.some(chapter => chapter.id === chapterId)) throw new Error('Chapitre inconnu.');
  if (!Number.isFinite(lesson.requiredProgress) || lesson.requiredProgress <= 0 ||
      !Number.isFinite(lesson.complexity) || lesson.complexity < 0 || lesson.complexity > 100 ||
      !Number.isFinite(lesson.pressure) || lesson.pressure < 0 || lesson.pressure > 100) throw new Error('Leçon invalide.');
  const queue = new ActionQueue(rules, rules.maxReactionsPerStudent);
  const byId = new Map(students.map(student => [student.id, student]));
  const states = new Map(initialStates.map(state => [state.studentId, structuredClone(state)]));
  if (byId.size !== students.length || states.size !== initialStates.length || states.size !== byId.size) {
    throw new Error('Les élèves et leurs états doivent correspondre sans doublons.');
  }
  const capacity = chapterCapacity(lesson);
  for (const student of students) {
    const state = states.get(student.id);
    if (!state) throw new Error('État de séance invalide.');
    validateEffects(state);
    for (const value of [state.lessonUnderstanding, state.concentration, state.morale, student.intelligence, student.discipline]) {
      if (!Number.isFinite(value) || value < statBounds.min || value > statBounds.max) throw new Error('Statistique invalide.');
    }
    if (state.chapters.length !== lesson.chapters.length ||
        new Set(state.chapters.map(c => c.chapterId)).size !== state.chapters.length ||
        state.chapters.some(c => !lesson.chapters.some(d => d.id === c.chapterId) ||
          !Number.isFinite(c.progress) || c.progress < 0 || c.progress > capacity ||
          !Number.isSafeInteger(c.missedRounds) || c.missedRounds < 0)) throw new Error('Progression de chapitre invalide.');
    const understanding = roundValue(100 * state.chapters.reduce((sum, c) => sum + c.progress, 0) / lesson.requiredProgress);
    if (understanding !== state.lessonUnderstanding) throw new Error('Compréhension incohérente avec les chapitres.');
    if (!Object.hasOwn(rules.supportChanceByArchetype, student.archetypeId)) throw new Error('Règle d’archétype manquante.');
  }

  const events: ActionEvent[] = [];
  function changeConcentration(state: StudentLessonState, value: number, reason: 'pressure' | 'support' | 'recovery') {
    const before = state.concentration;
    state.concentration = roundValue(Math.max(0, Math.min(100, value)));
    events.push({ type: 'CONCENTRATION_CHANGED', studentId: state.studentId, before, after: state.concentration, reason });
    if (before > 0 && state.concentration === 0) {
      const moraleBefore = state.morale;
      state.morale = roundValue(Math.max(0, state.morale - rules.dropoutMoraleLoss));
      events.push({ type: 'STUDENT_DROPPED_OUT', studentId: state.studentId });
      events.push({ type: 'MORALE_CHANGED', studentId: state.studentId, before: moraleBefore, after: state.morale });
    } else if (before === 0 && state.concentration > 0) {
      events.push({ type: 'STUDENT_RESUMED', studentId: state.studentId });
    }
  }
  for (const student of students) {
    const kind = random.next() < rules.supportChanceByArchetype[student.archetypeId]! && students.length > 1 ? 'SUPPORT' : 'WORK';
    queue.enqueue({ actorId: student.id, kind, depth: 0 });
  }

  // Un élève qui se repose ne gagne pas une nouvelle action d'apprentissage dans ce round.
  const resting = new Set<string>();
  let action: QueuedAction | undefined;
  while ((action = queue.dequeue()) !== undefined) {
    const student = byId.get(action.actorId)!;
    const state = states.get(student.id)!;
    const chapter = state.chapters.find(c => c.chapterId === chapterId)!;
    if (action.depth > 0 && (state.concentration === 0 || resting.has(student.id))) continue;
    if (state.concentration === 0) {
      resting.add(student.id);
      chapter.missedRounds++;
      events.push({ type: 'STUDENT_ACTION', actorId: student.id, actionId: 'RECOVER', targetId: student.id, extra: false });
      events.push({ type: 'CHAPTER_PROGRESS_CHANGED', studentId: student.id, ...chapter });
      changeConcentration(state, rules.recovery, 'recovery');
      continue;
    }
    if (action.kind === 'WORK') {
      events.push({ type: 'STUDENT_ACTION', actorId: student.id, actionId: 'WORK', targetId: student.id, extra: action.depth > 0 });
      // La réaction modifie uniquement la leçon effective de cette action.
      const effectiveLesson = { ...lesson };
      const understandingBefore = state.lessonUnderstanding;
      const resolvedEffects = new Set<string>();
      const modifiers: AttackModifiers = {};
      const turn = resolveWorkTurn({ student, state, lesson: effectiveLesson, chapterId, rules, random, events, changeConcentration, modifiers });
      for (const window of turn) {
        events.push({ type: 'REACTION_WINDOW_OPENED', studentId: student.id, window, extra: action.depth > 0 });
        if (reactionSetup) resolveReactionWindow({ window, target: student, students, states,
          resting, setup: reactionSetup, lesson: effectiveLesson, rules, queue, depth: action.depth + 1, events, resolvedEffects,
          attackSucceeded: state.lessonUnderstanding > understandingBefore, modifiers });
      }
    } else {
      const candidates = students.filter(candidate => candidate.id !== student.id);
      const target = candidates[random.integer(candidates.length)]!;
      const targetState = states.get(target.id)!;
      events.push({ type: 'STUDENT_ACTION', actorId: student.id, actionId: 'SUPPORT', targetId: target.id, extra: action.depth > 0 });
      const before = targetState.concentration;
      changeConcentration(targetState, before + rules.supportBonus, 'support');
      events.push({ type: 'EFFECT_APPLIED', sourceId: student.id, targetId: target.id,
        effectId: 'concentration_bonus', before, after: targetState.concentration, amount: roundValue(targetState.concentration - before) });
      if (random.next() < rules.extraActionChance && targetState.concentration > 0 && !resting.has(target.id)) {
        const depth = action.depth + 1;
        const reason = queue.enqueue({ actorId: target.id, kind: 'WORK', depth });
        if (reason) events.push({ type: 'ACTION_LIMIT_REACHED', studentId: target.id, reason });
        else events.push({ type: 'EXTRA_ACTION_CREATED', studentId: target.id, depth });
      }
    }
  }
  endRoundEffects(states.values(), events);
  return { students: students.map(student => states.get(student.id)!), events };
}

