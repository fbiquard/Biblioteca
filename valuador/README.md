# Valuador de propiedades · ¿Está subvaluada? 🏠

Web app personal para saber si una propiedad de **zona norte de Buenos Aires**
(Tigre y GBA Norte) está **subvaluada, en precio justo o cara** respecto al
mercado real de su subzona.

Pegás el link de una publicación de **Zonaprop** o **Argenprop**, la app lee los
datos, compara contra ~20 propiedades similares de la misma subzona y te da un
veredicto visual claro.

---

## 🟢 Guía rápida para ponerla online (sin terminal)

> Esta app necesita un "servidor" prendido y un servicio que lea las páginas de
> Zonaprop (que bloquea robots). Con estos 3 pasos queda funcionando en una
> dirección web, sin tocar la terminal.

### Paso 1 — Conseguir la "llave" para leer Zonaprop (gratis)

1. Entrá a **https://www.scraperapi.com** y creá una cuenta (plan gratis: 1000
   lecturas por mes).
2. En el panel vas a ver tu **API Key** (una tira de letras y números).
   Copiala y guardala para el Paso 2.

### Paso 2 — Subirla a internet con Vercel (gratis)

1. Entrá a **https://vercel.com** y registrate con tu cuenta de **GitHub**.
2. Clic en **Add New… → Project** e importá el repositorio **`Biblioteca`**.
3. En **Root Directory** elegí la carpeta **`valuador`** (¡importante!).
4. Abrí **Environment Variables** y agregá estas dos:
   - `SCRAPER_PROVIDER` = `scraperapi`
   - `SCRAPER_API_KEY` = *(pegá la llave del Paso 1)*
5. Clic en **Deploy** y esperá ~1 minuto.

### Paso 3 — ¡Listo!

Vercel te da una dirección tipo `https://valuador-tuusuario.vercel.app`.
Abrila en el celu o la compu, pegá un link de Zonaprop y probá. 🎉

> 💡 ¿Querés sincronizar el historial entre tus dispositivos? Es opcional: ver
> [Historial con Supabase](#historial-con-supabase-opcional).

---

## Cómo funciona

1. **Input**: pegás la URL de una propiedad (Zonaprop / Argenprop).
2. **Lectura**: vía un servicio anti-bot se obtiene la página y se extraen
   precio (USD), m², ubicación, tipo y días publicada.
3. **Benchmark**: se leen las primeras ~20 propiedades similares **en venta** de
   la misma subzona en Zonaprop (mismo barrio, mismo tipo). Se filtran a **±20%
   de superficie** y se descartan outliers (IQR).
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
- **Cheerio** (parseo de HTML, sin navegador → liviano y deployable)
- **Servicio de scraping anti-bot** (ScraperAPI / ScrapingBee / ZenRows)
- **Supabase** (persistencia opcional del historial)

## Correr en tu computadora (opcional, requiere terminal)

```bash
cd valuador
npm install
cp .env.example .env     # y completá SCRAPER_API_KEY
npm run dev              # http://localhost:3000
```

## Configuración (variables de entorno)

| Variable | Para qué | Obligatoria |
| --- | --- | --- |
| `SCRAPER_PROVIDER` | `scraperapi` · `scrapingbee` · `zenrows` | sí |
| `SCRAPER_API_KEY` | la llave del servicio elegido | sí |
| `BENCHMARK_SAMPLE_SIZE` | cuántas comparables leer (default 20) | no |
| `SCRAPE_TIMEOUT_MS` | timeout por lectura (default 60000) | no |
| `NEXT_PUBLIC_SUPABASE_URL` | historial en Supabase | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | historial en Supabase | no |

## Historial con Supabase (opcional)

- **Por defecto**: el historial se guarda en `localStorage` (tu navegador). Cero
  configuración.
- **Con Supabase**: completá `NEXT_PUBLIC_SUPABASE_URL` y
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, y ejecutá `supabase/schema.sql` en el SQL
  Editor de tu proyecto. El historial pasa a sincronizar entre dispositivos
  (con copia local offline).

## Manejo de errores

La app distingue y muestra mensajes claros para cada caso:

| Caso | Mensaje |
| --- | --- |
| URL inválida | "La URL no parece válida…" |
| Portal no soportado | "Por ahora solo soportamos Zonaprop y Argenprop…" |
| Propiedad dada de baja / 404 | "No encontramos la propiedad…" |
| Bloqueo anti-bot | "El portal bloqueó el acceso automático…" |
| Cambio de estructura del HTML | "No pudimos leer los datos…" |
| Precio en pesos (no USD) | "Esta publicación no está en dólares…" |
| Sin comparables suficientes | "No encontramos suficientes propiedades similares…" |
| Falta configurar el servicio | "Falta configurar el servicio de lectura…" |

## Limitaciones conocidas

- **Anti-bot**: sin un `SCRAPER_API_KEY` válido, Zonaprop/Argenprop bloquean la
  lectura automática. El servicio del Paso 1 es lo que lo resuelve.
- Solo **casas y departamentos en venta**, precios en **USD**.
- Los datos son estimativos y dependen de la disponibilidad de los portales.

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
│   ├── scraper/               # fetch (servicio anti-bot), url, parse, zonaprop, argenprop
│   ├── valuation.ts           # benchmark + veredicto
│   ├── history.ts             # localStorage + Supabase opcional
│   └── ...
└── supabase/schema.sql        # tabla opcional
```
