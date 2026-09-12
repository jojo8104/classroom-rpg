import type { LessonResult, PrototypeScenario, StudentLessonState, TeacherAction, TeacherActionKind, TeacherState } from '../domain.js';
import type { GameEvent, GameEventPayload } from '../events.js';
import { createActionRules, type ActionRules } from '../data/rules.js';
import { resolveActionRound, validateActionRules } from './actions.js';
import { SeededRandom } from './random.js';
import { validateScenario } from './validation.js';
import { createLessonStates } from './combat.js';
import { createTeacherRules, validateTeacherRules, type TeacherRules } from '../data/teacherRules.js';
import { previewTeacherAction, resolveTeacherAction, type TeacherActionPreview } from './teacher.js';

export type LessonState = 'ROUND_READY' | 'ROUND_RESOLVING' | 'ROUND_RESULT' |
  'TEACHER_INTERVENTION' | 'LESSON_FINISHED';

export interface SimulationResult {
  classRelations?: import('../domain.js').ClassRelations;
  teacher: TeacherState;
  decisions: TeacherAction[];
  nextLessonStudents: PrototypeScenario['students'];
  seed: number;
  results: LessonResult[];
  events: GameEvent[];
}

export class Simulation {
  private readonly scenario: PrototypeScenario;
  private readonly rules: ActionRules;
  private readonly random: SeededRandom;
  private readonly seed: number;
  private phase: LessonState = 'ROUND_READY';
  private chapterIndex = 0;
  private roundInChapter = 0;
  private round = 0;
  private students: StudentLessonState[];
  private history: GameEvent[] = [];
  private teacher: TeacherState;
  private teacherRules: TeacherRules;
  private decisions: TeacherAction[] = [];

  constructor(scenario: PrototypeScenario, seed: number, rules = createActionRules(), teacherRules = createTeacherRules()) {
    const errors = validateScenario(scenario);
    if (errors.length) throw new Error(errors.join('\n'));
    this.scenario = structuredClone(scenario);
    this.rules = structuredClone(rules);
    validateTeacherRules(teacherRules);
    this.teacherRules = structuredClone(teacherRules);
    this.teacher = { ...structuredClone(scenario.teacher), maxPatience: scenario.teacher.maxPatience ?? scenario.teacher.patience };
    this.seed = seed;
    this.random = new SeededRandom(seed);
    const seats = new Map(scenario.classroom.seats.map(seat => [seat.id, seat]));
    this.scenario.students.sort((a, b) => {
      const left = seats.get(a.seatId)!;
      const right = seats.get(b.seatId)!;
      return left.row - right.row || left.column - right.column;
    });
    this.students = createLessonStates(this.scenario.students, this.scenario.lesson);
    validateActionRules(this.rules, this.students.length);
    for (const student of this.scenario.students) {
      if (!Object.hasOwn(this.rules.supportChanceByArchetype, student.archetypeId)) {
        throw new Error('Règle d’archétype manquante.');
      }
    }
    this.emit({ type: 'LESSON_STARTED', seed });
    this.emit({ type: 'CHAPTER_STARTED' });
  }

  get classRelations(): import('../domain.js').ClassRelations | undefined { return structuredClone(this.scenario.classRelations); }
  get state(): LessonState { return this.phase; }
  get events(): GameEvent[] { return structuredClone(this.history); }
  get studentStates(): StudentLessonState[] { return structuredClone(this.students); }
  get teacherState(): TeacherState { return structuredClone(this.teacher); }
  get hasNextRound(): boolean { return this.round < this.scenario.lesson.chapters.reduce((sum, chapter) => sum + chapter.roundCount, 0); }

  private teacherContext() {
    return { teacher: this.teacher, students: this.scenario.students, states: this.students,
      lesson: this.scenario.lesson, rules: this.teacherRules, hasNextRound: this.hasNextRound };
  }

  teacherActions(targetId = ''): TeacherActionPreview[] {
    return (Object.keys(this.teacherRules.actions) as TeacherActionKind[]).map(kind => {
      const action: TeacherAction = kind === 'PASS' || kind === 'BREAK' ? { kind } : { kind, targetId };
      const preview = previewTeacherAction(this.teacherContext(), action);
      return this.phase === 'TEACHER_INTERVENTION' ? preview : { ...preview, available: false, reason: 'Attendez la fin du round.' };
    });
  }

  private emit(event: GameEventPayload): void {
    this.history.push(structuredClone({ ...event, sequence: this.history.length + 1,
      lessonId: this.scenario.lesson.id,
      chapterId: this.scenario.lesson.chapters[this.chapterIndex]!.id, round: this.round,
    }) as GameEvent);
  }

  private requireState(expected: LessonState): void {
    if (this.phase !== expected) throw new Error(`Transition interdite : ${this.phase}, attendu ${expected}.`);
  }

