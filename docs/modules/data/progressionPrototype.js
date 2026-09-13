import { createSocialPrototype } from './socialPrototype.js';
import { createProgression } from '../engine/progression.js';
import { abilities } from './abilities.js';
export function createProgressionPrototype() {
    const scenario = createSocialPrototype();
    scenario.reactionAbilities = structuredClone(abilities.flatMap(a => a.mode === 'REACTION' ? [a.reaction] : []));
    for (const student of scenario.students) {
        student.progression = createProgression(student.archetypeId);
        delete student.reactionIds;
    }
    return scenario;
}
