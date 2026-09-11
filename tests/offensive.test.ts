import { describe, expect, it } from 'vitest';
import { createPrototype } from '../src/data/prototype.js';
import { createActionRules } from '../src/data/rules.js';
import { resolveActionRound } from '../src/engine/actions.js';
import { createLessonStates, workGain } from '../src/engine/combat.js';
import { SeededRandom } from '../src/engine/random.js';
import { Simulation } from '../src/engine/simulation.js';
import { applyTemporaryEffect } from '../src/engine/effects.js';

function fixture(relation = 70) {
  const scenario = createPrototype();
  scenario.students = scenario.students.slice(0, 3);
  scenario.students.forEach((student, index) => {
    student.intelligence = 40 + index * 10; student.morale = 50; student.concentration = 100;
    student.reactionIds = index === 1 ? ['weaken_lesson', 'combined_attack'] : [];
  });
  scenario.students[1]!.archetypeId = 'offensive';
  scenario.relations = [{ studentIds: ['student-1', 'student-2'], value: relation },
    { studentIds: ['student-2', 'student-3'], value: relation }];
  scenario.lesson.requiredProgress = 10000;
  const rules = createActionRules(); rules.criticalChance = 0; rules.workVariation = 0;
  rules.supportChanceByArchetype = { offensive: 0, defensive: 0, support: 0 };
  return { scenario, rules, states: createLessonStates(scenario.students, scenario.lesson) };
}
function run(f: ReturnType<typeof fixture>, random = new SeededRandom(42)) {
  const s = f.scenario;
  return resolveActionRound(s.students, f.states, random, f.rules, s.lesson, s.lesson.chapters[0]!.id,
    { classroom: s.classroom, archetypes: s.archetypes, relations: s.relations!, abilities: s.reactionAbilities! });
}
const combos = (result: ReturnType<typeof run>) => result.events.filter(event => event.type === 'COMBINED_ATTACK_RESOLVED');

