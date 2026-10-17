// Genera src/data/references.json a partir de pipeline/sites.source.mjs,
// conservando el estado de capturas existentes.
import fs from "node:fs";
import { ROWS, SOURCES, POSITIONING } from "./sites.source.mjs";
const out = new URL("../datos/references.json", import.meta.url);
let prev = [];
try { prev = JSON.parse(fs.readFileSync(out, "utf8")); } catch {}
const byId = Object.fromEntries(prev.map((r) => [r.id, r]));
const refs = ROWS.map(([id, name, url, country, siteType, sector, objectives, src, reason]) => ({
  id, name, url, country, siteType, sector, objectives, reason,
  positioning: ["ecommerce", "marketplace"].includes(siteType) ? (Object.keys(POSITIONING).find((k) => POSITIONING[k].includes(id)) ?? "precio") : undefined,
  sources: [SOURCES[src]],
  demo: false,
  captures: byId[id]?.captures ?? { desktop: { status: "no_capturada" }, mobile: { status: "no_capturada" } },
}));
fs.writeFileSync(out, JSON.stringify(refs, null, 2));
console.log(`references.json: ${refs.length} referentes`);
