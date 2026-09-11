import { describe, expect, it, vi } from 'vitest';
import { createPrototype } from '../src/data/prototype.js';
import { createActionRules } from '../src/data/rules.js';
import { createInteractionRules } from '../src/data/interactionRules.js';
import { chapterMastery, checkMorale, moraleChances } from '../src/engine/interactions.js';
import { createLessonStates, moraleMultiplier } from '../src/engine/combat.js';
import { resolveReactionWindow } from '../src/engine/reactions.js';
import { ActionQueue } from '../src/engine/actions.js';
import { SeededRandom } from '../src/engine/random.js';
import { resolveWorkTurn } from '../src/engine/turn.js';
import { Simulation } from '../src/engine/simulation.js';
import { formatJournal } from '../src/cli/formatJournal.js';
import type { ActionEvent } from '../src/events.js';
import type { ReactionAbility } from '../src/domain.js';
import type { AttackModifiers } from '../src/engine/turn.js';

const explain: ReactionAbility = { id: 'explain', window: 'BEFORE_STUDENT_ATTACK', minRelation: 40,
  effect: 'APPLY_TEMPORARY_EFFECT', stat: 'intelligence', value: 20, durationInRounds: 2 };
const social: ReactionAbility = { ...explain, id: 'social', stat: 'discipline' };
const combo: ReactionAbility = { id: 'combo', window: 'BEFORE_STUDENT_ATTACK', minRelation: 90,
  effect: 'COMBINED_ATTACK', synergy: 0.25 };
