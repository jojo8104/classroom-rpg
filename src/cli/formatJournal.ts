import type { PrototypeScenario } from '../domain.js';
import type { SimulationResult } from '../engine/simulation.js';

export function formatJournal(scenario: PrototypeScenario, result: SimulationResult): string {
  const names = new Map(scenario.students.map(student => [student.id, student.name]));
  const name = (id: string) => names.get(id) ?? id;
  const lines: string[] = [];
  for (const event of result.events) {
    switch (event.type) {
      case 'REACTION_TRIGGERED': lines.push(event.effect === 'REDUCE_PRESSURE'
        ? `  ${name(event.sourceId)} protège ${name(event.targetId)} : pression ${event.before} → ${event.after} (relation ${event.relation}/100)`
        : event.effect === 'REDUCE_COMPLEXITY'
        ? `  ${name(event.sourceId)} affaiblit la leçon pour ${name(event.targetId)} : complexité ${event.before} → ${event.after}, pour cette attaque`
        : `  ${name(event.sourceId)} soutient ${name(event.targetId)} (${event.abilityId}) : ${event.before} → ${event.after}`); break;
      case 'COMBINED_ATTACK_STARTED': lines.push(`  ATTAQUE COMBINÉE : ${name(event.targetId)} + ${name(event.sourceId)} (relation ${event.relation}/100)`); break;
      case 'COMBINED_ATTACK_RESOLVED': lines.push(`  contributions ${event.activeGain} + ${event.partnerGain}, synergie +${event.synergyGain} → potentiel ${event.potentialGain}, progression appliquée ${event.appliedProgress} pour ${name(event.targetId)}`); break;
      case 'REACTION_LIMIT_REACHED': lines.push(`  réaction indisponible : ${name(event.sourceId)} (${event.reason})`); break;
      case 'TEMPORARY_EFFECT_APPLIED': lines.push(`  ${name(event.effect.targetId)} : ${event.effect.stat} +${event.effect.value}, ${event.effect.remainingRounds} round(s)${event.refreshed ? ' · renouvelé' : ''}`); break;
      case 'TEMPORARY_EFFECT_DECREMENTED': lines.push(`  ${name(event.effect.targetId)} : ${event.effect.stat}, durée restante ${event.effect.remainingRounds}`); break;
      case 'TEMPORARY_EFFECT_EXPIRED': lines.push(`  ${name(event.effect.targetId)} : bonus de ${event.effect.stat} expiré`); break;
      case 'REACTION_WINDOW_OPENED': lines.push(`  fenêtre : ${event.window}`); break;
      case 'LESSON_STARTED': lines.push(`LEÇON : ${scenario.lesson.name}`, `Seed : ${event.seed}`); break;
      case 'LESSON_RETALIATED': lines.push(`  pression → ${name(event.studentId)} : dégâts ${event.damage}`); break;
      case 'CONCENTRATION_CHANGED': lines.push(`  concentration : ${event.before} → ${event.after} (${event.reason})`); break;
      case 'MORALE_CHANGED': lines.push(`  moral : ${event.before} → ${event.after}`); break;
      case 'STUDENT_DROPPED_OUT': lines.push(`  ${name(event.studentId)} décroche`); break;
      case 'STUDENT_RESUMED': lines.push(`  ${name(event.studentId)} peut reprendre`); break;
      case 'CRITICAL_HIT': lines.push('  critique : pas de riposte'); break;
      case 'CHAPTER_PROGRESS_CHANGED': lines.push(`  chapitre ${event.chapterId} : ${event.progress} points, ${event.missedRounds} étape(s) manquée(s)`); break;
      case 'CHAPTER_STARTED': lines.push(`\nCHAPITRE : ${scenario.lesson.chapters.find(c => c.id === event.chapterId)!.name}`); break;
      case 'ROUND_STARTED': lines.push(`\nROUND ${event.round}`); break;
      case 'STUDENT_ACTION': lines.push(`${name(event.actorId)} → ${event.actionId}${event.extra ? ' (action supplémentaire)' : ''} → ${name(event.targetId)}`); break;
      case 'UNDERSTANDING_CHANGED': lines.push(`  compréhension +${event.amount} : ${event.before} → ${event.after}`); break;
      case 'EFFECT_APPLIED': lines.push(`  ${name(event.targetId)} : concentration +${event.amount} : ${event.before} → ${event.after}`); break;
      case 'EXTRA_ACTION_CREATED': lines.push(`  action supplémentaire ajoutée : ${name(event.studentId)}`); break;
      case 'ACTION_LIMIT_REACHED': lines.push(`  action refusée : ${name(event.studentId)} (${event.reason})`); break;
      case 'ROUND_ENDED': lines.push('\nRÉSULTAT DU ROUND', ...event.students.map(s => `  ${name(s.studentId)} : ${s.lessonUnderstanding} %`)); break;
      case 'TEACHER_INTERVENTION_STARTED': lines.push('INTERVENTION DU PROFESSEUR'); break;
      case 'TEACHER_INTERVENTION_ENDED': lines.push('  aucune intervention'); break;
      case 'CHAPTER_ENDED': lines.push('FIN DU CHAPITRE'); break;
      case 'LESSON_ENDED': lines.push(`\nLEÇON TERMINÉE — ${scenario.lesson.name}`,
        ...event.results.flatMap(s => [`${name(s.studentId).padEnd(10)} ${s.understanding} % · HP ${s.concentration} · moral ${s.morale}`,
          ...s.chapters.map(c => `  ${c.chapterId} : ${c.progress} points, ${c.missedRounds} étape(s) manquée(s)`)])); break;
      default: { const exhaustive: never = event; throw new Error(`Événement inconnu : ${exhaustive}`); }
    }
  }
  lines.push('\nConcepts référencés :', ...scenario.lesson.conceptIds.map(id => `- ${id}`), `Seed : ${result.seed}`);
  return lines.join('\n');
}
