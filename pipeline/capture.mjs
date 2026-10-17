// Captura y recorte de componentes. Corre en GitHub (todos los meses) o en tu computadora:
//   npm run capture                 → todos los referentes
//   npm run capture -- AR           → solo un país
//   npm run capture -- ar-fravega   → un sitio puntual
//   npm run capture -- --faltantes  → solo los sitios que todavía no tienen fotos
// Procesa varios sitios a la vez (variable CONCURRENCY, por defecto 4).
// En tiendas online además entra a una ficha de producto y a una página de categoría.
// Resultado: datos/imagenes/{capturas,recortes}/*.png, datos/components.json y estado en datos/references.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
const refsPath = path.join(root, "datos/references.json");
const compsPath = path.join(root, "datos/components.json");
const imgRoot = path.join(root, "datos/imagenes");
fs.mkdirSync(path.join(imgRoot, "capturas"), { recursive: true });
fs.mkdirSync(path.join(imgRoot, "recortes"), { recursive: true });

const LOCALES = { AR: ["es-AR", "America/Argentina/Buenos_Aires"], US: ["en-US", "America/New_York"], CN: ["zh-CN", "Asia/Shanghai"], MX: ["es-MX", "America/Mexico_City"], BR: ["pt-BR", "America/Sao_Paulo"], CL: ["es-CL", "America/Santiago"], JP: ["ja-JP", "Asia/Tokyo"], IN: ["en-IN", "Asia/Kolkata"], DE: ["de-DE", "Europe/Berlin"], PL: ["pl-PL", "Europe/Warsaw"], TR: ["tr-TR", "Europe/Istanbul"], ID: ["id-ID", "Asia/Jakarta"], FR: ["fr-FR", "Europe/Paris"], ES: ["es-ES", "Europe/Madrid"], GB: ["en-GB", "Europe/London"], IT: ["it-IT", "Europe/Rome"] };
const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" },
};
const STORE_TYPES = ["ecommerce", "marketplace"];
const CART_RE = /carrito|\/cart|\/basket|\/bag|cesta|panier|warenkorb|carrello|sepet|koszyk|keranjang|购物车|カート/i;
const ADD_RE = /agregar al carrito|añadir al carrito|add to cart|adicionar ao carrinho|in den warenkorb|ajouter au panier|aggiungi al carrello|sepete ekle|do koszyka|keranjang|加入购物车|カートに入れる|comprar/i;
// Qué buscar en cada página. Se puede sobrescribir por sitio con "selectors" en references.json.
const SELECTORS = {
  home: {
    top_bar: ["[class*=top-bar i]", "[class*=topbar i]", "[class*=announcement i]", "[class*=promo-bar i]", "[class*=pre-header i]", "[class*=preheader i]", "[class*=top-banner i]", "[class*=header-top i]"],
    header: ["header", "[role=banner]", "#header", ".header"],
    logo: ["header a[href='/'] img", "header a[href='/'] svg", "header [class*=logo i]", "[class*=logo i] img", "[class*=logo i]"],
    search_bar: ["form[role=search]", "[role=search]", "header form:has(input)", "input[type=search]", "input[name=q]", "input[name*=search i]", "input[placeholder*=busc i]", "input[placeholder*=search i]", "input[placeholder*=pesquis i]", "input[placeholder*=搜索]", "input[placeholder*=検索]"],
    main_nav: ["header nav", "nav[aria-label*=princip i]", "nav[aria-label*=main i]", "[role=navigation]", "nav"],
    hero: ["main [class*=hero i]", "[class*=banner i]:not(header *)", "[class*=carousel i]", "[class*=slider i]", "main section:first-of-type"],
    primary_button: ["main a[class*=btn-primary i]", "main button[class*=primary i]", "main a[class*=button i]", "a[class*=cta i]", "main button:not([aria-label])"],
    footer: ["footer", "[role=contentinfo]", "#footer", ".footer"],
  },
  ficha: {
    gallery: ["[class*=gallery i]", "[class*=product-image i]", "[class*=media-gallery i]", "[data-testid*=gallery i]", "main img"],
    price: ["[itemprop=price]", "[data-testid*=price i]", "[class*=price-tag i]", "[class*=price i]:not([class*=old i]):not([class*=before i])"],
    buy_button: ["text=/comprar ahora|agregar al carrito|añadir al carrito|add to cart|buy now|adicionar ao carrinho|comprar|in den warenkorb|ajouter au panier|aggiungi al carrello|sepete ekle|do koszyka|keranjang|加入购物车|立即购买|カートに入れる/i", "button[name*=add i]", "[class*=add-to-cart i]", "[id*=add-to-cart i]"],
  },
  carrito: {
    cart_summary: ["[class*=summary i]", "[class*=order-total i]", "[class*=cart-total i]", "[class*=totals i]", "aside"],
    checkout_button: ["text=/finalizar compra|ir a pagar|continuar compra|iniciar compra|checkout|proceed to checkout|go to checkout|zur kasse|commander|procedi all'ordine|ödemeye geç|przejdź do kasy|finalizar pedido|去结算|レジに進む/i", "[class*=checkout i] button", "a[href*=checkout i]"],
  },
  categoria: {
    filters: ["aside", "[class*=filter i]", "[class*=facet i]", "[data-testid*=filter i]", "text=/^(filtrar|filtros|filter|filters|filtern|filtrer|filtri)$/i"],
    product_card: ["[class*=product-card i]", "[class*=productCard]", "[class*=card i]:has(img)", "article:has(img)", "li:has(img):has(a)"],
  },
};
const PRODUCT_RE = /\/p\/|\/producto|\/product|\/dp\/|\/item|\/ip\/|\/pd\/|-p-|MLA-?\d|MLM-?\d|MLB-?\d|item\.jd|detail\.tmall|item\.taobao|\/goods|\/i\d{4,}/i;
const CATEGORY_RE = /\/c\/|categor|\/collections?\/|\/browse|\/cat\/|list\.jd|\/l\/|\/b\/|\/department|\/kategori/i;
const COOKIE_WORDS = ["Aceptar", "Aceptar todo", "Aceptar todas", "Entendido", "Accept", "Accept all", "Accept All", "I agree", "OK", "Got it", "Akzeptieren", "Alle akzeptieren", "Accepter", "Tout accepter", "Aceitar", "Accetta", "Kabul et", "Zaakceptuj", "同意", "同意する"];
const BLOCK_RE = /captcha|are you a robot|no eres un robot|verify you are human|access denied|unusual traffic|安全验证|滑动验证/i;

