import { behaviorCandidate, weightedChoice, getRelation, relationThreshold, validateSocial } from './social.js';
import { validateLearningRules, type LearningRules } from '../data/learningRules.js';
import { validateInteractionRules, type InteractionRules } from '../data/interactionRules.js';
import { chapterMastery, checkMorale, masteryAccess } from './interactions.js';
import type { SeededRandom } from './random.js';
import type { Classroom, Lesson, ReactionAbility, Student, StudentArchetype, StudentLessonState, StudentRelation } from '../domain.js';
import type { ActionRules } from '../data/rules.js';
import type { ActionEvent, ReactionWindow } from '../events.js';
import type { ActionQueue } from './actions.js';
import { moraleMultiplier, roundValue } from './combat.js';
import { applyTemporaryEffect, effectiveStats } from './effects.js';
import type { AttackModifiers } from './turn.js';

export interface ReactionSetup {
  classRelations?: import('../domain.js').ClassRelations | undefined;
  learningRules?: LearningRules | undefined;
  interactionRules?: InteractionRules | undefined;
  classroom: Classroom;
  archetypes: readonly StudentArchetype[];
  relations: readonly StudentRelation[];
  abilities: readonly ReactionAbility[];
}

export interface QueuedReaction {
  powerModifier?: number;
  actorId: string;
  targetId: string;
  ability: ReactionAbility;
  relation: number;
  depth: number;
}

export function validateReactionSetup(students: readonly Student[], setup: ReactionSetup): string[] {
  const errors: string[] = validateSocial(students, setup.classRelations);
  if (setup.classRelations && !setup.interactionRules) errors.push('Les comportements sociaux exigent les règles de moral et de maîtrise.');
  if (setup.learningRules) { try { validateLearningRules(setup.learningRules); } catch (error) { errors.push((error as Error).message); } }
  if (setup.interactionRules) {
    try { validateInteractionRules(setup.interactionRules); } catch (error) { errors.push((error as Error).message); }
  }
  const studentIds = new Set(students.map(student => student.id));
  const pairs = new Set<string>();
  for (const relation of setup.relations) {
    const [left, right] = relation.studentIds;
    if (relation.studentIds.length !== 2 || !studentIds.has(left) || !studentIds.has(right) || left === right) {
      errors.push('Relation : deux élèves distincts connus sont requis.');
    }
    const pair = JSON.stringify([...relation.studentIds].sort());
    if (pairs.has(pair)) errors.push('Relation : paire dupliquée.');
    pairs.add(pair);
    if (!Number.isFinite(relation.value) || relation.value < 0 || relation.value > 100) errors.push('Relation : valeur entre 0 et 100 requise.');
  }
  const ids = new Set<string>();
  for (const ability of setup.abilities) {
    if (!ability.id.trim() || ids.has(ability.id)) errors.push('Réaction : identifiant vide ou dupliqué.');
    ids.add(ability.id);
    if (ability.mastery && (!Number.isFinite(ability.mastery.minimum) || ability.mastery.minimum < 0 || ability.mastery.minimum > 100 || typeof ability.mastery.scalesPower !== 'boolean')) errors.push('Maîtrise de capacité invalide.');
    if (!Number.isFinite(ability.minRelation) || ability.minRelation < 0 || ability.minRelation > 100) errors.push('Réaction : seuil de relation invalide.');
    if (ability.effect === 'REDUCE_PRESSURE' || ability.effect === 'REDUCE_COMPLEXITY') {
      const windows = ability.effect === 'REDUCE_PRESSURE' ? ['BEFORE_LESSON_ATTACK', 'DURING_LESSON_ATTACK'] : ['BEFORE_STUDENT_ATTACK', 'DURING_STUDENT_ATTACK'];
      if (!windows.includes(ability.window)) errors.push('Réaction : fenêtre de réduction invalide.');
      for (const value of [ability.reduction, ability.maxReduction]) {
        if (!Number.isFinite(value) || value <= 0 || value > 1) errors.push('Réaction : réduction attendue dans ]0, 1].');
      }
    } else if (ability.effect === 'APPLY_TEMPORARY_EFFECT') {
      if (!['BEFORE_STUDENT_ATTACK', 'DURING_STUDENT_ATTACK', 'AFTER_STUDENT_ATTACK'].includes(ability.window) ||
          !['intelligence', 'discipline', 'morale'].includes(ability.stat)) errors.push('Réaction : fenêtre ou statistique de soutien invalide.');
      if (!Number.isFinite(ability.value) || ability.value <= 0 || ability.value > 100 ||
          !Number.isSafeInteger(ability.durationInRounds) || ability.durationInRounds <= 0) errors.push('Réaction : puissance ou durée invalide.');
    } else if (ability.effect === 'COMBINED_ATTACK') {
      if (!['BEFORE_STUDENT_ATTACK', 'DURING_STUDENT_ATTACK'].includes(ability.window) ||
          !Number.isFinite(ability.synergy) || ability.synergy <= 0 || ability.synergy > 1) errors.push('Réaction : fenêtre ou synergie invalide.');
    } else errors.push('Réaction : effet non pris en charge.');
  }
  for (const owner of [...setup.archetypes, ...students]) {
    const references = owner.reactionIds ?? [];
    if (new Set(references).size !== references.length || references.some(id => !ids.has(id))) errors.push('Capacités : réaction inconnue ou dupliquée.');
  }
  return errors;
}

