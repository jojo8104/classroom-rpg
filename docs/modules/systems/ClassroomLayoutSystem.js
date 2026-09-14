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
// Index construit une fois par structure. Les échanges ne modifient que l'occupation.
class LayoutIndex {
    seats = new Map();
    occupants = new Map();
    positions = new Map();
    neighbors = new Map();
    constructor(layout) {
        for (const seat of layout.seats) {
            this.seats.set(seat.id, seat);
            this.positions.set(`${seat.row}:${seat.column}`, seat);
            if (seat.studentId)
                this.occupants.set(seat.studentId, seat);
        }
        for (const seat of layout.seats) {
            const ids = (offsets) => offsets.flatMap(([dr, dc]) => {
                const other = this.positions.get(`${seat.row + dr}:${seat.column + dc}`);
                return other ? [other.id] : [];
            });
            this.neighbors.set(seat.id, { direct: ids([[-1, 0], [0, -1], [0, 1], [1, 0]]), diagonal: ids([[-1, -1], [-1, 1], [1, -1], [1, 1]]) });
        }
    }
    getNeighbors(studentId, diagonals = false) {
        const seat = this.occupants.get(studentId), neighbors = seat ? this.neighbors.get(seat.id) : { direct: [], diagonal: [] };
        const occupied = (ids) => ids.flatMap(id => { const student = this.seats.get(id).studentId; return student ? [student] : []; });
        return { direct: occupied(neighbors.direct), diagonal: diagonals ? occupied(neighbors.diagonal) : [] };
    }
}
const frozenIndexes = new WeakMap();
export class ClassroomLayoutSystem {
    layout;
    index;
    topologyBuilds = 1;
    constructor(layout) { this.layout = structuredClone(layout); this.index = new LayoutIndex(this.layout); }
    get currentLayout() { return structuredClone(this.layout); }
    get dimensions() { return { rows: this.layout.rows, columns: this.layout.columns }; }
    getSeat(id) { return structuredClone(this.index.seats.get(id)); }
    getStudentSeat(id) { return structuredClone(this.index.occupants.get(id)); }
    getSeatAt(row, column) { return structuredClone(this.index.positions.get(`${row}:${column}`)); }
    getNeighborSeatIds(seatId, diagonals = false) {
        const neighbors = this.index.neighbors.get(seatId);
        return neighbors ? [...neighbors.direct, ...(diagonals ? neighbors.diagonal : [])] : [];
    }
    canMoveStudent(studentId, seatId) {
        const source = this.index.occupants.get(studentId), target = this.index.seats.get(seatId);
        return !!source && !!target && !source.locked && !target.locked && source.id !== target.id;
    }
    moveStudent(studentId, seatId) {
        if (!this.canMoveStudent(studentId, seatId))
            throw new Error('Déplacement impossible : place verrouillée ou inconnue.');
        const source = this.index.occupants.get(studentId), target = this.index.seats.get(seatId);
        [source.studentId, target.studentId] = [target.studentId, source.studentId];
        this.index.occupants.set(studentId, target);
        if (source.studentId)
            this.index.occupants.set(source.studentId, source);
    }
    swapStudents(left, right) {
        const target = this.index.occupants.get(right);
        if (!target)
            throw new Error('Élève inconnu.');
        this.moveStudent(left, target.id);
    }
    setLocked(seatId, locked) {
        const seat = this.index.seats.get(seatId);
        if (!seat)
            throw new Error('Siège inconnu.');
        seat.locked = locked;
    }
    getNeighbors(studentId, options = {}) { return this.index.getNeighbors(studentId, options.diagonals); }
    static getNeighbors(layout, studentId, options = {}) {
        // Seuls les snapshots profondément figés sont partagés ; une donnée mutable externe n'est jamais mise en cache.
        let index = frozenIndexes.get(layout);
        if (!index) {
            index = new LayoutIndex(layout);
            if (Object.isFrozen(layout) && Object.isFrozen(layout.seats) && layout.seats.every(Object.isFrozen))
                frozenIndexes.set(layout, index);
        }
        return index.getNeighbors(studentId, options.diagonals);
    }
    getStudentsInRow(row) {
        return Array.from({ length: this.layout.columns }, (_, column) => this.index.positions.get(`${row}:${column}`)?.studentId).filter((id) => !!id);
    }
    getStudentsInColumn(column) {
        return Array.from({ length: this.layout.rows }, (_, row) => this.index.positions.get(`${row}:${column}`)?.studentId).filter((id) => !!id);
    }
    getStudentsInRadius(seatId, radius) {
        if (!Number.isSafeInteger(radius) || radius < 0)
            throw new Error('Rayon entier positif ou nul requis.');
        const source = this.index.seats.get(seatId);
        if (!source)
            return [];
        const result = [];
        for (let row = Math.max(0, source.row - radius); row <= Math.min(this.layout.rows - 1, source.row + radius); row++) {
            for (let column = Math.max(0, source.column - radius); column <= Math.min(this.layout.columns - 1, source.column + radius); column++) {
                if (Math.abs(row - source.row) + Math.abs(column - source.column) > radius)
                    continue;
                const student = this.index.positions.get(`${row}:${column}`)?.studentId;
                if (student)
                    result.push(student);
            }
        }
        return result;
    }
    getAllStudents() { return [...this.index.seats.values()].sort((a, b) => a.row - b.row || a.column - b.column).flatMap(s => s.studentId ? [s.studentId] : []); }
    validateLayout(students) { return validateLayout(this.layout, students); }
}
