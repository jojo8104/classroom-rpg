import { initializeConcepts } from './Concepts.js';
import { migratePreparationSave } from './PlanMigration.js';
import type { PrototypeScenario } from '../domain.js';
import type { ClassroomLayout, ClassroomPlans } from '../models/ClassroomLayout.js';
import { ClassroomLayoutSystem, layoutFromClassroom, validateLayout } from './ClassroomLayoutSystem.js';
import { validateScenario } from '../engine/validation.js';

export const GAME_STATE = { CLASS_PREPARATION: 'class_preparation', LESSON: 'lesson', LESSON_RESULT: 'lesson_result' } as const;
export interface PlanStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export class ClassPreparation {
  system: ClassroomLayoutSystem;
  private plans: ClassroomPlans;
  private initial: ClassroomLayout;
  get initialLayout(): ClassroomLayout { return structuredClone(this.initial); }
  message = '';
  constructor(readonly scenario: PrototypeScenario, private storage?: PlanStorage) {
    const initial = layoutFromClassroom(scenario.classroom, scenario.students);
    this.initial = structuredClone(scenario.classroom.defaultLayout ?? initial);
    this.plans = { version: 1, defaultLayout: structuredClone(this.initialLayout), currentLayout: initial, savedLayouts: {} };
    try {
      const raw = storage?.getItem(`classroom-rpg:${scenario.classroom.id}:preparation:v1`);
      if (raw) {
        const original=JSON.parse(raw);
        const saved = migratePreparationSave(original,scenario);
        const restored=structuredClone(scenario);
        restored.students=saved.students;
        if(saved.classRelations) restored.classRelations=saved.classRelations;
        this.plans = { ...saved.plans, savedLayouts: saved.plans.savedLayouts ?? {} };
        this.initial = structuredClone(this.plans.defaultLayout);
        scenario.students = restored.students;
        if (restored.classRelations) scenario.classRelations = restored.classRelations;
        this.message = original.plans.currentLayout.rows!==scenario.classroom.rows || original.plans.currentLayout.columns!==scenario.classroom.columns ? 'Classe agrandie : places, verrous et progrès précédents conservés.' : 'Placement et élèves restaurés.';
      }
    } catch { this.message = 'Sauvegarde indisponible ou incompatible : disposition initiale restaurée.'; }
    scenario.students.forEach(initializeConcepts);
    this.system = new ClassroomLayoutSystem(this.plans.currentLayout);
    this.sync();
  }
  private sync() {
    this.plans.currentLayout = this.system.currentLayout;
    this.scenario.classroom.currentLayout = this.system.currentLayout;
    this.scenario.classroom.defaultLayout = structuredClone(this.plans.defaultLayout);
  }
  save(): boolean {
    this.sync();
    try {
      if (!this.storage) throw new Error('Stockage indisponible.');
      this.storage.setItem(`classroom-rpg:${this.scenario.classroom.id}:preparation:v1`, JSON.stringify({
        plans: this.plans, students: this.scenario.students, classRelations: this.scenario.classRelations }));
      this.message = 'Placement sauvegardé sur cet appareil.'; return true;
    } catch { this.message = 'Sauvegarde impossible sur cet appareil. Le placement reste utilisable pour cette session.'; return false; }
  }
  moveStudent(studentId: string, seatId: string) { this.system.moveStudent(studentId, seatId); this.save(); }
  setLocked(seatId: string, locked: boolean) { this.system.setLocked(seatId, locked); this.save(); }
  reset() { this.system = new ClassroomLayoutSystem(this.initialLayout); this.save(); }
  prepareLesson(): PrototypeScenario {
    const errors = this.system.validateLayout(this.scenario.students);
    if (errors.length) throw new Error(errors.join('\n'));
    this.save(); return structuredClone(this.scenario);
  }
}