export function areAdjacent(left: Student, right: Student, classroom: Classroom): boolean {
  const a = classroom.seats.find(seat => seat.id === left.seatId);
  const b = classroom.seats.find(seat => seat.id === right.seatId);
  return left.id !== right.id && !!a && !!b && Math.abs(a.row - b.row) + Math.abs(a.column - b.column) === 1;
}

export function relationBetween(left: string, right: string, relations: readonly StudentRelation[]): number {
  return relations.find(relation => relation.studentIds.includes(left) && relation.studentIds.includes(right))?.value ?? 0;
}

interface ReactionContext {
  behavior?: { chapterId: string; random: SeededRandom };
  window: ReactionWindow;
  target: Student;
  students: readonly Student[];
  states: ReadonlyMap<string, StudentLessonState>;
  resting: ReadonlySet<string>;
  setup: ReactionSetup;
  lesson: Lesson;
  rules: ActionRules;
  queue: ActionQueue;
  depth: number;
  events: ActionEvent[];
  resolvedEffects: Set<string>;
  attackSucceeded: boolean;
  modifiers: AttackModifiers;
}

function effectKey(ability: ReactionAbility): string {
  if (ability.effect === 'APPLY_TEMPORARY_EFFECT') return `${ability.effect}:${ability.stat}`;
  return ability.effect === 'REDUCE_PRESSURE' ? ability.effect : 'OFFENSIVE_REACTION';
}

