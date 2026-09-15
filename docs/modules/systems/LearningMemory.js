import { sessionRules } from '../data/sessionRules.js';
export const bounded = (n) => Math.max(0, Math.min(100, n));
const rounded = (n) => Math.round(n * 100) / 100;
/** lessonMastery reste la source de vérité de masteryCurrent pour les anciens systèmes. */
export function memoryFor(student, lessonId, day = 0) {
    student.learningMemory ??= {};
    return student.learningMemory[lessonId] ??= { masteryAcquired: student.lessonMastery?.[lessonId] ?? 0,
        lastUsedAt: day, erosionUpdatedAt: day, revisionProtection: 0 };
}
export function erodeLearning(students, day, rules = sessionRules) {
    if (!Number.isSafeInteger(day) || day < 0)
        throw new Error('Date pédagogique invalide.');
    for (const student of students)
        for (const id of Object.keys(student.lessonMastery ?? {})) {
            const m = memoryFor(student, id, day);
            let loss = 0;
            for (let d = m.erosionUpdatedAt + 1; d <= day; d++) {
                const unused = d - m.lastUsedAt;
                if (unused <= rules.erosionGraceDays)
                    continue;
                const protectedDay = m.lastRevisionAt !== undefined && d - m.lastRevisionAt <= rules.revisionProtectionDays;
                loss += rounded(rules.erosionPerDay * (unused > rules.longAbsenceDays ? rules.longAbsenceMultiplier : 1) * (protectedDay ? 1 - m.revisionProtection : 1));
            }
            student.lessonMastery[id] = rounded(Math.max(0, student.lessonMastery[id] - loss));
            m.erosionUpdatedAt = Math.max(day, m.erosionUpdatedAt);
        }
}
export function consolidateMemory(student, id, current, type, day, effort) {
    const m = memoryFor(student, id, day), before = student.lessonMastery?.[id] ?? 0;
    const recovery = type === 'revision' ? Math.min(m.masteryAcquired - before, effort * sessionRules.revisionRecovery) : 0;
    student.lessonMastery ??= {};
    // La révision récupère d'abord ; les points restants permettent un apprentissage faible.
    student.lessonMastery[id] = rounded(bounded(type === 'revision' ? before + recovery + Math.max(0, current - before) * (1 - recovery / Math.max(1, effort)) : current));
    m.masteryAcquired = Math.max(m.masteryAcquired, student.lessonMastery[id]);
    m.lastUsedAt = day;
    m.erosionUpdatedAt = day;
    if (type === 'revision') {
        m.lastRevisionAt = day;
        m.revisionProtection = sessionRules.revisionProtection;
    }
}
export function observeLearning(student, id, teacher, type, day, performance) {
    const m = memoryFor(student, id, day), current = student.lessonMastery?.[id] ?? 0;
    const confounded = performance + 15 < current;
    const feedback = type === 'assessment' ? (confounded ? (teacher.pedagogy >= 60 ? 'Semble maîtriser malgré des erreurs d’inattention' : 'Résultat difficile à interpréter') : performance < 35 ? 'Semble réellement en difficulté' : 'Acquis mobilisés avec succès') : performance < 15 ? 'Hésitations ou blocages observés' : 'Réussites observées';
    const confidence = Math.min(60, (m.observation?.confidence ?? 0) + sessionRules.observation[type] * (0.5 + teacher.pedagogy / 100));
    // Une observation est bruitée et quantifiée ; elle n'est jamais une copie de la maîtrise.
    const bias = type === 'assessment' ? (performance - current) * (1 - teacher.pedagogy / 100) * 0.35 : 0;
    m.observation = { center: bounded(Math.round((current + bias) / 10) * 10), confidence,
        temporary: sessionRules.observation[type], observedAt: day, feedback };
}
export function estimateMastery(student, id, teacher, day = 0) {
    const observation = student.learningMemory?.[id]?.observation;
    if (!observation)
        return { low: 0, high: 100, label: 'Maîtrise non évaluée', feedback: 'Aucune observation disponible' };
    const age = Math.max(0, day - observation.observedAt);
    const precision = teacher.pedagogy * 0.25 + observation.confidence * 0.35 + observation.temporary * Math.max(0, 1 - age / 7) * 0.2;
    const radius = Math.max(5, 45 - precision + Math.min(30, age * 0.3));
    const low = Math.max(0, Math.floor((observation.center - radius) / 5) * 5);
    const high = Math.min(100, Math.ceil((observation.center + radius) / 5) * 5);
    return { low, high, label: `Maîtrise estimée : ${low}–${high} %`, feedback: observation.feedback };
}
export function repetitionLoss(student, type) {
    let count = 0;
    for (const previous of [...(student.recentSessionTypes ?? [])].reverse()) {
        if (previous !== type)
            break;
        count++;
    }
    return Math.max(0, count - 1) * sessionRules.repetitionLoss * (1 + (student.personality?.impulsive ?? 0) * 0.5 - (student.personality?.persistent ?? 0) * 0.3);
}
export function validateLearningMemory(student) {
    const valid = (n) => Number.isFinite(n) && n >= 0 && n <= 100;
    const date = (n) => Number.isSafeInteger(n) && n >= 0;
    try {
        return (!student.recentSessionTypes || (student.recentSessionTypes.length <= sessionRules.historyLimit && student.recentSessionTypes.every(t => ['lecture', 'exercise', 'revision', 'assessment', 'homework'].includes(t)))) &&
            Object.entries(student.learningMemory ?? {}).every(([id, m]) => valid(m.masteryAcquired) && m.masteryAcquired >= (student.lessonMastery?.[id] ?? 0) && date(m.lastUsedAt) && date(m.erosionUpdatedAt) && m.erosionUpdatedAt >= m.lastUsedAt && (m.lastRevisionAt === undefined || date(m.lastRevisionAt)) && m.revisionProtection >= 0 && m.revisionProtection <= 1 && (!m.observation || (valid(m.observation.center) && valid(m.observation.confidence) && valid(m.observation.temporary) && date(m.observation.observedAt) && typeof m.observation.feedback === 'string')));
    }
    catch {
        return false;
    }
}
