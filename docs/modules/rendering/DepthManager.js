export const LOCAL_LAYERS = { shadow: 0, student: 10, chair: 20, desk: 30, objects: 40, foreground: 50 };
export class DepthManager {
    static row(row) { return 100 + row * 100; }
    static local(row, layer) { return this.row(row) + LOCAL_LAYERS[layer]; }
    static effects(rows) { return this.row(rows); }
}
