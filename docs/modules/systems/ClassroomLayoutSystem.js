import { createSeat } from '../models/ClassroomLayout.js';
/** Frontière de migration : les anciens scénarios restent lisibles. */
export function layoutFromClassroom(classroom, students) {
    if (classroom.currentLayout)
        return structuredClone(classroom.currentLayout);
    return { rows: classroom.rows, columns: classroom.columns, seats: classroom.seats.map(seat => createSeat(seat.id, seat.row, seat.column, classroom.rows, classroom.columns, students.find(s => s.present !== false && s.seatId === seat.id)?.id ?? null)) };
}
export function validateLayout(value, students) {
    const errors = [];
    if (!value || typeof value !== 'object')
        return ['Plan de classe invalide.'];
    const layout = value;
    if (!Number.isSafeInteger(layout.rows) || layout.rows < 1 || !Number.isSafeInteger(layout.columns) || layout.columns < 1 || !Array.isArray(layout.seats))
        return ['Dimensions du plan invalides.'];
    if (layout.seats.length !== layout.rows * layout.columns)
        errors.push('Nombre de sièges invalide.');
    const seats = new Set(), positions = new Set(), occupants = new Set();
    const known = new Set(students.map(s => s.id));
    if (known.size !== students.length)
        errors.push('Élève dupliqué dans la classe.');
    for (const seat of layout.seats) {
        if (!seat || typeof seat !== 'object') {
            errors.push('Siège invalide.');
            continue;
        }
        if (typeof seat.id !== 'string' || !seat.id.trim() || seats.has(seat.id))
            errors.push('Identifiant de siège invalide ou dupliqué.');
        seats.add(seat.id);
        const position = `${seat.row}:${seat.column}`;
        if (!Number.isInteger(seat.row) || !Number.isInteger(seat.column) || seat.row < 0 || seat.row >= layout.rows || seat.column < 0 || seat.column >= layout.columns || positions.has(position))
            errors.push('Position de siège invalide ou dupliquée.');
        positions.add(position);
        if (typeof seat.locked !== 'boolean' || !Array.isArray(seat.tags) || seat.tags.some(t => typeof t !== 'string') ||
            [seat.nearWindow, seat.nearDoor, seat.frontRow, seat.backRow].some(v => typeof v !== 'boolean'))
            errors.push('Caractéristiques de siège invalides.');
        if (seat.studentId !== null) {
            if (typeof seat.studentId !== 'string' || !known.has(seat.studentId))
                errors.push('Élève inconnu dans le plan.');
            if (occupants.has(seat.studentId))
                errors.push('Élève dupliqué dans le plan.');
            occupants.add(seat.studentId);
        }
    }
    for (const student of students)
        if (student.present !== false && !occupants.has(student.id))
            errors.push(`Élève non placé : ${student.name}.`);
    return errors;
}
export class ClassroomLayoutSystem {
    layout;
    constructor(layout) { this.layout = structuredClone(layout); }
    get currentLayout() { return structuredClone(this.layout); }
    getSeat(id) { return structuredClone(this.layout.seats.find(s => s.id === id)); }
    getStudentSeat(id) { return structuredClone(this.layout.seats.find(s => s.studentId === id)); }
    canMoveStudent(studentId, seatId) {
        const source = this.getStudentSeat(studentId), target = this.getSeat(seatId);
        return !!source && !!target && !source.locked && !target.locked && source.id !== target.id;
    }
    moveStudent(studentId, seatId) {
        if (!this.canMoveStudent(studentId, seatId))
            throw new Error('Déplacement impossible : place verrouillée ou inconnue.');
        const source = this.layout.seats.find(s => s.studentId === studentId);
        const target = this.layout.seats.find(s => s.id === seatId);
        [source.studentId, target.studentId] = [target.studentId, source.studentId];
    }
    swapStudents(left, right) {
        const target = this.getStudentSeat(right);
        if (!target)
            throw new Error('Élève inconnu.');
        this.moveStudent(left, target.id);
    }
    setLocked(seatId, locked) {
        const seat = this.layout.seats.find(s => s.id === seatId);
        if (!seat)
            throw new Error('Siège inconnu.');
        seat.locked = locked;
    }
    getNeighbors(studentId, options = {}) {
        return ClassroomLayoutSystem.getNeighbors(this.layout, studentId, options);
    }
    static getNeighbors(layout, studentId, options = {}) {
        const source = layout.seats.find(s => s.studentId === studentId);
        const result = { direct: [], diagonal: [] };
        if (!source)
            return result;
        for (const seat of [...layout.seats].sort((a, b) => a.row - b.row || a.column - b.column)) {
            if (!seat.studentId || seat.studentId === studentId)
                continue;
            const dr = Math.abs(source.row - seat.row), dc = Math.abs(source.column - seat.column);
            if (dr + dc === 1)
                result.direct.push(seat.studentId);
            else if (options.diagonals && dr === 1 && dc === 1)
                result.diagonal.push(seat.studentId);
        }
        return result;
    }
    validateLayout(students) { return validateLayout(this.layout, students); }
}
