import type { ClassRelations, PersonalityProfile, PersonalityTrait, Student, StudentLessonState, StudentRelation } from '../domain.js';
import type { ActionEvent } from '../events.js';
import { SeededRandom } from './random.js';
import { roundValue } from './combat.js';

export const socialRules = {
  min: -100, max: 100, zones: [-60, -20, 20, 60, 85], initialMin: -15, initialMax: 55,
  base: 20, relationWeight: 0.3, needWeight: 10, altruisticNeed: 30,
  sociableWeight: 12, competitiveWeight: 15, impulsiveWeight: 16, calmWeight: 10,
  altruisticThreshold: 25, persistenceLoss: 0.5, calmLoss: 0.2, calmDistraction: 0.5,
  sociableGrowth: 0.5, impulsiveGrowth: 0.5, calmGrowth: 0.4,
  supportDelta: 1, defenseDelta: 2, comboDelta: 1, disruptionDelta: -2,
  comparisonMorale: 2, comparisonThreshold: 10,
};
export const personalityTraits: PersonalityTrait[] = ['altruistic', 'competitive', 'persistent', 'impulsive', 'calm', 'sociable'];
export const personalityLabels: Record<PersonalityTrait, string> = {
  altruistic: 'Altruiste', competitive: 'Compétitif', persistent: 'Persévérant', impulsive: 'Impulsif', calm: 'Calme', sociable: 'Sociable',
};
export function trait(student: Student, key: PersonalityTrait): number { return student.personality?.[key] ?? 0; }
export function validateSocial(students: readonly Student[], relations?: ClassRelations): string[] {
  const errors: string[] = [], ids = new Set(students.map(s => s.id)), pairs = new Set<string>();
  for (const student of students) for (const [key, value] of Object.entries(student.personality ?? {})) {
    if (!personalityTraits.includes(key as PersonalityTrait) || !Number.isFinite(value) || value < 0 || value > 1) errors.push('Personnalité : trait ou intensité invalide.');
  }
  for (const link of relations?.links ?? []) {
    const key = JSON.stringify([link.from, link.to]);
    if (!ids.has(link.from) || !ids.has(link.to) || link.from === link.to || pairs.has(key)) errors.push('Relation orientée : élèves inconnus, identiques ou lien dupliqué.');
    if (!Number.isFinite(link.score) || link.score < socialRules.min || link.score > socialRules.max) errors.push('Relation orientée : score invalide.');
    pairs.add(key);
  }
  return errors;
}
export function clampRelation(score: number): number {
  if (!Number.isFinite(score)) throw new Error('Score relationnel invalide.');
  return roundValue(Math.max(socialRules.min, Math.min(socialRules.max, score)));
}
export function getRelation(relations: ClassRelations, from: string, to: string): number {
  return relations.links.find(link => link.from === from && link.to === to)?.score ?? 0;
}
export function modifyRelation(relations: ClassRelations, from: string, to: string, delta: number): { before: number; after: number } {
  if (from === to) throw new Error('Une relation exige deux élèves distincts.');
  const before = getRelation(relations, from, to), after = clampRelation(before + delta);
  const link = relations.links.find(link => link.from === from && link.to === to);
  if (link) link.score = after; else relations.links.push({ from, to, score: after });
  return { before, after };
}
export function relationZone(score: number): string {
  return ['hostile', 'antipathie', 'neutre', 'bonne', 'forte', 'exceptionnelle'][socialRules.zones.findIndex(max => score <= max) === -1 ? 5 : socialRules.zones.findIndex(max => score <= max)]!;
}
export function migrateRelations(legacy: readonly StudentRelation[]): ClassRelations {
  return { links: legacy.flatMap(({ studentIds: [a, b], value }) => [{ from: a, to: b, score: value }, { from: b, to: a, score: value }]) };
}
export function createInitialRelations(students: readonly Student[], seed: number): ClassRelations {
  const random = new SeededRandom(seed), links: ClassRelations['links'] = [];
  const ordered = [...students].sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  for (const from of ordered) for (const to of ordered) if (from.id !== to.id) links.push({ from: from.id, to: to.id,
    score: socialRules.initialMin + random.integer(socialRules.initialMax - socialRules.initialMin + 1) });
  return { links };
}
export function createPersonality(seed: number): PersonalityProfile {
  const random = new SeededRandom(seed);
  return Object.fromEntries(personalityTraits.map(key => [key, random.integer(11) / 10]));
}
export function difficultyLoss(student: Student, loss: number): number {
  return roundValue(loss * (1 - socialRules.persistenceLoss * trait(student, 'persistent') - socialRules.calmLoss * trait(student, 'calm')));
}
export function relationThreshold(student: Student, minimum: number, synergy = false): number {
  return synergy ? minimum : Math.max(0, minimum - socialRules.altruisticThreshold * trait(student, 'altruistic'));
}
export interface BehaviorCandidate {
  actorId: string; targetId: string; action: string;
  baseWeight: number; relationModifier: number; personalityModifier: number; contextModifier: number;
  masteryValid: boolean; finalWeight: number;
}
export function behaviorCandidate(student: Student, target: StudentLessonState, action: string, relation: number,
  baseWeight = socialRules.base, masteryValid = true): BehaviorCandidate {
  const negative = action === 'DISRUPT', work = action === 'WORK';
  const need = (200 - target.concentration - target.morale) / 200;
  const relationModifier = work ? 0 : relation * socialRules.relationWeight * (negative ? -1 : 1);
  const contextModifier = work || negative ? 0 : need * socialRules.needWeight;
  const personalityModifier = work ? trait(student, 'competitive') * socialRules.competitiveWeight + trait(student, 'persistent') * need * socialRules.needWeight :
    trait(student, 'sociable') * socialRules.sociableWeight + trait(student, 'impulsive') * socialRules.impulsiveWeight - trait(student, 'calm') * socialRules.calmWeight +
    (negative ? -trait(student, 'altruistic') * socialRules.altruisticNeed : trait(student, 'altruistic') * need * socialRules.altruisticNeed + trait(student, 'competitive') * target.lessonUnderstanding / 100 * socialRules.competitiveWeight);
  return { actorId: student.id, targetId: target.studentId, action, baseWeight, relationModifier: roundValue(relationModifier),
    personalityModifier: roundValue(personalityModifier), contextModifier: roundValue(contextModifier), masteryValid,
    finalWeight: masteryValid ? roundValue(Math.max(0.1, baseWeight + relationModifier + personalityModifier + contextModifier)) : 0 };
}
export function weightedChoice<T extends { finalWeight: number }>(candidates: readonly T[], random: SeededRandom): T | undefined {
  if (candidates.some(c => !Number.isFinite(c.finalWeight) || c.finalWeight < 0)) throw new Error('Poids invalide.');
  const total = candidates.reduce((sum,c) => sum + c.finalWeight, 0);
  if (!total) return undefined;
  let draw = random.next() * total;
  for (const candidate of candidates) { draw -= candidate.finalWeight; if (draw < 0) return candidate; }
  return candidates.filter(c => c.finalWeight > 0).at(-1);
}
export function chooseBehavior(candidates: BehaviorCandidate[], random: SeededRandom, events: ActionEvent[]): BehaviorCandidate | undefined {
  for (const candidate of candidates) events.push({ type: 'BEHAVIOR_CANDIDATE_CREATED', ...candidate });
  const chosen = weightedChoice(candidates, random);
  if (chosen) events.push({ type: 'BEHAVIOR_SELECTED', ...chosen });
  return chosen;
}
export function evolveRelation(relations: ClassRelations, owner: Student, otherId: string, delta: number, reason: string, events: ActionEvent[]): void {
  const modifier = 1 + (delta > 0 ? trait(owner, 'sociable') * socialRules.sociableGrowth : 0) + trait(owner, 'impulsive') * socialRules.impulsiveGrowth - trait(owner, 'calm') * socialRules.calmGrowth;
  const result = modifyRelation(relations, owner.id, otherId, delta * modifier);
  if (result.before !== result.after) events.push({ type: 'RELATION_CHANGED', from: owner.id, to: otherId, ...result, reason });
}
