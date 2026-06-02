// Genera data/series.json con el Top 10 y los Estrenos de cada plataforma en Argentina.
// Fuente: TMDB (gratis). Requiere la variable de entorno TMDB_API_KEY.
// Uso: TMDB_API_KEY=xxxx node scripts/build-series.mjs

import { writeFileSync, mkdirSync } from 'node:fs';

const KEY = process.env.TMDB_API_KEY;
if (!KEY) { console.error('❌ Falta la variable TMDB_API_KEY'); process.exit(1); }

const BASE = 'https://api.themoviedb.org/3';
const REGION = 'AR';          // país para disponibilidad
const LANG = 'es-MX';         // idioma de títulos/sinopsis (español LatAm)
const IMG = 'https://image.tmdb.org/t/p/w500';

// IDs de proveedores de TMDB (watch providers) para Argentina.
// Si alguno cambia, se ajusta acá.
const PLATFORMS = {
  netflix:   { name: 'Netflix',     color: '#e50914', provider: 8 },
  max:       { name: 'Max',         color: '#5b2db8', provider: 1899 },
  apple:     { name: 'Apple TV+',   color: '#aab0bb', provider: 350 },
  prime:     { name: 'Prime Video', color: '#1ba8e0', provider: 119 },
  paramount: { name: 'Paramount+',  color: '#0064ff', provider: 531 },
  disney:    { name: 'Disney+',     color: '#1f6fe5', provider: 337 }
};

async function tmdb(path, params) {
  const u = new URL(BASE + path);
  u.searchParams.set('api_key', KEY);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u);
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${await r.text()}`);
  return r.json();
}

function shape(s, genres, rank) {
  const gid = (s.genre_ids || []).find(id => genres[id]);
  return {
    rank,
    id: s.id,
    title: s.name,
    year: (s.first_air_date || '').slice(0, 4),
    date: s.first_air_date || '',
    genre: gid ? genres[gid] : '',
    overview: s.overview || '',
    poster: s.poster_path ? IMG + s.poster_path : null,
    rating: s.vote_average ? Math.round(s.vote_average * 10) / 10 : null
  };
}

const today = new Date().toISOString().slice(0, 10);
const since = new Date(Date.now() - 200 * 864e5).toISOString().slice(0, 10); // ~6.5 meses atrás

const g = await tmdb('/genre/tv/list', { language: LANG });
const genres = Object.fromEntries(g.genres.map(x => [x.id, x.name]));

const out = { updated_at: new Date().toISOString(), region: REGION, platforms: {}, top10: {}, estrenos: {} };

for (const [pid, p] of Object.entries(PLATFORMS)) {
  out.platforms[pid] = { name: p.name, color: p.color };

  const top = await tmdb('/discover/tv', {
    language: LANG, watch_region: REGION,
    with_watch_providers: p.provider, with_watch_monetization_types: 'flatrate',
    sort_by: 'popularity.desc', page: 1
  });
  out.top10[pid] = (top.results || []).slice(0, 10).map((s, i) => shape(s, genres, i + 1));

  const est = await tmdb('/discover/tv', {
    language: LANG, watch_region: REGION,
    with_watch_providers: p.provider, with_watch_monetization_types: 'flatrate',
    sort_by: 'first_air_date.desc',
    'first_air_date.lte': today, 'first_air_date.gte': since, 'vote_count.gte': 5,
    page: 1
  });
  out.estrenos[pid] = (est.results || []).slice(0, 10).map((s, i) => shape(s, genres, i + 1));

  console.log(`✓ ${p.name}: top10=${out.top10[pid].length} estrenos=${out.estrenos[pid].length}`);
}

mkdirSync('data', { recursive: true });
writeFileSync('data/series.json', JSON.stringify(out, null, 2) + '\n');
console.log('✅ Generado data/series.json');
