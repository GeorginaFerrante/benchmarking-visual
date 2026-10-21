import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { computePattern, matchesCriteria, formatFrequency, scorePattern, contrastRatio, compareLabel, slugify } from "../generador/core.mjs";
const refs = JSON.parse(fs.readFileSync(new URL("../datos/references.json", import.meta.url)));
const rules = JSON.parse(fs.readFileSync(new URL("../datos/rules.json", import.meta.url)));

const site = (id, status = "ok") => ({ id, captures: { desktop: { status } } });
const comp = (siteId, w) => ({ id: siteId + "-s", siteId, device: "desktop", type: "search_bar", region: "header", box: { x: 0, y: 0, w, h: 40 }, viewport: { w: 1000, h: 800 }, styles: { background: "#FFFFFF", radius: 4 }, hasIcon: true });
const rule = { id: "t", componentType: "search_bar", device: "desktop", criteria: { region: "header", widthNorm: [0.3, 0.7] }, goodFor: ["vender"], clarity: 0.9 };

describe("frecuencia", () => {
  it("usa solo capturas válidas y distingue ausentes de fallidas", () => {
    const header = { ...comp("d", 1000), id: "d-h", type: "header" };
    const r = computePattern(rule, [site("a"), site("b"), site("c"), site("d"), site("e", "fallida")], [comp("a", 500), comp("b", 600), comp("c", 100), header]);
    expect(r.validSites).toHaveLength(4);
    expect(r.matching).toEqual(["a", "b"]);
    expect(r.exceptions).toEqual(["c"]);
    expect(r.absent).toEqual(["d"]);
    expect(formatFrequency(r)).toBe("2 de 3 que lo tienen (67 %)");
  });
  it("tolerancias inclusivas", () => {
    expect(matchesCriteria(comp("x", 300), rule.criteria)).toBe(true);
    expect(matchesCriteria(comp("x", 299), rule.criteria)).toBe(false);
  });
});
describe("recomendador", () => {
  it("no puntúa con muestra insuficiente", () => {
    expect(scorePattern(computePattern(rule, [site("a"), site("b")], [comp("a", 500)]), "vender").score).toBeNull();
  });
  it("puntaje 0–100 redondeado a 5 y sensible al objetivo", () => {
    const ss = ["a", "b", "c", "d", "e"].map((i) => site(i));
    const p = computePattern(rule, ss, ss.map((s) => comp(s.id, 500)));
    const v = scorePattern(p, "vender").score, i = scorePattern(p, "informar").score;
    expect(v % 5).toBe(0);
    expect(v).toBeGreaterThan(i);
  });
  it("etiqueta comparaciones", () => {
    const ss = ["a", "b", "c"].map((i) => site(i));
    const p = computePattern(rule, ss, ss.map((s) => comp(s.id, 500)));
    expect(compareLabel(p, [p, p])).toBe("Patrón compartido");
  });
});
describe("contraste y textos", () => {
  it("WCAG", () => expect(contrastRatio("#000000", "#FFFFFF")).toBe(21));
  it("slug sin tildes", () => expect(slugify("México")).toBe("mexico"));
});
describe("datos", () => {
  it("referentes con fuente y URL", () => {
    for (const r of refs) { expect(r.sources.length).toBeGreaterThan(0); expect(r.url).toMatch(/^https?:\/\//); expect(r.demo).toBe(false); }
  });
  it("reglas con id único", () => expect(new Set(rules.map((r) => r.id)).size).toBe(rules.length));
});

import { componentVerdict, similarity, groupCountries } from "../generador/core.mjs";
describe("lo que comparten y lo que no", () => {
  const ss = ["a", "b", "c", "d", "e"].map((i) => site(i));
  const wide = { ...rule, id: "w" }, compact = { ...rule, id: "c", criteria: { region: "header", widthNorm: [0, 0.3] } };
  it("comparten cuando 70 % o más coincide", () => {
    const v = componentVerdict([wide, compact], ss, ss.map((s, i) => comp(s.id, i < 4 ? 500 : 100)), "search_bar", "desktop");
    expect(v.status).toBe("comparten");
    expect(v.best.rule.id).toBe("w");
  });
  it("no comparten cuando están repartidos", () => {
    const v = componentVerdict([wide, compact], ss, ss.map((s, i) => comp(s.id, i < 3 ? 500 : 100)), "search_bar", "desktop");
    expect(v.status).toBe("no-comparten");
  });
  it("sin datos con muestra chica", () => {
    expect(componentVerdict([wide], ss.slice(0, 2), [comp("a", 500)], "search_bar", "desktop").status).toBe("sin-datos");
  });
  it("similitud informa rangos reales", () => {
    const p = computePattern(wide, ss, ss.map((s, i) => comp(s.id, 400 + i * 50)));
    expect(similarity(p, ss.map((s, i) => comp(s.id, 400 + i * 50))).width).toEqual([40, 60]);
  });
  it("agrupa países parecidos", () => {
    const g = groupCountries({ AR: { x: 0.8, y: 0.2 }, MX: { x: 0.75, y: 0.25 }, US: { x: 0.1, y: 0.9 } });
    expect(g).toEqual([["AR", "MX"], ["US"]]);
  });
});

describe("capturas vacías", () => {
  it("una captura «ok» sin partes medidas no cuenta como válida", () => {
    const r = computePattern(rule, [site("a"), site("vacia")], [comp("a", 500)]);
    expect(r.validSites).toEqual(["a"]);
    expect(r.absent).toEqual([]);
  });
});
