import { describe, expect, it } from 'vitest';
import { createPrototype } from '../src/data/prototype.js';
import { createActionRules } from '../src/data/rules.js';
import { createTeacherRules } from '../src/data/teacherRules.js';
import { Simulation } from '../src/engine/simulation.js';
import { resolveTargets, resolveTeacherAction } from '../src/engine/teacher.js';
import { createLessonStates } from '../src/engine/combat.js';
import { areAdjacent } from '../src/engine/reactions.js';
import type { TeacherAction } from '../src/domain.js';

function ready(patience = 70) {
  const scenario = createPrototype(); scenario.teacher.patience = patience;
  const sim = new Simulation(scenario, 12345); sim.resolveRound(); sim.acknowledgeRoundResult(); return sim;
}
function context() {
  const s = createPrototype();
  return { teacher: { ...s.teacher, maxPatience: 70 }, students: s.students,
    states: createLessonStates(s.students, s.lesson), lesson: s.lesson, rules: createTeacherRules(), hasNextRound: true };
}
describe('Interventions du professeur', () => {
  it('exige la phase du professeur et une seule décision', () => {
    const sim = new Simulation(createPrototype(), 1);
    expect(() => sim.applyTeacherAction({ kind: 'PASS' })).toThrow();
    sim.resolveRound(); expect(() => sim.applyTeacherAction({ kind: 'PASS' })).toThrow();
    sim.acknowledgeRoundResult(); sim.applyTeacherAction({ kind: 'PASS' });
    expect(sim.state).toBe('ROUND_READY'); expect(() => sim.applyTeacherAction({ kind: 'PASS' })).toThrow();
  });
  it.each< TeacherAction >([{ kind: 'ENCOURAGE', targetId: 'missing' }, { kind: 'REFRAME', targetId: 'student-1' }])('rejette atomiquement une cible invalide : $kind', action => {
    const sim = ready(); const before = [sim.events, sim.studentStates, sim.teacherState];
    expect(() => sim.applyTeacherAction(action)).toThrow();
    expect([sim.events, sim.studentStates, sim.teacherState]).toEqual(before);
    expect(sim.state).toBe('TEACHER_INTERVENTION');
  });
  it('refuse une dépense excessive et permet PASS à zéro', () => {
    const sim = ready(0); const events = sim.events;
    expect(() => sim.applyTeacherAction({ kind: 'BREAK' })).toThrow(/Patience/);
    expect(sim.events).toEqual(events); sim.applyTeacherAction({ kind: 'PASS' });
    expect(sim.teacherState.patience).toBe(0); expect(sim.state).toBe('ROUND_READY');
  });
  it('encourage seulement la cible et débite exactement le coût', () => {
    const sim = ready(); const before = sim.studentStates;
    sim.applyTeacherAction({ kind: 'ENCOURAGE', targetId: 'student-1' });
    expect(sim.teacherState.patience).toBe(62);
    expect(sim.studentStates[0]!.morale).toBe(Math.min(100, before[0]!.morale + 14));
    expect(sim.studentStates.slice(1)).toEqual(before.slice(1));
  });
  it('module la puissance par la pédagogie', () => {
    const c = context(); c.teacher.pedagogy = 30;
    const low = resolveTeacherAction(c, { kind: 'ENCOURAGE', targetId: 'student-1' }, 10);
    c.teacher.pedagogy = 90;
    const high = resolveTeacherAction(c, { kind: 'ENCOURAGE', targetId: 'student-1' }, 10);
    expect(low.students[0]!.morale).toBe(72); expect(high.students[0]!.morale).toBe(86);
    expect(c.states[0]!.morale).toBe(65);
  });
  it('la pause réveille les élèves décrochés et plafonne à 100', () => {
    const c = context(); c.states[0]!.concentration = 0; c.states[1]!.concentration = 99;
    const result = resolveTeacherAction(c, { kind: 'BREAK' }, 10);
    expect(result.students[0]!.concentration).toBe(18); expect(result.students[1]!.concentration).toBe(100);
    expect(result.events).toContainEqual({ type: 'STUDENT_RESUMED', studentId: 'student-1' });
    expect(result.students.every((s, i) => s.concentration >= c.states[i]!.concentration)).toBe(true);
  });
  it('conserve le bilan antérieur à la pause', () => {
    const sim = ready(); const summary = sim.events.find(e => e.type === 'ROUND_ENDED');
    sim.applyTeacherAction({ kind: 'BREAK' });
    expect(sim.events.find(e => e.type === 'ROUND_ENDED')).toEqual(summary);
  });
  it('réexpliquer agit pendant deux prochains rounds puis expire', () => {
    const sim = ready(); sim.applyTeacherAction({ kind: 'REEXPLAIN', targetId: 'student-1' });
    const effect = () => sim.studentStates[0]!.effects.find(e => e.stat === 'complexityReduction');
    expect(effect()).toMatchObject({ value: 18, remainingRounds: 2 });
    sim.resolveRound(); expect(effect()?.remainingRounds).toBe(1);
    sim.acknowledgeRoundResult(); sim.applyTeacherAction({ kind: 'PASS' });
    sim.resolveRound(); expect(effect()).toBeUndefined();
  });
  it('réexpliquer augmente effectivement le gain de la cible sans modifier la leçon', () => {
    const scenario = createPrototype(); scenario.students = scenario.students.slice(0, 1);
    scenario.relations = []; scenario.students[0]!.reactionIds = [];
    const rules = createActionRules(); rules.workScale = 0.1; rules.pressureScale = 0;
    rules.extraActionChance = 0; rules.criticalChance = 0; rules.supportChanceByArchetype.offensive = 0;
    const sims = [new Simulation(scenario, 1, rules), new Simulation(scenario, 1, rules)];
    for (const sim of sims) { sim.resolveRound(); sim.acknowledgeRoundResult(); }
    sims[0]!.applyTeacherAction({ kind: 'PASS' });
    sims[1]!.applyTeacherAction({ kind: 'REEXPLAIN', targetId: 'student-1' });
    for (const sim of sims) sim.resolveRound();
    expect(sims[1]!.studentStates[0]!.lessonUnderstanding).toBeGreaterThan(sims[0]!.studentStates[0]!.lessonUnderstanding);
    expect(scenario.lesson.complexity).toBe(50);
  });
  it('le recadrage supprime les perturbations pour deux rounds à puissance 100', () => {
    const s = createPrototype(); s.students[3]!.disruptionChance = 1;
    // Risque négatif certain, sans buffs sociaux : on isole autorité et recadrage.
    s.students[3]!.morale = 0; s.students.forEach(student => { student.reactionIds = []; });
    s.lesson.pressure = 0; // Le test de durée ne doit pas être interrompu par un décrochage.
    const rules = createTeacherRules(); rules.actions.REFRAME.power = 100;
    const sim = new Simulation(s, 12345, undefined, rules);
    expect(sim.resolveRound().some(e => e.type === 'DISRUPTION_RESOLVED')).toBe(true);
    sim.acknowledgeRoundResult(); sim.applyTeacherAction({ kind: 'REFRAME', targetId: 'student-4' });
    for (let i = 0; i < 2; i++) {
      expect(sim.resolveRound().some(e => e.type === 'DISRUPTION_RESOLVED')).toBe(false);
      sim.acknowledgeRoundResult(); sim.applyTeacherAction({ kind: 'PASS' });
    }
    expect(sim.resolveRound().some(e => e.type === 'DISRUPTION_RESOLVED')).toBe(true);
  });
  it.each([0, 60, 100])('autorité %s réduit passivement les dégâts même sans patience', authority => {
    const s = createPrototype(); s.teacher.authority = authority; s.teacher.patience = 0;
    s.students[3]!.disruptionChance = 1;
    // Risque négatif certain, sans buffs sociaux : on isole autorité et recadrage.
    s.students[3]!.morale = 0; s.students.forEach(student => { student.reactionIds = []; });
    const events = new Simulation(s, 12345).resolveRound();
    const disruption = events.find(e => e.type === 'DISRUPTION_RESOLVED');
    expect(disruption).toMatchObject({ afterAuthority: Math.round(16 * (1 - authority / 100) * 100) / 100 });
    if (disruption?.type !== 'DISRUPTION_RESOLVED') throw new Error('Perturbation attendue');
    expect(areAdjacent(s.students[3]!, s.students.find(s => s.id === disruption.targetId)!, s.classroom)).toBe(true);
    expect(events.filter(e => e.type === 'STUDENT_ACTION' && e.actorId === 'student-4')).toHaveLength(1);
  });
  it('rejoue la même seed et les mêmes décisions à l’identique', () => {
    const decisions: TeacherAction[] = [{ kind: 'REEXPLAIN', targetId: 'student-3' }, { kind: 'REFRAME', targetId: 'student-4' }, { kind: 'ENCOURAGE', targetId: 'student-1' }, { kind: 'BREAK' }, { kind: 'PASS' }, { kind: 'PASS' }];
    const result = new Simulation(createPrototype(), 12345).runToCompletion(decisions);
    expect(new Simulation(createPrototype(), 12345).runToCompletion(decisions)).toEqual(result);
    expect(result.teacher.patience).toBe(32); expect(result.decisions).toEqual(decisions);
    expect(new Simulation(createPrototype(), 12345).runToCompletion().results).not.toEqual(result.results);
  });
  it('interdit les dépenses après le dernier round', () => {
    const sim = ready();
    while (sim.hasNextRound) { sim.applyTeacherAction({ kind: 'PASS' }); sim.resolveRound(); sim.acknowledgeRoundResult(); }
    expect(() => sim.applyTeacherAction({ kind: 'BREAK' })).toThrow(/terminée/);
    sim.applyTeacherAction({ kind: 'PASS' }); expect(sim.state).toBe('LESSON_FINISHED');
  });
  it('valide les ciblages et la configuration', () => {
    expect(() => resolveTargets('ALL_STUDENTS', 'teacher', ['a'], 'a')).toThrow();
    expect(() => resolveTargets('SELF', 'teacher', ['a'], 'a')).toThrow();
    const s = createPrototype(); s.teacher.maxPatience = 1;
    expect(() => new Simulation(s, 1)).toThrow();
    s.teacher.maxPatience = 70; s.students[0]!.disruptionChance = NaN;
    expect(() => new Simulation(s, 1)).toThrow();
    const rules = createTeacherRules(); rules.actions.PASS.cost = 1;
    expect(() => new Simulation(createPrototype(), 1, undefined, rules)).toThrow();
    expect(() => new Simulation(createPrototype(), 1).runToCompletion(Array.from({ length: 7 }, () => ({ kind: 'PASS' })))).toThrow();
  });
});
