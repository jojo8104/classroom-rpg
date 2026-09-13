import type { PrototypeScenario, Student } from '../domain.js';
import { personalityLabels, personalityTraits } from '../engine/social.js';
import { knowledgeOf } from '../systems/PlacementEvaluationSystem.js';

export const tagLabels: Record<string, string> = { front: 'devant', middle: 'milieu', back: 'fond', left: 'gauche', center: 'centre', right: 'droite', near_window: 'fenêtre', near_door: 'porte' };
export const signed = (value: number) => `${value > 0 ? '+' : ''}${value}`;
export function paragraph(parent: HTMLElement, text: string, tag = 'p') {
  const item = document.createElement(tag); item.textContent = text; parent.append(item); return item;
}
export function renderStudentCard(root: HTMLElement, student: Student, scenario: PrototypeScenario) {
  root.replaceChildren();
  paragraph(root, student.name, 'h2');
  paragraph(root, scenario.archetypes.find(a => a.id === student.archetypeId)?.name ?? student.archetypeId);
  paragraph(root, personalityTraits.filter(t => (student.personality?.[t] ?? 0) >= 0.5).map(t => personalityLabels[t]).join(' · ') || 'Personnalité discrète');
  paragraph(root, `Moral ${student.morale} · Concentration ${student.concentration} · Discipline ${student.discipline}`);
  paragraph(root, 'Acquis utiles pour la leçon', 'h3');
  for (const conceptId of scenario.lesson.conceptIds) {
    const value = knowledgeOf(student, conceptId);
    paragraph(root, `${scenario.concepts.find(c => c.id === conceptId)?.name ?? conceptId} : ${value === null ? 'non évalué' : value + ' %'}`);
  }
  const preference = student.seatPreferences;
  paragraph(root, 'Aime : ' + (preference?.likes.map(t => tagLabels[t] ?? t).join(', ') || 'aucune préférence'));
  paragraph(root, 'Évite : ' + (preference?.dislikes.map(t => tagLabels[t] ?? t).join(', ') || 'aucune préférence'));
}
