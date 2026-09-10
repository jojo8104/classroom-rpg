import type { LessonResult, StudentLessonState } from './domain.js';

export type ActionKind = 'WORK' | 'SUPPORT' | 'RECOVER';
export type ActionLimitReason = 'maxActionsPerRound' | 'maxExtraActionsPerStudent' | 'maxChainDepth';

// Les événements conservent les valeurs au moment de l'effet, pas de références mutables.
export type ActionEvent =
  | { type: 'LESSON_RETALIATED'; studentId: string; damage: number }
  | { type: 'CONCENTRATION_CHANGED'; studentId: string; before: number; after: number; reason: 'pressure' | 'support' | 'recovery' }
  | { type: 'MORALE_CHANGED'; studentId: string; before: number; after: number }
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
  | { type: 'TEACHER_INTERVENTION_STARTED' }
  | { type: 'TEACHER_INTERVENTION_ENDED'; intervention: 'none' }
  | { type: 'CHAPTER_ENDED' }
  | { type: 'LESSON_ENDED'; results: LessonResult[] };

export type GameEventPayload = ActionEvent | LessonEvent;

export type GameEvent = GameEventPayload & {
  sequence: number;
  lessonId: string;
  chapterId: string;
  round: number;
};