const argv = process.argv.slice(2);
const onlyMissing = argv.includes("--faltantes");
const args = argv.filter((a) => !a.startsWith("--"));
const refs = JSON.parse(fs.readFileSync(refsPath, "utf8"));
let comps = [];
try { comps = JSON.parse(fs.readFileSync(compsPath, "utf8")); } catch {}
const targets = refs
  .filter((r) => !args.length || args.includes(r.country) || args.includes(r.id))
  .filter((r) => !onlyMissing || r.captures?.desktop?.status !== "ok");
console.log(`${targets.length} sitios para capturar.`);
if (!targets.length) process.exit(0);
const today = new Date().toISOString().slice(0, 10);
const save = () => { fs.writeFileSync(refsPath, JSON.stringify(refs, null, 2)); fs.writeFileSync(compsPath, JSON.stringify(comps, null, 2)); };

const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ["--headless=new"] } : {}) });
const queue = [...targets];
const workers = Array.from({ length: Math.max(1, Number(process.env.CONCURRENCY) || 4) }, async () => {
  for (let ref = queue.shift(); ref; ref = queue.shift()) {
    try { await captureSite(ref); } catch (e) { console.log(`${ref.name}: error inesperado (${String(e.message ?? e).slice(0, 80)})`); }
  }
});
await Promise.all(workers);
await browser.close();
const meta = JSON.parse(fs.readFileSync(path.join(root, "datos/meta.json"), "utf8"));
meta.dataVersion = `${today}-capturas`; meta.generatedAt = today;
fs.writeFileSync(path.join(root, "datos/meta.json"), JSON.stringify(meta, null, 2));
console.log("Capturas listas. Ahora corré: npm run sitio");

