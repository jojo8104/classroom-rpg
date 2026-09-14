import type { PrototypeScenario, Student, ClassRelations } from '../domain.js';
import type { ClassroomLayout, ClassroomPlans } from '../models/ClassroomLayout.js';
import { createLayout } from '../models/ClassroomLayout.js';
import { validateLayout } from './ClassroomLayoutSystem.js';
import { validateScenario } from '../engine/validation.js';
export interface PreparationSave { plans:ClassroomPlans;students:Student[];classRelations?:ClassRelations }
export function migratePreparationSave(saved: PreparationSave,scenario: PrototypeScenario): PreparationSave {
  if(saved?.plans?.version!==1 || !Array.isArray(saved.students) || saved.students.some(s=>!scenario.students.some(current=>current.id===s.id)) || validateLayout(saved.plans.currentLayout,saved.students).length || validateLayout(saved.plans.defaultLayout,saved.students).length) throw new Error('Sauvegarde incompatible.');
  const oldScenario={...scenario,students:saved.students,classroom:{...scenario.classroom,currentLayout:saved.plans.currentLayout}};
  if(saved.classRelations) oldScenario.classRelations=saved.classRelations; else delete oldScenario.classRelations;
  if(validateScenario(oldScenario).length) throw new Error('Profils sauvegardés invalides.');
  const students=scenario.students.map(current=>structuredClone(saved.students.find(s=>s.id===current.id) ?? current));
  const migrate=(old:ClassroomLayout):ClassroomLayout=>{
    const {rows,columns}=scenario.classroom;
    if(old.rows===rows && old.columns===columns && students.length===saved.students.length) return structuredClone(old);
    const result=createLayout(rows,columns), placed=new Set<string>();
    for(const seat of old.seats) {
      if(!seat.studentId && !seat.locked) continue;
      const target=result.seats.find(s=>s.row===seat.row && s.column===seat.column);
      if(!target) throw new Error('La nouvelle grille ne contient pas toutes les places sauvegardées.');
      target.studentId=seat.studentId; target.locked=seat.locked; if(seat.studentId) placed.add(seat.studentId);
    }
    const newcomers=students.filter(s=>!placed.has(s.id) && s.present!==false);
    for(const student of newcomers) { const seat=result.seats.find(s=>s.studentId===null && !s.locked); if(!seat) throw new Error('Pas assez de places libres.'); seat.studentId=student.id; }
    if(validateLayout(result,students).length) throw new Error('Migration de plan invalide.');
    return result;
  };
  const links=new Map((scenario.classRelations?.links ?? []).map(l=>[JSON.stringify([l.from,l.to]),structuredClone(l)]));
  for(const link of saved.classRelations?.links ?? []) links.set(JSON.stringify([link.from,link.to]),structuredClone(link));
  return {students,classRelations:{links:[...links.values()]},plans:{version:1,currentLayout:migrate(saved.plans.currentLayout),defaultLayout:migrate(saved.plans.defaultLayout),
    savedLayouts:Object.fromEntries(Object.entries(saved.plans.savedLayouts ?? {}).map(([name,layout])=>{ if(validateLayout(layout,saved.students).length) throw new Error('Plan nommé invalide.'); return [name,migrate(layout)]; }))}};
}
