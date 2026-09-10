import type { LessonResult, StudentLessonState } from './domain.js';

export type ActionKind = 'WORK' | 'SUPPORT';
export type ActionLimitReason = 'maxActionsPerRound' | 'maxExtraActionsPerStudent' | 'maxChainDepth';

// Les événements conservent les valeurs au moment de l'effet, pas de références mutables.
export type ActionEvent =
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
