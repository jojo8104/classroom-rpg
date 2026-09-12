import { describe, expect, it } from 'vitest';
import { createSocialPrototype } from '../src/data/socialPrototype.js';
import { Simulation } from '../src/engine/simulation.js';
import { createActionRules } from '../src/data/rules.js';
import { createInteractionRules } from '../src/data/interactionRules.js';
import { createLessonStates } from '../src/engine/combat.js';
import { resolveActionRound } from '../src/engine/actions.js';
import { SeededRandom } from '../src/engine/random.js';
import { getRelation, modifyRelation } from '../src/engine/social.js';
import { formatJournal } from '../src/cli/formatJournal.js';

function reactionScenario(relation: number, mastery: number, effect: 'COMBINED_ATTACK' | 'REDUCE_PRESSURE' = 'COMBINED_ATTACK') {
  const s = createSocialPrototype(); s.students = s.students.slice(0, 2);
  s.students.forEach(st => { st.morale = 100; st.personality = { altruistic: 1 }; st.disruptionChance = 0; st.reactionIds = []; });
  const helper = s.students[1]!; helper.reactionIds = ['test'];
  s.classRelations = { links: [{ from: helper.id, to: s.students[0]!.id, score: relation }] };
  s.reactionAbilities = effect === 'COMBINED_ATTACK' ? [{ id: 'test', effect, window: 'BEFORE_STUDENT_ATTACK', minRelation: 90, synergy: 0.25 }] : [{ id: 'test', effect, window: 'DURING_LESSON_ATTACK', minRelation: 40, reduction: 0.6, maxReduction: 0.8 }];
  s.archetypes.forEach(a => a.reactionIds = []);
  const states = createLessonStates(s.students, s.lesson);
  states.forEach(state => { state.chapters[0]!.progress = mastery / 100 * 50; state.lessonUnderstanding = mastery / 2; });
  const rules = createActionRules(); rules.criticalChance = 0; rules.workScale = 0.01;
  for (const key of Object.keys(rules.supportChanceByArchetype)) rules.supportChanceByArchetype[key] = 0;
  return resolveActionRound(s.students, states, new SeededRandom(6), rules, s.lesson, s.lesson.chapters[0]!.id,
    { classRelations: s.classRelations, relations: [], classroom: s.classroom, archetypes: s.archetypes, abilities: s.reactionAbilities, interactionRules: createInteractionRules(), learningRules: s.learningRules });
}
describe('Roadmap 3 intégrée', () => {
  it('rejoue une séance avec traits, liens, maîtrise, réactions et interventions', () => {
    const s = createSocialPrototype(); const initial = structuredClone(s);
    const decisions = [{ kind: 'REEXPLAIN' as const, targetId: 'student-3' }, { kind: 'ENCOURAGE' as const, targetId: 'student-1' }];
    const result = new Simulation(s, 12345).runToCompletion(decisions);
    expect(result).toEqual(new Simulation(s, 12345).runToCompletion(decisions));
    expect(s).toEqual(initial);
    expect(result.events.some(e => e.type === 'BEHAVIOR_SELECTED')).toBe(true);
    expect(result.events.some(e => e.type === 'RELATION_CHANGED')).toBe(true);
    expect(result.events.some(e => e.type === 'REACTION_TRIGGERED')).toBe(true);
    expect(result.events.some(e => e.type === 'TEACHER_ACTION_APPLIED')).toBe(true);
    expect(formatJournal(s,result)).toContain('MATRICE RELATIONNELLE');
    const next = createSocialPrototype(); next.students = result.nextLessonStudents; next.classRelations = result.classRelations!;
    expect(new Simulation(next, 7).classRelations).toEqual(result.classRelations);
    const copy = new Simulation(next, 7); const snapshot = copy.classRelations!; snapshot.links[0]!.score = -100;
    expect(copy.classRelations).toEqual(result.classRelations);
  });
  it('reproduit les décisions si les collections sont réordonnées', () => {
    const s = createSocialPrototype(), expected = new Simulation(s, 17).runToCompletion();
    s.students.reverse(); s.classRelations!.links.reverse(); s.reactionAbilities!.reverse();
    const result = new Simulation(s, 17).runToCompletion();
    expect(result.events).toEqual(expected.events);
    const sorted = (links: NonNullable<typeof result.classRelations>['links']) => [...links].sort((a,b) => (a.from + a.to).localeCompare(b.from + b.to));
    expect(sorted(result.classRelations!.links)).toEqual(sorted(expected.classRelations!.links));
  });
  it('une variation de personnalité ou de relation produit une divergence explicable', () => {
    const s = createSocialPrototype(), original = new Simulation(s, 12).runToCompletion();
    s.students.forEach(st => st.personality = { calm: 1 });
    const changed = new Simulation(s, 12).runToCompletion();
    expect(changed.events.filter(e => e.type === 'BEHAVIOR_SELECTED')).not.toEqual(original.events.filter(e => e.type === 'BEHAVIOR_SELECTED'));
    s.classRelations!.links.forEach(r => modifyRelation(s.classRelations!, r.from, r.to, -100 - r.score));
    const hostile = new Simulation(s, 12).runToCompletion();
    expect(hostile.events.filter(e => e.type === 'BEHAVIOR_SELECTED')).not.toEqual(changed.events.filter(e => e.type === 'BEHAVIOR_SELECTED'));
  });
  it('la synergie exige relation ET maîtrise, sans exception altruiste', () => {
    expect(reactionScenario(100, 0).events.some(e => e.type === 'REACTION_EVALUATED' && e.reason === 'mastery')).toBe(true);
    expect(reactionScenario(100, 0).events.some(e => e.type === 'COMBINED_ATTACK_STARTED')).toBe(false);
    expect(reactionScenario(89, 80).events.some(e => e.type === 'COMBINED_ATTACK_STARTED')).toBe(false);
    expect(reactionScenario(100, 80).events.some(e => e.type === 'COMBINED_ATTACK_STARTED')).toBe(true);
  });
  it('une mauvaise relation bloque la protection et l’altruisme assouplit son seuil', () => {
    expect(reactionScenario(-50, 0, 'REDUCE_PRESSURE').events.some(e => e.type === 'REACTION_TRIGGERED')).toBe(false);
    const events = reactionScenario(20, 0, 'REDUCE_PRESSURE').events;
    expect(events.some(e => e.type === 'REACTION_TRIGGERED')).toBe(true);
    expect(events.some(e => e.type === 'RELATION_CHANGED' && e.from === 'student-1' && e.to === 'student-2')).toBe(true);
  });
  it('le moral reste la porte d’entrée des aides', () => {
    const s = createSocialPrototype(); s.students.forEach(st => { st.morale = 0; st.personality = { altruistic: 1, sociable: 1 }; });
    const sim = new Simulation(s, 42); const events = sim.resolveRound();
    expect(events.some(e => e.type === 'STUDENT_ACTION' && e.actionId === 'SUPPORT')).toBe(false);
    expect(events.some(e => e.type === 'REACTION_TRIGGERED')).toBe(false);
  });
  it('refuse les profils et les relations invalides', () => {
    const s = createSocialPrototype(); s.students[0]!.personality = { calm: Infinity };
    expect(() => new Simulation(s, 1)).toThrow('Personnalité');
    s.students[0]!.personality = {}; s.classRelations!.links.push({ from: 'unknown', to: 'student-1', score: 0 });
    expect(() => new Simulation(s, 1)).toThrow('Relation orientée');
  });
});

