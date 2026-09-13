import { describe, expect, it } from 'vitest';
import { createPreparationPrototype } from '../src/data/preparationPrototype.js';
import { createLayout } from '../src/models/ClassroomLayout.js';
import { ClassroomLayoutSystem, validateLayout } from '../src/systems/ClassroomLayoutSystem.js';
import { PlacementEvaluationSystem, getSeatPreferenceModifier } from '../src/systems/PlacementEvaluationSystem.js';
import { ClassPreparation, type PlanStorage } from '../src/systems/ClassPreparation.js';
import { Simulation } from '../src/engine/simulation.js';
import { areAdjacent } from '../src/engine/reactions.js';

function memory(): PlanStorage {
  const data = new Map<string,string>();
  return { getItem: key => data.get(key) ?? null, setItem: (key,value) => { data.set(key,value); } };
}
const setup = () => {
  const scenario = createPreparationPrototype();
  return { scenario, system: new ClassroomLayoutSystem(scenario.classroom.currentLayout!) };
};
describe('Roadmap 6 : placement', () => {
  it('déplace vers une place vide sans perdre un élève', () => {
    const layout = createLayout(3,3,['A','B']);
    const system = new ClassroomLayoutSystem(layout);
    system.moveStudent('A','seat_2_2');
    expect(system.getSeat('seat_0_0')!.studentId).toBeNull();
    expect(system.getStudentSeat('A')!.id).toBe('seat_2_2');
    expect(layout.seats[0]!.studentId).toBe('A');
  });
  it('échange et recalcule les voisins directs et diagonaux', () => {
    const system = new ClassroomLayoutSystem(createLayout(3,3,['A','B','C','D','E','F','G','H','I']));
    expect(system.getNeighbors('A')).toEqual({ direct: ['B','D'], diagonal: [] });
    system.swapStudents('A','E');
    expect(system.getNeighbors('A', {diagonals:true})).toEqual({ direct:['B','D','F','H'], diagonal:['E','C','G','I'] });
    expect(system.getStudentSeat('E')!.id).toBe('seat_0_0');
  });
  it('empêche de déplacer la source ou la cible verrouillée', () => {
    const {system} = setup();
    system.setLocked('seat-1',true);
    expect(() => system.moveStudent('student-1','seat-2')).toThrow();
    expect(() => system.moveStudent('student-2','seat-1')).toThrow();
    system.setLocked('seat-1',false);
    expect(system.canMoveStudent('student-2','seat-1')).toBe(true);
  });
  it('prévisualise un échange sans mutation et évalue relations et préférences', () => {
    const {scenario,system} = setup();
    const before = system.currentLayout;
    const evaluation = new PlacementEvaluationSystem(scenario,before);
    const current = evaluation.previewPlacement('student-5','seat-5');
    const preview = evaluation.previewPlacement('student-5','seat-2');
    expect(preview.neighbors.map(n => n.studentId)).toContain('student-1');
    expect(preview.neighbors.map(n => n.studentId)).toContain('student-2');
    expect(preview.neighbors.map(n => n.studentId)).not.toContain('student-5');
    expect(preview.score).not.toBe(current.score);
    expect(system.currentLayout).toEqual(before);
    const student = scenario.students[4]!;
    expect(getSeatPreferenceModifier(student,system.getSeat('seat-8')!)).toBe(2);
    expect(getSeatPreferenceModifier(student,system.getSeat('seat-2')!)).toBe(-2);
  });
  it('identifie le voisin compétent même avec une mauvaise relation', () => {
    const {scenario,system} = setup();
    const preview = new PlacementEvaluationSystem(scenario,system.currentLayout).previewPlacement('student-5','seat-5');
    expect(preview.neighbors.find(n => n.studentId === 'student-6')).toMatchObject({knowledge:91,relation:-36,useful:true});
    expect(preview.neighbors.flatMap(n => n.synergies).length).toBeGreaterThan(0);
    delete scenario.students[4]!.knowledge;
    expect(new PlacementEvaluationSystem(scenario,system.currentLayout).previewPlacement('student-5','seat-5').neighbors.every(n => !n.useful)).toBe(true);
  });
  it('change le score lorsque les seules relations changent', () => {
    const {scenario,system} = setup();
    const evaluation = new PlacementEvaluationSystem(scenario,system.currentLayout);
    const before = evaluation.previewPlacement('student-5','seat-5').score;
    scenario.classRelations!.links.filter(l => l.from === 'student-5').forEach(l => l.score = -100);
    expect(evaluation.previewPlacement('student-5','seat-5').score).toBeLessThan(before);
  });
  it('sauvegarde, recharge et restaure exactement la disposition initiale', () => {
    const store = memory(), scenario = createPreparationPrototype();
    const first = new ClassPreparation(scenario,store), initial = first.system.currentLayout;
    first.moveStudent('student-1','seat-5'); first.setLocked('seat-5',true);
    scenario.students[0]!.knowledge!.fraction = 89; first.save();
    const reloaded = new ClassPreparation(createPreparationPrototype(),store);
    expect(reloaded.system.currentLayout).toEqual(first.system.currentLayout);
    expect(reloaded.scenario.students[0]!.knowledge!.fraction).toBe(89);
    reloaded.reset(); expect(reloaded.system.currentLayout).toEqual(initial);
  });
  it('résiste aux sauvegardes corrompues et au stockage indisponible', () => {
    const prep = new ClassPreparation(createPreparationPrototype(), {getItem: () => '{broken', setItem: () => { throw new Error(); }});
    expect(prep.system.validateLayout(prep.scenario.students)).toEqual([]);
    expect(prep.save()).toBe(false);
    expect(prep.prepareLesson().students).toHaveLength(9);
  });
  it('rejette les doublons, occupants multiples, manquants, positions et dimensions invalides', () => {
    const {scenario,system} = setup();
    const mutations = [
      (l: ReturnType<typeof createLayout>) => { l.seats[1]!.studentId = l.seats[0]!.studentId; },
      (l: ReturnType<typeof createLayout>) => { l.seats[0]!.studentId = ['student-1','student-2'] as unknown as string; },
      (l: ReturnType<typeof createLayout>) => { l.seats[0]!.studentId = null; },
      (l: ReturnType<typeof createLayout>) => { l.seats[0]!.row = 99; },
      (l: ReturnType<typeof createLayout>) => { l.columns = 4; },
      (l: ReturnType<typeof createLayout>) => { l.seats[0]!.id = l.seats[1]!.id; },
    ];
    for (const mutate of mutations) { const layout = system.currentLayout; mutate(layout); expect(validateLayout(layout,scenario.students).length).toBeGreaterThan(0); }
  });
  it.each([4,5])('fonctionne avec une dimension %i, sans neuf sièges imposés', size => {
    const {scenario} = setup();
    const original = [...scenario.students];
    scenario.students = Array.from({length:size*size},(_,i) => ({...structuredClone(original[i % original.length]!), id:`grid-student-${i}`}));
    delete scenario.classRelations;
    const system = new ClassroomLayoutSystem(createLayout(size,size,scenario.students.map(s => s.id)));
    system.moveStudent('grid-student-0',`seat_${size-1}_${size-1}`);
    expect(system.validateLayout(scenario.students)).toEqual([]);
    scenario.classroom.currentLayout = system.currentLayout;
    scenario.classroom.rows = size; scenario.classroom.columns = size;
    scenario.classroom.seats = system.currentLayout.seats;
    expect(new Simulation(scenario,42).runToCompletion().results).toHaveLength(scenario.students.length);
  });
  it('isole le snapshot et applique un léger confort initial sans changer le profil', () => {
    const {scenario,system} = setup();
    system.moveStudent('student-1','seat-8'); scenario.classroom.currentLayout = system.currentLayout;
    const sim = new Simulation(scenario,42), expected = sim.layoutSnapshot;
    expect(sim.studentStates.find(s => s.studentId === 'student-1')!.morale).toBe(scenario.students[0]!.morale+2);
    scenario.classroom.currentLayout.seats[0]!.studentId = null;
    const returned = sim.layoutSnapshot; returned.seats[0]!.studentId = null;
    expect(sim.layoutSnapshot).toEqual(expected);
  });
  it('le moteur utilise le plan même si les anciens seatId disent autre chose', () => {
    const {scenario,system} = setup();
    system.moveStudent('student-1','seat-9'); scenario.classroom.currentLayout = system.currentLayout;
    scenario.students[0]!.seatId = 'seat-1';
    expect(areAdjacent(scenario.students[0]!,scenario.students[7]!,scenario.classroom)).toBe(true);
    expect(areAdjacent(scenario.students[0]!,scenario.students[1]!,scenario.classroom)).toBe(false);
    const result = new Simulation(scenario,42).runToCompletion();
    for (const event of result.events) if (event.type === 'REACTION_TRIGGERED' || event.type === 'DISRUPTION_RESOLVED' || event.type === 'COMBINED_ATTACK_STARTED' || event.type === 'EFFECT_APPLIED') {
      expect(system.getNeighbors(event.sourceId).direct).toContain(event.targetId);
    }
  });
  it('exclut les absents sans perdre leur profil ni leurs relations', () => {
    const {scenario} = setup(); scenario.students[0]!.present = false;
    const original = structuredClone(scenario.students[0]!);
    const sim = new Simulation(scenario,42);
    expect(sim.layoutSnapshot.seats[0]!.studentId).toBeNull();
    expect(sim.studentStates.some(s => s.studentId === original.id)).toBe(false);
    const result = sim.runToCompletion();
    expect(result.results).toHaveLength(8);
    expect(result.nextLessonStudents.find(s => s.id === original.id)).toEqual(original);
    expect(result.classRelations!.links.filter(l => l.from === original.id || l.to === original.id)).toEqual(scenario.classRelations!.links.filter(l => l.from === original.id || l.to === original.id));
  });
  it('limite aussi le soutien au voisinage sans règles sociales, et gère un élève isolé', () => {
    const {scenario} = setup();
    delete scenario.classRelations; delete scenario.interactionRules;
    scenario.students.forEach(s => { delete s.progression; });
    const result = new Simulation(scenario,42).runToCompletion();
    const system = new ClassroomLayoutSystem(scenario.classroom.currentLayout!);
    for (const event of result.events) if (event.type === 'EFFECT_APPLIED') expect(system.getNeighbors(event.sourceId).direct).toContain(event.targetId);
    scenario.students = [scenario.students[0]!];
    scenario.classroom.currentLayout = createLayout(3,3,scenario.students.map(s => s.id));
    expect(new Simulation(scenario,42).runToCompletion().results).toHaveLength(1);
  });
  it('consolide les acquis une seule fois et les transmet à la prochaine leçon', () => {
    const {scenario} = setup();
    scenario.students.forEach(s => { s.knowledge!.fraction = 0; });
    const sim = new Simulation(scenario,42), result = sim.runToCompletion();
    expect(result.nextLessonStudents.some(s => s.knowledge!.fraction! > 0)).toBe(true);
    expect(sim.getResult().nextLessonStudents).toEqual(result.nextLessonStudents);
  });
});
