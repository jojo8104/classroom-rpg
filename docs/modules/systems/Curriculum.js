import { getTeachingMode } from '../data/teachingModes.js';
export function lessonProgress(student, lessonId) {
    return { studentId: student.id, lessonId, mastery: student.lessonMastery?.[lessonId] ?? 0 };
}
/** Références normalisées : aucun contenu ni concept dupliqué dans les branches. */
export function validateCurriculum(data, concepts) {
    const errors = [];
    for (const items of [data.programs, data.subjects, data.chapters, data.lessons]) {
        if (items.some(x => !x.id.trim()) || new Set(items.map(x => x.id)).size !== items.length)
            errors.push('Programme : identifiants invalides ou dupliqués.');
    }
    for (const subject of data.subjects)
        if (!data.programs.some(p => p.id === subject.programId))
            errors.push('Matière : programme inconnu.');
    for (const chapter of data.chapters)
        if (!data.subjects.some(s => s.id === chapter.subjectId))
            errors.push('Chapitre : matière inconnue.');
    for (const lesson of data.lessons) {
        if (!data.chapters.some(c => c.id === lesson.topicId))
            errors.push('Leçon : chapitre inconnu.');
        if (lesson.conceptIds.some(id => !concepts.some(c => c.id === id)) || new Set(lesson.conceptIds).size !== lesson.conceptIds.length)
            errors.push('Leçon : concepts invalides.');
        if (!Number.isFinite(lesson.complexity) || lesson.complexity < 0 || lesson.complexity > 100 || !Number.isFinite(lesson.pressure) || lesson.pressure < 0 || lesson.pressure > 100 || !Number.isFinite(lesson.requiredProgress) || lesson.requiredProgress <= 0 || !Number.isSafeInteger(lesson.roundCount) || lesson.roundCount < 1)
            errors.push('Leçon : paramètres invalides.');
        const modes = lesson.availableTeachingModes ?? ['lecture'];
        if (!modes.length || new Set(modes).size !== modes.length)
            errors.push('Leçon : modes invalides.');
        for (const id of modes) {
            try {
                getTeachingMode(id);
            }
            catch {
                errors.push(`Mode inconnu : ${id}.`);
            }
        }
        for (const p of lesson.prerequisites ?? [])
            if (!data.lessons.some(l => l.id === p.lessonId) || !Number.isFinite(p.mastery) || p.mastery < 0 || p.mastery > 100)
                errors.push('Prérequis invalide.');
        for (const entry of lesson.conceptPool ?? [])
            if (!lesson.conceptIds.includes(entry.conceptId) || !Number.isFinite(entry.baseRate) || entry.baseRate < 0 || entry.baseRate > 1)
                errors.push('Pool de concepts invalide.');
    }
    const visit = (id, path) => {
        if (path.has(id))
            return true;
        return (data.lessons.find(l => l.id === id)?.prerequisites ?? []).some(p => visit(p.lessonId, new Set([...path, id])));
    };
    if (data.lessons.some(l => visit(l.id, new Set())))
        errors.push('Prérequis cycliques.');
    return errors;
}
/** Contrat Roadmap 10, sans calendrier. Les devoirs restent une activité différée. */
export function selectLessonActivity(scenario, data, activity) {
    const errors = validateCurriculum(data, scenario.concepts);
    if (errors.length)
        throw new Error(errors.join('\n'));
    const lesson = data.lessons.find(l => l.id === activity.lessonId);
    if (!lesson || !(lesson.availableTeachingModes ?? ['lecture']).includes(activity.teachingMode))
        throw new Error('Activité indisponible.');
    const topic = data.chapters.find(c => c.id === lesson.topicId);
    const subject = data.subjects.find(s => s.id === topic.subjectId);
    const program = data.programs.find(p => p.id === subject.programId);
    return structuredClone({ ...scenario, program, subject, topic, lesson, activity });
}
