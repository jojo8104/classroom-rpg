import { describe, expect, it } from 'vitest';
import { createPrototype } from '../src/data/prototype.js';
import { createActionRules } from '../src/data/rules.js';
import { ActionQueue, resolveActionRound } from '../src/engine/actions.js';
import { createLessonStates, pressureDamage } from '../src/engine/combat.js';
import { SeededRandom } from '../src/engine/random.js';
import { Simulation } from '../src/engine/simulation.js';
import { validateScenario } from '../src/engine/validation.js';

function fixture() {
  const scenario = createPrototype();
  scenario.archetypes.find(archetype => archetype.id === 'offensive')!.reactionIds = [];
  // Ce scénario isole les protections des nouvelles spécialités de soutien.
  scenario.students.filter(student => student.archetypeId === 'support').forEach(student => student.reactionIds = []);
  const rules = createActionRules();
  rules.criticalChance = 0;
  rules.supportChanceByArchetype = { offensive: 0, defensive: 0, support: 0 };
  return { scenario, rules, states: createLessonStates(scenario.students, scenario.lesson) };
}
function run(f: ReturnType<typeof fixture>) {
  const s = f.scenario;
  return resolveActionRound(s.students, f.states, new SeededRandom(42), f.rules, s.lesson, s.lesson.chapters[0]!.id,
    { classroom: s.classroom, archetypes: s.archetypes, relations: s.relations!, abilities: s.reactionAbilities! });
}
const reactions = (result: ReturnType<typeof run>) => result.events.filter(event => event.type === 'REACTION_TRIGGERED');

