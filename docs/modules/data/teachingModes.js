const consolidate = (before, understanding) => (100 - before) * understanding / 100;
export const teachingModes = [
    { id: 'lecture', name: 'Cours magistral', resolution: 'classroom', masteryGain: consolidate, conceptMultiplier: 1 },
    { id: 'exercise', name: 'Exercices', resolution: 'classroom', masteryGain: consolidate, conceptMultiplier: 1 },
    { id: 'homework', name: 'Devoirs', resolution: 'deferred', masteryGain: consolidate, conceptMultiplier: 1 },
    { id: 'revision', name: 'Révision', resolution: 'classroom', masteryGain: consolidate, conceptMultiplier: 1 },
    { id: 'assessment', name: 'Évaluation', resolution: 'classroom', masteryGain: () => 0, conceptMultiplier: 0 },
];
export function getTeachingMode(id) {
    const mode = teachingModes.find(m => m.id === id);
    if (!mode)
        throw new Error(`Mode pédagogique inconnu : ${id}.`);
    return mode;
}
