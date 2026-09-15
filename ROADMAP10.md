# Roadmap 10 — Agenda et temps scolaire

## Utilisation

Dans **Agenda scolaire**, planifier une séance sur le créneau courant, choisir une leçon et une approche, puis lancer la leçon avec le bouton habituel sous la classe. La clôture consomme exactement un créneau. Naviguer dans l'agenda ne fait pas avancer le temps. Un créneau vide peut être explicitement laissé libre ; il est alors perdu. À la fin de l'année, aucune nouvelle séance ne peut être lancée.

Chaque séance se modifie, se déplace via sa destination (y compris dans une autre période), ou se supprime tant qu'elle n'est pas réalisée. L'agenda est verrouillé pendant une leçon. Une leçon peut être travaillée autant de fois que le temps disponible le permet, avec différentes approches et sans duplication du contenu.

Les devoirs sont planifiables mais restent différés, conformément au contrat existant de Roadmap 9. Pour continuer en classe lorsqu'un devoir occupe le créneau courant, le déplacer, le modifier ou le supprimer. Aucun résultat de devoir ni bonus pédagogique n'est inventé.

## Architecture

- `src/models/SchoolCalendar.ts` : CalendarConfig, SchoolCalendar, périodes, semaines, jours, créneaux et Session.
- `src/data/calendarConfig.ts` : configuration par défaut, 36 semaines d'enseignement, cinq jours potentiels, deux créneaux par jour, cinq périodes et huit semaines de vacances. Il s'agit d'un calendrier de campagne relatif, pas du calendrier officiel d'une zone scolaire.
- `src/systems/SchoolCalendar.ts` : validation et génération déterministe. Les IDs ne dépendent pas de l'horloge. Les vacances suivent les périodes ; les jours particuliers sont indexés par semaine absolue, vacances comprises. Les jours non travaillés n'ont aucun créneau scolaire. Les événements n'en ont pas non plus.
- `src/systems/Agenda.ts` : références aux leçons, conflits, déplacement, suppression, temps courant, échéances et persistance versionnée.
- `src/ui/AgendaView.ts` : présentation et formulaires. Les règles métier restent dans les systèmes.
- `src/ui/app.ts` : adaptation vers `selectLessonActivity` et le moteur existant, puis consommation à la clôture.

Le panneau Configuration expose les règles en JSON pour cette première version fonctionnelle. Elles sont modifiables avant toute séance et avant toute consommation de temps. La somme des semaines des périodes doit correspondre au nombre de semaines d'enseignement. Les jours potentiels, jours travaillés et créneaux sont configurables ; les bornes de validation protègent des tailles accidentelles, ce ne sont pas des règles scolaires.

Les créneaux portent un domaine `school | teacher`, prêt pour une extension hors classe. Cette version génère uniquement des créneaux scolaires et ne simule ni corrections, ni repos, ni formation.

## Indicateurs

Temps scolaire restant, créneaux libres, leçons non abordées, leçons sous le seuil configurable de maîtrise moyenne, détail de maîtrise par leçon et temps jusqu'à la fin de la période affichée. Une séance planifiée ne compte pas comme une leçon abordée. Les acquis d'une ancienne sauvegarde sont pris en compte même sans historique d'agenda.

La marge minimale de couverture compare les créneaux restants au nombre de leçons non abordées, en supposant une séance par leçon. Ce n'est ni une prévision de maîtrise ni une recommandation automatique. `indicators` accepte également un ID de créneau comme échéance future.

## Sauvegardes et limites

L'agenda utilise `classroom-rpg:<classroomId>:agenda:v1`, à côté de la sauvegarde de préparation inchangée. Il conserve la configuration, les références de séances, leur état, le curseur temporel et le compteur d'IDs. Le calendrier se régénère depuis la configuration. Une ancienne sauvegarde sans agenda reçoit un calendrier neuf en conservant élèves, placement, relations et acquis.

Les erreurs de lecture ou d'écriture sont affichées. Une sauvegarde d'agenda invalide n'est pas écrasée au chargement. Les modifications restent utilisables en mémoire si le stockage local est indisponible. Comme auparavant, une leçon en cours ne possède pas de sauvegarde de ses rounds : le rechargement reprend à la préparation du créneau, avant clôture. Les sauvegardes de classe et d'agenda utilisent deux clés : une défaillance de stockage entre leurs écritures ne permet pas une transaction atomique entre acquis et temps.

## Validation ciblée

`npm run typecheck`

`npx vitest run tests/agenda.test.ts tests/curriculum.test.ts tests/layout.test.ts`

`npm run build`

Les tests de Roadmap 10 couvrent les calendriers par défaut et alternatifs, les exceptions et vacances, les configurations invalides, les conflits et références invalides, plusieurs séances par leçon, les déplacements et suppressions, le temps fini, les devoirs différés, les indicateurs, la restauration et les erreurs de stockage. Une simulation compare le chemin agenda au même mode pédagogique direct avec la même seed. Les tests Roadmap 9 et placement couvrent les contrats directement utilisés. Aucun changement Roadmap 10 dans le moteur de combat, les classes RPG, les personnalités, les relations, les concepts ou leurs taux.
