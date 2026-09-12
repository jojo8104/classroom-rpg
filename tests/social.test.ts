import { describe, it, expect } from 'vitest';
import { createPrototype } from '../src/data/prototype.js';
import { createLessonStates } from '../src/engine/combat.js';
import { SeededRandom } from '../src/engine/random.js';
import { behaviorCandidate, createInitialRelations, createPersonality, difficultyLoss, evolveRelation, getRelation, modifyRelation, validateSocial, weightedChoice } from '../src/engine/social.js';

describe('fondations sociales', () => {
  it('relations orientées, bornées, variations asymétriques', () => {
    const relations = { links: [{ from: 'a', to: 'b', score: 70 }, { from: 'b', to: 'a', score: 35 }] };
    modifyRelation(relations, 'a', 'b', 100); expect(getRelation(relations, 'a', 'b')).toBe(100);
    expect(getRelation(relations, 'b', 'a')).toBe(35);
    modifyRelation(relations, 'a', 'b', -500); expect(getRelation(relations, 'a', 'b')).toBe(-100);
    expect(() => modifyRelation(relations, 'a', 'b', NaN)).toThrow();
  });
  it('génération stable et variée', () => {
    const students = createPrototype().students;
    expect(createInitialRelations(students, 42)).toEqual(createInitialRelations([...students].reverse(), 42));
    expect(createPersonality(42)).toEqual(createPersonality(42));
    expect(createPersonality(42)).not.toEqual(createPersonality(43));
    expect(validateSocial(students, createInitialRelations(students, 42))).toEqual([]);
  });
  it('les six traits ont des tendances distinctes', () => {
    const s = createPrototype(), student = s.students[0]!, target = createLessonStates(s.students, s.lesson)[1]!;
    target.concentration = 10; target.morale = 10;
    const weight = (personality = {}, action = 'SUPPORT') => behaviorCandidate({ ...student, personality }, target, action, 40).finalWeight;
    expect(weight({ altruistic: 1 })).toBeGreaterThan(weight());
    expect(weight({ sociable: 1 })).toBeGreaterThan(weight());
    expect(weight({ impulsive: 1 })).toBeGreaterThan(weight());
    expect(weight({ impulsive: 1 }, 'DISRUPT')).toBeGreaterThan(weight({}, 'DISRUPT'));
    expect(weight({ impulsive: 1, calm: 1 })).toBeLessThan(weight({ impulsive: 1 }));
    expect(weight({ competitive: 1 }, 'WORK')).toBeGreaterThan(weight({}, 'WORK'));
    expect(difficultyLoss({ ...student, personality: { persistent: 1 } }, 10)).toBe(5);
  });
  it('besoin et relation influencent les poids sans contourner la maîtrise', () => {
    const s = createPrototype(), actor = { ...s.students[0]!, personality: { altruistic: 1 } }, states = createLessonStates(s.students, s.lesson);
    const a = { ...states[1]!, concentration: 10 }, b = { ...states[2]!, concentration: 100 };
    const ca = behaviorCandidate(actor, a, 'SUPPORT', 70), cb = behaviorCandidate(actor, b, 'SUPPORT', 40);
    expect(ca.finalWeight).toBeGreaterThan(cb.finalWeight);
    expect(behaviorCandidate(actor, b, 'SUPPORT', -70).finalWeight).toBeLessThan(cb.finalWeight);
    expect(behaviorCandidate(actor, a, 'COMBINED_ATTACK', 100, 20, false).finalWeight).toBe(0);
    expect(weightedChoice([ca, cb], new SeededRandom(4))).toEqual(weightedChoice([ca, cb], new SeededRandom(4)));
  });
  it('sociabilité et impulsivité amplifient la gratitude, le calme la tempère', () => {
    const s = createPrototype().students[0]!;
    const growth = (personality = {}) => { const r = { links: [] }; evolveRelation(r, { ...s, personality }, 'other', 2, 'support', []); return getRelation(r, s.id, 'other'); };
    expect(growth({ sociable: 1 })).toBeGreaterThan(growth());
    expect(growth({ impulsive: 1 })).toBeGreaterThan(growth());
    expect(growth({ calm: 1 })).toBeLessThan(growth());
  });
});
