// Pasa las fotos viejas (PNG pesados en datos/imagenes) a JPG liviano en docs/imagenes,
// actualiza las rutas en los datos y borra la copia duplicada. Se puede correr las veces que haga falta.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("..", import.meta.url));
const OLD = path.join(root, "datos/imagenes"), NEW = path.join(root, "docs/imagenes");
const refsPath = path.join(root, "datos/references.json"), compsPath = path.join(root, "datos/components.json");
const toJpg = (p) => (p ? p.replace(/\.png$/i, ".jpg") : p);
let converted = 0, saved = 0;

for (const dir of ["capturas", "recortes"]) {
  for (const base of [OLD, NEW]) {
    const src = path.join(base, dir);
    if (!fs.existsSync(src)) continue;
    fs.mkdirSync(path.join(NEW, dir), { recursive: true });
    for (const f of fs.readdirSync(src).filter((x) => /\.png$/i.test(x))) {
      const from = path.join(src, f), to = path.join(NEW, dir, toJpg(f));
      const before = fs.statSync(from).size;
      // capturas: hasta 1440 px de ancho; recortes: hasta 1200 px
      await sharp(from).resize({ width: dir === "capturas" ? 1440 : 1200, withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: dir === "capturas" ? 68 : 78, mozjpeg: true }).toFile(to);
      saved += before - fs.statSync(to).size;
      fs.rmSync(from);
      converted++;
    }
  }
}
if (fs.existsSync(OLD)) fs.rmSync(OLD, { recursive: true, force: true });

const refs = JSON.parse(fs.readFileSync(refsPath, "utf8"));
for (const r of refs) for (const c of Object.values(r.captures ?? {})) if (c?.screenshot) c.screenshot = toJpg(c.screenshot);
fs.writeFileSync(refsPath, JSON.stringify(refs, null, 2));
const comps = JSON.parse(fs.readFileSync(compsPath, "utf8"));
for (const c of comps) c.crop = toJpg(c.crop);
fs.writeFileSync(compsPath, JSON.stringify(comps, null, 2));
console.log(`Imágenes convertidas: ${converted}. Espacio ahorrado: ${Math.round(saved / 1048576)} MB.`);
