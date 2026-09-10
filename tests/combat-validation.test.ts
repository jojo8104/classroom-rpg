import { expect, it } from 'vitest';
import { createPrototype } from '../src/data/prototype.js';
import { Simulation } from '../src/engine/simulation.js';

it.each(['complexity', 'pressure', 'requiredProgress'] as const)('rejette %s non finie', key => {
  const scenario = createPrototype(); scenario.lesson[key] = NaN;
  expect(() => new Simulation(scenario, 1)).toThrow();
});
it('rejette une progression requise nulle', () => {
  const scenario = createPrototype(); scenario.lesson.requiredProgress = 0;
  expect(() => new Simulation(scenario, 1)).toThrow('Progression requise');
});
