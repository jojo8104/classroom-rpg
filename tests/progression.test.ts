import { describe, expect, it } from 'vitest';
import { createProgressionPrototype } from '../src/data/progressionPrototype.js';
import { abilities, specializations } from '../src/data/abilities.js';
import { getRequiredXpForLevel, levelForXp, progressionRules } from '../src/data/progressionRules.js';
import { createProgression, settleProgression, specializationTrends, selectSpecialization, validateProgression } from '../src/engine/progression.js';
import { AbilityUsage, effectiveAbility } from '../src/engine/abilities.js';
import { Simulation } from '../src/engine/simulation.js';
import { runProgressionStudy } from '../src/engine/progressionStudy.js';
import type { GameEvent, GameEventPayload } from '../src/events.js';
import { createLessonStates } from '../src/engine/combat.js';
import { resolveActionRound } from '../src/engine/actions.js';
import { createActionRules } from '../src/data/rules.js';
import { SeededRandom } from '../src/engine/random.js';

function events(payloads: GameEventPayload[]): GameEvent[] { return payloads.map((e,i) => ({ ...e, sequence: i+1, lessonId: 'test', chapterId: 'discover', round: 1 })); }
function support() { return createProgressionPrototype().students.find(s => s.archetypeId === 'support')!; }
function used(studentId: string, abilityId: string, effective = true): GameEventPayload { return { type: 'ABILITY_USED', studentId, targetId: 'student-1', abilityId, effective }; }

describe('Progression permanente', () => {
  it('récompense la participation même sans compréhension ni action réussie', () => {
    const s = support(), result = settleProgression(s, [], 0);
    expect(result.result.xpGained).toBe(progressionRules.rewards.participation);
    expect(result.result.rewards).toEqual({ participation: 5 });
  });
  it('compte les effets réels une fois et plafonne l’XP sans plafonner l’histoire d’usage', () => {
    const s = support();
    const history = events([used(s.id, 'motivate_neighbor', false), ...Array.from({ length: 10 }, () => used(s.id, 'motivate_neighbor')),
      { type: 'MORALE_CHANGED', studentId: s.id, before: 20, after: 30 }]);
    const result = settleProgression(s, history, 0).result;
    expect(result.xpGained).toBe(5 + 2 * 2);
    expect(result.usage.morale).toBe(10);
    expect(s.progression!.usage.morale).toBe(10);
  });
  it('centralise les seuils, franchit plusieurs niveaux et respecte le maximum', () => {
    expect(levelForXp(getRequiredXpForLevel(3) - 1)).toBe(2);
    expect(levelForXp(getRequiredXpForLevel(3))).toBe(3);
    expect(levelForXp(10000)).toBe(5);
    expect(() => getRequiredXpForLevel(6)).toThrow();
    expect(() => levelForXp(-1)).toThrow();
    const s = support();
    // Table raccourcie temporairement pour exercer un franchissement multiple réel.
    const saved = [...progressionRules.thresholds];
    try {
      progressionRules.thresholds = [0, 1, 2, 3, 4];
      const result = settleProgression(s, [], 0);
      expect(result.events.filter(e => e.type === 'STUDENT_LEVEL_UP')).toHaveLength(4);
      expect(s.progression!.level).toBe(5);
      expect(result.events.filter(e => e.type === 'ABILITY_UNLOCKED')).toHaveLength(3);
    } finally { progressionRules.thresholds = saved; }
  });
  it('diffère les niveaux au bilan et rend getResult idempotent avec des snapshots profonds', () => {
    const scenario = createProgressionPrototype();
    scenario.students.forEach(s => s.progression = createProgression(s.archetypeId, 19));
    const initial = structuredClone(scenario), sim = new Simulation(scenario, 42);
    sim.resolveRound();
    expect(sim.persistentStudents.every(s => s.progression!.level === 1)).toBe(true);
    const result = sim.runToCompletion();
    expect(result.nextLessonStudents.every(s => s.progression!.level >= 2)).toBe(true);
    expect(sim.getResult()).toEqual(result);
    result.nextLessonStudents[0]!.progression!.xp = 10000;
    expect(sim.getResult().nextLessonStudents[0]!.progression!.xp).not.toBe(10000);
    expect(scenario).toEqual(initial);
  });
  it('transmet XP et usage sans transmettre compréhension ni effets', () => {
    const scenario = createProgressionPrototype(), sim = new Simulation(scenario, 42), result = sim.runToCompletion();
    scenario.students = JSON.parse(JSON.stringify(result.nextLessonStudents));
    scenario.classRelations = result.classRelations!;
    const next = new Simulation(scenario, 43);
    expect(next.persistentStudents).toEqual(result.nextLessonStudents);
    expect(next.studentStates.every(s => s.lessonUnderstanding === 0 && s.effects.length === 0)).toBe(true);
    expect(result.events.filter(e => e.type === 'XP_GAINED')).toHaveLength(9);
  });
  it('valide niveau, XP, compétences et spécialisation', () => {
    const s = support(); expect(validateProgression(s)).toEqual([]);
    s.progression!.unlockedAbilities.push('combined_attack'); expect(validateProgression(s)).not.toEqual([]);
    s.progression = createProgression('support'); s.progression.level = 5; expect(validateProgression(s)).not.toEqual([]);
  });
});

