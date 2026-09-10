import { createPrototype } from '../dist/data/prototype.js';
import { Simulation } from '../dist/engine/simulation.js';

for (const [profile, morale] of [['Démotivé', 10], ['Neutre', 50], ['Motivé', 90]]) {
  let progress = 0, dropouts = 0, resumed = 0;
  for (let seed = 0; seed < 200; seed++) {
    const scenario = createPrototype();
    scenario.students.forEach(student => { student.morale = morale; });
    const result = new Simulation(scenario, seed).runToCompletion();
    progress += result.results.reduce((sum, student) => sum + student.understanding, 0);
    dropouts += result.events.filter(event => event.type === 'STUDENT_DROPPED_OUT').length;
    resumed += result.events.filter(event => event.type === 'STUDENT_RESUMED').length;
  }
  console.log(JSON.stringify({ profile, morale, meanUnderstanding: +(progress / 1800).toFixed(2),
    dropoutsPerLesson: +(dropouts / 200).toFixed(2), resumptionsPerLesson: +(resumed / 200).toFixed(2) }));
}
