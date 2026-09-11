// Une nouvelle instance à chaque appel évite de partager un état mutable entre tests.
export function createPrototype() {
    const names = ['Alice', 'Paul', 'Léa', 'Hugo', 'Emma', 'Louis', 'Inès', 'Adam', 'Chloé'];
    const archetypeIds = ['offensive', 'defensive', 'support'];
    return {
        relations: [
            { studentIds: ['student-1', 'student-2'], value: 85 },
            { studentIds: ['student-2', 'student-3'], value: 25 },
            { studentIds: ['student-4', 'student-5'], value: 75 },
            { studentIds: ['student-5', 'student-6'], value: 60 },
            { studentIds: ['student-7', 'student-8'], value: 90 },
            { studentIds: ['student-8', 'student-9'], value: 55 },
            { studentIds: ['student-3', 'student-6'], value: 80 },
            { studentIds: ['student-6', 'student-9'], value: 70 },
        ],
        reactionAbilities: [{ id: 'protect_neighbor', window: 'DURING_LESSON_ATTACK',
                effect: 'REDUCE_PRESSURE', minRelation: 40, reduction: 0.6, maxReduction: 0.8 },
            { id: 'explain_neighbor', window: 'BEFORE_STUDENT_ATTACK', effect: 'APPLY_TEMPORARY_EFFECT',
                minRelation: 40, stat: 'intelligence', value: 16, durationInRounds: 2 },
            { id: 'steady_neighbor', window: 'DURING_STUDENT_ATTACK', effect: 'APPLY_TEMPORARY_EFFECT',
                minRelation: 40, stat: 'discipline', value: 20, durationInRounds: 2 },
            { id: 'motivate_neighbor', window: 'AFTER_STUDENT_ATTACK', effect: 'APPLY_TEMPORARY_EFFECT',
                minRelation: 40, stat: 'morale', value: 12, durationInRounds: 2 },
            { id: 'weaken_lesson', window: 'BEFORE_STUDENT_ATTACK', effect: 'REDUCE_COMPLEXITY',
                minRelation: 40, reduction: 0.4, maxReduction: 0.6 },
            { id: 'combined_attack', window: 'BEFORE_STUDENT_ATTACK', effect: 'COMBINED_ATTACK',
                minRelation: 90, synergy: 0.25 },
        ],
        teacher: { id: 'teacher', pedagogy: 60, authority: 60, patience: 70 },
        classroom: {
            id: 'classroom', rows: 3, columns: 3,
            seats: Array.from({ length: 9 }, (_, index) => ({
                id: `seat-${index + 1}`, row: Math.floor(index / 3), column: index % 3,
            })),
        },
        students: names.map((name, index) => ({
            id: `student-${index + 1}`, name,
            intelligence: 45 + index * 4, discipline: 50 + index * 3,
            concentration: 55 + index * 2, morale: 65,
            archetypeId: archetypeIds[index % 3], seatId: `seat-${index + 1}`,
            ...(index === 5 ? { reactionIds: ['steady_neighbor'] } : index === 8 ? { reactionIds: ['motivate_neighbor'] } : {}),
        })),
        archetypes: [
            { id: 'offensive', name: 'Offensif', reactionIds: ['weaken_lesson', 'combined_attack'] },
            { id: 'defensive', name: 'Défensif', reactionIds: ['protect_neighbor'] },
            { id: 'support', name: 'Support', reactionIds: ['explain_neighbor'] },
        ],
        subject: { id: 'mathematics', name: 'Mathématiques' },
        topic: { id: 'fractions', subjectId: 'mathematics', name: 'Fractions' },
        lesson: {
            complexity: 50, pressure: 70, requiredProgress: 100,
            id: 'introduction-to-fractions', topicId: 'fractions',
            name: 'Introduction aux fractions',
            chapters: [
                { id: 'discover', name: 'Découvrir', roundCount: 3 },
                { id: 'understand', name: 'Comprendre', roundCount: 3 },
            ],
            conceptIds: ['fraction', 'numerator', 'denominator'],
        },
        concepts: [
            { id: 'fraction', name: 'Fraction' },
            { id: 'numerator', name: 'Numérateur' },
            { id: 'denominator', name: 'Dénominateur' },
        ],
    };
}
