import { describe, expect, it } from 'vitest';
import { createPrototype } from '../src/data/prototype.js';
import { createActionRules } from '../src/data/rules.js';
import { ActionQueue, resolveActionRound } from '../src/engine/actions.js';
import { SeededRandom } from '../src/engine/random.js';

function fixture() {
  const students = createPrototype().students;
  return { students, states: students.map(student => ({ studentId: student.id, lessonUnderstanding: 0, concentrationBonus: 0 })), rules: createActionRules() };
}

describe('Aléatoire à seed', () => {
  it('reproduit une séquence connue de Mulberry32', () => {
    const random = new SeededRandom(1);
    expect([random.next(), random.next(), random.next()]).toEqual([
      0.6270739405881613, 0.002735721180215478, 0.5274470399599522,
    ]);
  });
  it.each([-1, 1.5, NaN, Infinity, 4294967296])('rejette la seed %s', seed => {
    expect(() => new SeededRandom(seed)).toThrow();
  });
  it('produit des indices dans les bornes', () => {
    const random = new SeededRandom(42);
    for (let i = 0; i < 1000; i++) {
      const value = random.integer(9);
      expect(Number.isInteger(value) && value >= 0 && value < 9).toBe(true);
    }
    expect(() => random.integer(0)).toThrow();
  });
});

describe('File explicite', () => {
  it('conserve un ordre FIFO et copie les actions soumises', () => {
    const queue = new ActionQueue(createActionRules());
    const first = { actorId: 'a', kind: 'WORK' as const, depth: 0 };
    queue.enqueue(first);
    first.actorId = 'changed';
    queue.enqueue({ actorId: 'b', kind: 'WORK', depth: 0 });
    queue.enqueue({ actorId: 'a', kind: 'WORK', depth: 1 });
    expect([queue.dequeue()?.actorId, queue.dequeue()?.actorId, queue.dequeue()?.actorId]).toEqual(['a', 'b', 'a']);
    expect(queue.dequeue()).toBeUndefined();
  });
  it('arrête une chaîne auto-entretenue même après retrait des actions', () => {
    const queue = new ActionQueue({ maxActionsPerRound: 5, maxExtraActionsPerStudent: 100, maxChainDepth: 100 });
    queue.enqueue({ actorId: 'a', kind: 'WORK', depth: 0 });
    let resolved = 0;
    let reason;
    while (queue.dequeue()) {
      resolved++;
      reason = queue.enqueue({ actorId: 'a', kind: 'WORK', depth: resolved });
    }
    expect(resolved).toBe(5);
    expect(reason).toBe('maxActionsPerRound');
  });
  it('limite séparément la profondeur et les actions supplémentaires individuelles', () => {
    const queue = new ActionQueue({ maxActionsPerRound: 10, maxExtraActionsPerStudent: 1, maxChainDepth: 2 });
    expect(queue.enqueue({ actorId: 'a', kind: 'WORK', depth: 1 })).toBeUndefined();
    expect(queue.enqueue({ actorId: 'a', kind: 'WORK', depth: 1 })).toBe('maxExtraActionsPerStudent');
    expect(queue.enqueue({ actorId: 'b', kind: 'WORK', depth: 3 })).toBe('maxChainDepth');
  });
});

