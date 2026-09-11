import { areAdjacent } from './reactions.js';
import { effectBonus } from './effects.js';
import { roundValue } from './combat.js';
export function disruptionChance(student, state) {
    return (student.disruptionChance ?? 0) * (1 - effectBonus(state, 'disruptionReduction') / 100);
}
export function resolveDisruption(source, students, classroom, context, states, random, events, changeConcentration) {
    const neighbors = students.filter(student => areAdjacent(source, student, classroom));
    const target = neighbors[random.integer(neighbors.length)];
    const state = states.get(target.id);
    const power = context.rules.disruptionPower;
    const afterAuthority = roundValue(power * (1 - context.teacher.authority / 100));
    const damage = Math.min(state.concentration, afterAuthority);
    events.push({ type: 'STUDENT_ACTION', actorId: source.id, actionId: 'DISRUPT', targetId: target.id, extra: false });
    events.push({ type: 'DISRUPTION_RESOLVED', sourceId: source.id, targetId: target.id, power, afterAuthority, damage });
    if (damage > 0)
        changeConcentration(state, state.concentration - damage, 'disruption');
}
