import { CLASSROOM_CONFIG, type ClassroomConfig } from './classroomConfig.js';
import { createPreparationPrototype } from './preparationPrototype.js';
import { createLayout } from '../models/ClassroomLayout.js';
import { ClassroomLayoutSystem } from '../systems/ClassroomLayoutSystem.js';
import { createPersonality } from '../engine/social.js';
import { createProgression } from '../engine/progression.js';
import { SeededRandom } from '../engine/random.js';
import type { Student } from '../domain.js';

const names = ['Alice','Paul','Léa','Hugo','Emma','Louis','Inès','Adam','Chloé','Gabriel','Sarah','Farid','Hana','Thomas','Nora','Jules','Zoé','Sami','Clara','Noé','Maya','Bastien','Lina','Raphaël','Yasmine','Éden','Léon','Aya','Malo','Élise'];
export function createFullClassPrototype(config: ClassroomConfig = CLASSROOM_CONFIG) {
  if (!Number.isSafeInteger(config.maxStudents) || config.maxStudents<0 || config.maxStudents>config.rows*config.columns) throw new Error('Effectif incompatible avec la grille.');
  const scenario = createPreparationPrototype(), random = new SeededRandom(701);
  const roles = scenario.archetypes.map(a=>a.id);
  scenario.students = Array.from({length:config.maxStudents},(_,i): Student => {
    const archetypeId = roles[i % roles.length]!;
    const struggling = i % 4 === 0, turbulent = i % 6 === 3;
    const personality = createPersonality(710+i);
    if (archetypeId === 'support') personality.altruistic = 0.8;
    if (turbulent) { personality.impulsive=0.9; personality.calm=0.1; }
    return { id:`student-${i+1}`, name:names[i] ?? `Élève ${i+1}`, archetypeId, present:true,
      intelligence: struggling ? 28+random.integer(25) : 50+random.integer(46), discipline:turbulent ? 20+random.integer(26) : 50+random.integer(46),
      concentration:45+random.integer(56), morale:35+random.integer(61), personality,
      knowledge:Object.fromEntries(scenario.lesson.conceptIds.map(id=>[id,struggling ? 12+random.integer(30) : 48+random.integer(48)])),
      progression:createProgression(archetypeId,random.integer(4)*80), disruptionChance:turbulent ? 0.35 : 0.02,
      seatPreferences:{likes:[struggling ? 'front' : turbulent ? 'back' : 'near_window'],dislikes:[turbulent ? 'front' : 'near_door']} };
  });
  const layout = createLayout(config.rows,config.columns,scenario.students.map(s=>s.id));
  scenario.classroom = {id:scenario.classroom.id, rows:config.rows, columns:config.columns,seats:layout.seats,currentLayout:layout,defaultLayout:structuredClone(layout)};
  const system = new ClassroomLayoutSystem(layout);
  scenario.classRelations = { links: [] };
  // Liens orientés locaux et quelques affinités distantes ; les autres sont neutres.
  for (const student of scenario.students) {
    for (const target of system.getNeighbors(student.id).direct) {
      if (random.next()<0.22) continue;
      const row = system.getStudentSeat(student.id)!.row;
      const score = row < config.rows/2 ? 20+random.integer(66) : -65+random.integer(111);
      scenario.classRelations.links.push({from:student.id,to:target,score});
    }
  }
  const first=scenario.students[0], last=scenario.students.at(-1);
  if(first && last && first.id!==last.id && !scenario.classRelations.links.some(l=>l.from===first.id && l.to===last.id)) scenario.classRelations.links.push({from:first.id,to:last.id,score:72});
  return scenario;
}
