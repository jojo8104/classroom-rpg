/** Index d'une séance : références aux liens, scores toujours actuels. */
export class RelationIndex {
    relations;
    bySource = new Map();
    indexed = 0;
    constructor(relations) {
        this.relations = relations;
        this.appendNewLinks();
    }
    appendNewLinks() {
        for (; this.indexed < this.relations.links.length; this.indexed++) {
            const link = this.relations.links[this.indexed];
            let targets = this.bySource.get(link.from);
            if (!targets) {
                targets = new Map();
                this.bySource.set(link.from, targets);
            }
            targets.set(link.to, link);
        }
    }
    getRelation(from, to) { this.appendNewLinks(); return this.bySource.get(from)?.get(to)?.score ?? 0; }
}
