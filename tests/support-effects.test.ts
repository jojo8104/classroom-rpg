import { describe, expect, it } from 'vitest';
import type { ReactionAbility, TemporaryEffect } from '../src/domain.js';
import type { ActionEvent } from '../src/events.js';
import { createPrototype } from '../src/data/prototype.js';
import { createActionRules } from '../src/data/rules.js';
import { resolveActionRound } from '../src/engine/actions.js';
import { createLessonStates } from '../src/engine/combat.js';
import { applyTemporaryEffect, effectiveStats, endRoundEffects } from '../src/engine/effects.js';
import { SeededRandom } from '../src/engine/random.js';
import { Simulation } from '../src/engine/simulation.js';

type SupportAbility = Extract<ReactionAbility, { effect: 'APPLY_TEMPORARY_EFFECT' }>;
function fixture() {
  const scenario = createPrototype();
  scenario.students = scenario.students.slice(0, 2);
  scenario.students[0]!.reactionIds = [];
  scenario.students[1]!.archetypeId = 'support';
  scenario.students[1]!.reactionIds = ['test_support'];
  scenario.relations = [{ studentIds: ['student-1', 'student-2'], value: 80 }];
  const ability: SupportAbility = { id: 'test_support', window: 'BEFORE_STUDENT_ATTACK',
    effect: 'APPLY_TEMPORARY_EFFECT', minRelation: 40, stat: 'intelligence', value: 20, durationInRounds: 2 };
  scenario.reactionAbilities!.push(ability);
  scenario.lesson.pressure = 10;
  const rules = createActionRules();
  rules.criticalChance = 0; rules.workVariation = 0; rules.workScale = 0.1;
  rules.supportChanceByArchetype = { offensive: 0, defensive: 0, support: 0 };
  return { scenario, ability, rules, states: createLessonStates(scenario.students, scenario.lesson) };
}
function run(f: ReturnType<typeof fixture>) {
  const s = f.scenario;
  return resolveActionRound(s.students, f.states, new SeededRandom(42), f.rules, s.lesson, s.lesson.chapters[0]!.id,
    { classroom: s.classroom, archetypes: s.archetypes, relations: s.relations!, abilities: s.reactionAbilities! });
}
function effect(overrides: Partial<TemporaryEffect> = {}): TemporaryEffect {
  return { id: 'buff', abilityId: 'test_support', sourceId: 'student-2', targetId: 'student-1',
    stat: 'intelligence', value: 10, remainingRounds: 2, ...overrides };
}

describe('Soutiens réactifs', () => {
  it.each(['BEFORE_STUDENT_ATTACK', 'DURING_STUDENT_ATTACK'] as const)('augmente le gain dès la fenêtre %s', window => {
    const f = fixture();
    f.ability.window = window;
    const baseline = structuredClone(f); baseline.scenario.students[1]!.reactionIds = [];
    const before = structuredClone(f);
    const result = run(f);
    expect(result.students[0]!.lessonUnderstanding).toBeGreaterThan(run(baseline).students[0]!.lessonUnderstanding);
    const appliedIndex = result.events.findIndex(event => event.type === 'TEMPORARY_EFFECT_APPLIED');
    expect(appliedIndex).toBeLessThan(result.events.findIndex(event => event.type === 'UNDERSTANDING_CHANGED'));
    expect(result.events.filter(event => event.type === 'STUDENT_ACTION' && event.actorId === 'student-2' && !event.extra)).toHaveLength(1);
    expect(result.students[1]!.effects).toEqual([]);
    expect(f).toEqual(before);
  });

  it('un soutien de discipline réduit la riposte sans augmenter la compréhension', () => {
    const f = fixture(); f.ability.stat = 'discipline'; f.ability.window = 'DURING_STUDENT_ATTACK';
    const supported = run(f);
    f.scenario.students[1]!.reactionIds = [];
    const baseline = run(f);
    expect(supported.students[0]!.lessonUnderstanding).toBe(baseline.students[0]!.lessonUnderstanding);
    expect(supported.students[0]!.concentration).toBeGreaterThan(baseline.students[0]!.concentration);
  });

  it('le soutien après réussite agit sur la suite et ne réécrit pas le gain passé', () => {
    const f = fixture(); f.ability.stat = 'morale'; f.ability.window = 'AFTER_STUDENT_ATTACK';
    const supported = run(f);
    f.scenario.students[1]!.reactionIds = [];
    const baseline = run(f);
    expect(supported.students[0]!.lessonUnderstanding).toBe(baseline.students[0]!.lessonUnderstanding);
    expect(supported.students[0]!.morale).toBe(f.states[0]!.morale);
    expect(supported.students[0]!.concentration).toBeGreaterThan(baseline.students[0]!.concentration);
    f.states = supported.students;
    const next = run(f);
    const control = structuredClone(f); control.states[0]!.effects = [];
    expect(next.students[0]!.lessonUnderstanding).toBeGreaterThan(run(control).students[0]!.lessonUnderstanding);
    expect(next.students[0]!.effects).toEqual([]);
    expect(supported.students[0]!.effects[0]!.remainingRounds).toBe(1);
  });

  it('n’encourage pas une attaque sans progression', () => {
    const f = fixture(); f.ability.window = 'AFTER_STUDENT_ATTACK'; f.rules.workScale = 0;
    expect(run(f).events.some(event => event.type === 'REACTION_TRIGGERED')).toBe(false);
  });

  it.each(['relation', 'resting', 'budget'] as const)('respecte l’éligibilité du soutien : %s', reason => {
    const f = fixture();
    if (reason === 'relation') f.scenario.relations![0]!.value = 39;
    if (reason === 'resting') f.states[1]!.concentration = 0;
    if (reason === 'budget') f.rules.maxReactionsPerStudent = 0;
    expect(run(f).students[0]!.effects).toEqual([]);
  });

  it('reproduit une leçon complète avec effets et relations dans un ordre différent', () => {
    const scenario = createPrototype();
    const result = new Simulation(scenario, 12345).runToCompletion();
    expect(result.events.some(event => event.type === 'TEMPORARY_EFFECT_APPLIED')).toBe(true);
    scenario.students.reverse(); scenario.reactionAbilities!.reverse(); scenario.relations!.reverse();
    expect(new Simulation(scenario, 12345).runToCompletion()).toEqual(result);
  });
});

