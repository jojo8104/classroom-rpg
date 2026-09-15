import { abilities, specializations } from '../data/abilities.js';
import { levelForXp, progressionRules } from '../data/progressionRules.js';
export function emptyUsage() { return { offense: 0, concentration: 0, morale: 0, pedagogy: 0, defense: 0, combo: 0 }; }
export function createProgression(archetype, xp = 0) {
    const level = levelForXp(xp);
    return { xp, level, unlockedAbilities: abilities.filter(a => a.archetype === archetype && a.requiredLevel <= level).map(a => a.id), usage: emptyUsage() };
}
export function validateProgression(student) {
    const p = student.progression;
    if (!p)
        return [];
    try {
        if (p.level !== levelForXp(p.xp) || new Set(p.unlockedAbilities).size !== p.unlockedAbilities.length ||
            p.unlockedAbilities.some(id => !abilities.some(a => a.id === id && a.archetype === student.archetypeId && a.requiredLevel <= p.level)) ||
            abilities.some(a => a.archetype === student.archetypeId && a.requiredLevel <= p.level && !p.unlockedAbilities.includes(a.id)) ||
            Object.keys(p.usage).length !== Object.keys(emptyUsage()).length || Object.keys(emptyUsage()).some(k => !Number.isSafeInteger(p.usage[k]) || p.usage[k] < 0) ||
            p.specialization && (p.level < progressionRules.specializationLevel || !specializations.some(s => s.id === p.specialization && s.archetype === student.archetypeId)))
            throw new Error();
        return [];
    }
    catch {
        return [`Progression RPG invalide : ${student.id}.`];
    }
}
export function specializationTrends(student) {
    const branches = specializations.filter(s => s.archetype === student.archetypeId);
    const weights = branches.map(s => s.usage.reduce((n, key) => n + (student.progression?.usage[key] ?? 0), 0));
    const total = weights.reduce((a, b) => a + b, 0);
    return branches.map((s, i) => ({ id: s.id, name: s.name, percent: total ? Math.round(100 * weights[i] / total) : 50 }));
}
export function selectSpecialization(student, id) {
    const p = student.progression;
    if (!p || p.level < progressionRules.specializationLevel || p.specialization || !specializations.some(s => s.id === id && s.archetype === student.archetypeId))
        throw new Error('Spécialisation indisponible.');
    p.specialization = id;
    return { type: 'SPECIALIZATION_SELECTED', studentId: student.id, specializationId: id };
}
// Le bilan parcourt une seule fois les événements sources. Les événements dérivés
// (concentration, effets temporaires, moral, relations) ne sont jamais récompensés deux fois.
export function settleProgression(student, history, understanding, concepts) {
    const p = student.progression;
    const usage = emptyUsage(), counts = { participation: 1 };
    const add = (kind) => { counts[kind] = (counts[kind] ?? 0) + 1; };
    let resumed = false;
    for (const event of history) {
        if (event.type === 'ABILITY_USED' && event.studentId === student.id && event.effective) {
            const ability = abilities.find(a => a.id === event.abilityId);
            usage[ability.usage]++;
            add(ability.usage);
        }
        if (event.type === 'COMBINED_ATTACK_RESOLVED' && event.targetId === student.id && event.appliedProgress > 0) {
            usage.combo++;
            add('combo');
        }
        if (event.type === 'STUDENT_RESUMED' && event.studentId === student.id)
            resumed = true;
        if (event.type === 'UNDERSTANDING_CHANGED' && event.studentId === student.id && event.amount > 0) {
            if (resumed) {
                add('perseverance');
                resumed = false;
            }
            // Travail ordinaire : participation offensive, sans récompenser chaque point appris.
            if (student.archetypeId === 'offensive')
                add('offense');
        }
    }
    if (understanding >= progressionRules.personalThreshold)
        add('personal');
    const rewards = {};
    for (const key of Object.keys(progressionRules.rewards)) {
        const value = Math.min(counts[key] ?? 0, progressionRules.caps[key]) * progressionRules.rewards[key];
        if (value)
            rewards[key] = Math.round(value * (concepts?.service.learningMultiplier(student, concepts.context.lesson.tags ?? []) ?? 1));
    }
    const xpGained = Object.values(rewards).reduce((a, b) => a + b, 0), beforeLevel = p.level;
    const events = [];
    p.xp += xpGained;
    p.level = levelForXp(p.xp);
    for (const key of Object.keys(usage))
        p.usage[key] += usage[key];
    events.push({ type: 'XP_GAINED', studentId: student.id, amount: xpGained, rewards });
    events.push({ type: 'ARCHETYPE_USAGE_UPDATED', studentId: student.id, usage: structuredClone(p.usage), delta: usage });
    const unlockedAbilities = [];
    for (let level = beforeLevel + 1; level <= p.level; level++) {
        events.push({ type: 'STUDENT_LEVEL_UP', studentId: student.id, oldLevel: level - 1, newLevel: level });
        for (const a of abilities.filter(a => a.archetype === student.archetypeId && a.requiredLevel === level && !p.unlockedAbilities.includes(a.id))) {
            p.unlockedAbilities.push(a.id);
            unlockedAbilities.push(a.id);
            events.push({ type: 'ABILITY_UNLOCKED', studentId: student.id, abilityId: a.id, level, source: 'LEVEL_UP' });
        }
    }
    if (beforeLevel < progressionRules.specializationLevel && p.level >= progressionRules.specializationLevel)
        events.push({ type: 'SPECIALIZATION_AVAILABLE', studentId: student.id, suggestions: specializationTrends(student) });
    if (concepts)
        events.push(...concepts.service.attemptDiscoveries({ ...concepts.context, student, lessonProgress: understanding }, xpGained, concepts.random));
    return { result: { xpGained, beforeLevel, afterLevel: p.level, xp: p.xp, rewards, unlockedAbilities, usage }, events };
}
