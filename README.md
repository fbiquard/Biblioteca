# TopSeries 🍅

App web (una sola página, sin dependencias) que concentra las **series mejor rankeadas por Rotten Tomatoes** de las principales plataformas de streaming:

- Netflix
- Max (HBO Max)
- Apple TV+
- Prime Video
- Paramount+
- Disney+

## Funcionalidades

- **Top general** y filtros por plataforma, ordenados por Tomatometer.
- Cada serie muestra puntaje de Rotten Tomatoes, género, año y sinopsis.
- **CTA en cada serie:**
  - ❤️ **Wishlist** — agregá lo que querés ver.
  - ✅ **Ya la vi** — marcá lo que ya viste.
  - 🗑️ **Eliminar** — sacá una serie de tu wishlist o de tus vistas.
- Vistas dedicadas **"Mi wishlist"** y **"Ya vistas"** con contadores en el header.
- Todo se guarda en `localStorage`, así que persiste en tu dispositivo.

## Uso

Abrí `index.html` en cualquier navegador. No requiere build ni servidor.

> Los puntajes Tomatometer son aproximados, a modo de referencia curada. El listado de series se mantiene en el dataset dentro de `index.html`.

---

`biblioteca.html` es un proyecto anterior independiente (lector de historias) y se conserva en el repo.
