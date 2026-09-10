import type { LessonResult, PrototypeScenario, StudentLessonState } from '../domain.js';
import type { GameEvent, GameEventPayload } from '../events.js';
import { createActionRules, type ActionRules } from '../data/rules.js';
import { resolveActionRound, validateActionRules } from './actions.js';
import { SeededRandom } from './random.js';
import { validateScenario } from './validation.js';

export type LessonState = 'ROUND_READY' | 'ROUND_RESOLVING' | 'ROUND_RESULT' |
  'TEACHER_INTERVENTION' | 'LESSON_FINISHED';

export interface SimulationResult {
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

  constructor(scenario: PrototypeScenario, seed: number, rules = createActionRules()) {
    const errors = validateScenario(scenario);
    if (errors.length) throw new Error(errors.join('\n'));
    this.scenario = structuredClone(scenario);
    this.rules = structuredClone(rules);
    this.seed = seed;
    this.random = new SeededRandom(seed);
    const seats = new Map(scenario.classroom.seats.map(seat => [seat.id, seat]));
    this.scenario.students.sort((a, b) => {
      const left = seats.get(a.seatId)!;
      const right = seats.get(b.seatId)!;
      return left.row - right.row || left.column - right.column;
    });
    this.students = this.scenario.students.map(student => ({
      studentId: student.id, lessonUnderstanding: 0, concentrationBonus: 0,
    }));
    validateActionRules(this.rules, this.students.length);
    for (const student of this.scenario.students) {
      if (!Object.hasOwn(this.rules.supportChanceByArchetype, student.archetypeId)) {
        throw new Error('Règle d’archétype manquante.');
      }
    }
    this.emit({ type: 'LESSON_STARTED', seed });
    this.emit({ type: 'CHAPTER_STARTED' });
  }

  get state(): LessonState { return this.phase; }
  get events(): GameEvent[] { return structuredClone(this.history); }
  get studentStates(): StudentLessonState[] { return structuredClone(this.students); }

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
    const result = resolveActionRound(this.scenario.students, this.students, this.random, this.rules);
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
    this.emit({ type: 'TEACHER_INTERVENTION_STARTED' });
  }

  skipTeacherIntervention(): void {
    this.requireState('TEACHER_INTERVENTION');
    this.emit({ type: 'TEACHER_INTERVENTION_ENDED', intervention: 'none' });
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
      lessonId: this.scenario.lesson.id, understanding: student.lessonUnderstanding }));
  }

  getResult(): SimulationResult {
    this.requireState('LESSON_FINISHED');
    return { seed: this.seed, results: this.individualResults(), events: this.events };
  }

  runToCompletion(): SimulationResult {
    while (this.phase !== 'LESSON_FINISHED') {
      switch (this.phase) {
        case 'ROUND_READY': this.resolveRound(); break;
        case 'ROUND_RESULT': this.acknowledgeRoundResult(); break;
        case 'TEACHER_INTERVENTION': this.skipTeacherIntervention(); break;
        default: throw new Error('Un round est déjà en cours de résolution.');
      }
    }
    return this.getResult();
  }
}
