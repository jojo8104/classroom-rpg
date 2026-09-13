export const progressionRules = {
  thresholds: [0, 20, 50, 90, 140],
  specializationLevel: 5,
  rewards: { participation: 5, offense: 2, concentration: 2, morale: 2, pedagogy: 2, defense: 2, combo: 3, perseverance: 2, personal: 2 },
  caps: { participation: 1, offense: 2, concentration: 2, morale: 2, pedagogy: 2, defense: 2, combo: 2, perseverance: 1, personal: 1 },
  personalThreshold: 30,
};
export type UsageKind = 'offense' | 'concentration' | 'morale' | 'pedagogy' | 'defense' | 'combo';
export type RewardKind = keyof typeof progressionRules.rewards;
export const rewardLabels: Record<RewardKind, string> = { participation: 'Participation à la leçon', offense: 'Contribution offensive', concentration: 'Soutien de concentration', morale: 'Soutien moral', pedagogy: 'Aide pédagogique', defense: 'Protection utile', combo: 'Attaque combinée', perseverance: 'Difficulté surmontée', personal: 'Progression personnelle' };
export function getRequiredXpForLevel(level: number): number {
  if (!Number.isSafeInteger(level) || level < 1 || level > progressionRules.thresholds.length) throw new Error('Niveau invalide.');
  return progressionRules.thresholds[level - 1]!;
}
export function levelForXp(xp: number): number {
  if (!Number.isSafeInteger(xp) || xp < 0) throw new Error('XP invalide.');
  return progressionRules.thresholds.filter(threshold => xp >= threshold).length;
}
