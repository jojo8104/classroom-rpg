import { moraleMultiplier, roundValue } from './combat.js';
import { applyTemporaryEffect, effectiveStats } from './effects.js';
export function validateReactionSetup(students, setup) {
    const errors = [];
    const studentIds = new Set(students.map(student => student.id));
    const pairs = new Set();
    for (const relation of setup.relations) {
        const [left, right] = relation.studentIds;
        if (relation.studentIds.length !== 2 || !studentIds.has(left) || !studentIds.has(right) || left === right) {
            errors.push('Relation : deux élèves distincts connus sont requis.');
        }
        const pair = JSON.stringify([...relation.studentIds].sort());
        if (pairs.has(pair))
            errors.push('Relation : paire dupliquée.');
        pairs.add(pair);
        if (!Number.isFinite(relation.value) || relation.value < 0 || relation.value > 100)
            errors.push('Relation : valeur entre 0 et 100 requise.');
    }
    const ids = new Set();
    for (const ability of setup.abilities) {
        if (!ability.id.trim() || ids.has(ability.id))
            errors.push('Réaction : identifiant vide ou dupliqué.');
        ids.add(ability.id);
        if (!Number.isFinite(ability.minRelation) || ability.minRelation < 0 || ability.minRelation > 100)
            errors.push('Réaction : seuil de relation invalide.');
        if (ability.effect === 'REDUCE_PRESSURE' || ability.effect === 'REDUCE_COMPLEXITY') {
            const windows = ability.effect === 'REDUCE_PRESSURE' ? ['BEFORE_LESSON_ATTACK', 'DURING_LESSON_ATTACK'] : ['BEFORE_STUDENT_ATTACK', 'DURING_STUDENT_ATTACK'];
            if (!windows.includes(ability.window))
                errors.push('Réaction : fenêtre de réduction invalide.');
            for (const value of [ability.reduction, ability.maxReduction]) {
                if (!Number.isFinite(value) || value <= 0 || value > 1)
                    errors.push('Réaction : réduction attendue dans ]0, 1].');
            }
        }
        else if (ability.effect === 'APPLY_TEMPORARY_EFFECT') {
            if (!['BEFORE_STUDENT_ATTACK', 'DURING_STUDENT_ATTACK', 'AFTER_STUDENT_ATTACK'].includes(ability.window) ||
                !['intelligence', 'discipline', 'morale'].includes(ability.stat))
                errors.push('Réaction : fenêtre ou statistique de soutien invalide.');
            if (!Number.isFinite(ability.value) || ability.value <= 0 || ability.value > 100 ||
                !Number.isSafeInteger(ability.durationInRounds) || ability.durationInRounds <= 0)
                errors.push('Réaction : puissance ou durée invalide.');
        }
        else if (ability.effect === 'COMBINED_ATTACK') {
            if (!['BEFORE_STUDENT_ATTACK', 'DURING_STUDENT_ATTACK'].includes(ability.window) ||
                !Number.isFinite(ability.synergy) || ability.synergy <= 0 || ability.synergy > 1)
                errors.push('Réaction : fenêtre ou synergie invalide.');
        }
        else
            errors.push('Réaction : effet non pris en charge.');
    }
    for (const owner of [...setup.archetypes, ...students]) {
        const references = owner.reactionIds ?? [];
        if (new Set(references).size !== references.length || references.some(id => !ids.has(id)))
            errors.push('Capacités : réaction inconnue ou dupliquée.');
    }
    return errors;
}
export function areAdjacent(left, right, classroom) {
    const a = classroom.seats.find(seat => seat.id === left.seatId);
    const b = classroom.seats.find(seat => seat.id === right.seatId);
    return left.id !== right.id && !!a && !!b && Math.abs(a.row - b.row) + Math.abs(a.column - b.column) === 1;
}
export function relationBetween(left, right, relations) {
    return relations.find(relation => relation.studentIds.includes(left) && relation.studentIds.includes(right))?.value ?? 0;
}
function effectKey(ability) {
    if (ability.effect === 'APPLY_TEMPORARY_EFFECT')
        return `${ability.effect}:${ability.stat}`;
    return ability.effect === 'REDUCE_PRESSURE' ? ability.effect : 'OFFENSIVE_REACTION';
}
export function resolveReactionWindow(context) {
    const { window, target, students, states, resting, setup, lesson, rules, queue, events, resolvedEffects } = context;
    const targetState = states.get(target.id);
    if (!targetState || targetState.concentration <= 0 || resting.has(target.id))
        return;
    const candidates = [];
    for (const student of students) {
        const state = states.get(student.id);
        if (!state || state.concentration <= 0 || resting.has(student.id) || !areAdjacent(student, target, setup.classroom))
            continue;
        const relation = relationBetween(student.id, target.id, setup.relations);
        if (relation <= 0)
            continue;
        const ids = student.reactionIds ?? setup.archetypes.find(archetype => archetype.id === student.archetypeId)?.reactionIds ?? [];
        for (const ability of setup.abilities) {
            if (resolvedEffects.has(effectKey(ability)))
                continue;
            if (ability.effect === 'REDUCE_PRESSURE' && lesson.pressure <= 0)
                continue;
            if (ability.effect === 'REDUCE_COMPLEXITY' && (lesson.complexity <= 0 || effectiveStats(student, state).intelligence <= 0))
                continue;
            if (ability.effect === 'COMBINED_ATTACK' && (rules.workScale <= 0 ||
                effectiveStats(student, state).intelligence <= 0 || effectiveStats(target, targetState).intelligence <= 0))
                continue;
            if (ability.effect === 'APPLY_TEMPORARY_EFFECT') {
                if (roundValue(ability.value * relation / 100) <= 0)
                    continue;
                if (window === 'AFTER_STUDENT_ATTACK' && !context.attackSucceeded)
                    continue;
                if (effectiveStats(target, targetState)[ability.stat] >= 100)
                    continue;
            }
            if (ids.includes(ability.id) && ability.window === window && relation >= ability.minRelation) {
                candidates.push({ actorId: student.id, targetId: target.id, ability, relation, depth: context.depth });
            }
        }
    }
    const seat = (id) => setup.classroom.seats.find(s => s.id === students.find(student => student.id === id).seatId);
    candidates.sort((a, b) => b.relation - a.relation || seat(a.actorId).row - seat(b.actorId).row ||
        seat(a.actorId).column - seat(b.actorId).column ||
        Number(b.ability.effect === 'COMBINED_ATTACK') - Number(a.ability.effect === 'COMBINED_ATTACK') ||
        (a.ability.id < b.ability.id ? -1 : a.ability.id > b.ability.id ? 1 : 0));
    // Pour un même partenaire, une capacité de combo débloquée remplace sa
    // réduction simple, y compris si elles déclarent deux fenêtres différentes.
    const comboPartners = new Set(candidates.filter(candidate => candidate.ability.effect === 'REDUCE_COMPLEXITY').filter(candidate => {
        const student = students.find(student => student.id === candidate.actorId);
        const ids = student.reactionIds ?? setup.archetypes.find(archetype => archetype.id === student.archetypeId)?.reactionIds ?? [];
        return rules.workScale > 0 && effectiveStats(student, states.get(student.id)).intelligence > 0 &&
            effectiveStats(target, targetState).intelligence > 0 && setup.abilities.some(ability => ability.effect === 'COMBINED_ATTACK' && ids.includes(ability.id) &&
            (ability.window === window || window === 'BEFORE_STUDENT_ATTACK' && ability.window === 'DURING_STUDENT_ATTACK') &&
            candidate.relation >= ability.minRelation);
    }).map(candidate => candidate.actorId));
    for (const candidate of candidates) {
        if (candidate.ability.effect === 'REDUCE_COMPLEXITY' && comboPartners.has(candidate.actorId))
            continue;
        const reason = queue.enqueueReaction(candidate);
        if (reason) {
            events.push({ type: 'REACTION_LIMIT_REACHED', sourceId: candidate.actorId, targetId: target.id, reason });
            continue;
        }
        // Une réaction par fenêtre ; une seule protection et un soutien par statistique
        // sur ce tour. Les autres élèves conservent leur disponibilité.
        break;
    }
    let reaction;
    while ((reaction = queue.dequeueReaction()) !== undefined) {
        const source = students.find(student => student.id === reaction.actorId);
        const state = effectiveStats(source, states.get(source.id));
        const ability = reaction.ability;
        let before;
        let after;
        if (ability.effect === 'COMBINED_ATTACK') {
            context.modifiers.combined = { partner: state, synergyRatio: ability.synergy * reaction.relation / 100 };
            resolvedEffects.add(effectKey(ability));
            events.push({ type: 'COMBINED_ATTACK_STARTED', sourceId: source.id, targetId: target.id,
                abilityId: ability.id, relation: reaction.relation });
            continue;
        }
        else if (ability.effect === 'REDUCE_PRESSURE' || ability.effect === 'REDUCE_COMPLEXITY') {
            const stat = ability.effect === 'REDUCE_PRESSURE' ? 'pressure' : 'complexity';
            const power = ability.effect === 'REDUCE_PRESSURE' ? state.discipline : state.intelligence;
            const ratio = Math.min(ability.maxReduction, ability.reduction *
                power / rules.defenseReference * moraleMultiplier(state.morale) * reaction.relation / 100);
            before = lesson[stat];
            lesson[stat] = roundValue(Math.max(0, before * (1 - ratio)));
            after = lesson[stat];
        }
        else {
            before = effectiveStats(target, targetState)[ability.stat];
            // La relation module la puissance ; le plafond des statistiques reste 100.
            const value = roundValue(ability.value * reaction.relation / 100);
            applyTemporaryEffect(targetState, {
                id: JSON.stringify([source.id, target.id, ability.id]), abilityId: ability.id,
                sourceId: source.id, targetId: target.id, stat: ability.stat, value,
                remainingRounds: ability.durationInRounds,
            }, events);
            after = effectiveStats(target, targetState)[ability.stat];
        }
        resolvedEffects.add(effectKey(ability));
        events.push({ type: 'REACTION_TRIGGERED', sourceId: source.id, targetId: reaction.targetId,
            abilityId: ability.id, window, effect: ability.effect,
            relation: reaction.relation, before, after });
    }
}
