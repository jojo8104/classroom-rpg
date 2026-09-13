import { createProgressionPrototype } from './progressionPrototype.js';
import { layoutFromClassroom } from '../systems/ClassroomLayoutSystem.js';
export function createPreparationPrototype() {
    const scenario = createProgressionPrototype();
    scenario.classroom.currentLayout = layoutFromClassroom(scenario.classroom, scenario.students);
    scenario.classroom.defaultLayout = structuredClone(scenario.classroom.currentLayout);
    // Acquis de démonstration, distincts de la compréhension de la séance.
    const mastery = [82, 34, 67, 51, 23, 91, 73, 45, 62];
    scenario.students.forEach((student, index) => {
        delete student.seatId;
        student.present = true;
        student.knowledge = Object.fromEntries(scenario.lesson.conceptIds.map((id, i) => [id, Math.min(100, mastery[index] + i * 8)]));
        student.seatPreferences = { likes: [index % 2 === 0 ? 'back' : 'front'], dislikes: [index % 2 === 0 ? 'front' : 'back'] };
    });
    for (const [from, to, score] of [['student-5', 'student-6', -36], ['student-6', 'student-5', -24], ['student-5', 'student-1', 63], ['student-1', 'student-5', 47]]) {
        scenario.classRelations.links.find(l => l.from === from && l.to === to).score = score;
    }
    return scenario;
}
