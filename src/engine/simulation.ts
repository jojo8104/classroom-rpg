import { Concepts, initializeConcepts } from '../systems/Concepts.js';
import { TargetingSystem } from '../systems/TargetingSystem.js';
import { RelationIndex } from '../systems/RelationIndex.js';
import { emptyDebugMetrics,recordTick,eventPriority } from './diagnostics.js';
import type { LessonResult, PrototypeScenario, StudentLessonState, TeacherAction, TeacherActionKind, TeacherState } from '../domain.js';
import type { GameEvent, GameEventPayload } from '../events.js';
import { createActionRules, type ActionRules } from '../data/rules.js';
import { resolveActionRound, validateActionRules } from './actions.js';
import { SeededRandom } from './random.js';
import { validateScenario } from './validation.js';
import { createLessonStates } from './combat.js';
import { createTeacherRules, validateTeacherRules, type TeacherRules } from '../data/teacherRules.js';
import { previewTeacherAction, resolveTeacherAction, type TeacherActionPreview } from './teacher.js';
import { AbilityUsage } from './abilities.js';
import { abilities, type SpecializationId } from '../data/abilities.js';
import { settleProgression, selectSpecialization } from './progression.js';

import { ClassroomLayoutSystem, layoutFromClassroom } from '../systems/ClassroomLayoutSystem.js';
import type { ClassroomLayout } from '../models/ClassroomLayout.js';
import { getSeatPreferenceModifier } from '../systems/PlacementEvaluationSystem.js';

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
  private abilityUsage = new AbilityUsage();
  private targeting: TargetingSystem;
  private relationIndex: RelationIndex | undefined;
  private diagnostics=emptyDebugMetrics();
  get debugMetrics() { return {...this.diagnostics}; }
  private lessonResults: LessonResult[] | undefined;

  private readonly absentStudents: PrototypeScenario['students'];
  private readonly absentRelations: import('../domain.js').DirectedRelation[];
  get layoutSnapshot(): ClassroomLayout { return structuredClone(this.scenario.classroom.currentLayout!); }

  constructor(scenario: PrototypeScenario, seed: number, rules = createActionRules(), teacherRules = createTeacherRules()) {
    const errors = validateScenario(scenario);
    if (errors.length) throw new Error(errors.join('\n'));
    this.scenario = structuredClone(scenario);
    this.scenario.students.filter(s => s.present !== false).forEach(initializeConcepts);
    this.absentStudents = this.scenario.students.filter(s => s.present === false);
    const activeIds = new Set(this.scenario.students.filter(s => s.present !== false).map(s => s.id));
    this.absentRelations = this.scenario.classRelations?.links.filter(l => !activeIds.has(l.from) || !activeIds.has(l.to)) ?? [];
    const layout = layoutFromClassroom(this.scenario.classroom, this.scenario.students);
    for (const seat of layout.seats) if (seat.studentId && !activeIds.has(seat.studentId)) seat.studentId = null;
    for(const seat of layout.seats) { Object.freeze(seat.tags); Object.freeze(seat); }
    Object.freeze(layout.seats); Object.freeze(layout);
    this.scenario.classroom.currentLayout = layout;
    this.scenario.students = this.scenario.students.filter(s => activeIds.has(s.id));
    if (this.scenario.classRelations) this.scenario.classRelations.links = this.scenario.classRelations.links.filter(l => activeIds.has(l.from) && activeIds.has(l.to));
    if (this.scenario.relations) this.scenario.relations = this.scenario.relations.filter(r => r.studentIds.every(id => activeIds.has(id)));
    if (this.scenario.students.some(s => s.progression)) {
      const catalog = abilities.flatMap(a => a.mode === 'REACTION' ? [a.reaction] : []);
      this.scenario.reactionAbilities = [...(this.scenario.reactionAbilities ?? []).filter(a => !catalog.some(c => c.id === a.id)), ...structuredClone(catalog)];
    }
    this.rules = structuredClone(rules);
    validateTeacherRules(teacherRules);
    this.teacherRules = structuredClone(teacherRules);
    this.teacher = { ...structuredClone(scenario.teacher), maxPatience: scenario.teacher.maxPatience ?? scenario.teacher.patience };
    this.seed = seed;
    this.random = new SeededRandom(seed);
    const seats = new ClassroomLayoutSystem(layout);
    this.targeting=new TargetingSystem(seats);
    this.relationIndex=this.scenario.classRelations ? new RelationIndex(this.scenario.classRelations) : undefined;
    this.scenario.students.sort((a, b) => {
      const left = seats.getStudentSeat(a.id)!;
      const right = seats.getStudentSeat(b.id)!;
      return left.row - right.row || left.column - right.column;
    });
    this.students = createLessonStates(this.scenario.students, this.scenario.lesson);
    for (const state of this.students) {
      const student = this.scenario.students.find(s => s.id === state.studentId)!;
      state.morale = Math.max(0, Math.min(100, state.morale + getSeatPreferenceModifier(student, seats.getStudentSeat(student.id)!)));
    }
    validateActionRules(this.rules, this.students.length);
    for (const student of this.scenario.students) {
      if (!Object.hasOwn(this.rules.supportChanceByArchetype, student.archetypeId)) {
        throw new Error('Règle d’archétype manquante.');
      }
    }
    this.emit({ type: 'LESSON_STARTED', seed });
    this.emit({ type: 'CHAPTER_STARTED' });
  }

  get classRelations(): import('../domain.js').ClassRelations | undefined { return this.scenario.classRelations ? { links: structuredClone([...this.scenario.classRelations.links, ...this.absentRelations]) } : undefined; }
  get persistentStudents(): PrototypeScenario['students'] { return structuredClone([...this.scenario.students, ...this.absentStudents]); }
  chooseSpecialization(studentId: string, id: SpecializationId): void {
    this.requireState('LESSON_FINISHED');
    const student = this.scenario.students.find(s => s.id === studentId);
    if (!student) throw new Error('Élève inconnu.');
    this.emit(selectSpecialization(student, id));
  }
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
    this.history.push(structuredClone({ ...event, priority:eventPriority(event), sequence: this.history.length + 1,
      lessonId: this.scenario.lesson.id,
      chapterId: this.scenario.lesson.chapters[this.chapterIndex]!.id, round: this.round,
    }) as GameEvent);
  }

  private requireState(expected: LessonState): void {
    if (this.phase !== expected) throw new Error(`Transition interdite : ${this.phase}, attendu ${expected}.`);
  }

  resolveRound(): GameEvent[] {
    this.requireState('ROUND_READY');
    const started=performance.now();
    const start = this.history.length;
    this.phase = 'ROUND_RESOLVING';
    this.round++;
    this.roundInChapter++;
    this.emit({ type: 'ROUND_STARTED' });
    const result = resolveActionRound(this.scenario.students, this.students, this.random, this.rules,
      this.scenario.lesson, this.scenario.lesson.chapters[this.chapterIndex]!.id,
      { validated:true, targeting:this.targeting, relationIndex:this.relationIndex, abilityUsage: this.abilityUsage, learningRules: this.scenario.learningRules, interactionRules: this.scenario.interactionRules, classroom: this.scenario.classroom, archetypes: this.scenario.archetypes,
        classRelations: this.scenario.classRelations, relations: this.scenario.relations ?? [], abilities: this.scenario.reactionAbilities ?? [] },
      { teacher: this.teacher, rules: this.teacherRules });
    this.students = result.students;
    for (const event of result.events) this.emit(event);
    this.emit({ type: 'ROUND_ENDED', students: this.students });
    this.phase = 'ROUND_RESULT';
    const events=structuredClone(this.history.slice(start));
    recordTick(this.diagnostics,result.events,result.queueMetrics,performance.now()-started);
    return events;
  }

  /** Un tick pédagogique : toutes les actions principales puis leurs effets bornés. */
  resolveTick(): GameEvent[] { return this.resolveRound(); }

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
        this.lessonResults = this.individualResults();
        // Socle de connaissances : consolidation modérée, une seule fois par leçon.
        for (const student of this.scenario.students) {
          if (!student.knowledge) continue;
          const understanding = this.lessonResults.find(r => r.studentId === student.id)!.understanding;
          for (const concept of this.scenario.lesson.conceptIds) {
            const before = student.knowledge[concept] ?? 0;
            student.knowledge[concept] = Math.round((before + Math.max(0, understanding - before) * 0.15) * 100) / 100;
          }
        }
        const progressionEvents: GameEventPayload[] = [];
        for (const student of this.scenario.students) {
          if (!student.progression) continue;
          const result = this.lessonResults.find(r => r.studentId === student.id)!;
          const settled = settleProgression(student, this.history, result.understanding, { service: new Concepts(this.scenario.concepts), context: { lesson: this.scenario.lesson, teacher: this.teacher }, random: this.random });
          result.progression = settled.result;
          progressionEvents.push(...settled.events);
        }
        if (progressionEvents.length) {
          this.emit({ type: 'LESSON_RESULTS', results: structuredClone(this.lessonResults) });
          for (const event of progressionEvents) this.emit(event);
        }
        return;
      }
      this.chapterIndex++;
      this.roundInChapter = 0;
      this.emit({ type: 'CHAPTER_STARTED' });
    }
    this.phase = 'ROUND_READY';
  }

  private individualResults(): LessonResult[] {
    if (this.lessonResults) return structuredClone(this.lessonResults);
    return this.students.map(student => ({ studentId: student.studentId,
      lessonId: this.scenario.lesson.id, understanding: student.lessonUnderstanding,
      chapters: structuredClone(student.chapters), concentration: student.concentration, morale: student.morale }));
  }

  getResult(): SimulationResult {
    this.requireState('LESSON_FINISHED');
    // Nouvelle séance : concentration restaurée, moral conservé. L'historique reste dans results.
    const nextLessonStudents = this.scenario.students.map(student => ({ ...structuredClone(student), concentration: 100,
      morale: this.students.find(state => state.studentId === student.id)!.morale }));
    nextLessonStudents.push(...structuredClone(this.absentStudents));
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
