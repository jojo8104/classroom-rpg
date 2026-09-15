import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClassroomProjection } from '../src/rendering/ClassroomProjection.js';
import { DepthManager } from '../src/rendering/DepthManager.js';
import { SpriteController, getStudentOrientation, type SpriteState } from '../src/rendering/SpriteController.js';
import { createFullClassPrototype } from '../src/data/fullClassPrototype.js';
import { createClassroomActionRules } from '../src/data/rules.js';
import { Simulation } from '../src/engine/simulation.js';
import { ClassroomLayoutSystem } from '../src/systems/ClassroomLayoutSystem.js';
import { progressTier } from '../src/rendering/StudentDesk.js';
import { visualEvents } from '../src/ui/eventPlayback.js';

afterEach(() => vi.useRealTimers());
describe('Roadmap 8: projection and visual lifecycle', () => {
  it('contains 25 desks with increasing depth and converging columns', () => {
    const projection = new ClassroomProjection();
    const positions = [];
    for (let row = 0; row < 5; row++) for (let column = 0; column < 5; column++) {
      const p = projection.project(row, column); positions.push(p);
      expect(p.x - 115 * p.scale).toBeGreaterThan(0);
      expect(p.x + 115 * p.scale).toBeLessThan(1600);
      expect(p.y - 115 * p.scale).toBeGreaterThan(180);
      expect(p.y + 75 * p.scale).toBeLessThan(900);
      if (row) {
        expect(p.y).toBeGreaterThan(projection.project(row - 1, column).y);
        expect(p.scale).toBeGreaterThan(projection.project(row - 1, column).scale);
        expect(DepthManager.local(row - 1, 'foreground')).toBeLessThan(DepthManager.local(row, 'shadow'));
      }
    }
    expect(new Set(positions.map(p => `${p.x}:${p.y}`)).size).toBe(25);
    expect(projection.project(0, 0).x).toBeGreaterThan(projection.project(4, 0).x);
    expect(() => projection.project(5, 0)).toThrow();
  });
  it('faces a neighbour at either edge and follows same-column interactions', () => {
    expect(getStudentOrientation({row:0,column:0}, 'help', {row:0,column:1})).toBe('right');
    expect(getStudentOrientation({row:4,column:4}, 'distract', {row:4,column:3})).toBe('left');
    expect(getStudentOrientation({row:2,column:2}, 'receiveBonus', {row:1,column:2})).toBe('back');
    expect(getStudentOrientation({row:2,column:2}, 'receiveMalus', {row:3,column:2})).toBe('front');
    expect(getStudentOrientation({row:2,column:2}, 'encourage')).toBe('front');
    expect(getStudentOrientation({row:2,column:2}, 'attackLesson')).toBe('back');
    expect(getStudentOrientation({row:0,column:0}, 'understand')).toBe('front-right');
    expect(getStudentOrientation({row:4,column:4}, 'understand')).toBe('front-left');
  });
  it('reprojects moved and empty seats without writing screen coordinates into the plan', () => {
    const scenario = createFullClassPrototype();
    const system = new ClassroomLayoutSystem(scenario.classroom.currentLayout!);
    const projection = new ClassroomProjection();
    const old = system.getStudentSeat('student-1')!;
    system.swapStudents('student-1', 'student-25');
    const moved = system.getStudentSeat('student-1')!;
    expect(projection.project(moved.row, moved.column)).not.toEqual(projection.project(old.row, old.column));
    expect(getStudentOrientation(moved, 'idle')).toBe('back');
    expect(moved).not.toHaveProperty('x'); expect(moved).not.toHaveProperty('scale');
  });
  it('returns to rest, handles interruption and stops all timers when inactive', () => {
    vi.useFakeTimers(); const updates: SpriteState[] = [];
    const controller = new SpriteController((_id, state) => updates.push({...state}));
    expect(vi.getTimerCount()).toBe(0);
    controller.setRest('a', 'back');
    controller.play('a', { animation:'help', direction:'left', duration:700 });
    vi.advanceTimersByTime(300);
    controller.play('a', { animation:'distract', direction:'right', duration:150 });
    vi.advanceTimersByTime(200);
    expect(updates.at(-1)).toEqual({animation:'idle',direction:'back',frame:0});
    expect(controller.activeCount).toBe(0); expect(vi.getTimerCount()).toBe(0);
    controller.destroy();
  });
  it('pauses without consuming timers and resumes frame sheets correctly', () => {
    vi.useFakeTimers(); const states: SpriteState[] = [];
    const controller = new SpriteController((_id,s) => states.push({...s}), {id:'test',frameWidth:128,frameHeight:192,directions:['back'],animations:{work:6}});
    controller.play('a', {animation:'work',direction:'back',duration:600});
    vi.advanceTimersByTime(240); expect(states.at(-1)!.frame).toBe(2);
    controller.pause(); expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(10000); expect(controller.activeCount).toBe(1);
    controller.resume(); vi.advanceTimersByTime(1000);
    expect(controller.activeCount).toBe(0); expect(vi.getTimerCount()).toBe(0);
    controller.destroy();
  });
  it('keeps the five visual tiers bounded', () => {
    expect([-5,0,24,25,49,50,74,75,99,100,105].map(progressTier)).toEqual([0,0,0,1,1,2,2,3,3,4,4]);
  });
  it('shows real interactions in compact mode and always includes final settlement', () => {
    const result = new Simulation(createFullClassPrototype(), 12345, createClassroomActionRules(25)).runToCompletion();
    const firstRound = result.events.filter(e => e.round === 1 && e.type !== 'LESSON_STARTED');
    expect(visualEvents(firstRound, 'compact').some(e => ['REACTION_TRIGGERED','EFFECT_APPLIED'].includes(e.type))).toBe(true);
    expect(visualEvents(result.events, 'compact').some(e => e.type === 'LESSON_RESULTS')).toBe(true);
  });
  it('plays a complete 25-student lesson at all speeds without modifying events or simulation results', () => {
    vi.useFakeTimers();
    const scenario = createFullClassPrototype(); const input = structuredClone(scenario);
    const result = new Simulation(scenario, 12345, createClassroomActionRules(25)).runToCompletion();
    const baseline = structuredClone(result);
    for (const speed of ['compact','detailed','instant'] as const) {
      const controller = new SpriteController(() => {});
      for (const event of visualEvents(result.events, speed)) {
        if (event.type === 'STUDENT_ACTION') controller.play(event.actorId, {animation:'work',direction:'back',duration:700});
      }
      vi.runAllTimers(); expect(controller.activeCount).toBe(0); controller.destroy();
    }
    expect(result).toEqual(baseline); expect(scenario).toEqual(input);
    expect(result.results).toHaveLength(25);
    expect(new Simulation(scenario, 12345, createClassroomActionRules(25)).runToCompletion()).toEqual(result);
  });
});