function reactionFixture(level: number, mastery = 0, relation = 100) {
  const scenario = createProgressionPrototype();
  scenario.students = scenario.students.slice(0,2);
  const [target, source] = scenario.students;
  source!.archetypeId = 'offensive'; source!.progression = createProgression('offensive', getRequiredXpForLevel(level));
  target!.archetypeId = 'support'; target!.progression = createProgression('support');
  scenario.students.forEach(s => { s.morale = 100; s.concentration = 100; s.disruptionChance = 0; });
  scenario.classRelations = { links: [{ from: source!.id, to: target!.id, score: relation }, { from: target!.id, to: source!.id, score: relation }] };
  const states = createLessonStates(scenario.students, scenario.lesson);
  states.forEach(s => { s.chapters[0]!.progress = mastery / 2; s.lessonUnderstanding = mastery / 2; });
  const rules = createActionRules(); rules.criticalChance = 0;
  const run = () => resolveActionRound(scenario.students, states, new SeededRandom(42), rules, scenario.lesson, 'discover', {
    classroom: scenario.classroom, archetypes: scenario.archetypes, relations: [], classRelations: structuredClone(scenario.classRelations!),
    abilities: scenario.reactionAbilities!, interactionRules: scenario.interactionRules!, abilityUsage: new AbilityUsage(),
  });
  return { scenario, source: source!, states, run };
}
describe('Compétences dans le moteur existant', () => {
  it.each(abilities.filter(a => a.mode === 'REACTION'))('$name produit un effet réel dans sa fenêtre', a => {
    if (a.mode !== 'REACTION') throw new Error();
    const f = reactionFixture(5,80);
    f.source.archetypeId = a.archetype; f.source.progression = createProgression(a.archetype,140);
    f.scenario.archetypes.forEach(archetype => archetype.reactionIds = []);
    f.scenario.students[0]!.morale = 70;
    f.states[0]!.morale = 70;
    const rules = createActionRules(); rules.workScale = 0.1; rules.criticalChance = 0;
    const result = resolveActionRound(f.scenario.students, f.states, new SeededRandom(42), rules, f.scenario.lesson, 'discover', {
      classroom: f.scenario.classroom, archetypes: f.scenario.archetypes, relations: [], classRelations: f.scenario.classRelations!,
      abilities: [a.reaction], interactionRules: f.scenario.interactionRules!, abilityUsage: new AbilityUsage(),
    });
    expect(result.events.some(e => e.type === 'ABILITY_USED' && e.abilityId === a.id && e.effective)).toBe(true);
  });
  it('bloque un combo verrouillé même si maîtrise et relation suffisent', () => {
    const f = reactionFixture(1, 80);
    const result = f.run();
    expect(result.events.some(e => e.type === 'REACTION_EVALUATED' && e.abilityId === 'combined_attack' && e.reason === 'locked')).toBe(true);
    expect(result.events.some(e => e.type === 'COMBINED_ATTACK_STARTED')).toBe(false);
    expect(result.events.some(e => e.type === 'ABILITY_USED' && e.abilityId === 'weaken_lesson' && e.effective)).toBe(true);
  });
  it('un haut niveau ne remplace jamais la maîtrise', () => {
    const f = reactionFixture(5, 0), result = f.run();
    expect(result.events.some(e => e.type === 'REACTION_EVALUATED' && e.reason === 'mastery')).toBe(true);
    expect(result.events.some(e => e.type === 'ABILITY_USED' && e.studentId === f.source.id)).toBe(false);
    expect(f.source.progression!.unlockedAbilities).toContain('combined_attack');
  });
  it('la synergie garde son seuil strict même avec altruisme', () => {
    const f = reactionFixture(5, 80, 89); f.source.personality = { altruistic: 1 };
    expect(f.run().events.some(e => e.type === 'COMBINED_ATTACK_STARTED')).toBe(false);
  });
  it('la personnalité peut assouplir une relation sociale sans débloquer une compétence', () => {
    const f = reactionFixture(1, 80, 20);
    f.source.personality = {};
    expect(f.run().events.some(e => e.type === 'ABILITY_USED' && e.studentId === f.source.id)).toBe(false);
    f.source.personality = { altruistic: 1 };
    expect(f.run().events.some(e => e.type === 'ABILITY_USED' && e.studentId === f.source.id)).toBe(true);
    expect(f.run().events.some(e => e.type === 'COMBINED_ATTACK_STARTED')).toBe(false);
  });
  it('limite les utilisations par round et par leçon puis réinitialise à la leçon suivante', () => {
    const s = support(), usage = new AbilityUsage();
    expect(usage.reason(s, 'SUPPORT')).toBe('locked');
    const a = abilities.find(a => a.id === 'motivate_neighbor')!;
    for (let i=0;i<a.perLesson;i++) {
      usage.startRound(); expect(usage.reason(s,a.id)).toBeUndefined(); usage.consume(s,a.id);
      expect(usage.reason(s,a.id)).toBe('abilityLimit');
    }
    usage.startRound(); expect(usage.reason(s,a.id)).toBe('abilityLimit');
    expect(new AbilityUsage().reason(s,a.id)).toBeUndefined();
  });
  it('refuse les compétences RPG sans garde de maîtrise', () => {
    const f = reactionFixture(5,0); delete f.scenario.interactionRules;
    expect(() => new Simulation(f.scenario,42)).toThrow();
  });
  it('reproduit le bilan si les collections entrantes sont réordonnées', () => {
    const scenario = createProgressionPrototype();
    scenario.students.forEach(s => s.progression = createProgression(s.archetypeId,90));
    const before = new Simulation(scenario,42).runToCompletion();
    scenario.students.reverse(); scenario.archetypes.reverse(); scenario.classRelations!.links.reverse(); scenario.reactionAbilities!.reverse();
    const after = new Simulation(scenario,42).runToCompletion();
    expect(after.results).toEqual(before.results); expect(after.events).toEqual(before.events);
  });
});

