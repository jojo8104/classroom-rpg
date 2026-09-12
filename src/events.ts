import type { LessonResult, ReactionAbility, StudentLessonState, TeacherAction, TeacherActionKind, TeacherState, TemporaryEffect } from './domain.js';

export type ActionKind = 'WORK' | 'SUPPORT' | 'RECOVER' | 'DISRUPT';
export type ConcentrationReason = 'effort' | 'pressure' | 'support' | 'recovery' | 'disruption' | 'teacher';
export type ReactionWindow =
  | 'BEFORE_STUDENT_ATTACK' | 'DURING_STUDENT_ATTACK' | 'AFTER_STUDENT_ATTACK'
  | 'BEFORE_LESSON_ATTACK' | 'DURING_LESSON_ATTACK' | 'AFTER_LESSON_ATTACK';
export type ActionLimitReason = 'maxActionsPerRound' | 'maxExtraActionsPerStudent' | 'maxChainDepth';
export type ReactionLimitReason = 'maxActionsPerRound' | 'maxChainDepth' | 'maxReactionsPerStudent';

// Les événements conservent les valeurs au moment de l'effet, pas de références mutables.
export type ActionEvent =
  | ({ type: 'BEHAVIOR_CANDIDATE_CREATED' | 'BEHAVIOR_SELECTED' } & import('./engine/social.js').BehaviorCandidate)
  | { type: 'RELATION_CHANGED'; from: string; to: string; before: number; after: number; reason: string }
  | { type: 'MORALE_CHECK'; studentId: string; targetId: string; context: 'MAIN_ACTION' | ReactionWindow;
      kind: 'negative' | 'positive'; coefficient: number; chance: number; draw: number; success: boolean }
  | { type: 'BEHAVIOR_APPLIED'; studentId: string; effect: 'DISTRACTED'; multiplier: number }
  | { type: 'REACTION_EVALUATED'; sourceId: string; targetId: string; abilityId: string; window: ReactionWindow;
      reason: 'morale' | 'relation' | 'mastery' | 'noEffect' | 'eligible'; mastery: number; targetMastery: number; minimum: number; modifier: number }

  | { type: 'DISRUPTION_RESOLVED'; sourceId: string; targetId: string; power: number; afterAuthority: number; damage: number }
  | { type: 'REACTION_TRIGGERED'; sourceId: string; targetId: string; abilityId: string;
      window: ReactionWindow; effect: Exclude<ReactionAbility['effect'], 'COMBINED_ATTACK'>; relation: number; before: number; after: number }
  | { type: 'COMBINED_ATTACK_STARTED'; sourceId: string; targetId: string; abilityId: string; relation: number }
  | { type: 'COMBINED_ATTACK_RESOLVED'; sourceId: string; targetId: string;
      activeGain: number; partnerGain: number; synergyGain: number; potentialGain: number; appliedProgress: number }
  | { type: 'TEMPORARY_EFFECT_APPLIED'; effect: TemporaryEffect; refreshed: boolean }
  | { type: 'TEMPORARY_EFFECT_DECREMENTED'; effect: TemporaryEffect }
  | { type: 'TEMPORARY_EFFECT_EXPIRED'; effect: TemporaryEffect }
  | { type: 'REACTION_LIMIT_REACHED'; sourceId: string; targetId: string; reason: ReactionLimitReason }
  | { type: 'REACTION_WINDOW_OPENED'; studentId: string; window: ReactionWindow; extra: boolean }
  | { type: 'LESSON_RETALIATED'; studentId: string; damage: number }
  | { type: 'CONCENTRATION_CHANGED'; studentId: string; before: number; after: number; reason: ConcentrationReason }
  | { type: 'MORALE_CHANGED'; reason?: 'success' | 'retaliation' | 'dropout'; studentId: string; before: number; after: number }
  | { type: 'STUDENT_DROPPED_OUT'; studentId: string }
  | { type: 'STUDENT_RESUMED'; studentId: string }
  | { type: 'CRITICAL_HIT'; studentId: string }
  | { type: 'CHAPTER_PROGRESS_CHANGED'; studentId: string; chapterId: string; progress: number; missedRounds: number }
  | { type: 'STUDENT_ACTION'; actorId: string; actionId: ActionKind; targetId: string; extra: boolean }
  | { type: 'UNDERSTANDING_CHANGED'; studentId: string; before: number; after: number; amount: number }
  | { type: 'EFFECT_APPLIED'; sourceId: string; targetId: string; effectId: 'concentration_bonus'; before: number; after: number; amount: number }
  | { type: 'EXTRA_ACTION_CREATED'; studentId: string; depth: number }
  | { type: 'ACTION_LIMIT_REACHED'; studentId: string; reason: ActionLimitReason };

type LessonEvent =
  | { type: 'LESSON_STARTED'; seed: number }
  | { type: 'CHAPTER_STARTED' }
  | { type: 'ROUND_STARTED' }
  | { type: 'ROUND_ENDED'; students: StudentLessonState[] }
  | { type: 'TEACHER_INTERVENTION_STARTED'; teacher: TeacherState; actions: { kind: TeacherActionKind; cost: number }[] }
  | { type: 'TEACHER_ACTION_SELECTED'; action: TeacherAction }
  | { type: 'TEACHER_ACTION_APPLIED'; action: TeacherActionKind; targetIds: string[]; power: number }
  | { type: 'TEACHER_PATIENCE_CHANGED'; before: number; after: number }
  | { type: 'TEACHER_INTERVENTION_ENDED'; intervention: TeacherActionKind | 'none' }
  | { type: 'CHAPTER_ENDED' }
  | { type: 'LESSON_ENDED'; results: LessonResult[] };

export type GameEventPayload = ActionEvent | LessonEvent;

export type GameEvent = GameEventPayload & {
  sequence: number;
  lessonId: string;
  chapterId: string;
  round: number;
};
