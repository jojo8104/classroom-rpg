import type { GameEvent } from '../events.js';
import { eventPriority } from '../engine/diagnostics.js';
export type SimulationSpeed='compact' | 'detailed' | 'instant';
/** Les événements métier restent intacts ; seule leur présentation est agrégée. */
export function visualEvents(events: readonly GameEvent[],speed: SimulationSpeed): GameEvent[] {
  if(speed==='detailed') return [...events];
  if(speed==='instant') return events.filter(e=>e.type==='ROUND_ENDED' || e.type==='LESSON_RESULTS' || e.type==='LEARNING_OBSERVED');
  const important=events.filter(e=>((e.priority ?? eventPriority(e))==='major' && e.type!=='LESSON_ENDED') || ['REACTION_TRIGGERED','EFFECT_APPLIED','DISRUPTION_RESOLVED','TEACHER_ACTION_APPLIED'].includes(e.type));
  const snapshot=events.filter(e=>e.type==='ROUND_ENDED');
  // Au plus quatre faits saillants, puis l'état complet. Aucun effet métier n'est supprimé.
  // Settlement must not disappear behind XP/level-up highlights at the end of a lesson.
  const settlement: GameEvent[]=events.filter(e=>e.type==='LESSON_RESULTS' || e.type==='LEARNING_OBSERVED' || e.type==='concept_reactivated');
  return [...important.filter(e=>!settlement.includes(e)).slice(0,4),...snapshot,...settlement];
}
