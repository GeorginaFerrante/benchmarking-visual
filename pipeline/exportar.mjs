// Empaqueta las fotos de la última tanda sacada en tu compu en ZIPs de hasta ~20 MB,
// listos para subir a GitHub desde la web (carpeta datos/entrada). Cada ZIP trae sus fotos y sus datos.
// Uso: npm run exportar            → deja los ZIP en la carpeta «entrada» dentro de Descargas
//      npm run exportar -- RUTA    → los deja en otra carpeta
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));
const refs = read("datos/references.json"), comps = read("datos/components.json");
// Se exporta todo lo fotografiado bien hoy o ayer, aunque la tanda se haya cortado y retomado.
const d = new Date(), today = d.toISOString().slice(0, 10);
d.setUTCDate(d.getUTCDate() - 1);
const recent = new Set([today, d.toISOString().slice(0, 10)]);
const last = { fecha: today, sitios: refs.filter((r) => Object.values(r.captures ?? {}).some((c) => c?.status === "ok" && recent.has(c.date))).map((r) => r.id) };
const outDir = path.resolve(process.argv[2] ?? path.join(os.homedir(), "Downloads", "entrada"));
fs.mkdirSync(outDir, { recursive: true });
const IMG = path.join(root, "docs/imagenes");
const LIMIT = 20 * 1024 * 1024;

const ok = last.sitios.filter((id) => comps.some((c) => c.siteId === id));
let n = 0, zip = null, size = 0, part = { refs: [], comps: [] }, total = 0;
const flush = () => {
  if (!zip || !part.refs.length) return;
  zip.addFile("datos.json", Buffer.from(JSON.stringify(part)));
  const file = path.join(outDir, `fotos-${last.fecha}-${++n}.zip`);
  zip.writeZip(file);
  console.log(`${path.basename(file)}: ${part.refs.length} sitios, ${Math.round(fs.statSync(file).size / 1048576)} MB`);
  zip = null; size = 0; part = { refs: [], comps: [] };
};
for (const id of ok) {
  const ref = refs.find((r) => r.id === id);
  const mine = comps.filter((c) => c.siteId === id);
  const files = [...mine.map((c) => c.crop), ...Object.values(ref.captures ?? {}).map((c) => c?.screenshot)].filter(Boolean).filter((f) => fs.existsSync(path.join(IMG, f)));
  const bytes = files.reduce((s, f) => s + fs.statSync(path.join(IMG, f)).size, 0);
  if (zip && size + bytes > LIMIT) flush();
  if (!zip) zip = new AdmZip();
  for (const f of files) zip.addLocalFile(path.join(IMG, f), path.dirname(f));
  part.refs.push({ id, captures: ref.captures });
  part.comps.push(...mine);
  size += bytes; total++;
}
flush();
console.log(ok.length ? `Listo: ${total} sitios con fotos en ${n} archivo(s), en ${outDir}` : "No hay fotos nuevas para exportar.");
