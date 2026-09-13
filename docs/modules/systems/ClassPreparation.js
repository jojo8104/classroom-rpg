import { ClassroomLayoutSystem, layoutFromClassroom, validateLayout } from './ClassroomLayoutSystem.js';
import { validateScenario } from '../engine/validation.js';
export const GAME_STATE = { CLASS_PREPARATION: 'class_preparation', LESSON: 'lesson', LESSON_RESULT: 'lesson_result' };
export class ClassPreparation {
    scenario;
    storage;
    system;
    plans;
    initial;
    get initialLayout() { return structuredClone(this.initial); }
    message = '';
    constructor(scenario, storage) {
        this.scenario = scenario;
        this.storage = storage;
        const initial = layoutFromClassroom(scenario.classroom, scenario.students);
        this.initial = structuredClone(scenario.classroom.defaultLayout ?? initial);
        this.plans = { version: 1, defaultLayout: structuredClone(this.initialLayout), currentLayout: initial, savedLayouts: {} };
        try {
            const raw = storage?.getItem(`classroom-rpg:${scenario.classroom.id}:preparation:v1`);
            if (raw) {
                const saved = JSON.parse(raw);
                const restored = structuredClone(scenario);
                restored.students = saved.students;
                restored.classRelations = saved.classRelations;
                restored.classroom.currentLayout = saved.plans?.currentLayout;
                if (saved.plans?.version !== 1 || !Array.isArray(saved.students) ||
                    saved.students.length !== scenario.students.length || saved.students.some((s) => !scenario.students.some(x => x.id === s.id)) ||
                    validateLayout(saved.plans.currentLayout, saved.students).length || validateLayout(saved.plans.defaultLayout, saved.students).length ||
                    validateScenario(restored).length)
                    throw new Error('Sauvegarde invalide.');
                this.plans = { ...saved.plans, savedLayouts: saved.plans.savedLayouts ?? {} };
                this.initial = structuredClone(this.plans.defaultLayout);
                scenario.students = restored.students;
                if (restored.classRelations)
                    scenario.classRelations = restored.classRelations;
                this.message = 'Placement et élèves restaurés.';
            }
        }
        catch {
            this.message = 'Sauvegarde indisponible ou incompatible : disposition initiale restaurée.';
        }
        this.system = new ClassroomLayoutSystem(this.plans.currentLayout);
        this.sync();
    }
    sync() {
        this.plans.currentLayout = this.system.currentLayout;
        this.scenario.classroom.currentLayout = this.system.currentLayout;
        this.scenario.classroom.defaultLayout = structuredClone(this.plans.defaultLayout);
    }
    save() {
        this.sync();
        try {
            if (!this.storage)
                throw new Error('Stockage indisponible.');
            this.storage.setItem(`classroom-rpg:${this.scenario.classroom.id}:preparation:v1`, JSON.stringify({
                plans: this.plans, students: this.scenario.students, classRelations: this.scenario.classRelations
            }));
            this.message = 'Placement sauvegardé sur cet appareil.';
            return true;
        }
        catch {
            this.message = 'Sauvegarde impossible sur cet appareil. Le placement reste utilisable pour cette session.';
            return false;
        }
    }
    moveStudent(studentId, seatId) { this.system.moveStudent(studentId, seatId); this.save(); }
    setLocked(seatId, locked) { this.system.setLocked(seatId, locked); this.save(); }
    reset() { this.system = new ClassroomLayoutSystem(this.initialLayout); this.save(); }
    prepareLesson() {
        const errors = this.system.validateLayout(this.scenario.students);
        if (errors.length)
            throw new Error(errors.join('\n'));
        this.save();
        return structuredClone(this.scenario);
    }
}
