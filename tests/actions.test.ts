import { describe, expect, it } from 'vitest';
import { createPrototype } from '../src/data/prototype.js';
import { createActionRules } from '../src/data/rules.js';
import { ActionQueue, resolveActionRound } from '../src/engine/actions.js';
import { SeededRandom } from '../src/engine/random.js';
import { createLessonStates, moraleMultiplier, pressureDamage, workGain } from '../src/engine/combat.js';

function fixture() {
  const { students, lesson } = createPrototype();
  const rules = createActionRules();
  rules.criticalChance = 0;
  rules.workVariation = 0;
  rules.supportChanceByArchetype = { offensive: 0, defensive: 0, support: 0 };
  return { students, lesson, states: createLessonStates(students, lesson), rules };
}
function run(f: ReturnType<typeof fixture>, seed = 1) {
  return resolveActionRound(f.students, f.states, new SeededRandom(seed), f.rules, f.lesson, f.lesson.chapters[0]!.id);
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


describe('Combat 1.1', () => {
  it('applique le moral de ×0,1 à ×1,9', () => {
    expect(moraleMultiplier(0)).toBeCloseTo(0.1);
    expect(moraleMultiplier(50)).toBeCloseTo(1);
    expect(moraleMultiplier(100)).toBeCloseTo(1.9);
    const f = fixture();
    const student = f.students[0]!;
    expect(workGain(student, 100, f.lesson, f.rules, 0.5)).toBeGreaterThan(workGain(student, 0, f.lesson, f.rules, 0.5));
    expect(pressureDamage(student, 100, f.lesson, f.rules)).toBeLessThan(pressureDamage(student, 0, f.lesson, f.rules));
  });
  it('la complexité défend, la pression attaque et la discipline protège', () => {
    const f = fixture();
    const student = f.students[0]!;
    expect(workGain(student, 50, { ...f.lesson, complexity: 100 }, f.rules, .5)).toBeLessThan(workGain(student, 50, { ...f.lesson, complexity: 0 }, f.rules, .5));
    expect(pressureDamage(student, 50, { ...f.lesson, pressure: 0 }, f.rules)).toBe(0);
    expect(pressureDamage({ ...student, discipline: 100 }, 50, f.lesson, f.rules)).toBeLessThan(pressureDamage({ ...student, discipline: 0 }, 50, f.lesson, f.rules));
  });
  it('WORK progresse puis subit la riposte, sans mutation des entrées', () => {
    const f = fixture();
    const before = structuredClone(f);
    const result = run(f);
    expect(result.students[0]!.lessonUnderstanding).toBeGreaterThan(0);
    expect(result.students[0]!.concentration).toBeLessThan(f.states[0]!.concentration);
    expect(result.events.findIndex(e => e.type === 'UNDERSTANDING_CHANGED')).toBeLessThan(result.events.findIndex(e => e.type === 'LESSON_RETALIATED'));
    expect(f).toEqual(before);
    expect(run(f)).toEqual(result);
  });
  it('une concentration faible ne réduit pas le gain tant que les HP sont positifs', () => {
    const f = fixture();
    const high = run(f).students[0]!.lessonUnderstanding;
    f.states[0]!.concentration = 1;
    expect(run(f).students[0]!.lessonUnderstanding).toBe(high);
  });
  it('à zéro : ni travail ni riposte, une étape manquée et récupération autonome', () => {
    const f = fixture();
    f.states[0]!.concentration = 0;
    const result = run(f);
    const state = result.students[0]!;
    expect(state.lessonUnderstanding).toBe(0);
    expect(state.chapters[0]!.missedRounds).toBe(1);
    expect(state.concentration).toBe(f.rules.recovery);
    expect(state.morale).toBe(f.states[0]!.morale);
    expect(result.events.filter(e => e.type === 'STUDENT_ACTION' && e.actorId === state.studentId)).toEqual([
      { type: 'STUDENT_ACTION', actorId: state.studentId, targetId: state.studentId, actionId: 'RECOVER', extra: false },
    ]);
    expect(result.events).toContainEqual({ type: 'STUDENT_RESUMED', studentId: state.studentId });
    f.states = result.students;
    expect(run(f).students[0]!.lessonUnderstanding).toBeGreaterThan(0);
  });
  it('perd du moral une seule fois à la transition vers zéro, sans descendre sous zéro', () => {
    const f = fixture();
    f.states[0]!.concentration = 1; f.states[0]!.morale = 3;
    const result = run(f);
    expect(result.students[0]!.morale).toBe(0);
    expect(result.events.filter(e => e.type === 'STUDENT_DROPPED_OUT' && e.studentId === f.students[0]!.id)).toHaveLength(1);
    f.states = result.students;
    const recovery = run(f);
    expect(recovery.events.filter(e => e.type === 'MORALE_CHANGED' && e.studentId === f.students[0]!.id)).toHaveLength(0);
  });
  it('un critique augmente le gain et évite la riposte', () => {
    const f = fixture();
    const normal = run(f);
    f.rules.criticalChance = 1;
    const critical = run(f);
    expect(critical.students[0]!.lessonUnderstanding).toBeGreaterThan(normal.students[0]!.lessonUnderstanding);
    expect(critical.students[0]!.concentration).toBe(f.states[0]!.concentration);
    expect(critical.events.filter(e => e.type === 'LESSON_RETALIATED')).toHaveLength(0);
  });
  it('compléter un chapitre évite la riposte et ne remplit pas le chapitre suivant', () => {
    const f = fixture();
    f.rules.workScale = 100;
    const result = run(f);
    expect(result.students[0]!.lessonUnderstanding).toBe(50);
    expect(result.students[0]!.chapters[1]!.progress).toBe(0);
    expect(result.events.filter(e => e.type === 'LESSON_RETALIATED')).toHaveLength(0);
    f.states = result.students;
    expect(run(f).students[0]!.lessonUnderstanding).toBe(50);
  });
  it('SUPPORT restaure les HP, sans dépasser 100, et ajoute WORK en fin de file', () => {
    const f = fixture();
    f.rules.supportChanceByArchetype = { offensive: 1, defensive: 1, support: 1 };
    f.rules.extraActionChance = 1; f.rules.criticalChance = 1;
    f.states.forEach(s => s.concentration = 99);
    const result = run(f);
    const actions = result.events.filter(e => e.type === 'STUDENT_ACTION');
    expect(actions.slice(0,9).every(e => e.actionId === 'SUPPORT' && e.actorId !== e.targetId)).toBe(true);
    expect(actions.slice(9).length).toBeGreaterThan(0);
    expect(actions.slice(9).every(e => e.actionId === 'WORK' && e.extra)).toBe(true);
    expect(result.students.every(s => s.concentration <= 100)).toBe(true);
    expect(result.events.some(e => e.type === 'EXTRA_ACTION_CREATED')).toBe(true);
    expect(result.events.filter(e => e.type === 'EFFECT_APPLIED').every(e => e.amount <= 1)).toBe(true);
  });
  it('un élève au repos ne reçoit pas d’action bonus dans le même round', () => {
    const f = fixture();
    f.states[0]!.concentration = 0;
    f.rules.supportChanceByArchetype = { offensive: 1, defensive: 1, support: 1 };
    f.rules.extraActionChance = 1;
    const result = run(f);
    expect(result.events.filter(e => e.type === 'STUDENT_ACTION' && e.actorId === f.students[0]!.id)).toHaveLength(1);
  });
  it('journalise les refus du budget et garde une action principale par élève', () => {
    const f = fixture();
    f.rules.supportChanceByArchetype = { offensive: 1, defensive: 1, support: 1 };
    f.rules.extraActionChance = 1; f.rules.maxActionsPerRound = 9;
    expect(run(f).events.filter(e => e.type === 'STUDENT_ACTION')).toHaveLength(9);
    expect(run(f).events.filter(e => e.type === 'ACTION_LIMIT_REACHED')).toHaveLength(9);
  });
  it('rejette les états, paramètres et références de chapitre invalides', () => {
    const f = fixture();
    f.rules.recovery = 0; expect(() => run(f)).toThrow();
    f.rules.recovery = 30; f.states[0]!.chapters[0]!.progress = 999; expect(() => run(f)).toThrow();
    f.states = createLessonStates(f.students,f.lesson); f.states.pop(); expect(() => run(f)).toThrow('correspondre');
  });
});