describe('Durée et isolation des effets temporaires', () => {
  it('un effet reçu entre deux rounds couvre tout le prochain round puis expire', () => {
    const f = fixture(); f.scenario.students[1]!.reactionIds = [];
    const events: ActionEvent[] = [];
    applyTemporaryEffect(f.states[0]!, effect({ remainingRounds: 1 }), events);
    const baseline = structuredClone(f); baseline.states[0]!.effects = [];
    const result = run(f);
    expect(result.students[0]!.lessonUnderstanding).toBeGreaterThan(run(baseline).students[0]!.lessonUnderstanding);
    expect(result.students[0]!.effects).toEqual([]);
    expect(result.events.filter(event => event.type === 'TEMPORARY_EFFECT_EXPIRED')).toHaveLength(1);
    f.states = result.students;
    expect(effectiveStats(f.scenario.students[0]!, f.states[0]!).intelligence).toBe(f.scenario.students[0]!.intelligence);
  });

  it('les actions bonus ne consomment pas de durée supplémentaire', () => {
    const f = fixture(); f.scenario.students[1]!.reactionIds = [];
    f.rules.supportChanceByArchetype.support = 1; f.rules.extraActionChance = 1;
    applyTemporaryEffect(f.states[0]!, effect(), []);
    const result = run(f);
    expect(result.events.some(event => event.type === 'STUDENT_ACTION' && event.extra)).toBe(true);
    expect(result.students[0]!.effects[0]!.remainingRounds).toBe(1);
    expect(result.events.filter(event => event.type === 'TEMPORARY_EFFECT_DECREMENTED')).toHaveLength(1);
  });

  it('renouvelle un même effet sans empiler sa puissance et isole les événements', () => {
    const f = fixture(); const state = f.states[0]!; const events: ActionEvent[] = [];
    const original = effect();
    applyTemporaryEffect(state, original, events);
    original.value = 100;
    applyTemporaryEffect(state, effect({ value: 5, remainingRounds: 3 }), events);
    expect(state.effects).toHaveLength(1);
    expect(state.effects[0]).toMatchObject({ value: 10, remainingRounds: 3 });
    expect(events[0]).toMatchObject({ effect: { value: 10, remainingRounds: 2 } });
    endRoundEffects([state], events);
    expect(events[1]).toMatchObject({ type: 'TEMPORARY_EFFECT_APPLIED', refreshed: true, effect: { remainingRounds: 3 } });
  });

  it('retient le plus fort bonus par statistique et revient au plus faible après expiration', () => {
    const f = fixture(); const state = f.states[0]!; const student = f.scenario.students[0]!;
    applyTemporaryEffect(state, effect({ value: 10, remainingRounds: 2 }), []);
    applyTemporaryEffect(state, effect({ id: 'strong', value: 30, remainingRounds: 1 }), []);
    expect(effectiveStats(student, state).intelligence).toBe(student.intelligence + 30);
    endRoundEffects([state], []);
    expect(effectiveStats(student, state).intelligence).toBe(student.intelligence + 10);
    endRoundEffects([state], []);
    expect(effectiveStats(student, state).intelligence).toBe(student.intelligence);
  });

  it('borne les statistiques effectives et repart sans bonus dans une nouvelle leçon', () => {
    const f = fixture();
    applyTemporaryEffect(f.states[0]!, effect({ value: 100 }), []);
    expect(effectiveStats(f.scenario.students[0]!, f.states[0]!).intelligence).toBe(100);
    expect(createLessonStates(f.scenario.students, f.scenario.lesson)[0]!.effects).toEqual([]);
  });

  it.each([0, -1, 1.5, NaN, Infinity])('rejette une durée invalide : %s', duration => {
    const f = fixture(); f.ability.durationInRounds = duration;
    expect(() => new Simulation(f.scenario, 1, f.rules)).toThrow('durée');
    expect(() => applyTemporaryEffect(f.states[0]!, effect({ remainingRounds: duration }), [])).toThrow('invalide');
  });

  it('refuse un effet attribué à une autre cible', () => {
    const f = fixture();
    expect(() => applyTemporaryEffect(f.states[0]!, effect({ targetId: 'student-2' }), [])).toThrow('invalide');
  });
});