async function captureSite(ref) {
  const [locale, timezoneId] = LOCALES[ref.country] ?? ["en-US", "UTC"];
  for (const [device, opts] of Object.entries(DEVICES)) {
    const ctx = await browser.newContext({ ...opts, locale, timezoneId });
    const page = await ctx.newPage();
    let links = {};
    const pages = STORE_TYPES.includes(ref.siteType) ? ["home", "categoria", "ficha", "carrito"] : ["home"];
    for (const pg of pages) {
      const key = pg === "home" ? device : `${device}_${pg}`;
      const url = pg === "home" ? ref.url : ref.pages?.[pg] ?? links[pg];
      const tag = `${ref.name} · ${device} · ${pg}`;
      const capture = { status: "fallida", date: today, screenshot: null };
      try {
        if (!url) throw new Error("No se encontró un enlace a esta página");
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForTimeout(3500);
        await acceptCookies(page);
        const text = (await page.textContent("body").catch(() => "")) ?? "";
        if (BLOCK_RE.test(text.slice(0, 5000))) throw new Error("Bloqueo o CAPTCHA");
        if (pg === "home") links = await findLinks(page);
        if (pg === "carrito" && !CART_RE.test(page.url())) throw new Error("No se pudo llegar al carrito");
        const layout = await page.evaluate(() => ({ w: document.documentElement.clientWidth, h: window.innerHeight }));
        capture.viewport = layout;
        capture.url = page.url();
        const shot = `capturas/${ref.id}-${device}-${pg}.png`;
        await page.screenshot({ path: path.join(imgRoot, shot) });
        capture.screenshot = shot;
        capture.status = "ok";
        comps = comps.filter((c) => !(c.siteId === ref.id && c.device === device && (c.page ?? "home") === pg));
        const sel = { ...SELECTORS[pg], ...(ref.selectors?.[pg] ?? {}) };
        let found = 0;
        for (const [type, list] of Object.entries(sel)) {
          const handle = await findVisible(page, list, type);
          if (!handle) continue;
          const info = await measure(handle, type);
          if (!info) continue;
          const crop = `recortes/${ref.id}-${device}-${pg}-${type}.png`;
          await handle.screenshot({ path: path.join(imgRoot, crop), timeout: 8000 }).catch(() => null);
          comps.push({
            id: `${ref.id}-${device}-${pg}-${type}`, siteId: ref.id, page: pg, device, type,
            region: type === "footer" ? "footer" : info.inHeader ? "header" : "body",
            box: info.box, viewport: layout, styles: info.styles, hasIcon: info.hasIcon,
            crop: fs.existsSync(path.join(imgRoot, crop)) ? crop : null, method: "dom", confidence: info.confidence,
          });
          found++;
        }
        console.log(`${tag}: ok (${found} partes)`);
        if (pg === "ficha") {
          // Intenta agregar el producto para poder ver el carrito con algo adentro.
          const add = page.locator("button, a, input[type=submit]").filter({ hasText: ADD_RE }).first();
          if (await add.isVisible().catch(() => false)) { await add.click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(2500); }
          const cartHref = await page.$$eval("a[href]", (as) => as.map((a) => a.href)).then((hs) => hs.find((h) => /carrito|\/cart|\/basket|\/bag|cesta|panier|warenkorb|carrello|sepet|koszyk|keranjang/i.test(h))).catch(() => null);
          if (cartHref) links.carrito = cartHref;
        }
      } catch (e) {
        capture.error = String(e.message ?? e).slice(0, 120);
        console.log(`${tag}: falló (${capture.error})`);
      }
      const prev = ref.captures?.[key];
      if (capture.status !== "ok" && prev?.status === "ok") {
        // Se conserva la última captura válida, marcada como posiblemente desactualizada.
        ref.captures[key] = { ...prev, stale: true, lastAttempt: today, lastError: capture.error };
      } else {
        ref.captures = { ...(ref.captures ?? {}), [key]: capture };
      }
      save();
      if (pg === "home" && capture.status !== "ok") break; // sin inicio no hay enlaces a seguir
    }
    await ctx.close();
  }
}

async function acceptCookies(page) {
  for (const w of COOKIE_WORDS) {
    const b = page.getByRole("button", { name: w, exact: true }).first();
    if (await b.isVisible().catch(() => false)) { await b.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(800); return; }
  }
}

