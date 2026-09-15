import { describe, expect, it } from 'vitest';
import { createPrototype } from '../src/data/prototype.js';
import { createFullClassPrototype } from '../src/data/fullClassPrototype.js';
import { createClassroomActionRules } from '../src/data/rules.js';
import { sessionRules } from '../src/data/sessionRules.js';
import { Simulation } from '../src/engine/simulation.js';
import { exerciseFit, sessionWork } from '../src/engine/session.js';
import { consolidateMemory, erodeLearning, estimateMastery, memoryFor, observeLearning, repetitionLoss } from '../src/systems/LearningMemory.js';
import { ClassPreparation } from '../src/systems/ClassPreparation.js';
import { Agenda } from '../src/systems/Agenda.js';
import { curriculum } from '../src/data/curriculum.js';
import { defaultCalendarConfig } from '../src/data/calendarConfig.js';
import { validateScenario } from '../src/engine/validation.js';
import type { SessionType } from '../src/domain.js';

function scenarioFor(type: SessionType, mastery = 50, difficulty = 50) {
  const s = createPrototype();
  s.activity = { lessonId: s.lesson.id, teachingMode: type, sessionType: type, difficulty, day: 0 };
  s.students.forEach(student => { student.lessonMastery = { [s.lesson.id]: mastery }; });
  return s;
}
const disk = () => { const data = new Map<string,string>(); return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key,value); } }; };

describe('R13 : approches pédagogiques', () => {
  it.each<SessionType>(['lecture','exercise','revision','assessment','homework'])('%s : résolution déterministe, bornée et sans mutation du scénario', type => {
    const s = scenarioFor(type), before = structuredClone(s);
    const run = () => new Simulation(s, 42).runToCompletion();
    const result = run(); expect(result).toEqual(run()); expect(s).toEqual(before);
    expect(result.nextLessonStudents.every(student => student.lessonMastery![s.lesson.id]! >= 0 && student.lessonMastery![s.lesson.id]! <= 100)).toBe(true);
    expect(result.events.some(e => e.type === 'LEARNING_OBSERVED')).toBe(true);
  });
  it('le magistral implicite conserve les mêmes tours que lecture explicite', () => {
    const s = createPrototype(), implicit = new Simulation(s, 8).runToCompletion();
    s.activity = { lessonId: s.lesson.id, teachingMode: 'lecture', sessionType: 'lecture' };
    expect(new Simulation(s, 8).runToCompletion()).toEqual(implicit);
  });
  it('évaluation courte, sans aide, combo, perturbation ou intervention, même avec les classes RPG', () => {
    const s = createFullClassPrototype(); s.activity = { lessonId: s.lesson.id, teachingMode: 'assessment' };
    const sim = new Simulation(s, 3, createClassroomActionRules(s.students.length));
    expect(sim.studentStates[0]!.morale).toBeLessThan(s.students[0]!.morale);
    sim.resolveRound(); sim.acknowledgeRoundResult();
    expect(sim.teacherActions().filter(a => a.available).map(a => a.kind)).toEqual(['PASS']);
    expect(() => sim.applyTeacherAction({ kind: 'BREAK' })).toThrow();
    const r = sim.runToCompletion();
    expect(r.events.filter(e => e.type === 'ROUND_STARTED')).toHaveLength(2);
    expect(r.events.some(e => ['REACTION_TRIGGERED','COMBINED_ATTACK_RESOLVED','EFFECT_APPLIED','DISRUPTION_RESOLVED','concept_discovered'].includes(e.type))).toBe(false);
    expect(r.events.filter(e => e.type === 'STUDENT_ACTION').every(e => e.type === 'STUDENT_ACTION' && e.actorId === e.targetId)).toBe(true);
    expect(r.teacher.authority).toBe(s.teacher.authority - sessionRules.assessmentAuthority);
  });
  it('la performance dépend des acquis et des ressources, sans créer de maîtrise', () => {
    const score = (mastery: number, concentration: number, discipline: number) => {
      const s = scenarioFor('assessment', mastery); s.students.forEach(v => { v.concentration = concentration; v.discipline = discipline; });
      return new Simulation(s, 9).runToCompletion();
    };
    const strong = score(85,100,100), novice = score(5,100,100), tired = score(85,15,10);
    const sum = (r: typeof strong) => r.results.reduce((n,s) => n+s.understanding,0);
    expect(sum(strong)).toBeGreaterThan(sum(novice)); expect(sum(strong)).toBeGreaterThan(sum(tired));
    expect(tired.nextLessonStudents[0]!.lessonMastery![curriculum.lessons[0]!.id]).toBe(85);
  });
  it('exercice : trois zones, élargies par la Pédagogie, avec rendement et pression distincts', () => {
    expect(exerciseFit(70,10,0)).toBe('easy'); expect(exerciseFit(50,50,0)).toBe('adapted'); expect(exerciseFit(10,90,0)).toBe('hard');
    expect(exerciseFit(50,75,0)).toBe('hard'); expect(exerciseFit(50,75,100)).toBe('adapted');
    const s = scenarioFor('exercise'), student = s.students[0]!, state = new Simulation(s,1).studentStates[0]!;
    const work = (d: number) => sessionWork('exercise',student,state,s.lesson,s.teacher,d);
    expect(work(50).multiplier).toBeGreaterThan(work(0).multiplier); expect(work(50).multiplier).toBeGreaterThan(work(100).multiplier);
    expect(work(100).lesson.pressure).toBeGreaterThan(work(0).lesson.pressure);
    expect(work(100).morale).toBeLessThan(0); expect(work(0).morale).toBeGreaterThan(0);
  });
  it('devoir : la Discipline améliore le rendement et la Patience est consommée', () => {
    const run = (discipline: number) => { const s = scenarioFor('homework'); s.students.forEach(v => { v.discipline = discipline; }); return new Simulation(s,42).runToCompletion(); };
    const low = run(0), high = run(100);
    expect(high.nextLessonStudents[0]!.lessonMastery![curriculum.lessons[0]!.id]).toBeGreaterThan(low.nextLessonStudents[0]!.lessonMastery![curriculum.lessons[0]!.id]!);
    expect(high.teacher.patience).toBe(scenarioFor('homework').teacher.patience - sessionRules.homeworkPatience);
    expect(high.nextLessonStudents.some(s => s.concentration < 100)).toBe(true);
    const s = scenarioFor('homework'); s.teacher.patience = 0; expect(() => new Simulation(s,1)).toThrow(/Patience/);
  });
  it('répéter trois séances réduit le Moral, avec sensibilité personnelle et historique borné', () => {
    const s = scenarioFor('lecture'), student = s.students[0]!;
    student.recentSessionTypes = ['lecture','lecture']; expect(repetitionLoss(student,'lecture')).toBeGreaterThan(0);
    expect(repetitionLoss(student,'exercise')).toBe(0);
    const normal = scenarioFor('lecture');
    expect(new Simulation(s,42).studentStates[0]!.morale).toBeLessThan(new Simulation(normal,42).studentStates[0]!.morale);
    student.recentSessionTypes = Array(5).fill('lecture');
    expect(new Simulation(s,42).runToCompletion().nextLessonStudents[0]!.recentSessionTypes).toHaveLength(5);
  });
});

