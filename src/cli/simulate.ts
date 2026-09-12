import { createSocialPrototype } from '../data/socialPrototype.js';
import { Simulation } from '../engine/simulation.js';
import { formatJournal } from './formatJournal.js';
import type { TeacherAction } from '../domain.js';

try {
  const input = process.argv.slice(2);
  const demo = input.includes('--teacher-demo');
  const args = input.filter(arg => arg !== '--teacher-demo');
  if (args.length > 1 || (args[0] !== undefined && !/^\d+$/.test(args[0]))) {
    throw new Error('Usage : npm run simulate -- [seed entière entre 0 et 4294967295] [--teacher-demo]');
  }
  const seed = args[0] === undefined ? 12345 : Number(args[0]);
  const scenario = createSocialPrototype();
  const decisions: TeacherAction[] = demo ? [
    { kind: 'REEXPLAIN', targetId: 'student-3' }, { kind: 'REFRAME', targetId: 'student-4' },
    { kind: 'ENCOURAGE', targetId: 'student-1' }, { kind: 'BREAK' }, { kind: 'PASS' }, { kind: 'PASS' },
  ] : [];
  console.log(formatJournal(scenario, new Simulation(scenario, seed).runToCompletion(decisions)));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
