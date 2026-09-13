import { createProgressionPrototype } from '../data/progressionPrototype.js';
import { abilities } from '../data/abilities.js';
import { progressionRules } from '../data/progressionRules.js';
import { Simulation } from './simulation.js';
import { createProgression, specializationTrends } from './progression.js';

// Scénario d'observation, sans campagne ni sauvegarde automatique.
export function runProgressionStudy(seed = 12345, lessons = 20) {
  const scenario = createProgressionPrototype();
  scenario.classroom.rows = 4;
  scenario.classroom.seats.push({ id: 'seat-10', row: 3, column: 0 });
  scenario.students.push({ ...structuredClone(scenario.students[2]!), id: 'student-10', name: 'Noé', seatId: 'seat-10', progression: createProgression('support') });
  scenario.classRelations!.links.push({ from: 'student-10', to: 'student-7', score: 70 }, { from: 'student-7', to: 'student-10', score: 65 });
  const history: { lesson: number; students: { id: string; xp: number; level: number; gained: number }[] }[] = [];
  const used: Record<string, number> = Object.fromEntries(abilities.map(a => [a.id, 0]));
  for (let lesson = 0; lesson < lessons; lesson++) {
    scenario.lesson.id = `study-${lesson + 1}`;
    const simulation = new Simulation(scenario, seed + lesson);
    let result = simulation.runToCompletion();
    // Décisions explicites du pilote de test ; le moteur ne choisit jamais seul.
    for (const student of result.nextLessonStudents) if (student.progression!.level >= progressionRules.specializationLevel && !student.progression!.specialization) {
      const proposed = specializationTrends(student).sort((a,b) => b.percent - a.percent || a.id.localeCompare(b.id))[0]!;
      simulation.chooseSpecialization(student.id, proposed.id);
    }
    result = simulation.getResult();
    for (const event of result.events) if (event.type === 'ABILITY_USED' && event.effective) used[event.abilityId] = (used[event.abilityId] ?? 0) + 1;
    history.push({ lesson: lesson + 1, students: result.nextLessonStudents.map(s => ({ id: s.id, xp: s.progression!.xp, level: s.progression!.level, gained: result.results.find(r => r.studentId === s.id)!.progression!.xpGained })) });
    scenario.students = result.nextLessonStudents;
    scenario.classRelations = result.classRelations!;
  }
  return { seed, lessons, history, students: scenario.students, relations: scenario.classRelations, used,
    unusedAbilities: abilities.filter(a => !used[a.id]).map(a => a.id),
    archetypes: scenario.archetypes.map(a => {
      const students = scenario.students.filter(s => s.archetypeId === a.id);
      return { id: a.id, meanXp: students.reduce((n,s) => n+s.progression!.xp, 0) / students.length, levels: students.map(s => s.progression!.level) };
    }) };
}
