// Cuenta cuántos sitios necesitan fotos (lo usa el proceso automático de GitHub).
import fs from "node:fs";
const refs = JSON.parse(fs.readFileSync(new URL("../datos/references.json", import.meta.url), "utf8"));
let comps = [];
try { comps = JSON.parse(fs.readFileSync(new URL("../datos/components.json", import.meta.url), "utf8")); } catch {}
const STORE = ["ecommerce", "marketplace"];
const needs = (ref) => {
  const pages = STORE.includes(ref.siteType) ? ["home", "categoria", "ficha", "carrito"] : ["home"];
  return ["desktop", "mobile"].some((d) => pages.some((pg) => {
    const key = pg === "home" ? d : `${d}_${pg}`;
    return ref.captures?.[key]?.status !== "ok" || !comps.some((c) => c.siteId === ref.id && c.device === d && (c.page ?? "home") === pg);
  }));
};
console.log(refs.filter(needs).length);
