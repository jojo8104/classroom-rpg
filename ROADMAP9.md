# Roadmap 9

Le catalogue sérialisable `src/data/curriculum.ts` contient programmes, matières, chapitres et leçons avec références par ID. `Topic` reste le nom historique du chapitre (`Chapter` est un alias), `topicId` sa référence et `name` le titre.

`selectLessonActivity(scenario, curriculum, { lessonId, teachingMode })` résout une activité sans modifier le catalogue. Les prérequis sont des seuils déclaratifs ; ils ne bloquent pas une classe hétérogène. Les références et cycles sont validés.

`Student.lessonMastery[lessonId]` stocke la maîtrise persistante 0–100 ; `lessonProgress` expose studentId/lessonId/mastery. Les sauvegardes v1 conservent ce champ et les IDs inconnus. Un champ absent vaut zéro, sans déduire de maîtrise des connaissances de concepts. La compréhension temporaire repart de zéro pour conserver le combat. Consolidation en fin de séance : maîtrise + (100 - maîtrise) × compréhension / 100. Les absents sont préservés.

Le registre `src/data/teachingModes.ts` centralise les hooks : gain selon acquis, probabilité de concepts, paramètres pédagogiques et ressources initiales. Lecture, exercices et révisions partagent provisoirement le gameplay. L’évaluation mesure la compréhension sans augmenter la maîtrise. Les devoirs sont définis comme différés et refusés par le simulateur de classe, en attendant la Roadmap 10. L’interface affiche la hiérarchie et permet le choix du mode. Le choix d’autres leçons est disponible via l’API du catalogue.

`simulation.session` expose lessonId, teachingMode et état temporaire. Aucun calendrier ou temps du professeur ajouté.

Les concepts gardent leur catalogue global, conditions et taux facultatifs, associations par ID et taux spécifiques prioritaires. Découvertes possibles après un round de progression significative puis au bilan XP historique. Les bonus learning_boost compatibles agissent dès le round suivant. Les autres types d’effets restent les hooks existants.

## Validation

9 tests ciblés réussis, puis une validation globale unique : 289 tests réussis (20 fichiers). Vérification TypeScript et compilation web réussies. Pas de vérification visuelle manuelle dans le navigateur.
