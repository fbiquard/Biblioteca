// Genera data/series.json con el Top 10 (popular) y los Estrenos (más nuevos) de cada
// plataforma en Argentina, usando datos de JustWatch (lo que realmente se ve por país).
// No requiere API key. Uso: node scripts/build-series.mjs

import { writeFileSync, mkdirSync } from 'node:fs';

const GQL = 'https://apis.justwatch.com/graphql';
const COUNTRY = 'AR';
const LANG = 'es';
const IMG = 'https://images.justwatch.com';

// plataforma interna -> { nombre, color, paquete JustWatch (AR) }
const PLATFORMS = {
  netflix:   { name: 'Netflix',     color: '#e50914', pkg: 'nfx' },
  max:       { name: 'Max',         color: '#5b2db8', pkg: 'mxx' },
  apple:     { name: 'Apple TV+',   color: '#aab0bb', pkg: 'atp' },
  prime:     { name: 'Prime Video', color: '#1ba8e0', pkg: 'prv' },
  paramount: { name: 'Paramount+',  color: '#0064ff', pkg: 'pmp' },
  disney:    { name: 'Disney+',     color: '#1f6fe5', pkg: 'dnp' }
};

// códigos de género de JustWatch -> español
const GENRES = {
  act:'Acción', ani:'Animación', cmy:'Comedia', crm:'Crimen', doc:'Documental',
  drm:'Drama', eur:'Europeo', fml:'Familia', fnt:'Fantasía', hrr:'Terror',
  hst:'Historia', war:'Bélico', msc:'Música', rly:'Reality', rma:'Romance',
  scf:'Ciencia ficción', spt:'Deporte', trl:'Suspenso', wsn:'Western',
  ksp:'Infantil', trv:'Viajes', hol:'Especial'
};

const QUERY = `query P($country: Country!, $language: Language!, $packages: [String!], $first: Int!, $sortBy: PopularTitlesSorting!) {
  popularTitles(country: $country, first: $first, sortBy: $sortBy, filter: {packages: $packages, objectTypes: [SHOW]}) {
    edges { node { ... on Show {
      objectId
      content(country: $country, language: $language) {
        title originalReleaseYear shortDescription posterUrl genres { shortName }
      }
    } } }
  }
}`;

async function fetchList(pkg, sortBy, first = 10) {
  const r = await fetch(GQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'TopSeries/1.0' },
    body: JSON.stringify({ variables: { country: COUNTRY, language: LANG, packages: [pkg], first, sortBy }, query: QUERY })
  });
  if (!r.ok) throw new Error(`${pkg} ${sortBy} -> ${r.status} ${await r.text()}`);
  const j = await r.json();
  if (j.errors) throw new Error(`${pkg} ${sortBy} -> ${JSON.stringify(j.errors)}`);
  return (j.data.popularTitles.edges || []).map(e => e.node);
}

function shape(node, rank) {
  const c = node.content;
  const poster = c.posterUrl ? IMG + c.posterUrl.replace('{profile}', 's332').replace('{format}', 'webp') : null;
  const g = (c.genres || []).map(x => GENRES[x.shortName]).filter(Boolean)[0] || '';
  return {
    rank,
    id: node.objectId,
    title: c.title,
    year: c.originalReleaseYear || '',
    date: '',
    genre: g,
    overview: c.shortDescription || '',
    poster,
    rating: null
  };
}

const out = { updated_at: new Date().toISOString(), region: COUNTRY, platforms: {}, top10: {}, estrenos: {} };

for (const [pid, p] of Object.entries(PLATFORMS)) {
  out.platforms[pid] = { name: p.name, color: p.color };
  const top = await fetchList(p.pkg, 'POPULAR', 10);
  const est = await fetchList(p.pkg, 'RELEASE_YEAR', 10);
  out.top10[pid]    = top.map((n, i) => shape(n, i + 1));
  out.estrenos[pid] = est.map((n, i) => shape(n, i + 1));
  console.log(`✓ ${p.name}: top10=${out.top10[pid].length} estrenos=${out.estrenos[pid].length}`);
}

mkdirSync('data', { recursive: true });
writeFileSync('data/series.json', JSON.stringify(out, null, 2) + '\n');
console.log('✅ Generado data/series.json (fuente: JustWatch · Argentina)');
