export interface Seat {
  id: string;
  row: number;
  column: number;
  studentId: string | null;
  locked: boolean;
  tags: string[];
  nearWindow: boolean;
  nearDoor: boolean;
  frontRow: boolean;
  backRow: boolean;
}

export interface ClassroomLayout {
  rows: number;
  columns: number;
  seats: Seat[];
}

export interface ClassroomPlans {
  version: 1;
  defaultLayout: ClassroomLayout;
  currentLayout: ClassroomLayout;
  savedLayouts: Record<string, ClassroomLayout>;
}

export function seatTags(row: number, column: number, rows: number, columns: number): string[] {
  return [row === 0 ? 'front' : row === rows - 1 ? 'back' : 'middle',
    column === 0 ? 'left' : column === columns - 1 ? 'right' : 'center',
    ...(column === 0 ? ['near_window'] : []), ...(row === 0 && column === columns - 1 ? ['near_door'] : [])];
}

export function createSeat(id: string, row: number, column: number, rows: number, columns: number, studentId: string | null = null): Seat {
  return { id, row, column, studentId, locked: false, tags: seatTags(row, column, rows, columns),
    nearWindow: column === 0, nearDoor: row === 0 && column === columns - 1, frontRow: row === 0, backRow: row === rows - 1 };
}

export function createLayout(rows: number, columns: number, studentIds: readonly string[] = []): ClassroomLayout {
  if (!Number.isSafeInteger(rows) || !Number.isSafeInteger(columns) || rows < 1 || columns < 1 || studentIds.length > rows * columns) throw new Error('Dimensions ou effectif invalides.');
  return { rows, columns, seats: Array.from({ length: rows * columns }, (_, i) =>
    createSeat(`seat_${Math.floor(i / columns)}_${i % columns}`, Math.floor(i / columns), i % columns, rows, columns, studentIds[i] ?? null)) };
}
