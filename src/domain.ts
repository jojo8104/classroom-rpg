// Les définitions persistantes sont séparées de l'état temporaire d'une séance.
export interface Student {
  id: string;
  name: string;
  intelligence: number;
  discipline: number;
  concentration: number;
  morale: number;
  archetypeId: string;
  seatId: string;
}

export interface StudentArchetype {
  id: string;
  name: string;
}

export interface Teacher {
  id: string;
  pedagogy: number;
  authority: number;
  patience: number;
}

export interface Seat {
  id: string;
  row: number;
  column: number;
}

export interface Classroom {
  id: string;
  rows: number;
  columns: number;
  seats: Seat[];
}

export interface Subject {
  id: string;
  name: string;
}

export interface Topic {
  id: string;
  subjectId: string;
  name: string;
}

export interface Concept {
  id: string;
  name: string;
}

export interface LessonChapter {
  id: string;
  name: string;
  roundCount: number;
}

export interface Lesson {
  complexity: number;
  pressure: number;
  requiredProgress: number;
  id: string;
  topicId: string;
  name: string;
  chapters: LessonChapter[];
  conceptIds: string[];
}

export interface StudentLessonState {
  studentId: string;
  lessonUnderstanding: number;
  concentration: number;
  morale: number;
  chapters: ChapterProgress[];
}

export interface ChapterProgress {
  chapterId: string;
  progress: number;
  missedRounds: number;
}

export interface LessonResult {
  chapters: ChapterProgress[];
  concentration: number;
  morale: number;
  studentId: string;
  lessonId: string;
  understanding: number;
}

export interface PrototypeScenario {
  teacher: Teacher;
  classroom: Classroom;
  students: Student[];
  archetypes: StudentArchetype[];
  subject: Subject;
  topic: Topic;
  lesson: Lesson;
  concepts: Concept[];
}