  resolveRound(): GameEvent[] {
    this.requireState('ROUND_READY');
    const start = this.history.length;
    this.phase = 'ROUND_RESOLVING';
    this.round++;
    this.roundInChapter++;
    this.emit({ type: 'ROUND_STARTED' });
    const result = resolveActionRound(this.scenario.students, this.students, this.random, this.rules,
      this.scenario.lesson, this.scenario.lesson.chapters[this.chapterIndex]!.id,
      { learningRules: this.scenario.learningRules, interactionRules: this.scenario.interactionRules, classroom: this.scenario.classroom, archetypes: this.scenario.archetypes,
        classRelations: this.scenario.classRelations, relations: this.scenario.relations ?? [], abilities: this.scenario.reactionAbilities ?? [] },
      { teacher: this.teacher, rules: this.teacherRules });
    this.students = result.students;
    for (const event of result.events) this.emit(event);
    this.emit({ type: 'ROUND_ENDED', students: this.students });
    this.phase = 'ROUND_RESULT';
    return structuredClone(this.history.slice(start));
  }

  // Le futur rendu appelle cette méthode après avoir joué les événements du round.
  acknowledgeRoundResult(): void {
    this.requireState('ROUND_RESULT');
    this.phase = 'TEACHER_INTERVENTION';
    this.emit({ type: 'TEACHER_INTERVENTION_STARTED', teacher: this.teacherState,
      actions: (Object.keys(this.teacherRules.actions) as TeacherActionKind[])
        .filter(kind => this.hasNextRound || kind === 'PASS')
        .map(kind => ({ kind, cost: this.teacherRules.actions[kind].cost })) });
  }

  skipTeacherIntervention(): void {
    this.applyTeacherAction({ kind: 'PASS' });
  }

  applyTeacherAction(action: TeacherAction): GameEvent[] {
    this.requireState('TEACHER_INTERVENTION');
    const result = resolveTeacherAction(this.teacherContext(), action, this.rules.dropoutMoraleLoss);
    const start = this.history.length;
    this.teacher = result.teacher;
    this.students = result.students;
    this.decisions.push(structuredClone(action));
    for (const event of result.events) this.emit(event);
    this.emit({ type: 'TEACHER_INTERVENTION_ENDED', intervention: action.kind });
    this.advanceAfterIntervention();
    return structuredClone(this.history.slice(start));
  }

  private advanceAfterIntervention(): void {
    const chapter = this.scenario.lesson.chapters[this.chapterIndex]!;
    if (this.roundInChapter === chapter.roundCount) {
      this.emit({ type: 'CHAPTER_ENDED' });
      if (this.chapterIndex === this.scenario.lesson.chapters.length - 1) {
        this.phase = 'LESSON_FINISHED';
        this.emit({ type: 'LESSON_ENDED', results: this.individualResults() });
        return;
      }
      this.chapterIndex++;
      this.roundInChapter = 0;
      this.emit({ type: 'CHAPTER_STARTED' });
    }
    this.phase = 'ROUND_READY';
  }

  private individualResults(): LessonResult[] {
    return this.students.map(student => ({ studentId: student.studentId,
      lessonId: this.scenario.lesson.id, understanding: student.lessonUnderstanding,
      chapters: structuredClone(student.chapters), concentration: student.concentration, morale: student.morale }));
  }

  getResult(): SimulationResult {
    this.requireState('LESSON_FINISHED');
    // Nouvelle séance : concentration restaurée, moral conservé. L'historique reste dans results.
    const nextLessonStudents = this.scenario.students.map(student => ({ ...student, concentration: 100,
      morale: this.students.find(state => state.studentId === student.id)!.morale }));
    return { ...(this.scenario.classRelations ? { classRelations: this.classRelations! } : {}), seed: this.seed, results: this.individualResults(), events: this.events, nextLessonStudents,
      teacher: this.teacherState, decisions: structuredClone(this.decisions) };
  }

  runToCompletion(decisions: readonly TeacherAction[] = []): SimulationResult {
    const remaining = this.scenario.lesson.chapters.reduce((sum, chapter) => sum + chapter.roundCount, 0) - this.round +
      (this.phase === 'ROUND_RESULT' || this.phase === 'TEACHER_INTERVENTION' ? 1 : 0);
    if (decisions.length > remaining) throw new Error('Trop de décisions pour les rounds restants.');
    let decisionIndex = 0;
    while (this.phase !== 'LESSON_FINISHED') {
      switch (this.phase) {
        case 'ROUND_READY': this.resolveRound(); break;
        case 'ROUND_RESULT': this.acknowledgeRoundResult(); break;
        case 'TEACHER_INTERVENTION': this.applyTeacherAction(decisions[decisionIndex++] ?? { kind: 'PASS' }); break;
        default: throw new Error('Un round est déjà en cours de résolution.');
      }
    }
    return this.getResult();
  }
}
