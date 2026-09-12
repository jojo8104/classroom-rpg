import { createPrototype } from './prototype.js';
import { createInitialRelations, createPersonality, modifyRelation } from '../engine/social.js';

// Le prototype historique reste disponible pour les tests des Roadmaps 1 et 2.
export function createSocialPrototype() {
  const scenario = createPrototype();
  scenario.students.forEach((student, index) => { student.personality = createPersonality(900 + index); });
  scenario.classRelations = createInitialRelations(scenario.students, 300);
  for (const { studentIds: [from, to], value } of scenario.relations ?? []) {
    const a = scenario.classRelations.links.find(link => link.from === from && link.to === to)!;
    const b = scenario.classRelations.links.find(link => link.from === to && link.to === from)!;
    modifyRelation(scenario.classRelations, from, to, value - a.score);
    modifyRelation(scenario.classRelations, to, from, Math.max(0, value - 20) - b.score);
  }
  delete scenario.relations;
  return scenario;
}
