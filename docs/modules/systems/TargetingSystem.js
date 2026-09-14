export class TargetingSystem {
    layout;
    constructor(layout) {
        this.layout = layout;
    }
    getTargets({ sourceStudentId, rangeType, rangeValue = 1, includeSource = false, filters = [] }) {
        const seat = this.layout.getStudentSeat(sourceStudentId);
        if (!seat)
            return [];
        let targets;
        switch (rangeType) {
            case 'SELF':
                targets = [sourceStudentId];
                break;
            case 'ADJACENT':
                targets = this.layout.getNeighbors(sourceStudentId).direct;
                break;
            case 'DIAGONAL':
                targets = this.layout.getNeighbors(sourceStudentId, { diagonals: true }).diagonal;
                break;
            case 'ROW':
                targets = this.layout.getStudentsInRow(seat.row);
                break;
            case 'COLUMN':
                targets = this.layout.getStudentsInColumn(seat.column);
                break;
            case 'RADIUS':
                targets = this.layout.getStudentsInRadius(seat.id, rangeValue);
                break;
            case 'GLOBAL':
                targets = this.layout.getAllStudents();
                break;
            default: throw new Error('Portée inconnue.');
        }
        return targets.filter(id => (rangeType === 'SELF' || includeSource || id !== sourceStudentId) && filters.every(filter => filter(id)));
    }
}
export const INTERACTION_RANGES = { SUPPORT: 'ADJACENT', DISRUPT: 'ADJACENT', REACTION: 'ADJACENT', COMPARISON: 'ADJACENT' };
