import type { ActionEvent, GameEventPayload } from '../events.js';
export type EventPriority = 'minor' | 'normal' | 'major';
export function eventPriority(event: GameEventPayload): EventPriority {
  if (['STUDENT_DROPPED_OUT','STUDENT_RESUMED','COMBINED_ATTACK_STARTED','LESSON_ENDED','LESSON_RESULTS','STUDENT_LEVEL_UP'].includes(event.type)) return 'major';
  if (['STUDENT_ACTION','REACTION_TRIGGERED','DISRUPTION_RESOLVED','ROUND_ENDED'].includes(event.type)) return 'normal';
  return 'minor';
}
export interface DebugMetrics { ticks:number;mainActions:number;secondaryInteractions:number;positiveEffects:number;negativeEffects:number;maximumChain:number;maximumQueue:number;events:number;simulationMs:number;averageTickMs:number }
export function emptyDebugMetrics(): DebugMetrics { return {ticks:0,mainActions:0,secondaryInteractions:0,positiveEffects:0,negativeEffects:0,maximumChain:0,maximumQueue:0,events:0,simulationMs:0,averageTickMs:0}; }
export function recordTick(metrics: DebugMetrics,events: readonly ActionEvent[],queue:{maximumSize:number;maximumDepth:number},elapsed:number) {
  metrics.ticks++; metrics.events+=events.length; metrics.simulationMs+=elapsed; metrics.averageTickMs=metrics.simulationMs/metrics.ticks;
  metrics.maximumChain=Math.max(metrics.maximumChain,queue.maximumDepth); metrics.maximumQueue=Math.max(metrics.maximumQueue,queue.maximumSize);
  for(const event of events) {
    if(event.type==='STUDENT_ACTION' && !event.extra) metrics.mainActions++;
    if(event.type==='REACTION_TRIGGERED' || event.type==='COMBINED_ATTACK_RESOLVED' || event.type==='DISRUPTION_RESOLVED' || event.type==='EFFECT_APPLIED') metrics.secondaryInteractions++;
    if(event.type==='MORALE_CHANGED' || event.type==='CONCENTRATION_CHANGED' || event.type==='UNDERSTANDING_CHANGED') {
      if(event.after>event.before) metrics.positiveEffects++;
      if(event.after<event.before) metrics.negativeEffects++;
    }
  }
}
