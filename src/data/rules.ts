// Échelle provisoire commune aux statistiques du prototype.
export const statBounds = { min: 0, max: 100 } as const;

export interface ActionRules {
  workScale: number;
  pressureScale: number;
  defenseReference: number;
  criticalChance: number;
  criticalMultiplier: number;
  dropoutMoraleLoss: number;
  recovery: number;
  workVariation: number;
  supportBonus: number;
  extraActionChance: number;
  maxExtraActionsPerStudent: number;
  maxActionsPerRound: number;
  maxChainDepth: number;
  maxReactionsPerStudent: number;
  supportChanceByArchetype: Record<string, number>;
}

export function createActionRules(): ActionRules {
  return {
    workScale: 0.65, pressureScale: 0.65, defenseReference: 50,
    criticalChance: 0.1, criticalMultiplier: 1.5, dropoutMoraleLoss: 8, recovery: 30,
    workVariation: 0.1, supportBonus: 10, extraActionChance: 0.25,
    maxExtraActionsPerStudent: 1, maxActionsPerRound: 36, maxChainDepth: 3,
    maxReactionsPerStudent: 1,
    supportChanceByArchetype: { offensive: 0.1, defensive: 0.2, support: 0.65 },
  };
}
