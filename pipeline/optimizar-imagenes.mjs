// Pasa las fotos viejas (PNG pesados en datos/imagenes) a JPG liviano en docs/imagenes,
// actualiza las rutas en los datos y borra la copia duplicada. Se puede correr las veces que haga falta.
// Si una imagen no se puede convertir, se deja la original y se sigue con las demás.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("..", import.meta.url));
const OLD = path.join(root, "datos/imagenes"), NEW = path.join(root, "docs/imagenes");
const refsPath = path.join(root, "datos/references.json"), compsPath = path.join(root, "datos/components.json");
const MAX_H = 3000; // de los recortes muy altos (por ejemplo, un listado entero) alcanza con la parte de arriba
let converted = 0, kept = 0, saved = 0;

for (const dir of ["capturas", "recortes"]) {
  fs.mkdirSync(path.join(NEW, dir), { recursive: true });
  for (const base of [OLD, NEW]) {
    const src = path.join(base, dir);
    if (!fs.existsSync(src)) continue;
    for (const f of fs.readdirSync(src).filter((x) => /\.png$/i.test(x))) {
      const from = path.join(src, f), to = path.join(NEW, dir, f.replace(/\.png$/i, ".jpg"));
      const before = fs.statSync(from).size;
      try {
        const maxW = dir === "capturas" ? 1440 : 1200;
        const meta = await sharp(from, { limitInputPixels: false }).metadata();
        let img = sharp(from, { limitInputPixels: false });
        // primero se achica el ancho y después se corta el alto que sobre
        const scale = Math.min(1, maxW / (meta.width || maxW));
        const h = Math.round((meta.height || 1) * scale);
        img = img.resize({ width: Math.round((meta.width || maxW) * scale) });
        const buf = await img.png().toBuffer();
        await sharp(buf, { limitInputPixels: false })
          .extract({ left: 0, top: 0, width: Math.round((meta.width || maxW) * scale), height: Math.min(h, MAX_H) })
          .flatten({ background: "#ffffff" })
          .jpeg({ quality: dir === "capturas" ? 68 : 78, mozjpeg: true })
          .toFile(to);
        saved += before - fs.statSync(to).size;
        fs.rmSync(from);
        converted++;
      } catch (e) {
        // se deja el PNG en docs/imagenes para que la página la siga mostrando
        const keep = path.join(NEW, dir, f);
        if (from !== keep) fs.copyFileSync(from, keep);
        kept++;
        console.log(`No se pudo convertir ${dir}/${f}: ${String(e.message ?? e).slice(0, 80)}`);
      }
    }
  }
}
if (fs.existsSync(OLD)) fs.rmSync(OLD, { recursive: true, force: true });

// Las rutas pasan a .jpg solo si el JPG existe; si no, quedan como estaban.
const fix = (p) => {
  if (!p || !/\.png$/i.test(p)) return p;
  const jpg = p.replace(/\.png$/i, ".jpg");
  return fs.existsSync(path.join(NEW, jpg)) ? jpg : p;
};
const refs = JSON.parse(fs.readFileSync(refsPath, "utf8"));
for (const r of refs) for (const c of Object.values(r.captures ?? {})) if (c?.screenshot) c.screenshot = fix(c.screenshot);
fs.writeFileSync(refsPath, JSON.stringify(refs, null, 2));
const comps = JSON.parse(fs.readFileSync(compsPath, "utf8"));
for (const c of comps) c.crop = fix(c.crop);
fs.writeFileSync(compsPath, JSON.stringify(comps, null, 2));
console.log(`Imágenes convertidas: ${converted}. Dejadas como estaban: ${kept}. Espacio ahorrado: ${Math.round(saved / 1048576)} MB.`);
