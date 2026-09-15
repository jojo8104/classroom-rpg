import { describe, it, expect } from 'vitest';
import { Concepts, initializeConcepts } from '../src/systems/Concepts.js';
import { createProgressionPrototype } from '../src/data/progressionPrototype.js';
import { createPreparationPrototype } from '../src/data/preparationPrototype.js';
import { settleProgression } from '../src/engine/progression.js';
import { Simulation } from '../src/engine/simulation.js';
import { ClassPreparation } from '../src/systems/ClassPreparation.js';

const setup = () => {
  const scenario = createProgressionPrototype(), student = scenario.students[0]!;
  scenario.lesson.conceptPool = [{ conceptId: 'fraction', baseRate: 0.04 }];
  const service = new Concepts(scenario.concepts);
  return { scenario, student, service, context: { student, lesson: scenario.lesson, lessonProgress: 50 } };
};
describe('Concepts persistants', () => {
  it('acquiert, nettoie la progression et ne tire jamais deux fois un acquis', () => {
    const { service, student, context } = setup();
    initializeConcepts(student).progress.fraction = 0.2;
    expect(service.attemptDiscoveries(context, 4, { next: () => { throw Error('XP insuffisante'); } })).toEqual([]);
    expect(service.attemptDiscoveries(context, 5, { next: () => 0 })).toEqual([{ type: 'concept_discovered', studentId: student.id, lessonId: context.lesson.id, conceptId: 'fraction' }]);
    expect(student.concepts).toEqual({ acquired: ['fraction'], progress: {} });
    expect(service.attemptDiscoveries(context, 5, { next: () => { throw Error('Déjà acquis'); } })).toEqual([]);
  });
  it('partage la progression entre leçons tout en conservant leurs taux propres', () => {
    const { service, student, context } = setup();
    service.attemptDiscoveries(context, 5, { next: () => 0.99 });
    expect(student.concepts!.progress.fraction).toBe(0.05);
    const second = { ...context, lesson: { ...context.lesson, id: 'autre-lecon', conceptPool: [{ conceptId: 'fraction', baseRate: 0.2 }] } };
    expect(service.computeDiscoveryChance({ ...second, conceptId: 'fraction', baseRate: 0.2 })).toBeGreaterThan(0.25);
    expect(service.attemptDiscoveries(second, 5, { next: () => 0.24 })[0]).toMatchObject({ lessonId: 'autre-lecon' });
  });
  it('recherche par tags et applique seulement les bonus XP compatibles avant la découverte', () => {
    const { service, student, scenario } = setup();
    initializeConcepts(student).acquired.push('fraction');
    scenario.concepts[0]!.effects.push({ type: 'stat_modifier', tags: [], value: 999 }, { type: 'knowledge', tags: [], value: 999 }, { type: 'behavior', tags: [], value: 999 });
    expect(service.getConceptsByTag(student, 'mathematics')).toHaveLength(1);
    expect(service.getConceptsByTags(student, ['mathematics', 'missing'])).toEqual([]);
    expect(service.learningMultiplier(student, ['unrelated'])).toBe(1);
    const settled = settleProgression(student, [], 0, { service, context: { lesson: scenario.lesson }, random: { next: () => 0 } });
    expect(settled.result.xpGained).toBe(6);
    expect(student.intelligence).toBe(scenario.students[0]!.intelligence);
    expect(settled.events.filter(e => e.type === 'concept_discovered')).toEqual([]);
  });
  it('branche les découvertes après XP dans une simulation et conserve les élèves persistants', () => {
    const { scenario } = setup(); scenario.lesson.conceptPool![0]!.baseRate = 1;
    const result = new Simulation(scenario, 42).runToCompletion();
    const discovery = result.events.findIndex(e => e.type === 'concept_discovered');
    expect(discovery).toBeGreaterThan(result.events.findIndex(e => e.type === 'XP_GAINED'));
    expect(result.nextLessonStudents.every(s => s.concepts!.acquired.includes('fraction'))).toBe(true);
  });
  it('sauvegarde et charge acquis et progression ; migre les sauvegardes anciennes', () => {
    let raw = '';
    const storage = { getItem: () => raw || null, setItem: (_key: string, value: string) => { raw = value; } };
    const prep = new ClassPreparation(createPreparationPrototype(), storage);
    prep.scenario.students[0]!.concepts = { acquired: ['fraction'], progress: { numerator: 0.15 } };
    expect(prep.save()).toBe(true);
    const restored = new ClassPreparation(createPreparationPrototype(), storage);
    expect(restored.scenario.students[0]!.concepts).toEqual(prep.scenario.students[0]!.concepts);
    const old = JSON.parse(raw); old.students.forEach((s: { concepts?: unknown }) => { delete s.concepts; }); raw = JSON.stringify(old);
    const migrated = new ClassPreparation(createPreparationPrototype(), storage);
    expect(migrated.message).toContain('restaurés');
    expect(migrated.scenario.students[0]!.concepts).toEqual({ acquired: [], progress: {} });
    expect(migrated.scenario.students[0]!.knowledge).toEqual(prep.scenario.students[0]!.knowledge);
  });
});
