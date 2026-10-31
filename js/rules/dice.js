// Dobbelstenen en kleine rekenhulpjes. rng is injecteerbaar zodat tests voorspelbaar zijn.
// d, rollExpr, HD_RE en avgExpr staan sinds WP79 in de gedeelde module js/dice/roll.js (één plek voor de rolcode);
// hier alleen doorgegeven zodat de aanroepers in Initiative ongewijzigd blijven.
export { d, HD_RE, rollExpr, avgExpr } from "../dice/roll.js";

export const mod = (score) => Math.floor((score - 10) / 2);
export const sgn = (n) => (n >= 0 ? "+" : "") + n;
export const uid = () => Math.random().toString(36).slice(2, 9);