describe('Résolution des actions', () => {
  it('reproduit les états et tous les événements sans modifier les entrées', () => {
    const f = fixture();
    const before = structuredClone(f);
    const run = (seed: number) => resolveActionRound(f.students, f.states, new SeededRandom(seed), f.rules);
    expect(run(12345)).toEqual(run(12345));
    expect(run(12345)).not.toEqual(run(67890));
    expect(f).toEqual(before);
    const actions = run(12345).events.filter(event => event.type === 'STUDENT_ACTION').filter(event => !event.extra);
    expect(actions.map(event => event.actorId)).toEqual(f.students.map(student => student.id));
  });
  it('WORK progresse et reste borné à 100, avec un delta réel dans le journal', () => {
    const f = fixture();
    f.rules.supportChanceByArchetype = { offensive: 0, defensive: 0, support: 0 };
    f.states[0]!.lessonUnderstanding = 99;
    const result = resolveActionRound(f.students, f.states, new SeededRandom(1), f.rules);
    expect(result.students[0]!.lessonUnderstanding).toBe(100);
    expect(result.students.every(student => student.lessonUnderstanding > 0 && student.lessonUnderstanding <= 100)).toBe(true);
    expect(result.events).toContainEqual({ type: 'UNDERSTANDING_CHANGED', studentId: f.students[0]!.id, before: 99, after: 100, amount: 1 });
  });
  it('SUPPORT cible autrui, expire en fin de round et ajoute WORK après les actions principales', () => {
    const f = fixture();
    f.rules.supportChanceByArchetype = { offensive: 1, defensive: 1, support: 1 };
    f.rules.extraActionChance = 1;
    const result = resolveActionRound(f.students, f.states, new SeededRandom(1), f.rules);
    const actions = result.events.filter(event => event.type === 'STUDENT_ACTION');
    expect(actions.slice(0, 9).every(event => event.actionId === 'SUPPORT' && event.targetId !== event.actorId && f.students.some(s => s.id === event.targetId))).toBe(true);
    expect(actions.slice(9).length).toBeGreaterThan(0);
    expect(actions.slice(9).every(event => event.extra && event.actionId === 'WORK')).toBe(true);
    expect(result.events.some(event => event.type === 'EXTRA_ACTION_CREATED')).toBe(true);
    expect(result.students.every(student => student.concentrationBonus === 0)).toBe(true);
  });
  it('le bonus de SUPPORT améliore le travail supplémentaire de sa cible', () => {
    const f = fixture();
    f.rules.supportChanceByArchetype = { offensive: 1, defensive: 1, support: 1 };
    f.rules.extraActionChance = 1;
    f.rules.concentrationFactor = 1;
    f.rules.workVariation = 0;
    const run = () => resolveActionRound(f.students.slice(0, 2), f.states.slice(0, 2), new SeededRandom(1), f.rules);
    f.rules.supportBonus = 0;
    const without = run();
    f.rules.supportBonus = 10;
    const withBonus = run();
    expect(withBonus.students[0]!.lessonUnderstanding).toBeGreaterThan(without.students[0]!.lessonUnderstanding);
  });
  it('journalise les refus du budget sans supprimer les actions principales', () => {
    const f = fixture();
    f.rules.supportChanceByArchetype = { offensive: 1, defensive: 1, support: 1 };
    f.rules.extraActionChance = 1;
    f.rules.maxActionsPerRound = 9;
    const result = resolveActionRound(f.students, f.states, new SeededRandom(1), f.rules);
    expect(result.events.filter(event => event.type === 'STUDENT_ACTION')).toHaveLength(9);
    expect(result.events.filter(event => event.type === 'ACTION_LIMIT_REACHED')).toHaveLength(9);
  });
  it('un élève isolé travaille même si son archétype privilégie le soutien', () => {
    const f = fixture();
    f.rules.supportChanceByArchetype.offensive = 1;
    const result = resolveActionRound(f.students.slice(0, 1), f.states.slice(0, 1), new SeededRandom(1), f.rules);
    expect(result.events[0]).toMatchObject({ type: 'STUDENT_ACTION', actionId: 'WORK' });
  });
  it('rejette un budget insuffisant, des états incohérents et des probabilités invalides', () => {
    const f = fixture();
    const run = () => resolveActionRound(f.students, f.states, new SeededRandom(1), f.rules);
    f.rules.maxActionsPerRound = 8;
    expect(run).toThrow('budget');
    f.rules.maxActionsPerRound = 36;
    f.rules.extraActionChance = NaN;
    expect(run).toThrow('Probabilité');
    f.rules.extraActionChance = 0;
    f.states.pop();
    expect(run).toThrow('correspondre');
  });
});
