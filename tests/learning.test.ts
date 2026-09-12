import { describe, it, expect } from 'vitest';
import { createPrototype } from '../src/data/prototype.js';
import { createActionRules } from '../src/data/rules.js';
import { createLearningRules } from '../src/data/learningRules.js';
import { createLessonStates } from '../src/engine/combat.js';
import { resolveWorkTurn, type WorkTurnContext } from '../src/engine/turn.js';
import { updateConcentration } from '../src/engine/resources.js';
import { SeededRandom } from '../src/engine/random.js';
import { Simulation } from '../src/engine/simulation.js';
function fixture(): WorkTurnContext {
  const s = createPrototype(); const rules = createActionRules(); rules.criticalChance = 0;
  const events: WorkTurnContext['events'] = [];
  return { student: s.students[0]!, state: createLessonStates(s.students, s.lesson)[0]!, lesson: s.lesson,
    chapterId: s.lesson.chapters[0]!.id, rules, learningRules: createLearningRules(), events, random: new SeededRandom(1),
    changeConcentration(state, value, reason) { updateConcentration(state, value, reason, rules.dropoutMoraleLoss, events); } };
}
const run = (c: WorkTurnContext) => [...resolveWorkTurn(c)];
describe('Réussite, effort et moral', () => {
  it('récompense une progression et fait payer l’effort avant le soutien après attaque', () => {
    const c = fixture(); const turn = resolveWorkTurn(c);
    turn.next(); turn.next(); expect(turn.next().value).toBe('AFTER_STUDENT_ATTACK');
    expect(c.state.morale).toBe(66); expect(c.state.concentration).toBe(54);
    expect(c.events).toContainEqual({ type: 'MORALE_CHANGED', studentId: c.student.id, before: 65, after: 66, reason: 'success' });
  });
  it('ne récompense pas un travail sans progression mais lui applique l’effort', () => {
    const c = fixture(); c.rules.workScale = 0; c.lesson.pressure = 0; run(c);
    expect(c.state.morale).toBe(65); expect(c.state.concentration).toBe(54);
  });
  it('ne fait rien pour un chapitre déjà acquis', () => {
    const c = fixture(); c.state.chapters[0]!.progress = 50; run(c);
    expect(c.events).toEqual([]); expect(c.state.morale).toBe(65); expect(c.state.concentration).toBe(55);
  });
  it.each(['critical', 'completion'])('paie l’effort malgré l’exemption %s', exemption => {
    const c = fixture(); if (exemption === 'critical') c.rules.criticalChance = 1; else c.rules.workScale = 100;
    run(c); expect(c.state.morale).toBe(66); expect(c.state.concentration).toBe(54);
    expect(c.events.some(e => e.type === 'LESSON_RETALIATED')).toBe(false);
  });
  it('une riposte non nulle baisse le moral sans exiger un décrochage', () => {
    const c = fixture(); run(c);
    expect(c.state.concentration).toBeGreaterThan(0);
    const loss = c.events.find(e => e.type === 'MORALE_CHANGED' && e.reason === 'retaliation');
    expect(loss).toBeDefined(); if (loss?.type === 'MORALE_CHANGED') expect(loss.before - loss.after).toBeLessThanOrEqual(1);
  });
  it('une protection complète évite la perte de moral de riposte', () => {
    const c = fixture(); c.lesson.pressure = 0; run(c);
    expect(c.events.some(e => e.type === 'MORALE_CHANGED' && e.reason === 'retaliation')).toBe(false);
  });
  it('une protection partielle réduit aussi la perte de moral', () => {
    const c = fixture(); c.lesson.pressure = 10; run(c);
    const d = fixture(); d.lesson.pressure = 5; run(d);
    expect(d.state.morale).toBeGreaterThan(c.state.morale);
  });
  it('l’épuisement par effort provoque un seul décrochage et supprime la riposte', () => {
    const c = fixture(); c.state.concentration = 0.5; run(c);
    expect(c.state.concentration).toBe(0); expect(c.state.morale).toBe(58);
    expect(c.events.filter(e => e.type === 'STUDENT_DROPPED_OUT')).toHaveLength(1);
    expect(c.events.some(e => e.type === 'LESSON_RETALIATED')).toBe(false);
  });
  it('borne le moral et ne multiplie pas la récompense d’un combo', () => {
    const c = fixture(); c.state.morale = 99.8; c.lesson.pressure = 0;
    c.modifiers = { combined: { partner: { ...c.student, id: 'partner' }, synergyRatio: 0.2 } }; run(c);
    expect(c.state.morale).toBe(100);
    expect(c.events.filter(e => e.type === 'MORALE_CHANGED' && e.reason === 'success')).toHaveLength(1);
  });
  it('permet de désactiver chaque effet et valide les valeurs', () => {
    const c = fixture(); c.learningRules = { successMorale: 0, effortConcentration: 0, damageMoraleRatio: 0, maxRetaliationMoraleLoss: 0 }; run(c);
    expect(c.events.some(e => e.type === 'MORALE_CHANGED')).toBe(false);
    const s = createPrototype(); s.learningRules!.successMorale = NaN;
    expect(() => new Simulation(s, 1)).toThrow(/effort/);
  });
  it('conserve la récupération après décrochage et le déterminisme', () => {
    const s = createPrototype(); s.students.forEach(student => { student.concentration = 0; });
    const a = new Simulation(s, 1).runToCompletion(); const b = new Simulation(s, 1).runToCompletion();
    expect(a).toEqual(b); expect(a.events.some(e => e.type === 'STUDENT_RESUMED')).toBe(true);
    expect(a.results.some(r => r.understanding > 0)).toBe(true);
  });
});
