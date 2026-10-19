// Cuenta cuántos sitios necesitan fotos (lo usa el proceso automático de GitHub).
import fs from "node:fs";
const refs = JSON.parse(fs.readFileSync(new URL("../datos/references.json", import.meta.url), "utf8"));
let comps = [];
try { comps = JSON.parse(fs.readFileSync(new URL("../datos/components.json", import.meta.url), "utf8")); } catch {}
const needs = (ref) => ["desktop", "mobile"].some((d) => ref.captures?.[d]?.status !== "ok" || !comps.some((c) => c.siteId === ref.id && c.device === d && (c.page ?? "home") === "home"));
console.log(refs.filter(needs).length);
