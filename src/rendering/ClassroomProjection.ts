export interface LogicalPosition { row: number; column: number }
export const CLASSROOM_PERSPECTIVE = {
  width: 1600, height: 900, horizonY: 180, firstRowY: 315,
  rowGap: 119, frontScale: 0.72, backScale: 1, horizontalGap: 285,
  deskWidth: 230, deskHeight: 150,
};
/** Pure rendering math. Row zero is nearest the board. Never persisted. */
export class ClassroomProjection {
  constructor(public rows = 5, public columns = 5, public config = CLASSROOM_PERSPECTIVE) {}
  project(row: number, column: number) {
    if (!Number.isInteger(row) || !Number.isInteger(column) || row < 0 || row >= this.rows || column < 0 || column >= this.columns) throw new RangeError('Place hors de la classe');
    const c = this.config;
    const scale = c.frontScale + (c.backScale - c.frontScale) * row / Math.max(1, this.rows - 1);
    const gap = Math.min(c.horizontalGap, (c.width - c.deskWidth - 80) / Math.max(1, this.columns - 1));
    const rowGap = Math.min(c.rowGap, (c.height - c.firstRowY - 100) / Math.max(1, this.rows - 1));
    return { x: c.width / 2 + (column - (this.columns - 1) / 2) * gap * scale, y: c.firstRowY + row * rowGap, scale };
  }
}
