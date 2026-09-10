export const roundValue = (value) => Math.round(value * 100) / 100;
export const moraleMultiplier = (morale) => 0.1 + 1.8 * morale / 100;
export const chapterCapacity = (lesson) => lesson.requiredProgress / lesson.chapters.length;
export function createLessonStates(students, lesson) {
    return students.map(student => ({ studentId: student.id, lessonUnderstanding: 0,
        concentration: student.concentration, morale: student.morale,
        chapters: lesson.chapters.map(chapter => ({ chapterId: chapter.id, progress: 0, missedRounds: 0 })),
    }));
}
export function workGain(student, morale, lesson, rules, variation) {
    return roundValue(rules.workScale * student.intelligence * moraleMultiplier(morale) *
        rules.defenseReference / (rules.defenseReference + lesson.complexity) *
        (1 + (variation * 2 - 1) * rules.workVariation));
}
export function pressureDamage(student, morale, lesson, rules) {
    return roundValue(rules.pressureScale * lesson.pressure * rules.defenseReference /
        (rules.defenseReference + student.discipline * moraleMultiplier(morale)));
}
