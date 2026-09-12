import { chapterCapacity, roundValue } from '../engine/combat.js';
// Seuils de lecture du bilan ; ils ne changent aucune règle de simulation.
export const summaryThresholds = { lowMorale: 40, largeLoss: 25, lowConcentration: 25, lowProgress: 5 };
export function summarizeRound(before, after, events, lesson, chapterId) {
    return after.map(state => {
        const previous = before.find(s => s.studentId === state.studentId);
        const progress = roundValue(state.lessonUnderstanding - previous.lessonUnderstanding);
        const concentration = roundValue(state.concentration - previous.concentration);
        const chapter = state.chapters.find(c => c.chapterId === chapterId);
        const completed = chapter.progress >= chapterCapacity(lesson);
        const alerts = [];
        if (state.concentration === 0)
            alerts.push('Décroché');
        else if (state.concentration <= summaryThresholds.lowConcentration)
            alerts.push('Concentration faible');
        if (state.morale <= summaryThresholds.lowMorale)
            alerts.push('Moral faible');
        if (concentration <= -summaryThresholds.largeLoss)
            alerts.push('Forte perte de concentration');
        if (!completed && progress < summaryThresholds.lowProgress)
            alerts.push('Peu de progression');
        const received = { support: 0, protection: 0, combo: 0, disruptionDamage: 0 };
        for (const event of events) {
            if ('targetId' in event && event.targetId === state.studentId) {
                if (event.type === 'EFFECT_APPLIED' && event.amount > 0)
                    received.support++;
                if (event.type === 'REACTION_TRIGGERED' && event.before !== event.after) {
                    if (event.effect === 'REDUCE_PRESSURE')
                        received.protection++;
                    else
                        received.support++;
                }
                if (event.type === 'COMBINED_ATTACK_RESOLVED' && event.appliedProgress > 0)
                    received.combo++;
                if (event.type === 'DISRUPTION_RESOLVED')
                    received.disruptionDamage = roundValue(received.disruptionDamage + event.damage);
            }
        }
        return { studentId: state.studentId, progress, concentration, alerts, completed, received };
    });
}
