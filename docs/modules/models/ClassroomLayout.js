import { SEAT_ENVIRONMENT } from '../data/classroomConfig.js';
function zone(index, size, labels) {
    const band = Math.max(1, Math.round(size / 3));
    return labels[index < band ? 0 : index >= size - band ? 2 : 1];
}
function onEdge(row, column, rows, columns, edge) {
    return edge === 'left' ? column === 0 : edge === 'right' ? column === columns - 1 : edge === 'front' ? row === 0 : edge === 'back' ? row === rows - 1 : false;
}
export function seatTags(row, column, rows, columns, environment = SEAT_ENVIRONMENT) {
    return [zone(row, rows, ['front', 'middle', 'back']), zone(column, columns, ['left', 'center', 'right']),
        ...(onEdge(row, column, rows, columns, environment.windowEdge) ? ['near_window'] : []),
        ...(onEdge(row, column, rows, columns, environment.doorEdge) ? ['near_door'] : [])];
}
export function createSeat(id, row, column, rows, columns, studentId = null, environment = SEAT_ENVIRONMENT) {
    const tags = seatTags(row, column, rows, columns, environment);
    return { id, row, column, studentId, locked: false, tags,
        nearWindow: tags.includes('near_window'), nearDoor: tags.includes('near_door'), frontRow: tags.includes('front'), backRow: tags.includes('back') };
}
export function generateSeats(rows, columns, environment = SEAT_ENVIRONMENT) {
    if (!Number.isSafeInteger(rows) || !Number.isSafeInteger(columns) || rows < 1 || columns < 1)
        throw new Error('Dimensions invalides.');
    return Array.from({ length: rows * columns }, (_, i) => createSeat(`seat_${Math.floor(i / columns)}_${i % columns}`, Math.floor(i / columns), i % columns, rows, columns, null, environment));
}
export function createLayout(rows, columns, studentIds = [], environment = SEAT_ENVIRONMENT) {
    const seats = generateSeats(rows, columns, environment);
    if (studentIds.length > seats.length)
        throw new Error('Effectif invalide.');
    seats.forEach((seat, i) => { seat.studentId = studentIds[i] ?? null; });
    return { rows, columns, seats };
}
/** Profondeur logique, sans projection ni coordonnées graphiques. */
export function renderPosition(seat) { return { row: seat.row, column: seat.column, depth: seat.row }; }
