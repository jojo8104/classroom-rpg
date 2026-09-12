export interface LearningRules {
  successMorale: number;
  effortConcentration: number;
  damageMoraleRatio: number;
  maxRetaliationMoraleLoss: number;
}
export function createLearningRules(): LearningRules {
  return { successMorale: 1, effortConcentration: 1, damageMoraleRatio: 0.05, maxRetaliationMoraleLoss: 1 };
}
export function validateLearningRules(rules: LearningRules): void {
  for (const value of [rules.successMorale, rules.effortConcentration, rules.damageMoraleRatio, rules.maxRetaliationMoraleLoss]) {
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error('Règles de réussite et effort invalides.');
  }
}
