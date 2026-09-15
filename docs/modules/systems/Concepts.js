export const conceptRules = { significantXp: 5, failureProgress: 0.05 };
const clamp = (n) => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
/** Migration douce : conserve aussi les identifiants de catalogues absents. */
export function initializeConcepts(student) {
    const previous = student.concepts;
    const acquired = [...new Set(Array.isArray(previous?.acquired) ? previous.acquired.filter(id => typeof id === 'string') : [])];
    const progress = Object.fromEntries(Object.entries(previous?.progress ?? {}).filter(([id, n]) => !acquired.includes(id) && typeof n === 'number' && Number.isFinite(n)).map(([id, n]) => [id, clamp(n)]));
    return student.concepts = { acquired, progress };
}
export function hasConcept(student, conceptId) {
    return student.concepts?.acquired.includes(conceptId) ?? false;
}
export class Concepts {
    catalog;
    constructor(catalog) {
        this.catalog = catalog;
    }
    getConcept(id) { return this.catalog.find(c => c.id === id); }
    hasConcept = hasConcept;
    getConceptsByTag(student, tag) { return this.getConceptsByTags(student, [tag]); }
    /** Tous les tags demandés doivent être présents ; [] renvoie tous les acquis. */
    getConceptsByTags(student, tags) {
        return this.catalog.filter(c => hasConcept(student, c.id) && tags.every(tag => c.tags.includes(tag)));
    }
    learningMultiplier(student, tags) {
        return 1 + this.getConceptsByTags(student, []).flatMap(c => c.effects)
            .filter(e => e.type === 'learning_boost' && e.tags.every(tag => tags.includes(tag)))
            .reduce((sum, e) => sum + Math.max(0, Number.isFinite(e.value) ? e.value : 0), 0);
    }
    isEligible(context) {
        const concept = this.getConcept(context.conceptId);
        return !!concept && !hasConcept(context.student, context.conceptId) && context.baseRate > 0
            && (context.modeMultiplier ?? 1) > 0
            && context.lessonProgress >= (concept.conditions?.minimumUnderstanding ?? 0)
            && (concept.conditions?.requiredConceptIds ?? []).every(id => hasConcept(context.student, id));
    }
    computeDiscoveryChance(context) {
        if (!this.isEligible(context))
            return 0;
        const { student, conceptId } = context;
        const rate = clamp(context.baseRate) * (1 + clamp(context.lessonProgress / 100) * 0.25)
            * (1 + clamp(student.personality?.persistent ?? 0) * 0.1)
            * (1 + clamp((context.teacher?.pedagogy ?? 0) / 100) * 0.1 + clamp(context.teacherModifier ?? 0))
            * this.learningMultiplier(student, this.getConcept(conceptId).tags);
        return clamp((rate + clamp(student.concepts?.progress[conceptId] ?? 0)) * (context.modeMultiplier ?? 1));
    }
    attemptDiscoveries(context, xpGained, random) {
        const state = initializeConcepts(context.student), events = [];
        if (xpGained < conceptRules.significantXp)
            return events;
        const visited = new Set();
        for (const entry of context.lesson.conceptIds.map(conceptId => ({ conceptId, baseRate: context.lesson.conceptPool?.find(e => e.conceptId === conceptId)?.baseRate ?? this.getConcept(conceptId)?.baseRate ?? 0 }))) {
            const attempt = { ...context, ...entry };
            if (visited.has(entry.conceptId) || !this.isEligible(attempt))
                continue;
            visited.add(entry.conceptId);
            if (random.next() < this.computeDiscoveryChance(attempt)) {
                state.acquired.push(entry.conceptId);
                delete state.progress[entry.conceptId];
                events.push({ type: 'concept_discovered', studentId: context.student.id, conceptId: entry.conceptId, lessonId: context.lesson.id });
            }
            else
                state.progress[entry.conceptId] = clamp((state.progress[entry.conceptId] ?? 0) + conceptRules.failureProgress);
        }
        return events;
    }
}