describe('Spécialisations', () => {
  it('propose deux branches par archétype et distingue usage social et pédagogique', () => {
    const s = support();
    expect(specializationTrends(s).map(t => t.percent)).toEqual([50,50]);
    s.progression!.usage.morale = 3; s.progression!.usage.pedagogy = 1;
    expect(specializationTrends(s).map(t => t.percent)).toEqual([75,25]);
    for (const archetype of ['support','offensive','defensive']) expect(specializations.filter(s => s.archetype === archetype)).toHaveLength(2);
  });
  it('annonce la disponibilité, persiste le choix et refuse le choix prématuré ou étranger', () => {
    const s = support(); expect(() => selectSpecialization(s,'motivator')).toThrow();
    s.progression = createProgression('support',139);
    expect(settleProgression(s,[],0).events.some(e => e.type === 'SPECIALIZATION_AVAILABLE')).toBe(true);
    expect(() => selectSpecialization(s,'analyst')).toThrow();
    selectSpecialization(s,'motivator'); expect(JSON.parse(JSON.stringify(s)).progression.specialization).toBe('motivator');
    expect(() => selectSpecialization(s,'educator')).toThrow();
    expect(s.progression.unlockedAbilities).toContain('explain_neighbor');
  });
  it.each(specializations)('$name modifie réellement un effet ciblé sans augmenter les statistiques de base', branch => {
    const s = support(); s.archetypeId = branch.archetype; s.progression = createProgression(branch.archetype,140);
    const before = structuredClone(s); selectSpecialization(s,branch.id);
    const a = abilities.find(a => a.archetype === branch.archetype && a.mode === 'REACTION' && (branch.usage as readonly string[]).includes(a.usage))!;
    if (a.mode !== 'REACTION') throw new Error();
    expect(effectiveAbility(s,a.reaction)).not.toEqual(a.reaction);
    expect(s.intelligence).toBe(before.intelligence); expect(s.discipline).toBe(before.discipline);
    expect(s.progression.unlockedAbilities).toEqual(before.progression!.unlockedAbilities);
  });
  it('choix explicite dans Simulation, résultat relisible et reproductible', () => {
    const run = () => {
      const s = createProgressionPrototype(); s.students.forEach(st => st.progression = createProgression(st.archetypeId,140));
      const sim = new Simulation(s,42);
      expect(() => sim.chooseSpecialization('student-3','motivator')).toThrow();
      sim.runToCompletion(); sim.chooseSpecialization('student-3','motivator'); return sim.getResult();
    };
    expect(run()).toEqual(run());
  });
});
it('observe 10 élèves sur 20 leçons et reproduit XP, compétences, usage, relations et choix', () => {
  const a = runProgressionStudy(12345,20), b = runProgressionStudy(12345,20);
  expect(a).toEqual(b); expect(a.students).toHaveLength(10);
  expect(a.students.every(s => s.progression!.xp >= 100 && s.progression!.level <= 5)).toBe(true);
  for (let i=1;i<a.history.length;i++) for (const s of a.history[i]!.students) expect(s.xp).toBeGreaterThan(a.history[i-1]!.students.find(x => x.id === s.id)!.xp);
}, 60000);
