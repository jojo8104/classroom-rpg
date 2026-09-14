import { SEAT_ENVIRONMENT, type SeatEnvironment, type ClassroomEdge } from '../data/classroomConfig.js';
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

function zone(index: number, size: number, labels: readonly string[]): string {
  const band = Math.max(1, Math.round(size / 3));
  return labels[index < band ? 0 : index >= size - band ? 2 : 1]!;
}
function onEdge(row: number, column: number, rows: number, columns: number, edge: ClassroomEdge) {
  return edge === 'left' ? column === 0 : edge === 'right' ? column === columns-1 : edge === 'front' ? row === 0 : edge === 'back' ? row === rows-1 : false;
}
export function seatTags(row: number, column: number, rows: number, columns: number, environment: SeatEnvironment = SEAT_ENVIRONMENT): string[] {
  return [zone(row,rows,['front','middle','back']), zone(column,columns,['left','center','right']),
    ...(onEdge(row,column,rows,columns,environment.windowEdge) ? ['near_window'] : []),
    ...(onEdge(row,column,rows,columns,environment.doorEdge) ? ['near_door'] : [])];
}
export function createSeat(id: string, row: number, column: number, rows: number, columns: number, studentId: string | null = null, environment: SeatEnvironment = SEAT_ENVIRONMENT): Seat {
  const tags = seatTags(row,column,rows,columns,environment);
  return { id, row, column, studentId, locked: false, tags,
    nearWindow: tags.includes('near_window'), nearDoor: tags.includes('near_door'), frontRow: tags.includes('front'), backRow: tags.includes('back') };
}
export function generateSeats(rows: number, columns: number, environment: SeatEnvironment = SEAT_ENVIRONMENT): Seat[] {
  if (!Number.isSafeInteger(rows) || !Number.isSafeInteger(columns) || rows < 1 || columns < 1) throw new Error('Dimensions invalides.');
  return Array.from({ length: rows * columns }, (_, i) => createSeat(`seat_${Math.floor(i / columns)}_${i % columns}`, Math.floor(i / columns), i % columns, rows, columns, null, environment));
}
export function createLayout(rows: number, columns: number, studentIds: readonly string[] = [], environment: SeatEnvironment = SEAT_ENVIRONMENT): ClassroomLayout {
  const seats = generateSeats(rows,columns,environment);
  if (studentIds.length > seats.length) throw new Error('Effectif invalide.');
  seats.forEach((seat,i) => { seat.studentId = studentIds[i] ?? null; });
  return { rows, columns, seats };
}
/** Profondeur logique, sans projection ni coordonnées graphiques. */
export function renderPosition(seat: Seat) { return { row: seat.row, column: seat.column, depth: seat.row }; }