export function resolveReactionWindow(context: ReactionContext): void {
  const { window, target, students, states, resting, setup, lesson, rules, queue, events, resolvedEffects } = context;
  const targetState = states.get(target.id);
  if (!targetState || targetState.concentration <= 0 || resting.has(target.id)) return;

  const candidates: QueuedReaction[] = [];
  const interactionRules = setup.interactionRules;
  if (interactionRules && !context.behavior) throw new Error('Contexte comportemental manquant.');
  const seat = (id: string) => setup.classroom.seats.find(s => s.id === students.find(student => student.id === id)!.seatId)!;
  const ordered = [...students].sort((a, b) => seat(a.id).row - seat(b.id).row || seat(a.id).column - seat(b.id).column);
  for (const student of ordered) {
    const state = states.get(student.id);
    if (!state || state.concentration <= 0 || resting.has(student.id) || !areAdjacent(student, target, setup.classroom)) continue;
    const relation = setup.classRelations ? getRelation(setup.classRelations, student.id, target.id) : relationBetween(student.id, target.id, setup.relations);
    if (!interactionRules && relation <= 0) continue;
    const ids = student.reactionIds ?? setup.archetypes.find(archetype => archetype.id === student.archetypeId)?.reactionIds ?? [];
    const available = setup.abilities.filter(ability => ids.includes(ability.id) && ability.window === window && !resolvedEffects.has(effectKey(ability)))
      .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const checks = interactionRules && available.length ? checkMorale(student.id, effectiveStats(student, state).morale,
      context.behavior!.random, interactionRules, events, window, target.id) : undefined;
    const mastery = interactionRules ? chapterMastery(state, lesson, context.behavior!.chapterId) : 100;
    const targetMastery = interactionRules ? chapterMastery(targetState, lesson, context.behavior!.chapterId) : 100;
    for (const ability of available) {
      let powerModifier = 1;
      let noEffect = false;
      if (interactionRules) {
        const access = masteryAccess(ability, mastery, targetMastery, interactionRules);
        powerModifier = access.modifier * (checks!.negative ? interactionRules.negativePowerMultiplier : 1);
        noEffect = powerModifier <= 0 ||
          ability.effect === 'REDUCE_PRESSURE' && lesson.pressure <= 0 ||
          ability.effect === 'REDUCE_COMPLEXITY' && (lesson.complexity <= 0 || effectiveStats(student, state).intelligence <= 0) ||
          ability.effect === 'COMBINED_ATTACK' && (rules.workScale <= 0 || effectiveStats(student, state).intelligence <= 0 || effectiveStats(target, targetState).intelligence <= 0) ||
          ability.effect === 'APPLY_TEMPORARY_EFFECT' && (roundValue(ability.value * relation / 100 * powerModifier) <= 0 ||
            window === 'AFTER_STUDENT_ATTACK' && !context.attackSucceeded || effectiveStats(target, targetState)[ability.stat] >= 100);
        const reason = !checks!.positive ? 'morale' : relation <= 0 || relation < (setup.classRelations ? relationThreshold(student, ability.minRelation, ability.effect === 'COMBINED_ATTACK') : ability.minRelation) ? 'relation' : !access.allowed ? 'mastery' : noEffect ? 'noEffect' : 'eligible';
        events.push({ type: 'REACTION_EVALUATED', sourceId: student.id, targetId: target.id, abilityId: ability.id,
          window, reason, mastery, targetMastery, minimum: access.minimum, modifier: powerModifier });
        if (reason !== 'eligible') continue;
      }
      if (resolvedEffects.has(effectKey(ability))) continue;
      if (ability.effect === 'REDUCE_PRESSURE' && lesson.pressure <= 0) continue;
      if (ability.effect === 'REDUCE_COMPLEXITY' && (lesson.complexity <= 0 || effectiveStats(student, state).intelligence <= 0)) continue;
      if (ability.effect === 'COMBINED_ATTACK' && (rules.workScale <= 0 ||
          effectiveStats(student, state).intelligence <= 0 || effectiveStats(target, targetState).intelligence <= 0)) continue;
      if (ability.effect === 'APPLY_TEMPORARY_EFFECT') {
        if (roundValue(ability.value * relation / 100 * powerModifier) <= 0) continue;
        if (window === 'AFTER_STUDENT_ATTACK' && !context.attackSucceeded) continue;
        if (effectiveStats(target, targetState)[ability.stat] >= 100) continue;
      }
      if (ids.includes(ability.id) && ability.window === window && relation >= (setup.classRelations ? relationThreshold(student, ability.minRelation, ability.effect === 'COMBINED_ATTACK') : ability.minRelation)) {
        candidates.push({ actorId: student.id, targetId: target.id, ability, relation, powerModifier, depth: context.depth });
      }
    }
  }
  candidates.sort((a, b) => b.relation - a.relation || seat(a.actorId).row - seat(b.actorId).row ||
    seat(a.actorId).column - seat(b.actorId).column ||
    Number(b.ability.effect === 'COMBINED_ATTACK') - Number(a.ability.effect === 'COMBINED_ATTACK') ||
    (a.ability.id < b.ability.id ? -1 : a.ability.id > b.ability.id ? 1 : 0));
  // Pour un même partenaire, une capacité de combo débloquée remplace sa
  // réduction simple. Avec checks de moral, seules les opportunités validées
  // dans la fenêtre actuelle sont prioritaires : aucune réservation future.
  const comboPartners = new Set(candidates.filter(candidate => candidate.ability.effect === 'REDUCE_COMPLEXITY').filter(candidate => {
    if (interactionRules) return candidates.some(other => other.actorId === candidate.actorId && other.ability.effect === 'COMBINED_ATTACK');
    const student = students.find(student => student.id === candidate.actorId)!;
    const ids = student.reactionIds ?? setup.archetypes.find(archetype => archetype.id === student.archetypeId)?.reactionIds ?? [];
    return rules.workScale > 0 && effectiveStats(student, states.get(student.id)!).intelligence > 0 &&
      effectiveStats(target, targetState).intelligence > 0 && setup.abilities.some(ability =>
        ability.effect === 'COMBINED_ATTACK' && ids.includes(ability.id) &&
        (ability.window === window || window === 'BEFORE_STUDENT_ATTACK' && ability.window === 'DURING_STUDENT_ATTACK') &&
        candidate.relation >= ability.minRelation);
  }).map(candidate => candidate.actorId));
  if (setup.classRelations && context.behavior) {
    const pool = candidates.map(candidate => ({ candidate, ...behaviorCandidate(students.find(s => s.id === candidate.actorId)!, targetState, candidate.ability.id, candidate.relation) }));
    for (const item of pool) { const { candidate: _, ...detail } = item; events.push({ type: 'BEHAVIOR_CANDIDATE_CREATED', ...detail }); }
    candidates.length = 0;
    while (pool.length) {
      const chosen = weightedChoice(pool, context.behavior.random)!;
      candidates.push(chosen.candidate); pool.splice(pool.indexOf(chosen), 1);
    }
  }
  for (const candidate of candidates) {
    if (!setup.classRelations && candidate.ability.effect === 'REDUCE_COMPLEXITY' && comboPartners.has(candidate.actorId)) continue;
    const reason = queue.enqueueReaction(candidate);
    if (reason) {
      events.push({ type: 'REACTION_LIMIT_REACHED', sourceId: candidate.actorId, targetId: target.id, reason });
      continue;
    }
    if (setup.classRelations) events.push({ type: 'BEHAVIOR_SELECTED', ...behaviorCandidate(students.find(s => s.id === candidate.actorId)!, targetState, candidate.ability.id, candidate.relation) });
    // Une réaction par fenêtre ; une seule protection et un soutien par statistique
    // sur ce tour. Les autres élèves conservent leur disponibilité.
    break;
  }
  let reaction: QueuedReaction | undefined;
  while ((reaction = queue.dequeueReaction()) !== undefined) {
    const source = students.find(student => student.id === reaction!.actorId)!;
    const state = effectiveStats(source, states.get(source.id)!);
    const ability = reaction.ability;
    const powerModifier = reaction.powerModifier ?? 1;
    let before: number;
    let after: number;
    if (ability.effect === 'COMBINED_ATTACK') {
      context.modifiers.combined = { partner: state, synergyRatio: ability.synergy * reaction.relation / 100 * powerModifier };
      resolvedEffects.add(effectKey(ability));
      events.push({ type: 'COMBINED_ATTACK_STARTED', sourceId: source.id, targetId: target.id,
        abilityId: ability.id, relation: reaction.relation });
      continue;
    } else if (ability.effect === 'REDUCE_PRESSURE' || ability.effect === 'REDUCE_COMPLEXITY') {
      const stat = ability.effect === 'REDUCE_PRESSURE' ? 'pressure' : 'complexity';
      const power = ability.effect === 'REDUCE_PRESSURE' ? state.discipline : state.intelligence;
      const ratio = Math.min(ability.maxReduction, ability.reduction *
        power / rules.defenseReference * moraleMultiplier(state.morale) * reaction.relation / 100 * powerModifier);
      before = lesson[stat];
      lesson[stat] = roundValue(Math.max(0, before * (1 - ratio)));
      after = lesson[stat];
    } else {
      before = effectiveStats(target, targetState)[ability.stat];
      // La relation module la puissance ; le plafond des statistiques reste 100.
      const value = roundValue(ability.value * reaction.relation / 100 * powerModifier);
      applyTemporaryEffect(targetState, {
        id: JSON.stringify([source.id, target.id, ability.id]), abilityId: ability.id,
        sourceId: source.id, targetId: target.id, stat: ability.stat, value,
        remainingRounds: ability.durationInRounds,
      }, events);
      after = effectiveStats(target, targetState)[ability.stat];
    }
    resolvedEffects.add(effectKey(ability));
    events.push({ type: 'REACTION_TRIGGERED', sourceId: source.id, targetId: reaction.targetId,
      abilityId: ability.id, window, effect: ability.effect,
      relation: reaction.relation, before, after });
  }
}
