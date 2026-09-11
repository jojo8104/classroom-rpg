import type { Lesson, Student, StudentLessonState, TargetKind, TeacherAction, TeacherActionKind, TeacherState } from '../domain.js';
import type { TeacherActionDefinition, TeacherRules } from '../data/teacherRules.js';
import type { ActionEvent, GameEventPayload } from '../events.js';
import { applyTemporaryEffect } from './effects.js';
import { roundValue } from './combat.js';
import { changeMorale, updateConcentration } from './resources.js';

export interface TeacherContext {
  teacher: TeacherState;
  students: readonly Student[];
  states: readonly StudentLessonState[];
  lesson: Lesson;
  rules: TeacherRules;
  hasNextRound: boolean;
}
export interface TeacherActionPreview extends TeacherActionDefinition {
  kind: TeacherActionKind;
  available: boolean;
  reason: string;
  targetIds: string[];
}

export function resolveTargets(target: TargetKind, teacherId: string, studentIds: readonly string[], targetId?: string): string[] {
  if (target === 'ONE_STUDENT') {
    if (!targetId || !studentIds.includes(targetId)) throw new Error('Sélectionnez un élève valide.');
    return [targetId];
  }
  if (targetId !== undefined) throw new Error('Cette intervention ne demande pas de cible individuelle.');
  return target === 'SELF' ? [teacherId] : [...studentIds];
}

export function previewTeacherAction(context: TeacherContext, action: TeacherAction): TeacherActionPreview {
  const { teacher, rules, states, students, lesson } = context;
  if (!Object.hasOwn(rules.actions, action.kind)) throw new Error('Intervention inconnue.');
  const definition = rules.actions[action.kind];
  const power = roundValue(Math.min(100, definition.power * teacher[definition.stat] / rules.statReference));
  const preview: TeacherActionPreview = { ...definition, kind: action.kind, power, targetIds: [], available: true, reason: '' };
  try {
    preview.targetIds = resolveTargets(definition.target, teacher.id, students.map(student => student.id), 'targetId' in action ? action.targetId : undefined);
    if (action.kind === 'PASS') return preview;
    if (!context.hasNextRound) throw new Error('La leçon est terminée : aucune intervention payante nécessaire.');
    if (teacher.patience < definition.cost) throw new Error('Patience insuffisante.');
    if (power <= 0) throw new Error('Cette intervention n’aurait aucun effet.');
    const state = states.find(state => state.studentId === preview.targetIds[0]);
    if (action.kind === 'ENCOURAGE' && state!.morale >= 100) throw new Error('Le moral de cet élève est déjà au maximum.');
    if (action.kind === 'REEXPLAIN' && lesson.complexity <= 0) throw new Error('Cette leçon ne présente aucune complexité.');
    if (action.kind === 'REFRAME' && !(students.find(student => student.id === preview.targetIds[0])!.disruptionChance! > 0)) throw new Error('Cet élève ne provoque pas de perturbations.');
    if (action.kind === 'BREAK' && states.every(state => state.concentration >= 100)) throw new Error('La classe dispose déjà de toute sa concentration.');
  } catch (error) {
    preview.available = false; preview.reason = error instanceof Error ? error.message : 'Intervention invalide.';
  }
  return preview;
}

// Validation complète avant toute modification ; résultats et événements sont copiés.
export function resolveTeacherAction(context: TeacherContext, action: TeacherAction, dropoutMoraleLoss: number) {
  const preview = previewTeacherAction(context, action);
  if (!preview.available) throw new Error(preview.reason);
  const teacher = structuredClone(context.teacher);
  const students = structuredClone([...context.states]);
  const events: GameEventPayload[] = [{ type: 'TEACHER_ACTION_SELECTED', action: structuredClone(action) }];
  const effects: ActionEvent[] = [];
  if (action.kind !== 'PASS') {
    const before = teacher.patience;
    teacher.patience = roundValue(teacher.patience - preview.cost);
    events.push({ type: 'TEACHER_PATIENCE_CHANGED', before, after: teacher.patience });
    for (const id of preview.targetIds) {
      const state = students.find(state => state.studentId === id)!;
      switch (action.kind) {
        case 'ENCOURAGE': changeMorale(state, state.morale + preview.power, effects); break;
        case 'BREAK': updateConcentration(state, state.concentration + preview.power, 'teacher', dropoutMoraleLoss, effects); break;
        case 'REEXPLAIN':
        case 'REFRAME': applyTemporaryEffect(state, {
          id: JSON.stringify([teacher.id, id, action.kind]), sourceId: teacher.id, targetId: id, abilityId: action.kind,
          stat: action.kind === 'REEXPLAIN' ? 'complexityReduction' : 'disruptionReduction',
          value: preview.power, remainingRounds: preview.duration,
        }, effects); break;
      }
    }
  }
  events.push(...effects, { type: 'TEACHER_ACTION_APPLIED', action: action.kind, targetIds: preview.targetIds, power: preview.power });
  return { teacher, students, events };
}
