// Échelle provisoire commune aux statistiques du prototype.
export const statBounds = { min: 0, max: 100 } as const;

export interface ActionRules {
  workBase: number;
  intelligenceFactor: number;
  concentrationFactor: number;
  workVariation: number;
  supportBonus: number;
  extraActionChance: number;
  maxExtraActionsPerStudent: number;
  maxActionsPerRound: number;
  maxChainDepth: number;
  supportChanceByArchetype: Record<string, number>;
}

export function createActionRules(): ActionRules {
  return {
    workBase: 2, intelligenceFactor: 0.08, concentrationFactor: 0.04,
    workVariation: 2, supportBonus: 10, extraActionChance: 0.25,
    maxExtraActionsPerStudent: 1, maxActionsPerRound: 36, maxChainDepth: 3,
    supportChanceByArchetype: { offensive: 0.1, defensive: 0.2, support: 0.65 },
  };
}