async function findLinks(page) {
  const hrefs = await page.$$eval("a[href]", (as) => as.filter((a) => a.offsetParent !== null).map((a) => a.href)).catch(() => []);
  const same = hrefs.filter((h) => /^https?:/.test(h));
  return { ficha: same.find((h) => PRODUCT_RE.test(h)), categoria: same.find((h) => CATEGORY_RE.test(h) && !PRODUCT_RE.test(h)) };
}

async function findVisible(page, list, type) {
  for (const s of list) {
    let els = [];
    if (s.startsWith("text=")) {
      const loc = page.locator(`button, a, input[type=submit], [role=button]`).filter({ hasText: new RegExp(s.slice(6, s.lastIndexOf("/")), "i") });
      const n = Math.min(await loc.count().catch(() => 0), 6);
      for (let i = 0; i < n; i++) { const h = await loc.nth(i).elementHandle().catch(() => null); if (h) els.push(h); }
    } else {
      els = await page.$$(s).catch(() => []);
    }
    let best = null, bestArea = 0;
    for (const el of els.slice(0, 12)) {
      const box = await el.boundingBox().catch(() => null);
      if (!box || box.width < 20 || box.height < 12) continue;
      if ((type === "header" || type === "logo") && box.y > 250) continue;
      if (type === "top_bar" && (box.y > 60 || box.height > 70)) continue;
      if (type === "search_bar" && box.y > 400) continue;
      if (["primary_button", "product_card", "hero"].includes(type) && box.y < 60) continue;
      if (["gallery", "price", "buy_button"].includes(type) && box.y > 1400) continue;
      if (type === "search_bar") {
        const parent = await el.evaluateHandle((n) => (n.tagName === "INPUT" ? n.closest("form") ?? n.parentElement : n));
        const pb = await parent.asElement()?.boundingBox();
        if (pb && pb.width < box.width * 2.5 && pb.height < 90) return parent.asElement();
        return el;
      }
      // para galería y precio conviene el elemento más grande; para el resto, el primero visible
      if (type === "gallery" || type === "price") {
        const area = type === "price" ? await el.evaluate((n) => parseFloat(getComputedStyle(n).fontSize) || 0) : box.width * box.height;
        if (area > bestArea) { best = el; bestArea = area; }
        continue;
      }
      return el;
    }
    if (best) return best;
  }
  return null;
}

async function measure(handle, type) {
  return handle.evaluate((el, type) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const toHex = (c) => {
      const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null;
      const [r1, g, b, a = "1"] = m[1].split(/[ ,/]+/).filter(Boolean);
      if (Number(a) === 0) return null;
      return "#" + [r1, g, b].map((v) => Number(v).toString(16).padStart(2, "0")).join("").toUpperCase();
    };
    let bg = null, n = el;
    const field = el.matches("input") ? el : el.querySelector("input[type=search], input[type=text], input:not([type])");
    if (field) bg = toHex(getComputedStyle(field).backgroundColor);
    while (n && !bg) { bg = toHex(getComputedStyle(n).backgroundColor); n = n.parentElement; }
    // tamaño de letra: para el precio, el texto más grande que contiene
    let fontSize = parseFloat(cs.fontSize) || 0;
    if (type === "price") el.querySelectorAll("*").forEach((k) => { fontSize = Math.max(fontSize, parseFloat(getComputedStyle(k).fontSize) || 0); });
    return {
      box: { x: Math.round(r.x + window.scrollX), y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) },
      styles: {
        background: bg ?? "#FFFFFF", color: toHex(cs.color) ?? "#000000",
        radius: Math.round(parseFloat(getComputedStyle(field ?? el).borderTopLeftRadius) || parseFloat(cs.borderTopLeftRadius) || 0),
        fontSize: Math.round(fontSize), fontFamily: cs.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
        borderWidth: Math.round(parseFloat(getComputedStyle(field ?? el).borderTopWidth) || parseFloat(cs.borderTopWidth) || 0),
        borderColor: toHex(getComputedStyle(field ?? el).borderTopColor) ?? null,
      },
      hasIcon: !!el.querySelector("svg, img, i, [class*=icon i]"),
      inHeader: !!el.closest("header,[role=banner]") || (r.y + window.scrollY + r.height) < 160,
      confidence: el.matches("header, footer, nav, form[role=search], input[type=search], [role=search], [itemprop=price]") ? "alta" : "media",
    };
  }, type);
}
