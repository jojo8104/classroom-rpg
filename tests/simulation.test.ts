import { describe, expect, it } from 'vitest';
import { createPrototype } from '../src/data/prototype.js';
import { createActionRules } from '../src/data/rules.js';
import { Simulation } from '../src/engine/simulation.js';
import { formatJournal } from '../src/cli/formatJournal.js';

describe('Leçon complète', () => {
  it('conserve une lacune du premier chapitre après reprise dans le second', () => {
    const scenario = createPrototype();
    scenario.students = scenario.students.slice(0, 1);
    scenario.relations = [];
    scenario.students[0]!.concentration = 0;
    scenario.lesson.chapters[0]!.roundCount = 1;
    const rules = createActionRules(); rules.workScale = 100; rules.criticalChance = 0;
    const result = new Simulation(scenario, 1, rules).runToCompletion();
    expect(result.results[0]!.chapters[0]).toMatchObject({ progress: 0, missedRounds: 1 });
    expect(result.results[0]!.chapters[1]!.progress).toBe(50);
    expect(result.results[0]!.understanding).toBe(50);
  });

  it('prépare une nouvelle leçon avec des HP restaurés et le moral conservé', () => {
    const scenario = createPrototype();
    scenario.students = scenario.students.slice(0, 1);
    scenario.relations = [];
    scenario.students[0]!.concentration = 1;
    const rules = createActionRules(); rules.criticalChance = 0;
    const result = new Simulation(scenario, 1, rules).runToCompletion();
    expect(result.nextLessonStudents[0]!.concentration).toBe(100);
    expect(result.nextLessonStudents[0]!.morale).toBeLessThan(scenario.students[0]!.morale);
    expect(result.nextLessonStudents[0]!.morale).toBe(result.results[0]!.morale);
    const next = createPrototype(); next.lesson.id = 'another-lesson'; next.students = result.nextLessonStudents;
    next.relations = [];
    const simulation = new Simulation(next, 1);
    expect(simulation.studentStates[0]!.chapters.every(c => c.progress === 0 && c.missedRounds === 0)).toBe(true);
    expect(simulation.studentStates[0]!.concentration).toBe(100);
    expect(simulation.resolveRound().some(e => e.type === 'STUDENT_ACTION' && e.actionId === 'WORK')).toBe(true);
  });

  it('reste bornée et déterministe sur cent seeds', () => {
    for (let seed = 0; seed < 100; seed++) {
      const result = new Simulation(createPrototype(), seed).runToCompletion();
      expect(result).toEqual(new Simulation(createPrototype(), seed).runToCompletion());
      for (const student of result.results) {
        expect(student.understanding >= 0 && student.understanding <= 100).toBe(true);
        expect(student.concentration >= 0 && student.concentration <= 100).toBe(true);
        expect(student.morale >= 0 && student.morale <= 100).toBe(true);
        expect(student.chapters.every(c => c.progress >= 0 && c.progress <= 50)).toBe(true);
      }
    }
  }, 30000);
  it('enchaîne six rounds, deux chapitres et six phases du professeur', () => {
    const result = new Simulation(createPrototype(), 12345).runToCompletion();
    expect(result.results).toHaveLength(9);
    expect(new Set(result.results.map(r => r.studentId)).size).toBe(9);
    expect(result.results.every(r => r.understanding >= 0 && r.understanding <= 100)).toBe(true);
    expect(result.events.filter(e => e.type === 'ROUND_STARTED').map(e => e.round)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(result.events.filter(e => e.type === 'CHAPTER_STARTED').map(e => e.chapterId)).toEqual(['discover', 'understand']);
    expect(result.events.filter(e => e.type === 'CHAPTER_ENDED')).toHaveLength(2);
    expect(result.events.filter(e => e.type === 'TEACHER_INTERVENTION_ENDED')).toHaveLength(6);
    for (let round = 1; round <= 6; round++) {
      const actions = result.events.filter(e => e.type === 'STUDENT_ACTION').filter(e => e.round === round && !e.extra);
      expect(actions).toHaveLength(9);
      expect(new Set(actions.map(e => e.actorId)).size).toBe(9);
      const end = result.events.findIndex(e => e.type === 'ROUND_ENDED' && e.round === round);
      expect(result.events[end + 1]!.type).toBe('TEACHER_INTERVENTION_STARTED');
      expect(result.events[end + 2]!.type).toBe('TEACHER_INTERVENTION_ENDED');
    }
    expect(result.events.at(-1)!.type).toBe('LESSON_ENDED');
    expect(result.events.map(e => e.sequence)).toEqual(result.events.map((_, i) => i + 1));
  });

  it('attend explicitement la fin du rendu puis le choix du professeur', () => {
    const simulation = new Simulation(createPrototype(), 1);
    expect(() => simulation.skipTeacherIntervention()).toThrow('Transition');
    expect(() => simulation.acknowledgeRoundResult()).toThrow('Transition');
    expect(() => simulation.getResult()).toThrow('Transition');
    simulation.resolveRound();
    expect(simulation.state).toBe('ROUND_RESULT');
    expect(simulation.events.some(e => e.type === 'TEACHER_INTERVENTION_STARTED')).toBe(false);
    expect(() => simulation.resolveRound()).toThrow('Transition');
    expect(() => simulation.skipTeacherIntervention()).toThrow('Transition');
    const states = simulation.studentStates;
    simulation.acknowledgeRoundResult();
    expect(simulation.state).toBe('TEACHER_INTERVENTION');
    expect(() => simulation.resolveRound()).toThrow('Transition');
    simulation.skipTeacherIntervention();
    expect(simulation.state).toBe('ROUND_READY');
    expect(simulation.studentStates).toEqual(states);
    simulation.runToCompletion();
    expect(simulation.state).toBe('LESSON_FINISHED');
    expect(() => simulation.resolveRound()).toThrow('Transition');
    expect(simulation.runToCompletion()).toEqual(simulation.getResult());
  });

  it('reproduit toute la leçon avec la même seed, y compris en mode pas à pas', () => {
    const run = (seed: number) => new Simulation(createPrototype(), seed).runToCompletion();
    expect(run(12345)).toEqual(run(12345));
    expect(run(12345).results).not.toEqual(run(54321).results);
    const manual = new Simulation(createPrototype(), 12345);
    for (let i = 0; i < 6; i++) {
      manual.resolveRound(); manual.acknowledgeRoundResult(); manual.skipTeacherIntervention();
    }
    expect(manual.getResult()).toEqual(run(12345));
  });

  it('ordonne par siège indépendamment de l’ordre des tableaux', () => {
    const scenario = createPrototype();
    const expected = new Simulation(scenario, 12345).runToCompletion();
    scenario.students.reverse(); scenario.classroom.seats.reverse();
    expect(new Simulation(scenario, 12345).runToCompletion()).toEqual(expected);
  });

  it('isole les entrées, les événements et les résultats exposés', () => {
    const scenario = createPrototype();
    const rules = createActionRules();
    const simulation = new Simulation(scenario, 12345, rules);
    scenario.students[0]!.intelligence = 0;
    rules.workScale = 100;
    const batch = simulation.resolveRound();
    const last = batch.at(-1)!;
    if (last.type === 'ROUND_ENDED') last.students[0]!.lessonUnderstanding = 999;
    simulation.studentStates[0]!.lessonUnderstanding = 999;
    const result = simulation.runToCompletion();
    const expected = new Simulation(createPrototype(), 12345).runToCompletion();
    expect(result).toEqual(expected);
    result.results[0]!.understanding = 999;
    result.events.length = 0;
    expect(simulation.getResult()).toEqual(expected);
  });

  it('rejette un scénario ou des règles invalides avant tout round', () => {
    const scenario = createPrototype();
    scenario.students[0]!.seatId = 'missing';
    expect(() => new Simulation(scenario, 1)).toThrow('siège inconnu');
    const rules = createActionRules();
    rules.maxActionsPerRound = 1;
    expect(() => new Simulation(createPrototype(), 1, rules)).toThrow('budget');
  });

  it('produit un journal lisible couvrant les résultats et concepts', () => {
    const scenario = createPrototype();
    const result = new Simulation(scenario, 12345).runToCompletion();
    const journal = formatJournal(scenario, result);
    expect(journal).toContain('ROUND 6');
    expect(journal.match(/INTERVENTION DU PROFESSEUR/g)).toHaveLength(6);
    expect(journal).toContain('LEÇON TERMINÉE');
    expect(journal).toContain('Seed : 12345');
    for (const student of scenario.students) expect(journal).toContain(student.name);
    for (const id of scenario.lesson.conceptIds) expect(journal).toContain(`- ${id}`);
  });
});