it('le compétitif est stimulé par un voisin apprécié et contrarié par un rival', () => {
  const run = (relation: number) => {
    const s = createSocialPrototype(); s.students = s.students.slice(0, 2);
    s.students.forEach(st => { st.personality = {}; st.morale = 65; st.reactionIds = []; st.disruptionChance = 0; });
    s.students[1]!.personality = { competitive: 1 };
    s.classRelations = { links: [{ from: 'student-2', to: 'student-1', score: relation }] };
    const rules = createActionRules(); rules.workScale = 100;
    Object.keys(rules.supportChanceByArchetype).forEach(key => rules.supportChanceByArchetype[key] = 0);
    return new Simulation(s, 22, rules).resolveRound();
  };
  for (const relation of [-50, 50]) {
    const events = run(relation);
    const comparison = events.find(e => e.type === 'RELATION_CHANGED' && e.reason === 'comparison');
    expect(comparison?.type).toBe('RELATION_CHANGED');
    if (comparison?.type === 'RELATION_CHANGED') expect(Math.sign(comparison.after - comparison.before)).toBe(Math.sign(relation));
    expect(events.some(e => e.type === 'MORALE_CHANGED' && e.studentId === 'student-2' && Math.sign(e.after - e.before) === Math.sign(relation))).toBe(true);
  }
});
it('la persévérance diminue la perte de moral effectivement causée par la riposte', () => {
  const run = (persistent: number) => {
    const s = createSocialPrototype(); s.students = s.students.slice(0,1); s.classRelations = { links: [] };
    s.students[0]!.personality = { persistent }; s.students[0]!.reactionIds = [];
    const rules = createActionRules(); rules.criticalChance = 0; rules.workScale = 0.01;
    return new Simulation(s, 22, rules).resolveRound().filter(e => e.type === 'MORALE_CHANGED' && e.reason === 'retaliation').reduce((sum,e) => sum + (e.type === 'MORALE_CHANGED' ? e.before - e.after : 0), 0);
  };
  expect(run(0)).toBeGreaterThan(0); expect(run(1)).toBeLessThan(run(0));
});
it('les liens évoluent uniquement après une conséquence utile et restent bornés sur plusieurs seeds', () => {
  for (const seed of [1, 2, 3, 100, 4294967295]) {
    const s = createSocialPrototype();
    const a = new Simulation(s, seed).runToCompletion();
    expect(a).toEqual(new Simulation(s, seed).runToCompletion());
    expect(a.classRelations!.links.every(r => r.score >= -100 && r.score <= 100)).toBe(true);
    for (const [index,e] of a.events.entries()) {
      if (e.type === 'RELATION_CHANGED' && e.reason === 'disruption') expect(a.events.slice(0,index).some(c => c.type === 'DISRUPTION_RESOLVED' && c.sourceId === e.to && c.targetId === e.from && c.damage > 0)).toBe(true);
    }
  }
});
