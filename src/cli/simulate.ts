import { createPrototype } from '../data/prototype.js';
import { Simulation } from '../engine/simulation.js';
import { formatJournal } from './formatJournal.js';

try {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args[0] !== undefined && !/^\d+$/.test(args[0]))) {
    throw new Error('Usage : npm run simulate -- [seed entière entre 0 et 4294967295]');
  }
  const seed = args[0] === undefined ? 12345 : Number(args[0]);
  const scenario = createPrototype();
  console.log(formatJournal(scenario, new Simulation(scenario, seed).runToCompletion()));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
