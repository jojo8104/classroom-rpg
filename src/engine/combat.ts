import type { Lesson, Student, StudentLessonState } from '../domain.js';
import type { ActionRules } from '../data/rules.js';

export const roundValue = (value: number) => Math.round(value * 100) / 100;
export const moraleMultiplier = (morale: number) => 0.1 + 1.8 * morale / 100;
export const chapterCapacity = (lesson: Lesson) => lesson.requiredProgress / lesson.chapters.length;

export function createLessonStates(students: readonly Student[], lesson: Lesson): StudentLessonState[] {
  return students.map(student => ({ studentId: student.id, lessonUnderstanding: 0,
    concentration: student.concentration, morale: student.morale,
    chapters: lesson.chapters.map(chapter => ({ chapterId: chapter.id, progress: 0, missedRounds: 0 })),
  }));
}

export function workGain(student: Student, morale: number, lesson: Lesson, rules: ActionRules, variation: number): number {
  return roundValue(rules.workScale * student.intelligence * moraleMultiplier(morale) *
    rules.defenseReference / (rules.defenseReference + lesson.complexity) *
    (1 + (variation * 2 - 1) * rules.workVariation));
}

export function pressureDamage(student: Student, morale: number, lesson: Lesson, rules: ActionRules): number {
  return roundValue(rules.pressureScale * lesson.pressure * rules.defenseReference /
    (rules.defenseReference + student.discipline * moraleMultiplier(morale)));
}