describe('Réactions offensives', () => {
  it.each(['BEFORE_STUDENT_ATTACK', 'DURING_STUDENT_ATTACK'] as const)('affaiblit la complexité à la fenêtre %s, pour cette attaque seulement', window => {
    const f = fixture();
    f.scenario.reactionAbilities!.find(ability => ability.id === 'weaken_lesson')!.window = window;
    const original = structuredClone(f);
    const result = run(f);
    expect(result.events.find(event => event.type === 'REACTION_TRIGGERED')).toMatchObject({
      effect: 'REDUCE_COMPLEXITY', sourceId: 'student-2', targetId: 'student-1', before: 50, after: 36,
    });
    expect(result.students[0]!.chapters[0]!.progress).toBeGreaterThan(workGain(f.scenario.students[0]!, 50, f.scenario.lesson, f.rules, 0.5));
    expect(result.students[1]!.chapters[0]!.progress).toBe(workGain(f.scenario.students[1]!, 50, f.scenario.lesson, f.rules, 0.5));
    expect(result.students[2]!.chapters[0]!.progress).toBe(workGain(f.scenario.students[2]!, 50, f.scenario.lesson, f.rules, 0.5));
    expect(f).toEqual(original);
    expect(combos(result)).toHaveLength(0);
  });

  it.each([0, 39, 40, 89, 90, 100])('débloque la réaction attendue avec une relation de %s', relation => {
    const result = run(fixture(relation));
    const simple = result.events.filter(event => event.type === 'REACTION_TRIGGERED' && event.effect === 'REDUCE_COMPLEXITY');
    expect(simple).toHaveLength(relation >= 40 && relation < 90 ? 1 : 0);
    expect(combos(result)).toHaveLength(relation >= 90 ? 1 : 0);
  });

  it('applique la somme des deux contributions plus une synergie positive à l’élève actif', () => {
    const f = fixture(90);
    const result = run(f);
    const combo = combos(result)[0]!;
    expect(combo.activeGain).toBe(workGain(f.scenario.students[0]!, 50, f.scenario.lesson, f.rules, .5));
    expect(combo.partnerGain).toBe(workGain(f.scenario.students[1]!, 50, f.scenario.lesson, f.rules, .5));
    expect(combo.synergyGain).toBeGreaterThan(0);
    expect(combo.potentialGain).toBeGreaterThan(combo.activeGain + combo.partnerGain);
    expect(result.students[0]!.chapters[0]!.progress).toBe(combo.potentialGain);
    const partnerTurn = result.events.findIndex(event => event.type === 'STUDENT_ACTION' && event.actorId === 'student-2');
    expect(result.events.slice(0, partnerTurn).filter(event => event.type === 'UNDERSTANDING_CHANGED' && event.studentId === 'student-2')).toHaveLength(0);
    expect(result.events.filter(event => event.type === 'STUDENT_ACTION' && event.actorId === 'student-2' && !event.extra)).toHaveLength(1);
    expect(result.students[1]!.chapters[0]!.progress).toBe(combo.partnerGain);
    expect(result.events.findIndex(event => event.type === 'COMBINED_ATTACK_STARTED')).toBeLessThan(result.events.indexOf(combo));
  });

  it('plafonne le gain appliqué au chapitre sans masquer le potentiel du combo', () => {
    const f = fixture(90); f.scenario.lesson.requiredProgress = 40;
    const result = run(f);
    const combo = combos(result)[0]!;
    expect(combo.potentialGain).toBeGreaterThan(combo.appliedProgress);
    expect(combo.appliedProgress).toBe(20);
    expect(result.students[0]!.chapters[1]!.progress).toBe(0);
    expect(result.events.some(event => event.type === 'LESSON_RETALIATED' && event.studentId === 'student-1')).toBe(false);
  });

  it.each(['disengaged', 'diagonal', 'no-capacity', 'budget', 'depth'] as const)('refuse le combo si le partenaire est inéligible : %s', reason => {
    const f = fixture(90);
    if (reason === 'disengaged') f.states[1]!.concentration = 0;
    if (reason === 'diagonal') f.scenario.students[1]!.seatId = 'seat-5';
    if (reason === 'no-capacity') f.scenario.students[1]!.reactionIds = [];
    if (reason === 'budget') f.rules.maxReactionsPerStudent = 0;
    if (reason === 'depth') f.rules.maxChainDepth = 0;
    expect(combos(run(f))).toHaveLength(0);
  });

  it('une capacité de combo pendant l’attaque remplace l’affaiblissement préalable du même partenaire', () => {
    const f = fixture(90);
    f.scenario.reactionAbilities!.find(ability => ability.id === 'combined_attack')!.window = 'DURING_STUDENT_ATTACK';
    const result = run(f);
    expect(combos(result)).toHaveLength(1);
    expect(result.events.some(event => event.type === 'REACTION_TRIGGERED' && event.effect === 'REDUCE_COMPLEXITY')).toBe(false);
  });

  it('les effets temporaires du partenaire renforcent sa contribution au combo', () => {
    const f = fixture(90);
    const normal = combos(run(f))[0]!;
    applyTemporaryEffect(f.states[1]!, { id: 'intelligence', abilityId: 'explain_neighbor', sourceId: 'student-3',
      targetId: 'student-2', stat: 'intelligence', value: 20, remainingRounds: 2 }, []);
    expect(combos(run(f))[0]!.partnerGain).toBeGreaterThan(normal.partnerGain);
  });

  it('permet un affaiblissement tardif si la fenêtre du combo a été prise par un soutien', () => {
    const f = fixture(90);
    f.scenario.students[2]!.seatId = 'seat-4';
    f.scenario.students[2]!.reactionIds = ['explain_neighbor'];
    f.scenario.relations!.push({ studentIds: ['student-1', 'student-3'], value: 100 });
    f.scenario.reactionAbilities!.find(ability => ability.id === 'weaken_lesson')!.window = 'DURING_STUDENT_ATTACK';
    const result = run(f);
    expect(result.events.some(event => event.type === 'REACTION_TRIGGERED' && event.effect === 'APPLY_TEMPORARY_EFFECT' && event.targetId === 'student-1')).toBe(true);
    expect(result.events.some(event => event.type === 'REACTION_TRIGGERED' && event.effect === 'REDUCE_COMPLEXITY' && event.targetId === 'student-1')).toBe(true);
    expect(combos(result).some(event => event.targetId === 'student-1')).toBe(false);
  });

  it('ne consomme aucun tirage supplémentaire et conserve l’exemption de riposte sur critique', () => {
    const f = fixture(90); f.rules.criticalChance = 1;
    const random = new SeededRandom(42); const normalRandom = new SeededRandom(42);
    const result = run(f, random);
    f.scenario.students[1]!.reactionIds = [];
    run(f, normalRandom);
    expect(random.next()).toBe(normalRandom.next());
    expect(result.events.filter(event => event.type === 'LESSON_RETALIATED')).toHaveLength(0);
    expect(combos(result)).toHaveLength(1);
  });

  it('reproduit les combos indépendamment de l’ordre des données', () => {
    const f = fixture(90);
    const result = new Simulation(f.scenario, 42, f.rules).runToCompletion();
    f.scenario.students.reverse(); f.scenario.reactionAbilities!.reverse(); f.scenario.relations!.reverse();
    expect(new Simulation(f.scenario, 42, f.rules).runToCompletion()).toEqual(result);
  });

  it.each([0, -1, NaN, Infinity, 1.1])('rejette un coefficient de synergie invalide : %s', synergy => {
    const f = fixture(90);
    const ability = f.scenario.reactionAbilities!.find(ability => ability.effect === 'COMBINED_ATTACK')!;
    if (ability.effect === 'COMBINED_ATTACK') ability.synergy = synergy;
    expect(() => new Simulation(f.scenario, 42, f.rules)).toThrow('synergie');
  });
});