describe('Protection voisine', () => {
  it('réduit la pression avant la défense personnelle, sans modifier la leçon ni supprimer le tour du protecteur', () => {
    const f = fixture();
    const initial = structuredClone(f);
    const result = run(f);
    const protection = reactions(result)[0]!;
    expect(protection).toMatchObject({ sourceId: 'student-2', targetId: 'student-1', before: 70 });
    expect(protection.after).toBeLessThan(35);
    const damage = result.events.find(event => event.type === 'LESSON_RETALIATED' && event.studentId === 'student-1')!;
    expect(damage).toMatchObject({ damage: pressureDamage(f.scenario.students[0]!, f.states[0]!.morale,
      { ...f.scenario.lesson, pressure: protection.after }, f.rules) });
    expect(result.events.indexOf(protection)).toBeLessThan(result.events.indexOf(damage));
    expect(result.events.filter(event => event.type === 'STUDENT_ACTION' && event.actorId === 'student-2' && !event.extra)).toHaveLength(1);
    expect(f).toEqual(initial);
    // La riposte sur le protecteur lui-même utilise la pression originale.
    expect(result.events.find(event => event.type === 'LESSON_RETALIATED' && event.studentId === 'student-2')).toMatchObject({
      damage: pressureDamage(f.scenario.students[1]!, f.states[1]!.morale, f.scenario.lesson, f.rules),
    });
  });

  it.each(['weak', 'missing', 'diagonal', 'distant', 'disengaged', 'wrong-archetype'] as const)('refuse une protection non éligible : %s', reason => {
    const f = fixture();
    if (reason === 'weak') f.scenario.relations![0]!.value = 39;
    if (reason === 'missing') f.scenario.relations = [];
    if (reason === 'diagonal' || reason === 'distant') {
      const other = f.scenario.students[reason === 'diagonal' ? 4 : 8]!;
      [f.scenario.students[1]!.seatId, other.seatId] = [other.seatId, f.scenario.students[1]!.seatId];
    }
    if (reason === 'disengaged') f.states[1]!.concentration = 0;
    if (reason === 'wrong-archetype') f.scenario.students[1]!.archetypeId = 'offensive';
    expect(reactions(run(f)).some(event => event.targetId === 'student-1')).toBe(false);
  });

  it('une meilleure relation renforce la réduction', () => {
    const f = fixture();
    f.scenario.relations![0]!.value = 40;
    const weak = reactions(run(f))[0]!.after;
    f.scenario.relations![0]!.value = 90;
    expect(reactions(run(f))[0]!.after).toBeLessThan(weak);
  });

  it('limite chaque protecteur à une réaction, puis renouvelle le budget au round suivant', () => {
    const f = fixture();
    f.scenario.relations![1]!.value = 90;
    const result = run(f);
    expect(reactions(result).filter(event => event.sourceId === 'student-2')).toHaveLength(1);
    expect(result.events).toContainEqual({ type: 'REACTION_LIMIT_REACHED', sourceId: 'student-2', targetId: 'student-3', reason: 'maxReactionsPerStudent' });
    f.states = result.students;
    expect(reactions(run(f)).filter(event => event.sourceId === 'student-2')).toHaveLength(1);
  });

  it('un Défenseur au repos ne réagit pas après sa récupération dans le même round', () => {
    const f = fixture();
    f.states[1]!.concentration = 0;
    f.scenario.relations![1]!.value = 90;
    expect(reactions(run(f)).some(event => event.sourceId === 'student-2')).toBe(false);
  });

  it.each(['budget', 'depth', 'disabled'] as const)('respecte la limite %s sans supprimer les tours principaux', limit => {
    const f = fixture();
    if (limit === 'budget') f.rules.maxActionsPerRound = 9;
    if (limit === 'depth') f.rules.maxChainDepth = 0;
    if (limit === 'disabled') f.rules.maxReactionsPerStudent = 0;
    const result = run(f);
    expect(reactions(result)).toHaveLength(0);
    expect(result.events.filter(event => event.type === 'STUDENT_ACTION' && !event.extra)).toHaveLength(9);
    expect(result.events.some(event => event.type === 'REACTION_LIMIT_REACHED')).toBe(true);
  });

  it('départage plusieurs voisins par relation puis siège, indépendamment de l’ordre des données', () => {
    const f = fixture();
    // Tous les candidats réussissent le check positif : on isole le départage.
    f.scenario.students.forEach(student => { student.morale = 100; });
    f.rules.workScale = 0.1;
    f.scenario.students[3]!.archetypeId = 'defensive';
    f.scenario.relations!.push({ studentIds: ['student-1', 'student-4'], value: 90 });
    const first = new Simulation(f.scenario, 42, f.rules).runToCompletion();
    expect(first.events.find(event => event.type === 'REACTION_TRIGGERED')).toMatchObject({ sourceId: 'student-4' });
    f.scenario.students.reverse(); f.scenario.relations!.reverse(); f.scenario.classroom.seats.reverse();
    expect(new Simulation(f.scenario, 42, f.rules).runToCompletion()).toEqual(first);
    f.scenario.relations!.find(r => r.studentIds.includes('student-4') && r.studentIds.includes('student-1'))!.value = 85;
    expect(new Simulation(f.scenario, 42, f.rules).resolveRound().find(event => event.type === 'REACTION_TRIGGERED')).toMatchObject({ sourceId: 'student-2' });
  });

  it('ne déclenche pas de protection sans riposte', () => {
    const f = fixture();
    f.rules.criticalChance = 1;
    expect(reactions(run(f))).toHaveLength(0);
    f.rules.criticalChance = 0; f.rules.workScale = 100;
    expect(reactions(run(f))).toHaveLength(0);
    f.rules.workScale = 0.65; f.scenario.lesson.pressure = 0;
    expect(reactions(run(f))).toHaveLength(0);
  });

  it('une relation réciproque et son ordre de déclaration ne changent pas la simulation', () => {
    const f = fixture();
    const expected = run(f);
    f.scenario.relations!.forEach(relation => relation.studentIds.reverse());
    expect(run(f)).toEqual(expected);
    f.scenario.relations = [];
    const withoutRelations = run(f);
    expect(withoutRelations.students).not.toEqual(expected.students);
    expect(run(f)).toEqual(withoutRelations);
  });

  it('ne cumule pas les protections de deux fenêtres sur une même riposte', () => {
    const f = fixture();
    f.rules.maxReactionsPerStudent = 10;
    f.scenario.reactionAbilities!.push({ ...f.scenario.reactionAbilities![0]!, id: 'early_protection', window: 'BEFORE_LESSON_ATTACK' });
    f.scenario.archetypes.find(a => a.id === 'defensive')!.reactionIds!.push('early_protection');
    expect(reactions(run(f)).filter(event => event.targetId === 'student-1')).toHaveLength(1);
  });

  it('partage le budget global de la file et copie la réaction soumise', () => {
    const f = fixture();
    const queue = new ActionQueue({ maxActionsPerRound: 2, maxExtraActionsPerStudent: 1, maxChainDepth: 2 });
    queue.enqueue({ actorId: 'student-1', kind: 'WORK', depth: 0 });
    const reaction = { actorId: 'student-2', targetId: 'student-1', ability: f.scenario.reactionAbilities![0]!, relation: 85, depth: 1 };
    expect(queue.enqueueReaction(reaction)).toBeUndefined();
    reaction.targetId = 'changed';
    expect(queue.dequeueReaction()!.targetId).toBe('student-1');
    expect(queue.dequeue()!.actorId).toBe('student-1');
    expect(queue.enqueue({ actorId: 'student-1', kind: 'WORK', depth: 1 })).toBe('maxActionsPerRound');
  });

  it('rejette les relations inconnues, dupliquées et les capacités invalides', () => {
    const f = fixture();
    f.scenario.relations!.push({ studentIds: ['student-2', 'student-1'], value: 80 });
    expect(validateScenario(f.scenario).join()).toContain('paire dupliquée');
    f.scenario.relations = [{ studentIds: ['student-1', 'unknown'], value: NaN }];
    const protection = f.scenario.reactionAbilities![0]!;
    if (protection.effect === 'REDUCE_PRESSURE') protection.maxReduction = 2;
    expect(() => new Simulation(f.scenario, 42)).toThrow('Relation');
    expect(validateScenario(f.scenario).join()).toContain('réduction');
  });
});
