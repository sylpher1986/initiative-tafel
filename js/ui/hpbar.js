// HP-balk: fractie en kleurklasse. Puur en bewust zonder soort (WP36, HS12): speler en monster krijgen bij dezelfde HP-fractie
// dezelfde klasse en dus dezelfde kleur; identiteit zit alleen in de vorm van de avatar (js/ui/avatar.js).
/** Fractie 0..1 (zonder max HP: vol) */
export const hpPct = (hp, max) => (max ? Math.min(1, Math.max(0, hp) / max) : 1);
/** "" gezond (> 50 %), "mid" gewond (≤ 50 %), "low" kritiek (≤ 25 %) */
export const hpCls = (hp, max) => { const p = hpPct(hp, max); return p <= 0.25 ? "low" : p <= 0.5 ? "mid" : ""; };
