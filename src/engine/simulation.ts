import { sessionRules } from '../data/sessionRules.js';
import { sessionWork } from './session.js';
import { bounded, memoryFor, erodeLearning, consolidateMemory, observeLearning, estimateMastery, repetitionLoss } from '../systems/LearningMemory.js';
import type { SessionType } from '../domain.js';
import { getTeachingMode, type TeachingModeDefinition } from '../data/teachingModes.js';
import { lessonProgress } from '../systems/Curriculum.js';
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
  private readonly mode: TeachingModeDefinition;
  private readonly scenario: PrototypeScenario;
  private readonly rules: ActionRules;
  private readonly random: SeededRandom;
  private readonly seed: number;
  private phase: LessonState = 'ROUND_READY';
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
  private reactivated = new Set<string>();

  private readonly absentStudents: PrototypeScenario['students'];
  private readonly absentRelations: import('../domain.js').DirectedRelation[];
  get layoutSnapshot(): ClassroomLayout { return structuredClone(this.scenario.classroom.currentLayout!); }

  constructor(scenario: PrototypeScenario, seed: number, rules = createActionRules(), teacherRules = createTeacherRules()) {
    const errors = validateScenario(scenario);
    if (errors.length) throw new Error(errors.join('\n'));
    this.mode = getTeachingMode(scenario.activity?.sessionType ?? scenario.activity?.teachingMode ?? 'lecture');
    if (scenario.activity?.sessionType && scenario.activity.sessionType !== scenario.activity.teachingMode) throw new Error('Types de séance incohérents.');
    const difficulty = scenario.activity?.difficulty;
    if (difficulty !== undefined && (!Number.isFinite(difficulty) || difficulty < 0 || difficulty > 100)) throw new Error('Difficulté invalide.');
    if (scenario.activity && scenario.activity.lessonId !== scenario.lesson.id) throw new Error('Activité : leçon incohérente.');
    if (!(scenario.lesson.availableTeachingModes ?? ['lecture']).includes(this.mode.id)) throw new Error('Mode indisponible pour cette leçon.');
    if (this.mode.id === 'homework' && scenario.teacher.patience < sessionRules.homeworkPatience) throw new Error('Patience insuffisante pour ce devoir.');
    if (this.mode.id === 'assessment' && scenario.teacher.authority < sessionRules.assessmentAuthority) throw new Error('Autorité insuffisante pour cette évaluation.');
    this.scenario = structuredClone(scenario);
    erodeLearning(this.scenario.students, this.day);
    for (const student of this.scenario.students.filter(s => s.present !== false)) memoryFor(student, this.scenario.lesson.id, this.day);
    if (this.mode.id === 'assessment') this.scenario.lesson.roundCount = sessionRules.assessmentRounds;
    if (this.mode.id === 'homework') this.scenario.lesson.roundCount = 2;
    if (this.mode.id === 'revision') {
      const related = this.scenario.concepts.filter(c => c.tags.some(t => this.scenario.lesson.tags?.includes(t)));
      this.scenario.lesson.conceptIds = [...new Set([...this.scenario.lesson.conceptIds, ...related.map(c => c.id)])];
    }
    if (this.mode.prepareLesson) this.scenario.lesson = this.mode.prepareLesson(this.scenario.lesson);
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
    if (this.mode.id === 'assessment') this.teacher.authority -= sessionRules.assessmentAuthority;
    if (this.mode.id === 'homework') this.teacher.patience -= sessionRules.homeworkPatience;
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
      this.mode.prepareStudent?.(student, state);
      state.morale = bounded(state.morale - repetitionLoss(student, this.mode.id as SessionType) - (this.mode.id === 'assessment' ? sessionRules.assessmentMorale : 0));
      state.morale = Math.max(0, Math.min(100, state.morale + getSeatPreferenceModifier(student, seats.getStudentSeat(student.id)!)));
    }
    validateActionRules(this.rules, this.students.length);
    for (const student of this.scenario.students) {
      if (!Object.hasOwn(this.rules.supportChanceByArchetype, student.archetypeId)) {
        throw new Error('Règle d’archétype manquante.');
      }
    }
    this.emit({ type: 'LESSON_STARTED', seed });
  }

  get classRelations(): import('../domain.js').ClassRelations | undefined { return this.scenario.classRelations ? { links: structuredClone([...this.scenario.classRelations.links, ...this.absentRelations]) } : undefined; }
  get persistentStudents(): PrototypeScenario['students'] { return structuredClone([...this.scenario.students, ...this.absentStudents]); }
  chooseSpecialization(studentId: string, id: SpecializationId): void {
    this.requireState('LESSON_FINISHED');
    const student = this.scenario.students.find(s => s.id === studentId);
    if (!student) throw new Error('Élève inconnu.');
    this.emit(selectSpecialization(student, id));
  }
  get session(): import('../domain.js').LessonSession { return { ...this.scenario.activity, lessonId: this.scenario.lesson.id, teachingMode: this.mode.id, sessionType: this.mode.id as SessionType, round: this.round, state: this.phase, students: this.studentStates }; }
  private get day() { return this.scenario.activity?.day ?? Math.max(0, ...this.scenario.students.flatMap(s => Object.values(s.learningMemory ?? {}).map(m => m.erosionUpdatedAt))); }
  get roundCount() { return this.scenario.lesson.roundCount; }
  get individual() { return this.mode.id === 'assessment' || this.mode.id === 'homework'; }
  get state(): LessonState { return this.phase; }
  get events(): GameEvent[] { return structuredClone(this.history); }
  get studentStates(): StudentLessonState[] { return structuredClone(this.students); }
  get teacherState(): TeacherState { return structuredClone(this.teacher); }
  get hasNextRound(): boolean { return this.round < this.scenario.lesson.roundCount; }

  private teacherContext() {
    return { teacher: this.teacher, students: this.scenario.students, states: this.students,
      lesson: this.scenario.lesson, rules: this.teacherRules, hasNextRound: this.hasNextRound };
  }

  teacherActions(targetId = ''): TeacherActionPreview[] {
    return (Object.keys(this.teacherRules.actions) as TeacherActionKind[]).map(kind => {
      const action: TeacherAction = kind === 'PASS' || kind === 'BREAK' ? { kind } : { kind, targetId };
      if (this.individual && kind !== 'PASS') return { ...previewTeacherAction(this.teacherContext(), action), available: false, reason: 'Travail individuel sans intervention.' };
      const preview = previewTeacherAction(this.teacherContext(), action);
      return this.phase === 'TEACHER_INTERVENTION' ? preview : { ...preview, available: false, reason: 'Attendez la fin du round.' };
    });
  }

  private emit(event: GameEventPayload): void {
    this.history.push(structuredClone({ ...event, priority:eventPriority(event), sequence: this.history.length + 1,
      lessonId: this.scenario.lesson.id,
      round: this.round,
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
    this.emit({ type: 'ROUND_STARTED' });
    const result = resolveActionRound(this.scenario.students, this.students, this.random, this.rules,
      this.scenario.lesson,
      { individual: this.individual, sessionWork: (student, state) => sessionWork(this.mode.id as SessionType, student, state, this.scenario.lesson, this.teacher, this.scenario.activity?.difficulty), learningMultiplier: student => new Concepts(this.scenario.concepts).learningMultiplier(student, this.scenario.lesson.tags ?? []), validated:true, targeting:this.targeting, relationIndex:this.relationIndex, abilityUsage: this.abilityUsage, learningRules: this.mode.id === 'lecture' ? this.scenario.learningRules : { successMorale: this.mode.id === 'assessment' ? 0 : 0.5, effortConcentration: this.mode.id === 'assessment' ? sessionRules.assessmentEffort : this.mode.id === 'revision' ? 1 : 3, damageMoraleRatio: 0.05, maxRetaliationMoraleLoss: 1 }, interactionRules: this.scenario.interactionRules, classroom: this.scenario.classroom, archetypes: this.scenario.archetypes,
        classRelations: this.scenario.classRelations, relations: this.scenario.relations ?? [], abilities: this.scenario.reactionAbilities ?? [] },
      { teacher: this.teacher, rules: this.teacherRules });
    this.students = result.students;
    for (const event of result.events) this.emit(event);
    const concepts = new Concepts(this.scenario.concepts);
    for (const student of this.scenario.students) {
      const state = this.students.find(s => s.studentId === student.id)!;
      if (this.mode.id === 'revision' && state.concentration > 0) {
        for (const concept of concepts.getConceptsByTags(student, []).filter(c => c.tags.some(t => this.scenario.lesson.tags?.includes(t)))) {
          const key = `${student.id}/${concept.id}`;
          if (!this.reactivated.has(key) && this.random.next() < 0.15 + (student.lessonMastery?.[this.scenario.lesson.id] ?? 0) / 200) {
            this.reactivated.add(key);
            memoryFor(student, this.scenario.lesson.id, this.day).revisionProtection = sessionRules.revisionProtection;
            this.emit({ type: 'concept_reactivated', studentId: student.id, conceptId: concept.id });
          }
        }
      }
      const gain = result.events.filter(e => e.type === 'UNDERSTANDING_CHANGED' && e.studentId === student.id).reduce((sum, e) => sum + (e.type === 'UNDERSTANDING_CHANGED' ? e.amount : 0), 0);
      for (const event of concepts.attemptDiscoveries({ student, lesson: this.scenario.lesson, lessonProgress: this.mode.id === 'revision' ? Math.max(state.lessonUnderstanding, student.lessonMastery?.[this.scenario.lesson.id] ?? 0) : state.lessonUnderstanding, teacher: this.teacher,
        teacherModifier: this.decisions.at(-1)?.kind === 'REEXPLAIN' ? 0.1 : 0, modeMultiplier: this.mode.conceptMultiplier * (this.mode.id === 'revision' ? 1 + (student.lessonMastery?.[this.scenario.lesson.id] ?? 0) / 100 : 1) }, gain, this.random)) this.emit(event);
    }
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
    if (this.individual && action.kind !== 'PASS') throw new Error('Travail individuel sans intervention.');
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
    if (!this.hasNextRound) {
      this.phase = 'LESSON_FINISHED';
      this.lessonResults = this.individualResults();
      for (const student of this.scenario.students) {
        const before = lessonProgress(student, this.scenario.lesson.id).mastery;
        const understanding = this.lessonResults.find(r => r.studentId === student.id)!.understanding;
        consolidateMemory(student, this.scenario.lesson.id, before + this.mode.masteryGain(before, understanding), this.mode.id as SessionType, this.day, understanding);
        observeLearning(student, this.scenario.lesson.id, this.teacher, this.mode.id as SessionType, this.day, understanding);
        const observation = estimateMastery(student, this.scenario.lesson.id, this.teacher, this.day);
        this.emit({ type: 'LEARNING_OBSERVED', studentId: student.id, label: observation.label, feedback: observation.feedback });
        student.recentSessionTypes = [...(student.recentSessionTypes ?? []), this.mode.id as SessionType].slice(-sessionRules.historyLimit);
      }
      this.emit({ type: 'LESSON_ENDED', results: this.individualResults() });
      // Socle de connaissances : consolidation modérée, une seule fois par leçon.
      for (const student of this.scenario.students) {
        if (!student.knowledge) continue;
        const understanding = this.lessonResults.find(r => r.studentId === student.id)!.understanding;
        for (const concept of this.scenario.lesson.conceptIds) {
          const before = student.knowledge[concept] ?? 0;
          student.knowledge[concept] = Math.round((before + Math.max(0, understanding - before) * 0.15 * this.mode.conceptMultiplier) * 100) / 100;
        }
      }
      const progressionEvents: GameEventPayload[] = [];
      for (const student of this.scenario.students) {
        if (!student.progression) continue;
        const result = this.lessonResults.find(r => r.studentId === student.id)!;
        const settled = settleProgression(student, this.history, result.understanding, { service: new Concepts(this.scenario.concepts), context: { lesson: this.scenario.lesson, teacher: this.teacher, modeMultiplier: this.mode.conceptMultiplier }, random: this.random });
        result.progression = settled.result;
        progressionEvents.push(...settled.events);
      }
      if (progressionEvents.length) {
        this.emit({ type: 'LESSON_RESULTS', results: structuredClone(this.lessonResults) });
        for (const event of progressionEvents) this.emit(event);
      }
      return;
    }
    this.phase = 'ROUND_READY';
  }

  private individualResults(): LessonResult[] {
    if (this.lessonResults) return structuredClone(this.lessonResults);
    return this.students.map(student => ({ studentId: student.studentId,
      lessonId: this.scenario.lesson.id, understanding: student.lessonUnderstanding,
      progress: student.progress, missedRounds: student.missedRounds, concentration: student.concentration, morale: student.morale }));
  }

  getResult(): SimulationResult {
    this.requireState('LESSON_FINISHED');
    // Nouvelle séance : concentration restaurée, moral conservé. L'historique reste dans results.
    const nextLessonStudents = this.scenario.students.map(student => ({ ...structuredClone(student), concentration: this.mode.id === 'homework' ? this.students.find(state => state.studentId === student.id)!.concentration : 100,
      morale: this.students.find(state => state.studentId === student.id)!.morale }));
    nextLessonStudents.push(...structuredClone(this.absentStudents));
    return { ...(this.scenario.classRelations ? { classRelations: this.classRelations! } : {}), seed: this.seed, results: this.individualResults(), events: this.events, nextLessonStudents,
      teacher: this.teacherState, decisions: structuredClone(this.decisions) };
  }

  runToCompletion(decisions: readonly TeacherAction[] = []): SimulationResult {
    const remaining = this.scenario.lesson.roundCount - this.round +
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
