import { ClassroomLayoutSystem } from './ClassroomLayoutSystem.js';
import { getRelation } from '../engine/social.js';
import { abilities } from '../data/abilities.js';
export const knowledgeOf = (student, conceptId) => student.knowledge?.[conceptId] ?? null;
export function getSeatPreferenceModifier(student, seat) {
    const preference = student.seatPreferences;
    return Math.max(-3, Math.min(3, (preference?.likes.filter(t => seat.tags.includes(t)).length ?? 0) * 2 -
        (preference?.dislikes.filter(t => seat.tags.includes(t)).length ?? 0) * 2));
}
/** Expose les compétences existantes, sans promettre leur déclenchement. */
export function getClassSynergy(studentA, studentB) {
    return [studentA, studentB].flatMap(student => abilities.filter(a => a.archetype === student.archetypeId && a.mode === 'REACTION' &&
        (student.progression ? student.progression.unlockedAbilities.includes(a.id) : true))
        .map(a => ({ sourceId: student.id, targetId: student.id === studentA.id ? studentB.id : studentA.id, abilityId: a.id, name: a.name })));
}
export class PlacementEvaluationSystem {
    scenario;
    layout;
    constructor(scenario, layout) {
        this.scenario = scenario;
        this.layout = layout;
    }
    relation(from, to) {
        return this.scenario.classRelations ? getRelation(this.scenario.classRelations, from, to) :
            this.scenario.relations?.find(r => r.studentIds.includes(from) && r.studentIds.includes(to))?.value ?? 0;
    }
    previewPlacement(studentId, seatId) {
        const system = new ClassroomLayoutSystem(this.layout);
        const student = this.scenario.students.find(s => s.id === studentId);
        const seat = system.getSeat(seatId);
        if (!student || !seat || !system.getStudentSeat(studentId))
            throw new Error('Placement inconnu.');
        const current = system.getStudentSeat(studentId).id === seatId;
        const allowed = current || system.canMoveStudent(studentId, seatId);
        if (allowed && !current)
            system.moveStudent(studentId, seatId);
        const preference = getSeatPreferenceModifier(student, seat);
        const conceptId = this.scenario.lesson.conceptIds[0] ?? '';
        const mastery = knowledgeOf(student, conceptId);
        const neighbors = system.getNeighbors(studentId).direct.map(id => {
            const other = this.scenario.students.find(s => s.id === id);
            const knowledge = knowledgeOf(other, conceptId);
            return { studentId: id, name: other.name, relation: this.relation(studentId, id),
                incomingRelation: this.relation(id, studentId), knowledge,
                useful: mastery !== null && mastery < 50 && knowledge !== null && knowledge >= 65 && knowledge >= mastery + 20,
                synergies: getClassSynergy(student, other) };
        });
        const score = Math.round(preference * 5 + (neighbors.length ? neighbors.reduce((sum, n) => sum + n.relation, 0) / neighbors.length * 0.5 : 0));
        const state = score > 5 ? 'positive' : score < -5 ? 'negative' : 'neutral';
        return { studentId, seatId, allowed, preference, neighbors, score, state,
            advisory: 'Indication de préférence et de relations ; les compétences gardent leurs conditions de déclenchement.' };
    }
    getPlacementScore(student, seat) { return this.previewPlacement(student.id, seat.id).score; }
}
