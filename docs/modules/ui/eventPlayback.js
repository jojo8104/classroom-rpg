import { eventPriority } from '../engine/diagnostics.js';
/** Les événements métier restent intacts ; seule leur présentation est agrégée. */
export function visualEvents(events, speed) {
    if (speed === 'detailed')
        return [...events];
    if (speed === 'instant')
        return events.filter(e => e.type === 'ROUND_ENDED' || e.type === 'LESSON_RESULTS');
    const important = events.filter(e => (e.priority ?? eventPriority(e)) === 'major' && e.type !== 'LESSON_ENDED');
    const snapshot = events.filter(e => e.type === 'ROUND_ENDED');
    // Au plus quatre faits saillants, puis l'état complet. Aucun effet métier n'est supprimé.
    return [...important.slice(0, 4), ...snapshot];
}
