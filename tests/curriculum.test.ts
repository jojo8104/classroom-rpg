import { describe, it, expect } from 'vitest';
import { curriculum } from '../src/data/curriculum.js';
import { createPrototype } from '../src/data/prototype.js';
import { selectLessonActivity, validateCurriculum, lessonProgress } from '../src/systems/Curriculum.js';
import { Simulation } from '../src/engine/simulation.js';
import { ClassPreparation } from '../src/systems/ClassPreparation.js';

describe('Programme et séances atomiques', () => {
  it('résout plusieurs programmes par ID et rejette les références cassées', () => {
    const scenario = createPrototype(), data = structuredClone(curriculum);
    data.programs.push({ id: 'other', name: 'Autre programme' });
    data.subjects.push({ id: 'science', name: 'Sciences', programId: 'other' });
    data.chapters.push({ id: 'measure', name: 'Mesures', subjectId: 'science' });
    data.lessons.push({ ...structuredClone(data.lessons[0]!), id: 'measure-parts', topicId: 'measure' });
    expect(validateCurriculum(data, scenario.concepts)).toEqual([]);
    const selected = selectLessonActivity(scenario, data, { lessonId: 'measure-parts', teachingMode: 'exercise' });
    expect(selected.program?.id).toBe('other');
    expect(selected.concepts).toEqual(scenario.concepts);
    data.lessons[1]!.topicId = 'missing';
    expect(validateCurriculum(data, scenario.concepts).length).toBeGreaterThan(0);
  });
  it('consolide une même leçon sans modifier sa définition et sans toucher aux absents', () => {
    const scenario = createPrototype(), original = structuredClone(scenario.lesson);
    scenario.students[0]!.present = false;
    const first = new Simulation(scenario, 42).runToCompletion();
    const student = first.nextLessonStudents.find(s => s.id === 'student-2')!;
    const mastery = lessonProgress(student, scenario.lesson.id).mastery;
    expect(mastery).toBeGreaterThan(0);
    expect(first.nextLessonStudents.find(s => s.id === 'student-1')!.lessonMastery).toBeUndefined();
    scenario.students = first.nextLessonStudents;
    const second = new Simulation(scenario, 43).runToCompletion();
    expect(lessonProgress(second.nextLessonStudents.find(s => s.id === student.id)!, scenario.lesson.id).mastery).toBeGreaterThanOrEqual(mastery);
    expect(scenario.lesson).toEqual(original);
    expect(lessonProgress(student, 'other').mastery).toBe(0);
  });
  it('mesure sans augmenter la maîtrise et expose une session par ID et mode', () => {
    const scenario = selectLessonActivity(createPrototype(), curriculum, { lessonId: curriculum.lessons[0]!.id, teachingMode: 'assessment' });
    scenario.students[0]!.lessonMastery = { [scenario.lesson.id]: 37 };
    const simulation = new Simulation(scenario, 42);
    expect(simulation.session).toMatchObject({ lessonId: scenario.lesson.id, teachingMode: 'assessment', round: 0 });
    const result = simulation.runToCompletion();
    expect(result.nextLessonStudents[0]!.lessonMastery![scenario.lesson.id]).toBe(37);
    expect(result.events.some(e => e.type === 'concept_discovered')).toBe(false);
    scenario.activity!.teachingMode = 'homework';
    expect(new Simulation(scenario, 42).runToCompletion().teacher.patience).toBeLessThan(scenario.teacher.patience);
  });
  it('préserve les sauvegardes et accepte les anciennes sans maîtrise', () => {
    let raw = '';
    const storage = { getItem: () => raw || null, setItem: (_key: string, value: string) => { raw = value; } };
    const prep = new ClassPreparation(createPrototype(), storage);
    prep.scenario.students[0]!.lessonMastery = { [prep.scenario.lesson.id]: 74, 'future-lesson': 23 };
    prep.save();
    const restored = new ClassPreparation(createPrototype(), storage);
    expect(restored.scenario.students[0]!.lessonMastery).toEqual(prep.scenario.students[0]!.lessonMastery);
    const saved = JSON.parse(raw); saved.students.forEach((s: { lessonMastery?: unknown }) => delete s.lessonMastery); raw = JSON.stringify(saved);
    expect(lessonProgress(new ClassPreparation(createPrototype(), storage).scenario.students[0]!, prep.scenario.lesson.id).mastery).toBe(0);
  });
});
