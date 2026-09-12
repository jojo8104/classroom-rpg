import { behaviorCandidate, chooseBehavior, difficultyLoss, evolveRelation, getRelation, relationThreshold, socialRules, trait } from './social.js';
import { changeMorale } from './resources.js';
import { checkMorale } from './interactions.js';
import type { Lesson, Student, StudentLessonState } from '../domain.js';
import type { ActionEvent, ActionKind, ActionLimitReason, ConcentrationReason, ReactionLimitReason } from '../events.js';
import type { ActionRules } from '../data/rules.js';
import { statBounds } from '../data/rules.js';
import { SeededRandom } from './random.js';
import { chapterCapacity, roundValue } from './combat.js';

import { resolveWorkTurn, type AttackModifiers } from './turn.js';
import { effectBonus, effectiveStats, endRoundEffects, validateEffects } from './effects.js';
import { areAdjacent, relationBetween, resolveReactionWindow, validateReactionSetup, type QueuedReaction, type ReactionSetup } from './reactions.js';
import { updateConcentration } from './resources.js';
import { disruptionChance, resolveDisruption, type TeacherRoundContext } from './disruptions.js';

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
  teacherContext?: TeacherRoundContext,
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
  function changeConcentration(state: StudentLessonState, value: number, reason: ConcentrationReason) {
    updateConcentration(state, value, reason, reactionSetup?.classRelations ? difficultyLoss(byId.get(state.studentId)!, rules.dropoutMoraleLoss) : rules.dropoutMoraleLoss, events);
  }
  const interactionRules = reactionSetup?.interactionRules;
  const social = reactionSetup?.classRelations;
  const relation = (from: string, to: string) => social ? getRelation(social, from, to) : relationBetween(from, to, reactionSetup?.relations ?? []);
  let socialCursor = 0;
  function socialConsequences() {
    if (!social || !reactionSetup) return;
    const recent = events.slice(socialCursor); socialCursor = events.length;
    for (const event of recent) {
      if (event.type === 'EFFECT_APPLIED' && event.amount > 0 || event.type === 'REACTION_TRIGGERED' && event.before !== event.after) {
        evolveRelation(social, byId.get(event.targetId)!, event.sourceId,
          event.type === 'REACTION_TRIGGERED' && event.effect === 'REDUCE_PRESSURE' ? socialRules.defenseDelta : socialRules.supportDelta, event.type, events);
      } else if (event.type === 'DISRUPTION_RESOLVED' && event.damage > 0) {
        evolveRelation(social, byId.get(event.targetId)!, event.sourceId, socialRules.disruptionDelta, 'disruption', events);
      } else if (event.type === 'COMBINED_ATTACK_RESOLVED' && event.appliedProgress > 0) {
        evolveRelation(social, byId.get(event.targetId)!, event.sourceId, socialRules.comboDelta, 'combo', events);
        evolveRelation(social, byId.get(event.sourceId)!, event.targetId, socialRules.comboDelta, 'combo', events);
      } else if (event.type === 'UNDERSTANDING_CHANGED' && event.amount >= socialRules.comparisonThreshold) {
        for (const observer of students) {
          const observerState = states.get(observer.id)!;
          if (trait(observer, 'competitive') <= 0 || observerState.concentration <= 0 || !areAdjacent(observer, byId.get(event.studentId)!, reactionSetup.classroom)) continue;
          const delta = socialRules.comparisonMorale * trait(observer, 'competitive') * (relation(observer.id, event.studentId) < 0 ? -1 : 1);
          changeMorale(observerState, observerState.morale + (delta < 0 ? difficultyLoss(observer, -delta) * -1 : delta), events);
          evolveRelation(social, observer, event.studentId, delta / socialRules.comparisonMorale, 'comparison', events);
        }
      }
    }
    socialCursor = events.length;
  }
  function supportCandidates(student: Student) {
    return students.filter(candidate => candidate.id !== student.id && (!interactionRules || reactionSetup &&
      areAdjacent(student, candidate, reactionSetup.classroom) &&
      relation(student.id, candidate.id) >= (social ? relationThreshold(student, interactionRules.mainSupportMinimumRelation) : interactionRules.mainSupportMinimumRelation) &&
      relation(student.id, candidate.id) > 0 && states.get(candidate.id)!.concentration < 100));
  }
  for (const student of students) {
    if (interactionRules) { queue.enqueue({ actorId: student.id, kind: 'WORK', depth: 0 }); continue; }
    if (teacherContext && reactionSetup && (student.disruptionChance ?? 0) > 0 &&
        students.some(other => areAdjacent(student, other, reactionSetup.classroom)) &&
        random.next() < disruptionChance(student, states.get(student.id)!)) {
      queue.enqueue({ actorId: student.id, kind: 'DISRUPT', depth: 0 });
      continue;
    }
    const kind = random.next() < rules.supportChanceByArchetype[student.archetypeId]! && students.length > 1 ? 'SUPPORT' : 'WORK';
    queue.enqueue({ actorId: student.id, kind, depth: 0 });
  }

  // Un élève qui se repose ne gagne pas une nouvelle action d'apprentissage dans ce round.
  const resting = new Set<string>();
  let action: QueuedAction | undefined;
  while ((action = queue.dequeue()) !== undefined) {
    socialConsequences();
    const student = byId.get(action.actorId)!;
    const state = states.get(student.id)!;
    const chapter = state.chapters.find(c => c.chapterId === chapterId)!;
    if (action.depth > 0 && (state.concentration === 0 || resting.has(student.id))) continue;
    const checks = interactionRules && action.depth === 0 ? checkMorale(student.id, effectiveStats(student, state).morale,
      random, interactionRules, events, 'MAIN_ACTION', student.id) : undefined;
    let selectedTarget: string | undefined;
    let turnRules = rules;
    if (checks && state.concentration > 0) {
      const support = !social && checks.positive && random.next() < rules.supportChanceByArchetype[student.archetypeId]! && supportCandidates(student).length > 0;
      const disrupt = !social && checks.negative && teacherContext && reactionSetup && (student.disruptionChance ?? 0) > 0 &&
        students.some(other => areAdjacent(student, other, reactionSetup.classroom)) && random.next() < disruptionChance(student, state);
      action.kind = disrupt ? 'DISRUPT' : support ? 'SUPPORT' : 'WORK';
      if (social) {
        const choices = [behaviorCandidate(student, state, 'WORK', 0)];
        const chance = rules.supportChanceByArchetype[student.archetypeId]!;
        if (checks.positive && chance > 0) for (const target of supportCandidates(student)) choices.push(behaviorCandidate(student, states.get(target.id)!, 'SUPPORT', relation(student.id, target.id), socialRules.base * chance));
        if (checks.negative && teacherContext && reactionSetup && (student.disruptionChance ?? 0) + trait(student, 'impulsive') + trait(student, 'sociable') > 0) {
          for (const target of students.filter(t => areAdjacent(student, t, reactionSetup.classroom) && states.get(t.id)!.concentration > 0)) choices.push(behaviorCandidate(student, states.get(target.id)!, 'DISRUPT', relation(student.id, target.id), socialRules.base * disruptionChance(student, state)));
        }
        const chosen = chooseBehavior(choices, random, events)!;
        action.kind = chosen.action as ActionKind; selectedTarget = chosen.targetId;
      }
      if (checks.negative && action.kind !== 'DISRUPT') {
        turnRules = { ...rules, workScale: rules.workScale * (social ? 1 - (1 - interactionRules!.negativePowerMultiplier) * (1 - trait(student, 'calm') * 0.5) : interactionRules!.negativePowerMultiplier),
          supportBonus: rules.supportBonus * interactionRules!.negativePowerMultiplier };
        events.push({ type: 'BEHAVIOR_APPLIED', studentId: student.id, effect: 'DISTRACTED', multiplier: interactionRules!.negativePowerMultiplier });
      }
    }
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
      const effectiveLesson = { ...lesson, complexity: Math.max(0, lesson.complexity - effectBonus(state, 'complexityReduction')) };
      const understandingBefore = state.lessonUnderstanding;
      const resolvedEffects = new Set<string>();
      const modifiers: AttackModifiers = {};
      const turn = resolveWorkTurn({ social: !!social, learningRules: reactionSetup?.learningRules, student, state, lesson: effectiveLesson, chapterId, rules: turnRules, random, events, changeConcentration, modifiers });
      for (const window of turn) {
        events.push({ type: 'REACTION_WINDOW_OPENED', studentId: student.id, window, extra: action.depth > 0 });
        if (reactionSetup) resolveReactionWindow({ behavior: { chapterId, random }, window, target: student, students, states,
          resting, setup: reactionSetup, lesson: effectiveLesson, rules, queue, depth: action.depth + 1, events, resolvedEffects,
          attackSucceeded: state.lessonUnderstanding > understandingBefore, modifiers });
      }
    } else if (action.kind === 'DISRUPT' && teacherContext && reactionSetup) {
      resolveDisruption(student, students, reactionSetup.classroom, teacherContext, states, random, events, changeConcentration, selectedTarget);
    } else {
      const candidates = supportCandidates(student);
      const target = selectedTarget ? byId.get(selectedTarget)! : candidates[random.integer(candidates.length)]!;
      const targetState = states.get(target.id)!;
      events.push({ type: 'STUDENT_ACTION', actorId: student.id, actionId: 'SUPPORT', targetId: target.id, extra: action.depth > 0 });
      const before = targetState.concentration;
      changeConcentration(targetState, before + turnRules.supportBonus, 'support');
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
  socialConsequences();
  endRoundEffects(states.values(), events);
  return { students: students.map(student => states.get(student.id)!), events };
}

