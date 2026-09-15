import { bounded } from '../systems/LearningMemory.js';
import { sessionRules } from '../data/sessionRules.js';
export function exerciseFit(mastery, difficulty, pedagogy) {
    const delta = difficulty - mastery, zone = 15 + pedagogy * 0.15;
    return delta < -zone ? 'easy' : delta > zone ? 'hard' : 'adapted';
}
/** Modifie le tour existant, pas la leçon du programme. */
export function sessionWork(type, student, state, lesson, teacher, difficulty = 50) {
    const mastery = student.lessonMastery?.[lesson.id] ?? 0;
    if (type === 'lecture')
        return { lesson, multiplier: 1, morale: 0 };
    if (type === 'assessment')
        return { lesson: { ...lesson, pressure: sessionRules.assessmentPressure, complexity: 30 },
            multiplier: (0.05 + mastery / 100 * 2) * (0.3 + student.discipline / 100 * 0.7) * (0.25 + state.concentration / 100 * 0.75), morale: 0 };
    if (type === 'revision')
        return { lesson: { ...lesson, pressure: lesson.pressure * 0.25, complexity: lesson.complexity * 0.5 }, multiplier: 0.8, morale: 0 };
    const fit = exerciseFit(mastery, difficulty, teacher.pedagogy);
    const multiplier = fit === 'easy' ? 0.22 : fit === 'adapted' ? 0.85 + teacher.pedagogy / 200 : 0.22 + mastery / 200;
    return { lesson: { ...lesson, complexity: bounded(difficulty), pressure: fit === 'easy' ? 8 : bounded(lesson.pressure + (fit === 'adapted' ? 10 : 30)) },
        multiplier: multiplier * (type === 'homework' ? (0.05 + student.discipline / 100 * 0.95) * (0.3 + state.concentration / 100 * 0.7) : 1), morale: fit === 'easy' ? 1 : fit === 'hard' ? -2 : 0 };
}
