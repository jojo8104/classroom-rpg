import type { ReactionAbility, Student } from '../domain.js';
import { abilities, specializations } from '../data/abilities.js';

// Compteurs temporaires : une instance par séance, remise à zéro du round seule.
export class AbilityUsage {
  private round = new Map<string, number>();
  private lesson = new Map<string, number>();
  startRound(): void { this.round.clear(); }
  reason(student: Student, id: string): 'locked' | 'abilityLimit' | undefined {
    if (!student.progression) return undefined;
    const a = abilities.find(a => a.id === id);
    if (!a || a.archetype !== student.archetypeId || a.requiredLevel > student.progression.level || !student.progression.unlockedAbilities.includes(id)) return 'locked';
    const key = JSON.stringify([student.id, id]);
    if ((this.round.get(key) ?? 0) >= a.perRound || (this.lesson.get(key) ?? 0) >= a.perLesson) return 'abilityLimit';
    return undefined;
  }
  consume(student: Student, id: string): void {
    if (this.reason(student, id)) throw new Error('Compétence indisponible.');
    const key = JSON.stringify([student.id, id]);
    this.round.set(key, (this.round.get(key) ?? 0) + 1);
    this.lesson.set(key, (this.lesson.get(key) ?? 0) + 1);
  }
}
export function specializationPower(student: Student, abilityId: string): number {
  const ability = abilities.find(a => a.id === abilityId);
  const branch = specializations.find(s => s.id === student.progression?.specialization);
  return ability && branch && (branch.usage as readonly string[]).includes(ability.usage) ? branch.power : 1;
}
export function effectiveAbility(student: Student, ability: ReactionAbility): ReactionAbility {
  const result = structuredClone(ability), power = specializationPower(student, ability.id);
  if (power === 1) return result;
  if (result.effect === 'APPLY_TEMPORARY_EFFECT') {
    result.value = Math.min(100, result.value * power);
    result.durationInRounds += specializations.find(s => s.id === student.progression?.specialization)!.duration;
  } else if (result.effect === 'COMBINED_ATTACK') result.synergy = Math.min(1, result.synergy * power);
  else { result.reduction = Math.min(1, result.reduction * power); result.maxReduction = Math.min(1, result.maxReduction * power); }
  return result;
}
