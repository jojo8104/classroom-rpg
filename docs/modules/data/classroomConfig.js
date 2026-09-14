export const CLASSROOM_CONFIG = Object.freeze({ rows: 5, columns: 5, get maxStudents() { return this.rows * this.columns; } });
export const SEAT_ENVIRONMENT = Object.freeze({ windowEdge: 'left', doorEdge: 'right' });
