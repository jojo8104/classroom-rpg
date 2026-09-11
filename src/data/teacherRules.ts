import type { TargetKind, TeacherActionKind } from '../domain.js';

export interface TeacherActionDefinition {
  label: string;
  description: string;
  target: TargetKind;
  cost: number;
  power: number;
  duration: number;
  stat: 'pedagogy' | 'authority';
}
export interface TeacherRules {
  statReference: number;
  disruptionPower: number;
  actions: Record<TeacherActionKind, TeacherActionDefinition>;
}
export function createTeacherRules(): TeacherRules {
  return { statReference: 60, disruptionPower: 16, actions: {
    ENCOURAGE: { label: 'Encourager', description: 'Remonte immédiatement le moral d’un élève.', target: 'ONE_STUDENT', cost: 8, power: 14, duration: 0, stat: 'pedagogy' },
    REEXPLAIN: { label: 'Réexpliquer', description: 'Réduit la complexité pour cet élève pendant les prochains rounds.', target: 'ONE_STUDENT', cost: 14, power: 18, duration: 2, stat: 'pedagogy' },
    REFRAME: { label: 'Recadrer', description: 'Diminue le risque de perturbation de cet élève pendant les prochains rounds.', target: 'ONE_STUDENT', cost: 10, power: 60, duration: 2, stat: 'authority' },
    BREAK: { label: 'Faire une pause', description: 'Restaure la concentration de toute la classe.', target: 'ALL_STUDENTS', cost: 6, power: 18, duration: 0, stat: 'pedagogy' },
    PASS: { label: 'Ne pas intervenir', description: 'Conserve toute la patience restante.', target: 'SELF', cost: 0, power: 0, duration: 0, stat: 'pedagogy' },
  } };
}

export function validateTeacherRules(rules: TeacherRules): void {
  if (!Number.isFinite(rules.statReference) || rules.statReference <= 0 ||
      !Number.isFinite(rules.disruptionPower) || rules.disruptionPower < 0 || rules.disruptionPower > 100) throw new Error('Règles du professeur invalides.');
  const expected = createTeacherRules().actions;
  for (const kind of Object.keys(expected) as TeacherActionKind[]) {
    const definition = rules.actions[kind];
    if (!definition || definition.target !== expected[kind].target || definition.stat !== expected[kind].stat ||
        !Number.isFinite(definition.cost) || definition.cost < 0 || definition.cost > 100 ||
        !Number.isFinite(definition.power) || definition.power < 0 || definition.power > 100 ||
        !Number.isSafeInteger(definition.duration) || definition.duration < 0 ||
        (kind === 'REEXPLAIN' || kind === 'REFRAME') && definition.duration === 0 ||
        kind !== 'PASS' && definition.cost === 0) throw new Error('Intervention configurée invalide.');
  }
  const pass = rules.actions.PASS;
  if (pass.cost !== 0 || pass.power !== 0 || pass.duration !== 0) throw new Error('PASS doit rester gratuit et sans effet.');
}
