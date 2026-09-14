import type { ClassRelations, DirectedRelation } from '../domain.js';
/** Index d'une séance : références aux liens, scores toujours actuels. */
export class RelationIndex {
  private bySource = new Map<string,Map<string,DirectedRelation>>();
  private indexed = 0;
  constructor(private relations: ClassRelations) { this.appendNewLinks(); }
  private appendNewLinks() {
    for (;this.indexed<this.relations.links.length;this.indexed++) {
      const link=this.relations.links[this.indexed]!;
      let targets=this.bySource.get(link.from); if(!targets) { targets=new Map();this.bySource.set(link.from,targets); }
      targets.set(link.to,link);
    }
  }
  getRelation(from: string,to: string): number { this.appendNewLinks(); return this.bySource.get(from)?.get(to)?.score ?? 0; }
}
