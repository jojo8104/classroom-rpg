import type { Lesson, Student, StudentLessonState } from '../domain.js';
export interface TeachingModeDefinition {
  id: string; name: string; resolution: 'classroom' | 'deferred';
  masteryGain: (before: number, understanding: number) => number;
  conceptMultiplier: number;
  /** Hooks de séance : ressources, difficulté, efficacité selon les acquis. */
  prepareLesson?: (lesson: Lesson) => Lesson;
  prepareStudent?: (student: Student, state: StudentLessonState) => void;
}
const consolidate = (before: number, understanding: number) => (100 - before) * understanding / 100;
export const teachingModes: TeachingModeDefinition[] = [
  { id: 'lecture', name: 'Cours magistral', resolution: 'classroom', masteryGain: consolidate, conceptMultiplier: 1 },
  { id: 'exercise', name: 'Exercices', resolution: 'classroom', masteryGain: consolidate, conceptMultiplier: 1 },
  { id: 'homework', name: 'Devoirs', resolution: 'deferred', masteryGain: consolidate, conceptMultiplier: 1 },
  { id: 'revision', name: 'Révision', resolution: 'classroom', masteryGain: (before, understanding) => consolidate(before, understanding) * 0.08, conceptMultiplier: 2 },
  { id: 'assessment', name: 'Évaluation', resolution: 'classroom', masteryGain: () => 0, conceptMultiplier: 0 },
];
export function getTeachingMode(id: string): TeachingModeDefinition {
  const mode = teachingModes.find(m => m.id === id);
  if (!mode) throw new Error(`Mode pédagogique inconnu : ${id}.`);
  return mode;
}
