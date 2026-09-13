import { abilities, specializations } from '../data/abilities.js';
// Compteurs temporaires : une instance par séance, remise à zéro du round seule.
export class AbilityUsage {
    round = new Map();
    lesson = new Map();
    startRound() { this.round.clear(); }
    reason(student, id) {
        if (!student.progression)
            return undefined;
        const a = abilities.find(a => a.id === id);
        if (!a || a.archetype !== student.archetypeId || a.requiredLevel > student.progression.level || !student.progression.unlockedAbilities.includes(id))
            return 'locked';
        const key = JSON.stringify([student.id, id]);
        if ((this.round.get(key) ?? 0) >= a.perRound || (this.lesson.get(key) ?? 0) >= a.perLesson)
            return 'abilityLimit';
        return undefined;
    }
    consume(student, id) {
        if (this.reason(student, id))
            throw new Error('Compétence indisponible.');
        const key = JSON.stringify([student.id, id]);
        this.round.set(key, (this.round.get(key) ?? 0) + 1);
        this.lesson.set(key, (this.lesson.get(key) ?? 0) + 1);
    }
}
export function specializationPower(student, abilityId) {
    const ability = abilities.find(a => a.id === abilityId);
    const branch = specializations.find(s => s.id === student.progression?.specialization);
    return ability && branch && branch.usage.includes(ability.usage) ? branch.power : 1;
}
export function effectiveAbility(student, ability) {
    const result = structuredClone(ability), power = specializationPower(student, ability.id);
    if (power === 1)
        return result;
    if (result.effect === 'APPLY_TEMPORARY_EFFECT') {
        result.value = Math.min(100, result.value * power);
        result.durationInRounds += specializations.find(s => s.id === student.progression?.specialization).duration;
    }
    else if (result.effect === 'COMBINED_ATTACK')
        result.synergy = Math.min(1, result.synergy * power);
    else {
        result.reduction = Math.min(1, result.reduction * power);
        result.maxReduction = Math.min(1, result.maxReduction * power);
    }
    return result;
}
