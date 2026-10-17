# DesignTrust · benchmarking de diseño web

Sitio gratuito para gente que no es diseñadora: respondés 2 o 3 preguntas, una por pantalla (uno o varios países, tipo de sitio y, si es una tienda, si compite por precio, calidad o lujo) y te muestra los sitios líderes de tu rubro, **qué decisiones de diseño comparten** (y por lo tanto son seguras), **cuáles no** (donde tenés libertad), parte por parte, con gráficos y recortes reales.

Secciones:
- **¿Qué diseño necesita mi sitio?** (principal): test → resultado con los seleccionados, lo que comparten, lo que no y el detalle por parte (header, logo, buscador, menú, banner, botón, pie; y en tiendas también fotos del producto, precio, botón de compra, filtros y tarjetas).
- **Explorar diseño en otras regiones** (secundaria): grupos de países que diseñan parecido, uso del color y estructura por país.
- **Armar mi paleta**: generador 60-30-10 con contraste verificado.

Dirección prevista: **https://georginaferrante.github.io/benchmarking-visual/**

## Cómo está hecho

Es un **sitio estático**: cada país, tipo de sitio, componente, referente y patrón tiene su propia página HTML, con título, descripción, enlace canónico y sitemap para buscadores. La carpeta `docs/` es el sitio terminado y la genera GitHub automáticamente (por eso no viene en este proyecto):

- Para verlo en tu compu sin publicar, usá la vista previa (`vista-previa-calco`) y abrí `index.html` con doble clic.
- GitHub Pages la publica tal cual, sin compilar nada.
- Las páginas que todavía no tienen mediciones llevan `noindex` y quedan fuera del sitemap hasta tener datos, para no indexar páginas vacías.

Las partes interactivas (test guiado, cambio escritorio/celular, objetivo, comparador, juego y editor de paletas) son un solo archivo JavaScript chico (`assets/app.js`). Sin él, el contenido igual se lee.

En `docs/demo/` hay un ejemplo completo con sitios ficticios, rotulado y con `noindex`.

## Cómo publicarlo (una sola vez)

1. En GitHub, creá un repositorio nuevo llamado **benchmarking-visual** (público).
2. Tocá **«uploading an existing file»**, arrastrá **todo el contenido** de esta carpeta y confirmá con **Commit changes**. Antes de confirmar, revisá que en la lista aparezca la carpeta `.github` (en Mac es una carpeta oculta: mostrala con Cmd + Shift + punto).
3. En **Settings → Pages**, elegí **Deploy from a branch → `main` → `/docs`** y guardá. Es el único ajuste: GitHub exige que el dueño active la publicación.

Listo. Al subir los archivos arranca solo el proceso «Fotos y sitio»: fotografía los 190 sitios líderes (en computadora y celular, y en las tiendas también una ficha de producto y una categoría), arma las comparaciones y publica el sitio. La primera vez tarda entre 1 y 3 horas; mientras tanto podés ver cómo avanza en la pestaña **Actions**.

Después no hay que hacer nada: el **día 1 de cada mes** se actualizan todas las fotos. Si un sitio no deja sacar la foto, se conserva la anterior marcada como posiblemente desactualizada.

Dirección: **https://georginaferrante.github.io/benchmarking-visual/**

Los servidores de GitHub están en Estados Unidos: algunos sitios de Argentina o China pueden bloquearlos. Para completarlos desde tu compu: instalá Node.js, abrí una terminal en esta carpeta y corré `npm install`, `npm run browsers`, `npm run capture -- AR --faltantes` y `npm run check`.

## Agregar o cambiar contenido
- Referentes: `pipeline/sites.source.mjs` → `npm run sites` → `npm run sitio`.
- Patrones medibles: `datos/rules.json`.
- Curiosidades culturales: `datos/insights.json`.
- Textos y estructura de páginas: `generador/construir.mjs` y `generador/plantillas.mjs`.
- Colores e identidad: variables al inicio de `assets/styles.css`.
- Si cambiás el nombre del repositorio, actualizá `SITE_URL` en `generador/plantillas.mjs`.

## Comandos
| Comando | Qué hace |
|---|---|
| `npm run capture -- [país o id]` | Captura, mide y recorta componentes |
| `npm run sitio` | Genera el sitio en `docs/` |
| `npm run ver` | Lo sirve en http://localhost:8080/benchmarking-visual/ como en GitHub Pages |
| `npm run check` | Valida datos, corre tests y genera el sitio |
| `npm run sites` | Regenera la lista de referentes |
| `npm run demo:data` | Regenera los datos ficticios del ejemplo |

## Estructura
```
datos/            JSON versionados + imagenes/ (capturas y recortes originales)
generador/        core.mjs (cálculos), plantillas.mjs, construir.mjs, servidor.mjs
assets/           styles.css, app.js, icon.svg
pipeline/         sites.source.mjs, capture.mjs, validate.mjs, demo/
docs/             EL SITIO GENERADO (lo que publica GitHub Pages)
documentacion/    metodología, fuentes, política de cobertura
tests/            tests de frecuencias, recomendador, contraste y datos
```

## Límites honestos
- La puntuación de adecuación es una heurística versionada, no una probabilidad de éxito.
- Frecuencia visual no implica preferencia de usuarios ni más ventas.
- Las curiosidades culturales de ejemplo están marcadas como hipótesis hasta cargar fuentes.
- Los recortes de sitios de terceros se muestran con su nombre, solo con fines de análisis y comparación.

## Cómo compite cada tienda
La clasificación precio / calidad / lujo está en `pipeline/sites.source.mjs` (constante `POSITIONING`) y es editorial: se puede corregir ahí. Si en un país hay menos de 3 tiendas líderes de un tipo, el resultado suma referentes de otros países que compiten igual, y lo aclara.

## Textos escritos a mano
`datos/notas.json` guarda notas por país, rubro y parte (por ejemplo `"AR/tienda-online/search_bar"`). Se muestran junto a la recomendación automática.
