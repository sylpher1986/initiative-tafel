// D&D-termen (WP29, docs/i18n.md §4.2). Puur: geen DOM, geen catalogus.
// Een term (conditie, damage type, ability, monster-ref, presetnaam) is een stabiele Engelse id in opslag, export,
// snapshot en logdescriptor. Weergave gaat via term(kind, id), zodat een latere taal termen kan lokaliseren
// (instelling "D&D-termen: Engels | <taal>", na licentieonderzoek V7) zonder data te dupliceren.
// Voor en en nl is het label de Engelse term zelf: de app houdt de termen uit de SRD 5.1 (CLAUDE.md, Communicatie).

/** Label van een D&D-term. kind = "cond" | "dmg" | "ab" | …; id = de Engelse term zoals opgeslagen */
export const term = (kind, id) => (id == null ? "" : String(id));
