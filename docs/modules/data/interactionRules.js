export function createInteractionRules() {
    return { negativeThreshold: 1.2, positiveThreshold: 0.8, chancePerUnit: 1,
        mainSupportMinimumRelation: 40, pedagogicalMinimum: 20, comboMinimum: 60, negativePowerMultiplier: 0.75 };
}
export function validateInteractionRules(rules) {
    for (const value of [rules.negativeThreshold, rules.positiveThreshold, rules.chancePerUnit]) {
        if (!Number.isFinite(value) || value < 0 || value > 10)
            throw new Error('Probabilité de comportement invalide.');
    }
    for (const value of [rules.pedagogicalMinimum, rules.comboMinimum, rules.mainSupportMinimumRelation]) {
        if (!Number.isFinite(value) || value < 0 || value > 100)
            throw new Error('Seuil de maîtrise invalide.');
    }
    if (!Number.isFinite(rules.negativePowerMultiplier) || rules.negativePowerMultiplier < 0 || rules.negativePowerMultiplier > 1)
        throw new Error('Modificateur négatif invalide.');
}
