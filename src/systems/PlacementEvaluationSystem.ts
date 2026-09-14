import type { PrototypeScenario, Student } from '../domain.js';
import type { ClassroomLayout, Seat } from '../models/ClassroomLayout.js';
import { ClassroomLayoutSystem } from './ClassroomLayoutSystem.js';
import { getRelation } from '../engine/social.js';
import { abilities } from '../data/abilities.js';

export type PlacementState = 'positive' | 'neutral' | 'negative';
export const knowledgeOf = (student: Student, conceptId: string): number | null => student.knowledge?.[conceptId] ?? null;
export function getSeatPreferenceModifier(student: Student, seat: Seat): number {
  const preference = student.seatPreferences;
  return Math.max(-3, Math.min(3, (preference?.likes.filter(t => seat.tags.includes(t)).length ?? 0) * 2 -
    (preference?.dislikes.filter(t => seat.tags.includes(t)).length ?? 0) * 2));
}

/** Expose les compétences existantes, sans promettre leur déclenchement. */
export function getClassSynergy(studentA: Student, studentB: Student) {
  return [studentA, studentB].flatMap(student => abilities.filter(a => a.archetype === student.archetypeId && a.mode === 'REACTION' &&
    (student.progression ? student.progression.unlockedAbilities.includes(a.id) : true))
    .map(a => ({ sourceId: student.id, targetId: student.id === studentA.id ? studentB.id : studentA.id, abilityId: a.id, name: a.name })));
}

export class PlacementEvaluationSystem {
  private system: ClassroomLayoutSystem;
  private students: Map<string,Student>;
  private scores=new Map<string,number>();
  constructor(private scenario: PrototypeScenario, layout: ClassroomLayout | ClassroomLayoutSystem) {
    this.system=layout instanceof ClassroomLayoutSystem ? layout : new ClassroomLayoutSystem(layout);
    this.students=new Map(scenario.students.map(s=>[s.id,s]));
  }
  recalculateAffectedPlacements(changedSeatIds: readonly string[]): Map<string,number> {
    const seats=new Set(changedSeatIds.flatMap(id=>[id,...this.system.getNeighborSeatIds(id)]));
    const result=new Map<string,number>();
    for(const id of seats) {
      const seat=this.system.getSeat(id); if(!seat?.studentId) continue;
      const score=this.previewPlacement(seat.studentId,id).score;
      this.scores.set(seat.studentId,score); result.set(seat.studentId,score);
    }
    return result;
  }
  relation(from: string, to: string): number {
    return this.scenario.classRelations ? getRelation(this.scenario.classRelations, from, to) :
      this.scenario.relations?.find(r => r.studentIds.includes(from) && r.studentIds.includes(to))?.value ?? 0;
  }
  previewPlacement(studentId: string, seatId: string) {
    const system = this.system;
    const student = this.students.get(studentId);
    const seat = system.getSeat(seatId);
    if (!student || !seat || !system.getStudentSeat(studentId)) throw new Error('Placement inconnu.');
    const current = system.getStudentSeat(studentId)!.id === seatId;
    const allowed = current || system.canMoveStudent(studentId, seatId);
    const source=system.getStudentSeat(studentId)!;
    // Occupation virtuelle des seuls voisins de la destination ; aucun clone du plan.
    const destination=allowed ? seat : source;
    const occupant=(id:string)=>allowed && !current && id===source.id ? seat.studentId : system.getSeat(id)?.studentId;
    const neighborIds=system.getNeighborSeatIds(destination.id).flatMap(id=>{const who=occupant(id);return who && who!==studentId ? [who] : [];});
    const preference = getSeatPreferenceModifier(student, seat);
    const conceptId = this.scenario.lesson.conceptIds[0] ?? '';
    const mastery = knowledgeOf(student, conceptId);
    const neighbors = neighborIds.filter(id=>this.students.get(id)?.present!==false).map(id => {
      const other = this.students.get(id)!;
      const knowledge = knowledgeOf(other, conceptId);
      return { studentId: id, name: other.name, relation: this.relation(studentId, id),
        incomingRelation: this.relation(id, studentId), knowledge,
        useful: mastery !== null && mastery < 50 && knowledge !== null && knowledge >= 65 && knowledge >= mastery + 20,
        synergies: getClassSynergy(student, other) };
    });
    const score = Math.round(preference * 5 + (neighbors.length ? neighbors.reduce((sum,n) => sum+n.relation,0) / neighbors.length * 0.5 : 0));
    const state: PlacementState = score > 5 ? 'positive' : score < -5 ? 'negative' : 'neutral';
    return { studentId, seatId, allowed, preference, neighbors, score, state,
      advisory: 'Indication de préférence et de relations ; les compétences gardent leurs conditions de déclenchement.' };
  }
  getPlacementScore(student: Student, seat: Seat) { return this.previewPlacement(student.id, seat.id).score; }
}
