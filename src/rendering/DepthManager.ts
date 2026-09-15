export const LOCAL_LAYERS = { shadow: 0, student: 10, chair: 20, desk: 30, objects: 40, foreground: 50 } as const;
export class DepthManager {
  static row(row: number) { return 100 + row * 100; }
  static local(row: number, layer: keyof typeof LOCAL_LAYERS) { return this.row(row) + LOCAL_LAYERS[layer]; }
  static effects(rows: number) { return this.row(rows); }
}
