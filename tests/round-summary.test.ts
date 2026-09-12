import { describe, expect, it } from 'vitest';
import { summarizeRound } from '../src/ui/roundSummary.js';
import { createPrototype } from '../src/data/prototype.js';
import { createLessonStates } from '../src/engine/combat.js';
import type { ActionEvent } from '../src/events.js';
function fixture() { const s = createPrototype(); const before = createLessonStates(s.students, s.lesson); return { s, before, after: structuredClone(before) }; }
describe('Bilan du round', () => {
  it('ne signale pas un chapitre acquis comme un manque de progrès', () => {
    const { s, before, after } = fixture(); before[0]!.chapters[0]!.progress = 50; after[0]!.chapters[0]!.progress = 50;
    const result = summarizeRound(before, after, [], s.lesson, s.lesson.chapters[0]!.id);
    expect(result[0]!.alerts).not.toContain('Peu de progression');
    expect(result[1]!.alerts).toContain('Peu de progression');
  });
  it('signale le décrochage et les pertes nettes sans modifier les états', () => {
    const { s, before, after } = fixture(); after[0]!.concentration = 0; after[0]!.morale = 30;
    const snapshot = structuredClone(after);
    const result = summarizeRound(before, after, [], s.lesson, s.lesson.chapters[0]!.id);
    expect(result[0]!.alerts).toEqual(expect.arrayContaining(['Décroché', 'Moral faible', 'Forte perte de concentration']));
    expect(after).toEqual(snapshot); after[0]!.morale = 100;
    expect(result[0]!.alerts).toContain('Moral faible');
  });
  it('distingue une perte courante, une forte perte et une réserve faible', () => {
    const { s, before, after } = fixture();
    after[0]!.concentration = before[0]!.concentration - 20;
    after[1]!.concentration = before[1]!.concentration - 25;
    before[2]!.concentration = 25; after[2]!.concentration = 25;
    const result = summarizeRound(before, after, [], s.lesson, s.lesson.chapters[0]!.id);
    expect(result[0]!.alerts).not.toContain('Forte perte de concentration');
    expect(result[1]!.alerts).toContain('Forte perte de concentration');
    expect(result[2]!.alerts).toContain('Concentration faible');
    expect(result[2]!.alerts).not.toContain('Forte perte de concentration');
  });
  it('compte les effets utiles reçus sans doubler les combos ni compter les tentatives sans effet', () => {
    const { s, before, after } = fixture(); const sourceId = 'student-2', targetId = 'student-1';
    const events: ActionEvent[] = [
      { type: 'EFFECT_APPLIED', sourceId, targetId, effectId: 'concentration_bonus', before: 100, after: 100, amount: 0 },
      { type: 'COMBINED_ATTACK_STARTED', sourceId, targetId, abilityId: 'combo', relation: 100 },
      { type: 'COMBINED_ATTACK_RESOLVED', sourceId, targetId, activeGain: 1, partnerGain: 1, synergyGain: 1, potentialGain: 3, appliedProgress: 3 },
      { type: 'DISRUPTION_RESOLVED', sourceId, targetId, power: 16, afterAuthority: 6.4, damage: 6.4 },
      { type: 'DISRUPTION_RESOLVED', sourceId, targetId, power: 16, afterAuthority: 0, damage: 0 },
    ];
    const result = summarizeRound(before, after, events, s.lesson, s.lesson.chapters[0]!.id);
    expect(result[0]!.received).toEqual({ support: 0, protection: 0, combo: 1, disruptionDamage: 6.4 });
    expect(result[1]!.received.combo).toBe(0);
  });
});
