// Verifica la integridad de los datos antes de publicar.
import fs from "node:fs";
const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), "utf8"));
const refs = read("../datos/references.json");
const comps = read("../datos/components.json");
const rules = read("../datos/rules.json");
const errors = [];
const ids = new Set(refs.map((r) => r.id));
if (ids.size !== refs.length) errors.push("Hay ids de referentes repetidos.");
for (const r of refs) {
  if (!r.sources?.length) errors.push(`${r.id}: falta fuente.`);
  if (r.demo) errors.push(`${r.id}: un referente ficticio está en los datos reales.`);
}
for (const c of comps) {
  if (!ids.has(c.siteId)) errors.push(`${c.id}: el sitio ${c.siteId} no existe.`);
  if (c.method === "demo") errors.push(`${c.id}: componente de demostración en datos reales.`);
  if (c.crop && !fs.existsSync(new URL(`../docs/imagenes/${c.crop}`, import.meta.url))) errors.push(`${c.id}: falta el recorte ${c.crop}.`);
}
const rids = rules.map((r) => r.id);
if (new Set(rids).size !== rids.length) errors.push("Hay reglas con id repetido.");
const ok = refs.filter((r) => r.captures?.desktop?.status === "ok").length;
console.log(`${refs.length} referentes, ${ok} con captura de escritorio, ${comps.length} componentes medidos.`);
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("Datos válidos.");
