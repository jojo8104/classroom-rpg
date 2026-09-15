/** Paramètres exploratoires R13. Le temps est exprimé en jours de calendrier. */
export const sessionRules = {
  erosionGraceDays: 7, erosionPerDay: 0.12, longAbsenceDays: 28, longAbsenceMultiplier: 1.8,
  revisionRecovery: 0.8, revisionProtectionDays: 10, revisionProtection: 0.8,
  historyLimit: 5, repetitionLoss: 2,
  assessmentRounds: 2, assessmentAuthority: 8, assessmentMorale: 5,
  assessmentPressure: 90, assessmentEffort: 20,
  homeworkPatience: 6, homeworkMinutes: 30, dailyPreparationMinutes: 60,
  observation: { lecture: 2, exercise: 12, revision: 5, assessment: 35, homework: 3 },
};
