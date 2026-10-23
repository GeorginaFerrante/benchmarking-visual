// Suma al proyecto las fotos sacadas en una compu (ZIPs subidos a datos/entrada).
// Reemplaza las fotos y medidas de esos sitios y después borra los ZIP. Lo corre el proceso automático.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";

const root = fileURLToPath(new URL("..", import.meta.url));
const IN = path.join(root, "datos/entrada"), IMG = path.join(root, "docs/imagenes");
if (!fs.existsSync(IN)) { console.log("No hay fotos para importar."); process.exit(0); }
const zips = fs.readdirSync(IN).filter((f) => f.endsWith(".zip"));
if (!zips.length) { console.log("No hay fotos para importar."); process.exit(0); }
const refsPath = path.join(root, "datos/references.json"), compsPath = path.join(root, "datos/components.json");
const refs = JSON.parse(fs.readFileSync(refsPath, "utf8"));
let comps = JSON.parse(fs.readFileSync(compsPath, "utf8"));
let sitios = 0;
for (const z of zips) {
  const zip = new AdmZip(path.join(IN, z));
  const data = JSON.parse(zip.readAsText("datos.json"));
  for (const e of zip.getEntries()) {
    if (e.isDirectory || e.entryName === "datos.json") continue;
    const dest = path.join(IMG, e.entryName);
    if (!dest.startsWith(IMG)) continue; // seguridad: nada fuera de docs/imagenes
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, e.getData());
  }
  for (const r of data.refs) {
    const ref = refs.find((x) => x.id === r.id);
    if (!ref) continue;
    // Solo se reemplazan las páginas que en la compu salieron bien.
    for (const [key, cap] of Object.entries(r.captures ?? {})) {
      if (cap?.status !== "ok") continue;
      ref.captures[key] = cap;
      const [device, pg = "home"] = key.split("_");
      comps = comps.filter((c) => !(c.siteId === r.id && c.device === device && (c.page ?? "home") === pg));
      comps.push(...data.comps.filter((c) => c.siteId === r.id && c.device === device && (c.page ?? "home") === pg));
    }
    sitios++;
  }
  fs.rmSync(path.join(IN, z));
  console.log(`${z}: importado.`);
}
fs.writeFileSync(refsPath, JSON.stringify(refs, null, 2));
fs.writeFileSync(compsPath, JSON.stringify(comps, null, 2));
console.log(`Fotos importadas de ${sitios} sitios.`);