function reaction(ability = explain, mastery = 0, targetMastery = 0, morale = 100, relation = 100, draws = [0.99, 0], additional: ReactionAbility[] = []) {
  const s = createPrototype(); s.students = s.students.slice(0, 2);
  s.students[0]!.reactionIds = []; s.students[1]!.reactionIds = [ability.id, ...additional.map(a => a.id)];
  s.students[1]!.morale = morale;
  const states = createLessonStates(s.students, s.lesson);
  states[0]!.chapters[0]!.progress = targetMastery / 2; states[0]!.lessonUnderstanding = targetMastery / 2;
  states[1]!.chapters[0]!.progress = mastery / 2; states[1]!.lessonUnderstanding = mastery / 2;
  const events: ActionEvent[] = []; const modifiers: AttackModifiers = {};
  const random = new SeededRandom(1); let index = 0;
  vi.spyOn(random, 'next').mockImplementation(() => draws[index++ % draws.length]!);
  const rules = createActionRules(); const lesson = structuredClone(s.lesson);
  resolveReactionWindow({ window: ability.window, target: s.students[0]!, students: s.students,
    states: new Map(states.map(s => [s.studentId, s])), resting: new Set(),
    setup: { classroom: s.classroom, archetypes: s.archetypes, abilities: [ability, ...additional],
      relations: [{ studentIds: ['student-1', 'student-2'], value: relation }], interactionRules: createInteractionRules() },
    lesson, rules, queue: new ActionQueue(rules), depth: 1, events, resolvedEffects: new Set(),
    attackSucceeded: true, modifiers, behavior: { chapterId: s.lesson.chapters[0]!.id, random } });
  return { events, states, modifiers, lesson };
}
describe('Maîtrise et moral — point 35 ter', () => {
  it.each([[1.2, 0, 0.4], [1, 0.2, 0.2], [0.8, 0.4, 0], [0.5, 0.7, 0], [0.2, 1, 0], [1.8, 0, 1], [-10, 1, 0], [10, 0, 1]])('moral %s : probabilités exactes', (morale, negative, positive) => {
    expect(moraleChances(morale)).toEqual({ negative, positive });
  });
  it('conserve la conversion historique et refuse un moral non fini', () => {
    expect(moraleMultiplier(50)).toBe(1); expect(() => moraleChances(NaN)).toThrow();
  });
  it.each([[0.1, 0.1, true, true], [0.9, 0.1, false, true], [0.1, 0.9, true, false], [0.9, 0.9, false, false]])('deux tirages indépendants : %s / %s', (first, second, negative, positive) => {
    const next = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const events: ActionEvent[] = [];
    expect(checkMorale('a', 50, { next }, createInteractionRules(), events, 'MAIN_ACTION', 'a')).toEqual({ negative, positive });
    expect(next).toHaveBeenCalledTimes(2); expect(events).toHaveLength(2);
  });
  it('consomme deux tirages même aux bornes et reproduit les résultats', () => {
    const events = () => { const out: ActionEvent[] = []; checkMorale('a', 100, new SeededRandom(5), createInteractionRules(), out, 'MAIN_ACTION', 'a'); return out; };
    expect(events()).toEqual(events()); expect(events()).toHaveLength(2);
  });
  it('autorise un soutien social sans maîtrise', () => {
    expect(reaction(social).events.some(e => e.type === 'REACTION_TRIGGERED')).toBe(true);
  });
  it('refuse une explication sans maîtrise malgré un excellent moral et une excellente relation', () => {
    const result = reaction();
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'REACTION_EVALUATED', reason: 'mastery', minimum: 20 }));
    expect(result.events.some(e => e.type === 'REACTION_TRIGGERED')).toBe(false);
  });
  it('augmente la puissance pédagogique avec la maîtrise', () => {
    expect(reaction(explain, 20).states[0]!.effects[0]!.value).toBe(4);
    expect(reaction(explain, 80).states[0]!.effects[0]!.value).toBe(16);
  });
  it('une bonne maîtrise ne contourne pas le moral ou la relation', () => {
    expect(reaction(explain, 100, 0, 0).events).toContainEqual(expect.objectContaining({ type: 'REACTION_EVALUATED', reason: 'morale' }));
    expect(reaction(explain, 100, 0, 100, 10).events).toContainEqual(expect.objectContaining({ type: 'REACTION_EVALUATED', reason: 'relation' }));
  });
  it('les deux checks réussis affaiblissent une aide sans la supprimer', () => {
    const result = reaction(social, 0, 0, 50, 100, [0.1, 0.1]);
    expect(result.events.filter(e => e.type === 'MORALE_CHECK' && e.success)).toHaveLength(2);
    expect(result.states[0]!.effects[0]!.value).toBe(15);
  });
  it.each([[100, 0], [0, 100], [59, 100]])('combo refusé avec maîtrises %s et %s', (source, target) => {
    expect(reaction(combo, source, target).modifiers.combined).toBeUndefined();
  });
  it('le combo exige aussi relation et moral puis module la synergie', () => {
    expect(reaction(combo, 100, 100, 100, 89).modifiers.combined).toBeUndefined();
    expect(reaction(combo, 100, 100, 0).modifiers.combined).toBeUndefined();
    expect(reaction(combo, 60, 80).modifiers.combined).toMatchObject({ synergyRatio: 0.15 });
    expect(reaction(combo, 100, 100).modifiers.combined).toMatchObject({ synergyRatio: 0.25 });
  });
  it('même au seuil de maîtrise, un combo garde une synergie supérieure à la somme des contributions', () => {
    const result = reaction(combo, 60, 60);
    const s = createPrototype(); const rules = createActionRules(); rules.workScale = 0.1;
    const events: ActionEvent[] = [];
    const turn = resolveWorkTurn({ student: s.students[0]!, state: result.states[0]!, lesson: s.lesson,
      chapterId: s.lesson.chapters[0]!.id, rules, random: new SeededRandom(1), events,
      changeConcentration: () => {}, modifiers: result.modifiers });
    for (const _window of turn) { /* Résolution sans réactions supplémentaires. */ }
    const resolved = events.find(e => e.type === 'COMBINED_ATTACK_RESOLVED');
    if (resolved?.type !== 'COMBINED_ATTACK_RESOLVED') throw new Error('Combo attendu');
    expect(resolved.potentialGain).toBeGreaterThan(resolved.activeGain + resolved.partnerGain);
    expect(resolved.synergyGain).toBeGreaterThan(0);
  });
  it('utilise les acquis locaux et non ceux du chapitre précédent', () => {
    const s = createPrototype(); const state = createLessonStates(s.students, s.lesson)[0]!;
    state.chapters[0]!.progress = 50; state.lessonUnderstanding = 50;
    expect(chapterMastery(state, s.lesson, s.lesson.chapters[0]!.id)).toBe(100);
    expect(chapterMastery(state, s.lesson, s.lesson.chapters[1]!.id)).toBe(0);
  });
  it('permet une exigence propre à une capacité et la valide', () => {
    expect(reaction({ ...explain, mastery: { minimum: 70, scalesPower: true } }, 60).states[0]!.effects).toHaveLength(0);
    const s = createPrototype(); s.reactionAbilities![0]!.mastery = { minimum: -1, scalesPower: true };
    expect(() => new Simulation(s, 1)).toThrow(/Maîtrise/);
    s.reactionAbilities![0]!.mastery.minimum = 0; s.interactionRules!.comboMinimum = NaN;
    expect(() => new Simulation(s, 1)).toThrow(/maîtrise/);
  });
  it('effectue les checks propres au candidat à la réaction', () => {
    expect(reaction(social).events.filter(e => e.type === 'MORALE_CHECK')).toEqual([
      expect.objectContaining({ studentId: 'student-2', targetId: 'student-1', context: 'BEFORE_STUDENT_ATTACK', kind: 'negative' }),
      expect.objectContaining({ studentId: 'student-2', targetId: 'student-1', context: 'BEFORE_STUDENT_ATTACK', kind: 'positive' }),
    ]);
  });
  it('reproduit la leçon indépendamment de l’ordre des données et documente les checks', () => {
    const s = createPrototype(); const a = new Simulation(s, 12345).runToCompletion();
    s.students.reverse(); s.reactionAbilities!.reverse(); s.relations!.reverse();
    const b = new Simulation(s, 12345).runToCompletion();
    expect(b).toEqual(a);
    expect(a.events.filter(e => e.type === 'MORALE_CHECK' && e.context === 'MAIN_ACTION')).toHaveLength(9 * 6 * 2);
    const journal = formatJournal(s, a); expect(journal).toContain('check positive'); expect(journal).toContain('maîtrise');
  });
  it('tire une seule paire par candidat et fenêtre même avec plusieurs capacités', () => {
    const result = reaction(explain, 0, 0, 100, 100, [0.99, 0], [social]);
    expect(result.events.filter(e => e.type === 'MORALE_CHECK')).toHaveLength(2);
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'REACTION_TRIGGERED', abilityId: 'social' }));
  });
  it('un combo verrouillé ne supprime pas la réduction simple accessible', () => {
    const weaken: ReactionAbility = { id: 'weaken', window: 'BEFORE_STUDENT_ATTACK', minRelation: 40,
      effect: 'REDUCE_COMPLEXITY', reduction: 0.4, maxReduction: 0.6 };
    const result = reaction(weaken, 40, 80, 100, 100, [0.99, 0], [combo]);
    expect(result.modifiers.combined).toBeUndefined();
    expect(result.lesson.complexity).toBeLessThan(50);
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'REACTION_TRIGGERED', abilityId: 'weaken' }));
    const powerful = reaction(weaken, 80, 80);
    expect(powerful.lesson.complexity).toBeLessThan(result.lesson.complexity);
  });
  it('un combo accessible remplace la réduction et les capacités partagent le même budget', () => {
    const weaken: ReactionAbility = { id: 'weaken', window: 'BEFORE_STUDENT_ATTACK', minRelation: 40,
      effect: 'REDUCE_COMPLEXITY', reduction: 0.4, maxReduction: 0.6 };
    const result = reaction(weaken, 80, 80, 100, 100, [0.99, 0], [combo]);
    expect(result.modifiers.combined).toBeDefined();
    expect(result.events.filter(e => e.type === 'REACTION_TRIGGERED')).toHaveLength(0);
    expect(result.events.filter(e => e.type === 'COMBINED_ATTACK_STARTED')).toHaveLength(1);
  });
  it('le soutien principal respecte le voisinage et la relation', () => {
    const s = createPrototype(); s.students.forEach(student => { student.morale = 100; student.reactionIds = []; });
    const rules = createActionRules(); rules.supportChanceByArchetype = { offensive: 1, defensive: 1, support: 1 };
    const events = new Simulation(s, 1, rules).resolveRound();
    const supports = events.filter(e => e.type === 'STUDENT_ACTION' && e.actionId === 'SUPPORT');
    expect(supports.length).toBeGreaterThan(0);
    for (const e of supports) {
      if (e.type !== 'STUDENT_ACTION') continue;
      const source = s.students.find(s => s.id === e.actorId)!; const target = s.students.find(s => s.id === e.targetId)!;
      const a = s.classroom.seats.find(s => s.id === source.seatId)!; const b = s.classroom.seats.find(s => s.id === target.seatId)!;
      expect(Math.abs(a.row - b.row) + Math.abs(a.column - b.column)).toBe(1);
      expect(s.relations!.find(r => r.studentIds.includes(source.id) && r.studentIds.includes(target.id))!.value).toBeGreaterThanOrEqual(40);
    }
    s.relations = [];
    expect(new Simulation(s, 1, rules).resolveRound().some(e => e.type === 'STUDENT_ACTION' && e.actionId === 'SUPPORT')).toBe(false);
  });
  it('les réactions restent bornées et conservent les neuf tours principaux', () => {
    const s = createPrototype(); s.students.forEach(student => { student.morale = 100; });
    const rules = createActionRules(); rules.maxReactionsPerStudent = 0;
    const events = new Simulation(s, 1, rules).resolveRound();
    expect(events.filter(e => e.type === 'REACTION_TRIGGERED' || e.type === 'COMBINED_ATTACK_STARTED')).toHaveLength(0);
    expect(events.filter(e => e.type === 'STUDENT_ACTION' && !e.extra)).toHaveLength(9);
    expect(events.some(e => e.type === 'REACTION_LIMIT_REACHED')).toBe(true);
  });
  it('un moral très bas produit une distraction mais interdit le soutien positif', () => {
    const s = createPrototype(); s.students.forEach(student => { student.morale = 0; student.disruptionChance = 0; });
    const events = new Simulation(s, 1).resolveRound();
    expect(events.filter(e => e.type === 'BEHAVIOR_APPLIED')).toHaveLength(9);
    expect(events.some(e => e.type === 'STUDENT_ACTION' && e.actionId === 'SUPPORT')).toBe(false);
  });
});
