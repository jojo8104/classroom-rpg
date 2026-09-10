import type { Student, StudentLessonState } from '../domain.js';
import type { ActionEvent, ActionKind, ActionLimitReason } from '../events.js';
import type { ActionRules } from '../data/rules.js';
import { statBounds } from '../data/rules.js';
import { SeededRandom } from './random.js';

export interface QueuedAction {
  actorId: string;
  kind: ActionKind;
  depth: number;
}

// Une instance par round. Le budget compte toutes les actions acceptées, même déjà sorties.
export class ActionQueue {
  private pending: QueuedAction[] = [];
  private accepted = 0;
  private extras = new Map<string, number>();
  private limits: Pick<ActionRules, 'maxActionsPerRound' | 'maxExtraActionsPerStudent' | 'maxChainDepth'>;

  constructor(limits: Pick<ActionRules, 'maxActionsPerRound' | 'maxExtraActionsPerStudent' | 'maxChainDepth'>) {
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
}

export interface ActionRoundResult {
  students: StudentLessonState[];
  events: ActionEvent[];
}

export function validateActionRules(rules: ActionRules, studentCount: number): void {
  for (const value of [rules.maxActionsPerRound, rules.maxExtraActionsPerStudent, rules.maxChainDepth]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Limite de file invalide.');
  }
  for (const value of [rules.workBase, rules.intelligenceFactor, rules.concentrationFactor,
    rules.workVariation, rules.supportBonus]) {
    if (!Number.isFinite(value) || value < 0) throw new Error('Paramètre d’effet invalide.');
  }
  for (const chance of [rules.extraActionChance, ...Object.values(rules.supportChanceByArchetype)]) {
    if (!Number.isFinite(chance) || chance < 0 || chance > 1) throw new Error('Probabilité invalide.');
  }
  if (rules.maxActionsPerRound < studentCount) throw new Error('Le budget doit permettre toutes les actions principales.');
}

// Résout seulement les actions d'un round, indépendamment des transitions de leçon.
// L'ordre des élèves est fourni par l'appelant ; les entrées ne sont jamais modifiées.
export function resolveActionRound(
  students: readonly Student[], initialStates: readonly StudentLessonState[],
  random: SeededRandom, rules: ActionRules,
): ActionRoundResult {
  validateActionRules(rules, students.length);
  const queue = new ActionQueue({
    maxActionsPerRound: rules.maxActionsPerRound,
    maxExtraActionsPerStudent: rules.maxExtraActionsPerStudent,
    maxChainDepth: rules.maxChainDepth,
  });
  const byId = new Map(students.map(student => [student.id, student]));
  const states = new Map(initialStates.map(state => [state.studentId, { ...state }]));
  if (byId.size !== students.length || states.size !== initialStates.length || states.size !== byId.size) {
    throw new Error('Les élèves et leurs états doivent correspondre sans doublons.');
  }
  for (const student of students) {
    const state = states.get(student.id);
    if (!state || !Number.isFinite(state.lessonUnderstanding) || state.lessonUnderstanding < 0 || state.lessonUnderstanding > 100 ||
        !Number.isFinite(state.concentrationBonus) || state.concentrationBonus < 0) throw new Error('État de séance invalide.');
    for (const value of [student.intelligence, student.concentration]) {
      if (!Number.isFinite(value) || value < statBounds.min || value > statBounds.max) throw new Error('Statistique invalide.');
    }
    if (!Object.hasOwn(rules.supportChanceByArchetype, student.archetypeId)) throw new Error('Règle d’archétype manquante.');
  }

  const events: ActionEvent[] = [];
  for (const student of students) {
    const supportChance = rules.supportChanceByArchetype[student.archetypeId]!;
    const kind = random.next() < supportChance && students.length > 1 ? 'SUPPORT' : 'WORK';
    queue.enqueue({ actorId: student.id, kind, depth: 0 });
  }

  let action: QueuedAction | undefined;
  while ((action = queue.dequeue()) !== undefined) {
    const student = byId.get(action.actorId)!;
    const state = states.get(student.id)!;
    if (action.kind === 'WORK') {
      events.push({ type: 'STUDENT_ACTION', actorId: student.id, actionId: 'WORK', targetId: student.id, extra: action.depth > 0 });
      const concentration = Math.min(statBounds.max, student.concentration + state.concentrationBonus);
      const gain = Math.max(0, Math.round(rules.workBase + student.intelligence * rules.intelligenceFactor +
        concentration * rules.concentrationFactor + (random.next() * 2 - 1) * rules.workVariation));
      const before = state.lessonUnderstanding;
      state.lessonUnderstanding = Math.min(100, before + gain);
      events.push({ type: 'UNDERSTANDING_CHANGED', studentId: student.id, before,
        after: state.lessonUnderstanding, amount: state.lessonUnderstanding - before });
    } else {
      const candidates = students.filter(candidate => candidate.id !== student.id);
      const target = candidates[random.integer(candidates.length)]!;
      const targetState = states.get(target.id)!;
      events.push({ type: 'STUDENT_ACTION', actorId: student.id, actionId: 'SUPPORT', targetId: target.id, extra: action.depth > 0 });
      const before = Math.min(statBounds.max, target.concentration + targetState.concentrationBonus);
      const after = Math.min(statBounds.max, before + rules.supportBonus);
      targetState.concentrationBonus = after - target.concentration;
      events.push({ type: 'EFFECT_APPLIED', sourceId: student.id, targetId: target.id,
        effectId: 'concentration_bonus', before, after, amount: after - before });
      if (random.next() < rules.extraActionChance) {
        const depth = action.depth + 1;
        const reason = queue.enqueue({ actorId: target.id, kind: 'WORK', depth });
        if (reason) events.push({ type: 'ACTION_LIMIT_REACHED', studentId: target.id, reason });
        else events.push({ type: 'EXTRA_ACTION_CREATED', studentId: target.id, depth });
      }
    }
  }
  // Le soutien est valable jusqu'à la fin de ce round seulement.
  return { students: students.map(student => ({ ...states.get(student.id)!, concentrationBonus: 0 })), events };
}
