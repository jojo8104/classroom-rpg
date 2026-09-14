export interface ClassroomConfig { rows: number; columns: number; maxStudents: number }
export const CLASSROOM_CONFIG: Readonly<ClassroomConfig> = Object.freeze({ rows: 5, columns: 5, get maxStudents() { return this.rows * this.columns; } });
export type ClassroomEdge = 'left' | 'right' | 'front' | 'back' | 'none';
export interface SeatEnvironment { windowEdge: ClassroomEdge; doorEdge: ClassroomEdge }
export const SEAT_ENVIRONMENT: Readonly<SeatEnvironment> = Object.freeze({ windowEdge: 'left', doorEdge: 'right' });
