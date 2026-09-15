// Les définitions persistantes sont séparées de l'état temporaire d'une séance.
export interface Student {
  learningMemory?: Record<string, import('./systems/LearningMemory.js').LearningMemory>;
  recentSessionTypes?: SessionType[];
  /** Maîtrise persistante par ID de leçon ; absente dans les anciennes sauvegardes. */
  lessonMastery?: Record<string, number>;
  concepts?: { acquired: string[]; progress: Record<string, number> };
  progression?: import('./engine/progression.js').StudentProgression;
  personality?: PersonalityProfile;
  id: string;
  name: string;
  intelligence: number;
  discipline: number;
  concentration: number;
  morale: number;
  archetypeId: string;
  /** Anciennes sauvegardes uniquement ; le layout est la source de vérité. */
  seatId?: string | undefined;
  present?: boolean;
  seatPreferences?: { likes: string[]; dislikes: string[] };
  knowledge?: Record<string, number>;
  reactionIds?: string[];
  disruptionChance?: number;
}

export type PersonalityTrait = 'altruistic' | 'competitive' | 'persistent' | 'impulsive' | 'calm' | 'sociable';
export type PersonalityProfile = Partial<Record<PersonalityTrait, number>>;
export interface DirectedRelation { from: string; to: string; score: number }
export interface ClassRelations { links: DirectedRelation[] }

export interface StudentArchetype {
  id: string;
  name: string;
  reactionIds?: string[];
}

// Relations réciproques fixes : une seule entrée par paire, échelle 0–100.
export interface StudentRelation {
  studentIds: [string, string];
  value: number;
}

interface ReactionAbilityBase {
  mastery?: { minimum: number; scalesPower: boolean };
  id: string;
  window: import('./events.js').ReactionWindow;
  minRelation: number;
}

export type ReactionAbility = ReactionAbilityBase & ({
  effect: 'REDUCE_PRESSURE';
  reduction: number;
  maxReduction: number;
} | {
  effect: 'REDUCE_COMPLEXITY';
  reduction: number;
  maxReduction: number;
} | {
  effect: 'APPLY_TEMPORARY_EFFECT';
  stat: 'intelligence' | 'discipline' | 'morale';
  value: number;
  durationInRounds: number;
} | {
  effect: 'COMBINED_ATTACK';
  synergy: number;
});

export type TemporaryStat = 'intelligence' | 'discipline' | 'morale' | 'complexityReduction' | 'disruptionReduction';

export interface TemporaryEffect {
  id: string;
  abilityId: string;
  sourceId: string;
  targetId: string;
  stat: TemporaryStat;
  value: number;
  remainingRounds: number;
}

export interface Teacher {
  id: string;
  pedagogy: number;
  authority: number;
  patience: number;
  maxPatience?: number;
}

export interface TeacherState extends Teacher { maxPatience: number }
export type TeacherActionKind = 'ENCOURAGE' | 'REEXPLAIN' | 'REFRAME' | 'BREAK' | 'PASS';
export type TeacherAction = { kind: 'ENCOURAGE' | 'REEXPLAIN' | 'REFRAME'; targetId: string }
  | { kind: 'BREAK' | 'PASS' };
export type TargetKind = 'SELF' | 'ONE_STUDENT' | 'ALL_STUDENTS';

export interface Seat {
  id: string;
  row: number;
  column: number;
}

export interface Classroom {
  currentLayout?: import('./models/ClassroomLayout.js').ClassroomLayout;
  defaultLayout?: import('./models/ClassroomLayout.js').ClassroomLayout;
  id: string;
  rows: number;
  columns: number;
  seats: Seat[];
}

export interface Subject {
  programId?: string;
  id: string;
  name: string;
}

export interface Topic {
  id: string;
  subjectId: string;
  name: string;
}

/** Topic est le nom historique du chapitre. */
export type Chapter = Topic;
export type TeachingMode = string;
export type SessionType = 'lecture' | 'exercise' | 'revision' | 'assessment' | 'homework';
export interface LessonActivity { lessonId: string; teachingMode: TeachingMode; sessionType?: SessionType; difficulty?: number; day?: number }
export interface StudentLessonProgress { studentId: string; lessonId: string; mastery: number }
export interface Curriculum { programs: Program[]; subjects: Subject[]; chapters: Chapter[]; lessons: Lesson[] }
export interface LessonSession extends LessonActivity { round: number; state: import('./engine/simulation.js').LessonState; students: StudentLessonState[] }

export interface Concept {
  baseRate?: number;
  conditions?: { minimumUnderstanding?: number; requiredConceptIds?: string[] };
  id: string;
  name: string;
  description: string;
  tags: string[];
  effects: { type: 'learning_boost' | 'knowledge' | 'stat_modifier' | 'behavior'; tags: string[]; value: number }[];
}

export interface Program { id: string; name: string }

export interface Lesson {
  availableTeachingModes?: TeachingMode[];
  prerequisites?: { lessonId: string; mastery: number }[];
  tags?: string[];
  conceptPool?: { conceptId: string; baseRate: number }[];
  complexity: number;
  pressure: number;
  requiredProgress: number;
  id: string;
  topicId: string;
  name: string;
  roundCount: number;
  conceptIds: string[];
}

export interface StudentLessonState {
  effects: TemporaryEffect[];
  studentId: string;
  lessonUnderstanding: number;
  concentration: number;
  morale: number;
  progress: number;
  missedRounds: number;
}

export interface LessonResult {
  progression?: import('./engine/progression.js').ProgressionResult;
  progress: number;
  missedRounds: number;
  concentration: number;
  morale: number;
  studentId: string;
  lessonId: string;
  understanding: number;
}

export interface PrototypeScenario {
  activity?: LessonActivity;
  program?: Program;
  classRelations?: ClassRelations;
  learningRules?: import('./data/learningRules.js').LearningRules;
  interactionRules?: import('./data/interactionRules.js').InteractionRules;
  relations?: StudentRelation[];
  reactionAbilities?: ReactionAbility[];
  teacher: Teacher;
  classroom: Classroom;
  students: Student[];
  archetypes: StudentArchetype[];
  subject: Subject;
  topic: Topic;
  lesson: Lesson;
  concepts: Concept[];
}
