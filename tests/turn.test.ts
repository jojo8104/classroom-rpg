import { describe, expect, it } from 'vitest';
import { createPrototype } from '../src/data/prototype.js';
import { createActionRules } from '../src/data/rules.js';
import { createLessonStates } from '../src/engine/combat.js';
import { resolveWorkTurn, type WorkTurnContext } from '../src/engine/turn.js';
import { SeededRandom } from '../src/engine/random.js';

function fixture(): WorkTurnContext {
  const { students, lesson } = createPrototype();
  const rules = createActionRules();
  rules.criticalChance = 0;
  return { student: students[0]!, state: createLessonStates(students, lesson)[0]!,
    chapterId: lesson.chapters[0]!.id, lesson, rules, random: new SeededRandom(42), events: [],
    changeConcentration(state, value) { state.concentration = value; } };
}

describe('Fenêtres du tour de travail', () => {
  it('suspend la progression puis les dégâts jusqu’à la résolution de leur fenêtre', () => {
    const context = fixture();
    const initialHP = context.state.concentration;
    const turn = resolveWorkTurn(context);
    expect(turn.next().value).toBe('BEFORE_STUDENT_ATTACK');
    expect(turn.next().value).toBe('DURING_STUDENT_ATTACK');
    expect(context.state.lessonUnderstanding).toBe(0);
    expect(turn.next().value).toBe('AFTER_STUDENT_ATTACK');
    expect(context.state.lessonUnderstanding).toBeGreaterThan(0);
    expect(context.state.concentration).toBe(initialHP);
    expect(turn.next().value).toBe('BEFORE_LESSON_ATTACK');
    expect(turn.next().value).toBe('DURING_LESSON_ATTACK');
    expect(context.state.concentration).toBe(initialHP);
    expect(turn.next().value).toBe('AFTER_LESSON_ATTACK');
    expect(context.state.concentration).toBeLessThan(initialHP);
    expect(turn.next().done).toBe(true);
  });

  it.each(['critical', 'completion'] as const)('n’ouvre aucune fenêtre de riposte après %s', exemption => {
    const context = fixture();
    if (exemption === 'critical') context.rules.criticalChance = 1;
    else context.rules.workScale = 100;
    expect([...resolveWorkTurn(context)]).toEqual([
      'BEFORE_STUDENT_ATTACK', 'DURING_STUDENT_ATTACK', 'AFTER_STUDENT_ATTACK',
    ]);
    expect(context.events.some(event => event.type === 'LESSON_RETALIATED')).toBe(false);
  });

  it('un chapitre déjà acquis n’ouvre pas de fenêtre et ne consomme aucun tirage', () => {
    const context = fixture();
    context.state.chapters[0]!.progress = context.lesson.requiredProgress / context.lesson.chapters.length;
    expect([...resolveWorkTurn(context)]).toEqual([]);
    expect(context.events).toEqual([]);
    expect(context.random.next()).toBe(new SeededRandom(42).next());
  });
});
