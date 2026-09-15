import { estimateMastery } from '../systems/LearningMemory.js';
import { personalityLabels, personalityTraits } from '../engine/social.js';
import { knowledgeOf } from '../systems/PlacementEvaluationSystem.js';
export const tagLabels = { front: 'devant', middle: 'milieu', back: 'fond', left: 'gauche', center: 'centre', right: 'droite', near_window: 'fenêtre', near_door: 'porte' };
export const signed = (value) => `${value > 0 ? '+' : ''}${value}`;
export function paragraph(parent, text, tag = 'p') {
    const item = document.createElement(tag);
    item.textContent = text;
    parent.append(item);
    return item;
}
export function renderStudentCard(root, student, scenario) {
    root.replaceChildren();
    paragraph(root, student.name, 'h2');
    paragraph(root, scenario.archetypes.find(a => a.id === student.archetypeId)?.name ?? student.archetypeId);
    paragraph(root, personalityTraits.filter(t => (student.personality?.[t] ?? 0) >= 0.5).map(t => personalityLabels[t]).join(' · ') || 'Personnalité discrète');
    paragraph(root, `Moral ${student.morale} · Concentration ${student.concentration} · Discipline ${student.discipline}`);
    paragraph(root, estimateMastery(student, scenario.lesson.id, scenario.teacher, scenario.activity?.day).label, 'h3');
    for (const conceptId of scenario.lesson.conceptIds) {
        const value = knowledgeOf(student, conceptId);
        paragraph(root, `${scenario.concepts.find(c => c.id === conceptId)?.name ?? conceptId} : ${value === null ? 'non évalué' : value < 35 ? 'fragiles' : value < 70 ? 'en consolidation' : 'solides'}`);
    }
    paragraph(root, 'Concepts découverts', 'h3');
    paragraph(root, student.concepts?.acquired.map(id => scenario.concepts.find(c => c.id === id)?.name ?? id).join(', ') || 'Aucun pour le moment');
    const preference = student.seatPreferences;
    paragraph(root, 'Aime : ' + (preference?.likes.map(t => tagLabels[t] ?? t).join(', ') || 'aucune préférence'));
    paragraph(root, 'Évite : ' + (preference?.dislikes.map(t => tagLabels[t] ?? t).join(', ') || 'aucune préférence'));
}
