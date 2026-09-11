import type { Lesson, Student, StudentLessonState } from '../domain.js';
import type { ActionRules } from '../data/rules.js';

export const roundValue = (value: number) => Math.round(value * 100) / 100;
export const moraleMultiplier = (morale: number) => 0.1 + 1.8 * morale / 100;
export const chapterCapacity = (lesson: Lesson) => lesson.requiredProgress / lesson.chapters.length;

export function createLessonStates(students: readonly Student[], lesson: Lesson): StudentLessonState[] {
  return students.map(student => ({ studentId: student.id, lessonUnderstanding: 0,
    effects: [],
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

export function combinedGain(activeGain: number, partnerGain: number, synergyRatio: number) {
  const active = roundValue(activeGain);
  const partner = roundValue(partnerGain);
  const sum = roundValue(active + partner);
  // Une synergie positive reste perceptible à la précision de deux décimales.
  const synergyGain = sum > 0 && synergyRatio > 0 ? Math.max(0.01, roundValue(sum * synergyRatio)) : 0;
  return { activeGain: active, partnerGain: partner, synergyGain,
    potentialGain: roundValue(sum + synergyGain) };
}
