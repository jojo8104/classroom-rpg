import { createInteractionRules } from '../data/interactionRules.js';
import { chapterCapacity, moraleMultiplier, roundValue } from './combat.js';
// Le stockage 0–100 et le multiplicateur historique 0,10–1,90 sont conservés.
export function moraleChances(coefficient, rules = createInteractionRules()) {
    if (!Number.isFinite(coefficient))
        throw new Error('Moral invalide.');
    const clamp = (value) => Math.max(0, Math.min(1, roundValue(value * 100) / 100));
    return { negative: clamp((rules.negativeThreshold - coefficient) * rules.chancePerUnit),
        positive: clamp((coefficient - rules.positiveThreshold) * rules.chancePerUnit) };
}
export function checkMorale(studentId, morale, random, rules, events, context, targetId) {
    const coefficient = moraleMultiplier(morale);
    const chances = moraleChances(coefficient, rules);
    const result = { negative: false, positive: false };
    // Toujours deux tirages distincts, même aux bornes 0 et 100 %.
    for (const kind of ['negative', 'positive']) {
        const draw = random.next();
        result[kind] = draw < chances[kind];
        events.push({ type: 'MORALE_CHECK', studentId, targetId, context, kind, coefficient,
            chance: chances[kind], draw, success: result[kind] });
    }
    return result;
}
export function chapterMastery(state, lesson, chapterId) {
    const chapter = state.chapters.find(chapter => chapter.chapterId === chapterId);
    if (!chapter)
        throw new Error('Chapitre de maîtrise inconnu.');
    return roundValue(100 * chapter.progress / chapterCapacity(lesson));
}
export function masteryRequirement(ability, rules) {
    const pedagogical = ability.effect === 'REDUCE_COMPLEXITY' || ability.effect === 'COMBINED_ATTACK' ||
        ability.effect === 'APPLY_TEMPORARY_EFFECT' && ability.stat === 'intelligence';
    return ability.mastery ?? { minimum: pedagogical ? ability.effect === 'COMBINED_ATTACK' ? rules.comboMinimum : rules.pedagogicalMinimum : 0,
        scalesPower: pedagogical };
}
export function masteryAccess(ability, source, target, rules) {
    const requirement = masteryRequirement(ability, rules);
    const mastery = ability.effect === 'COMBINED_ATTACK' ? Math.min(source, target) : source;
    return { allowed: mastery >= requirement.minimum, minimum: requirement.minimum,
        modifier: requirement.scalesPower ? mastery / 100 : 1 };
}