describe('R13 : observation, mémoire et persistance', () => {
  it('observation partielle : pédagogie et évaluation resserrent la plage sans dévoiler la vérité', () => {
    const s = scenarioFor('assessment',63), student = s.students[0]!;
    expect(estimateMastery(student,s.lesson.id,s.teacher).label).toMatch(/non évaluée/);
    const observe = (type: SessionType) => { const copy = structuredClone(student); observeLearning(copy,s.lesson.id,s.teacher,type,0,40); return copy; };
    const lecture = observe('lecture'), exam = observe('assessment');
    const width = (st: typeof student, pedagogy: number, day = 0) => { const e = estimateMastery(st,s.lesson.id,{pedagogy},day); return e.high-e.low; };
    expect(width(exam,90)).toBeLessThan(width(lecture,90)); expect(width(exam,90)).toBeLessThan(width(exam,0));
    expect(width(exam,90,30)).toBeGreaterThan(width(exam,90)); expect(width(exam,100)).toBeGreaterThan(0);
    expect(estimateMastery(exam,s.lesson.id,s.teacher).label).not.toContain('63');
  });
  it('interprète une mauvaise performance différemment selon la Pédagogie', () => {
    const s = scenarioFor('assessment',80), student = s.students[0]!;
    observeLearning(student,s.lesson.id,{...s.teacher,pedagogy:100},'assessment',0,20);
    expect(estimateMastery(student,s.lesson.id,s.teacher).feedback).toMatch(/inattention/);
    observeLearning(student,s.lesson.id,{...s.teacher,pedagogy:0},'assessment',0,20);
    expect(estimateMastery(student,s.lesson.id,s.teacher).feedback).toMatch(/interpréter/);
  });
  it('érosion lente, réserve récupérable, idempotence et même résultat par jours ou en bloc', () => {
    const s = scenarioFor('revision',72), student = s.students[0]!; memoryFor(student,s.lesson.id,0);
    erodeLearning([student],7); expect(student.lessonMastery![s.lesson.id]).toBe(72);
    const daily = structuredClone(student); erodeLearning([student],40);
    for (let day=8;day<=40;day++) erodeLearning([daily],day);
    expect(daily).toEqual(student); expect(student.lessonMastery![s.lesson.id]).toBeLessThan(72);
    expect(student.learningMemory![s.lesson.id]!.masteryAcquired).toBe(72);
    const copy = structuredClone(student); erodeLearning([student],40); expect(student).toEqual(copy);
  });
  it('révision : récupère prioritairement 64 vers 72 et protège temporairement', () => {
    const s = scenarioFor('revision',64), student = s.students[0]!, m = memoryFor(student,s.lesson.id,0); m.masteryAcquired = 72;
    consolidateMemory(student,s.lesson.id,64.5,'revision',0,8);
    expect(student.lessonMastery![s.lesson.id]).toBeGreaterThanOrEqual(70);
    expect(m.masteryAcquired).toBe(72); expect(m.lastRevisionAt).toBe(0);
    const unprotected = structuredClone(student); unprotected.learningMemory![s.lesson.id]!.revisionProtection = 0;
    erodeLearning([student,unprotected],10); expect(student.lessonMastery![s.lesson.id]).toBeGreaterThan(unprotected.lessonMastery![s.lesson.id]!);
    const a = student.lessonMastery![s.lesson.id]!, b = unprotected.lessonMastery![s.lesson.id]!;
    erodeLearning([student,unprotected],12); expect(a-student.lessonMastery![s.lesson.id]!).toBeCloseTo(b-unprotected.lessonMastery![s.lesson.id]!);
  });
  it('révision dans le moteur : récupère les acquis sans refaire un apprentissage complet', () => {
    const s = scenarioFor('revision',64); s.students.forEach(st => { memoryFor(st,s.lesson.id,0).masteryAcquired = 72; });
    const r = new Simulation(s,42).runToCompletion();
    expect(r.nextLessonStudents[0]!.lessonMastery![s.lesson.id]).toBeGreaterThan(64);
    expect(r.nextLessonStudents[0]!.learningMemory![s.lesson.id]!.revisionProtection).toBeGreaterThan(0);
  });
  it('les tags donnent accès aux concepts antérieurs et permettent leur réactivation', () => {
    const s = scenarioFor('revision',80);
    s.lesson.tags = ['linked'];
    s.concepts.push({ id:'prior', name:'Acquis antérieur', description:'', tags:['linked'], baseRate:1, effects:[] });
    s.students.forEach(st => { st.concepts = { acquired:['prior'], progress:{} }; });
    const r = new Simulation(s,42).runToCompletion();
    expect(r.events.some(e => e.type === 'concept_reactivated' && e.conceptId === 'prior')).toBe(true);
    expect(s.lesson.conceptIds).not.toContain('prior');
    s.students.forEach(st => { st.concepts = { acquired:[], progress:{} }; });
    const discovery = new Simulation(s,42).runToCompletion();
    expect(discovery.events.some(e => e.type === 'concept_discovered' && e.conceptId === 'prior')).toBe(true);
  });
  it('sauvegarde les nouvelles données, le professeur et migre les anciennes séances', () => {
    const storage = disk(), s = scenarioFor('assessment',63), p = new ClassPreparation(s,storage);
    const r = new Simulation(s,42).runToCompletion(); s.students = r.nextLessonStudents; s.teacher = r.teacher; p.save();
    const restored = new ClassPreparation(createPrototype(),storage);
    expect(restored.scenario.students).toEqual(s.students); expect(restored.scenario.teacher).toEqual(s.teacher);
    const agenda = new Agenda(defaultCalendarConfig,curriculum,storage); agenda.place(agenda.currentSlot!.id,s.lesson.id,'exercise',undefined,73);
    expect(new Agenda(defaultCalendarConfig,curriculum,storage).sessions[0]).toMatchObject({sessionType:'exercise',difficulty:73});
    const save = agenda.snapshot; delete save.sessions[0]!.sessionType; delete save.sessions[0]!.difficulty;
    storage.setItem('classroom-rpg:agenda:v1',JSON.stringify(save));
    expect(new Agenda(defaultCalendarConfig,curriculum,storage).nextSession().type).toBe('exercise');
  });
  it('vacances comptées et préparation hors classe bornée, sans bloquer le cours', () => {
    const config = {...structuredClone(defaultCalendarConfig),teachingWeeks:2,workingDays:['mon'],slotsPerDay:3,periods:[{id:'a',name:'A',teachingWeeks:1,holidayWeeksAfter:1},{id:'b',name:'B',teachingWeeks:1,holidayWeeksAfter:0}],specialDays:[]};
    const a = new Agenda(config,curriculum), id = curriculum.lessons[0]!.id;
    a.place(a.currentSlot!.id,id,'homework'); a.place(a.currentSlot!.id,id,'lecture');
    a.place(a.slots[1]!.id,id,'homework'); expect(() => a.place(a.slots[2]!.id,id,'homework')).toThrow(/Temps libre/);
    a.consume(a.nextSession().id); expect(a.snapshot.cursor).toBe(0); expect(a.nextSession().type).toBe('lecture');
    a.consume(a.nextSession().id); a.consume(a.nextSession().id); a.skip(); a.skip(); expect(a.currentDay).toBe(14);
  });
  it('rejette difficulté, date et mémoire corrompues', () => {
    const s = scenarioFor('exercise'); s.activity!.difficulty = NaN; expect(() => new Simulation(s,1)).toThrow();
    s.activity!.difficulty = 50; s.activity!.day = -1; expect(() => new Simulation(s,1)).toThrow();
    s.activity!.day = 0; memoryFor(s.students[0]!,s.lesson.id).masteryAcquired = -1; expect(validateScenario(s)).not.toEqual([]);
  });
});
