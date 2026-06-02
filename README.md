# TopSeries 🍿

App web (una sola página, sin dependencias) que concentra el **Top 10 y los estrenos de cada plataforma de streaming en Argentina**:

- Netflix
- Max (HBO Max)
- Apple TV+
- Prime Video
- Paramount+
- Disney+

## Funcionalidades

- Dos vistas por plataforma: **🔥 Top 10** (lo más visto) y **🆕 Estrenos** (lo más nuevo).
- Cada serie muestra ranking, póster, género, año y sinopsis.
- **CTA en cada serie:**
  - ❤️ **Wishlist** — agregá lo que querés ver.
  - ✅ **Ya la vi** — marcá lo que ya viste.
  - 🗑️ **Eliminar** — sacá una serie de tu wishlist o de tus vistas.
- Vistas dedicadas **"Mi wishlist"** y **"Ya vistas"** con contadores en el header.
- La wishlist y las vistas se guardan en `localStorage` (en tu dispositivo).

## Contenido y actualización automática

- Los datos viven en `data/series.json`.
- `scripts/build-series.mjs` los regenera consultando **JustWatch** (lo más visto y los estrenos por plataforma en Argentina). **No requiere API key.**
- `.github/workflows/update-series.yml` corre **cada lunes** (y a mano vía *Run workflow*), regenera el JSON y lo commitea solo.
- Si `data/series.json` todavía no existe, la app usa datos de ejemplo embebidos.

## Uso local

Servir la carpeta y abrir `index.html` (un `fetch` lee `data/series.json`, que no funciona con `file://`):

```
npx http-server -p 8080 .
```

---

`biblioteca.html` es un proyecto anterior independiente (lector de historias) y se conserva en el repo.
