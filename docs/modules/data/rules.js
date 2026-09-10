// Échelle provisoire commune aux statistiques du prototype.
export const statBounds = { min: 0, max: 100 };
export function createActionRules() {
    return {
        workBase: 2, intelligenceFactor: 0.08, concentrationFactor: 0.04,
        workVariation: 2, supportBonus: 10, extraActionChance: 0.25,
        maxExtraActionsPerStudent: 1, maxActionsPerRound: 36, maxChainDepth: 3,
        supportChanceByArchetype: { offensive: 0.1, defensive: 0.2, support: 0.65 },
    };
}
