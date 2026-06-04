# Valuador de propiedades · ¿Está subvaluada? 🏠

Web app personal para saber si una propiedad de **zona norte de Buenos Aires**
(Tigre y GBA Norte) está **subvaluada, en precio justo o cara** respecto al
mercado real de su subzona.

Pegás el link de una publicación de **Zonaprop** o **Argenprop**, la app extrae
los datos, scrapea ~20 propiedades similares de la misma subzona como muestra
comparativa y te da un veredicto visual claro.

## Cómo funciona

1. **Input**: pegás la URL de una propiedad (Zonaprop / Argenprop).
2. **Extracción**: con Playwright se obtienen precio (USD), m², ubicación,
   tipo y días publicada.
3. **Benchmark**: se scrapean en tiempo real las primeras ~20 propiedades
   similares **en venta** de la misma subzona en Zonaprop (mismo barrio, mismo
   tipo). Se filtran a **±20% de superficie** y se descartan outliers (IQR).
4. **Veredicto**: se compara el precio/m² de la propiedad contra la **mediana**
   de la muestra.
   - `< -7%` → 🟢 **Subvaluada**
   - `±7%` → 🟡 **Precio justo**
   - `> +7%` → 🔴 **Cara**
5. **Segunda señal**: días publicada vs. promedio de la zona (margen de
   negociación).
6. **Historial**: cada análisis se guarda localmente (y opcionalmente en
   Supabase).

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** (dark mode, mobile-first, una sola pantalla)
- **Playwright** (scraping headless)
- **Supabase** (persistencia opcional del historial)

## Puesta en marcha

```bash
cd valuador
npm install                     # instala deps + navegador de Playwright (postinstall)
# si el postinstall no bajó el navegador:
npx playwright install chromium

cp .env.example .env            # opcional (Supabase)
npm run dev                     # http://localhost:3000
```

> El `postinstall` ejecuta `playwright install chromium`. En entornos sin red
> puede fallar; en ese caso corré `npx playwright install chromium` cuando
> tengas conexión.

## Persistencia del historial

- **Por defecto**: se guarda en `localStorage` (en tu navegador). Cero
  configuración.
- **Opcional (Supabase)**: completá en `.env`:
  ```
  NEXT_PUBLIC_SUPABASE_URL=...
  NEXT_PUBLIC_SUPABASE_ANON_KEY=...
  ```
  y ejecutá `supabase/schema.sql` en el SQL Editor de tu proyecto. El historial
  pasa a sincronizar entre dispositivos (con fallback local offline).

## Manejo de errores

La app distingue y muestra mensajes claros para cada caso:

| Caso | Mensaje |
| --- | --- |
| URL inválida | "La URL no parece válida…" |
| Portal no soportado | "Por ahora solo soportamos Zonaprop y Argenprop…" |
| Propiedad dada de baja / 404 | "No encontramos la propiedad…" |
| Bloqueo anti-bot (DataDome/Cloudflare) | "El portal bloqueó el acceso automático…" |
| Cambio de estructura del HTML | "No pudimos leer los datos…" |
| Precio en pesos (no USD) | "Esta publicación no está en dólares…" |
| Sin comparables suficientes | "No encontramos suficientes propiedades similares…" |

## Limitaciones conocidas

- **Anti-bot**: Zonaprop y Argenprop usan protecciones (DataDome / Cloudflare).
  El scraping en tiempo real puede ser bloqueado intermitentemente; la app lo
  detecta y te pide reintentar. Para producción conviene un navegador con
  proxy/residential o un servicio de scraping.
- **Deploy**: Playwright necesita el runtime de **Node** (no Edge). En Vercel
  hay que usar `@sparticuz/chromium` + `playwright-core`; localmente o en un
  servidor Node funciona el `playwright` completo.
- Solo **casas y departamentos en venta**, precios en **USD**.

## Estructura

```
valuador/
├── app/
│   ├── api/analyze/route.ts   # endpoint POST de análisis
│   ├── layout.tsx · page.tsx  # pantalla única (dark)
│   └── globals.css
├── components/                # AnalyzeForm, VerdictCard, BenchmarkDetails, HistoryList
├── lib/
│   ├── analyze.ts             # orquestador
│   ├── scraper/               # browser, url, parse, zonaprop, argenprop
│   ├── valuation.ts           # benchmark + veredicto
│   ├── history.ts             # localStorage + Supabase opcional
│   └── ...
└── supabase/schema.sql        # tabla opcional
```
