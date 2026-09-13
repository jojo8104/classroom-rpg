export function seatTags(row, column, rows, columns) {
    return [row === 0 ? 'front' : row === rows - 1 ? 'back' : 'middle',
        column === 0 ? 'left' : column === columns - 1 ? 'right' : 'center',
        ...(column === 0 ? ['near_window'] : []), ...(row === 0 && column === columns - 1 ? ['near_door'] : [])];
}
export function createSeat(id, row, column, rows, columns, studentId = null) {
    return { id, row, column, studentId, locked: false, tags: seatTags(row, column, rows, columns),
        nearWindow: column === 0, nearDoor: row === 0 && column === columns - 1, frontRow: row === 0, backRow: row === rows - 1 };
}
export function createLayout(rows, columns, studentIds = []) {
    if (!Number.isSafeInteger(rows) || !Number.isSafeInteger(columns) || rows < 1 || columns < 1 || studentIds.length > rows * columns)
        throw new Error('Dimensions ou effectif invalides.');
    return { rows, columns, seats: Array.from({ length: rows * columns }, (_, i) => createSeat(`seat_${Math.floor(i / columns)}_${i % columns}`, Math.floor(i / columns), i % columns, rows, columns, studentIds[i] ?? null)) };
}
