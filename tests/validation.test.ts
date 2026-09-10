import { describe, expect, it } from 'vitest';
import { createPrototype } from '../src/data/prototype.js';
import { validateScenario } from '../src/engine/validation.js';

describe('Base du prototype', () => {
  it('décrit une classe de 9 élèves et une leçon de 6 rounds avec trois concepts distincts', () => {
    const scenario = createPrototype();
    expect(validateScenario(scenario)).toEqual([]);
    expect(scenario.students).toHaveLength(9);
    expect(scenario.classroom.seats).toHaveLength(9);
    expect(scenario.archetypes).toHaveLength(3);
    expect(scenario.lesson.chapters.reduce((sum, chapter) => sum + chapter.roundCount, 0)).toBe(6);
    expect(scenario.lesson.conceptIds).toHaveLength(3);
    expect(scenario.lesson.conceptIds.every(id => scenario.concepts.some(concept => concept.id === id))).toBe(true);
  });

  it('crée des scénarios indépendants', () => {
    const first = createPrototype();
    first.students[0]!.concentration = 0;
    first.lesson.conceptIds.pop();
    expect(createPrototype().students[0]!.concentration).toBe(55);
    expect(createPrototype().lesson.conceptIds).toHaveLength(3);
  });

  it.each([
    ['siège inconnu', (s: ReturnType<typeof createPrototype>) => { s.students[0]!.seatId = 'missing'; }],
    ['siège déjà occupé', (s: ReturnType<typeof createPrototype>) => { s.students[1]!.seatId = s.students[0]!.seatId; }],
    ['capacité', (s: ReturnType<typeof createPrototype>) => { s.classroom.seats.push({ id: 'extra', row: 3, column: 0 }); }],
    ['position déjà utilisée', (s: ReturnType<typeof createPrototype>) => { s.classroom.seats[1]!.column = 0; }],
    ['position hors grille', (s: ReturnType<typeof createPrototype>) => { s.classroom.seats[0]!.row = -1; }],
    ['identifiant dupliqué', (s: ReturnType<typeof createPrototype>) => { s.students[1]!.id = s.students[0]!.id; }],
    ['archétype inconnu', (s: ReturnType<typeof createPrototype>) => { s.students[0]!.archetypeId = 'missing'; }],
    ['matière inconnue', (s: ReturnType<typeof createPrototype>) => { s.topic.subjectId = 'missing'; }],
    ['thème inconnu', (s: ReturnType<typeof createPrototype>) => { s.lesson.topicId = 'missing'; }],
    ['concept inconnu', (s: ReturnType<typeof createPrototype>) => { s.lesson.conceptIds.push('missing'); }],
    ['rounds entier positif', (s: ReturnType<typeof createPrototype>) => { s.lesson.chapters[0]!.roundCount = 0; }],
    ['dimensions entières positives', (s: ReturnType<typeof createPrototype>) => { s.classroom.rows = 1.5; }],
  ])('rejette une configuration invalide : %s', (message, change) => {
    const scenario = createPrototype();
    change(scenario);
    expect(validateScenario(scenario).some(error => error.includes(message))).toBe(true);
  });

  it.each([-1, 101, NaN, Infinity])('rejette une statistique invalide : %s', value => {
    const scenario = createPrototype();
    scenario.students[0]!.intelligence = value;
    expect(validateScenario(scenario).some(error => error.includes('intelligence'))).toBe(true);
  });

  it('valide sans modifier les données', () => {
    const scenario = createPrototype();
    const before = structuredClone(scenario);
    validateScenario(scenario);
    expect(scenario).toEqual(before);
  });
});
