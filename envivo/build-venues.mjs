// Genera envivo/venues.json a partir de datos ABIERTOS oficiales (sin scraping,
// sin API keys, sin anti-bot). Corre en el GitHub Action o a mano:
//   node envivo/build-venues.mjs
//
// Fuentes:
//  - CABA: Buenos Aires Data -> "Espacios culturales" (incluye CLUB DE MUSICA
//    EN VIVO, MILONGA, CENTRO CULTURAL, BAR, ANFITEATRO, SALA DE TEATRO).
//  - Zona Norte (GBA): datos.cultura.gob.ar (SInCA) -> "Centros Culturales" y
//    "Sala de Teatro", filtrado a los partidos del norte del conurbano.

import { writeFile } from 'node:fs/promises';

const CABA_CSV =
  'https://cdn.buenosaires.gob.ar/datosabiertos/datasets/ministerio-de-cultura/espacios-culturales/espacios-culturales.csv';
const SINCA_CENTROS =
  'https://datos.cultura.gob.ar/dataset/37305de4-3cce-4d4b-9d9a-fec3ca61d09f/resource/0e9a431c-b4f7-455b-aa1a-f419b5740900/download/centros_culturales.csv';
const SINCA_TEATROS =
  'https://datos.cultura.gob.ar/dataset/37305de4-3cce-4d4b-9d9a-fec3ca61d09f/resource/87ebac9c-774c-4ef2-afa7-044c41ee4190/download/17_teatro.xlsx-datos-abiertos.csv';

// Partidos de Zona Norte del GBA que nos interesan.
const ZONA_NORTE = [
  'vicente lopez',
  'san isidro',
  'san fernando',
  'tigre',
  'general san martin',
  'san martin',
  'escobar',
  'pilar',
];

// ---- utilidades ----

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.text();
}

/** Parser CSV minimal con soporte de comillas y autodetección de separador. */
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const firstLine = text.slice(0, 5000).split(/\r?\n/)[0] ?? '';
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';

  const rows = [];
  let row = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* ignore */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }

  const header = (rows.shift() ?? []).map((h) => h.trim());
  return rows
    .filter((r) => r.length > 1)
    .map((r) => Object.fromEntries(header.map((h, idx) => [h, (r[idx] ?? '').trim()])));
}

const norm = (s) =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

/** Busca el valor de la primera columna cuyo nombre matchea alguno de los alias. */
function pick(rowObj, aliases) {
  const keys = Object.keys(rowObj);
  for (const a of aliases) {
    const k = keys.find((key) => norm(key) === norm(a)) ?? keys.find((key) => norm(key).includes(norm(a)));
    if (k && rowObj[k]) return rowObj[k].trim();
  }
  return '';
}

function num(v) {
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function cleanInstagram(v) {
  if (!v) return '';
  let s = v.trim();
  if (s.startsWith('@')) return `https://instagram.com/${s.slice(1)}`;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.includes('instagram.com')) return `https://${s.replace(/^\/+/, '')}`;
  return '';
}

function cleanWeb(v) {
  if (!v) return '';
  const s = v.trim();
  if (!s || norm(s) === 's/d' || norm(s) === 'no') return '';
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

// ---- CABA ----

// FUNCION_PRINCIPAL -> etiqueta amigable de tipo (solo lo relacionado a música/escena).
const CABA_TYPES = {
  'club de musica en vivo': 'Música en vivo',
  anfiteatro: 'Anfiteatro',
  'centro cultural': 'Centro cultural',
  'sala de teatro': 'Teatro / Sala',
  bar: 'Bar cultural',
};

function cabaVenues(rows) {
  const out = [];
  for (const r of rows) {
    const fp = norm(r.FUNCION_PRINCIPAL);
    const fs = norm(r.FUNCION_SECUNDARIA);
    const sub = norm(r.SUBCATEGORIA);

    let tipo = CABA_TYPES[fp];
    if (sub.includes('milonga') || fp.includes('milonga')) tipo = 'Milonga / Tango';
    // Bares: solo si tienen función escénica/música (evita bares notables sin música).
    if (tipo === 'Bar cultural' && !(fs.includes('escenico') || fs.includes('musica'))) tipo = null;
    if (!tipo) continue;

    const nombre = pick(r, ['ESTABLECIMIENTO', 'SALA', 'SUCURSAL']);
    if (!nombre) continue;

    out.push({
      nombre,
      tipo,
      zona: 'CABA',
      localidad: pick(r, ['BARRIO']),
      direccion: pick(r, ['DIRECCION', 'CALLE']),
      lat: num(pick(r, ['LATITUD'])),
      lng: num(pick(r, ['LONGITUD'])),
      tel: pick(r, ['TELEFONO']),
      web: cleanWeb(pick(r, ['WEB'])),
      instagram: cleanInstagram(pick(r, ['INSTAGRAM'])),
    });
  }
  return out;
}

// ---- Zona Norte (SInCA nacional) ----

function sincaVenues(rows, tipo) {
  const out = [];
  for (const r of rows) {
    const provincia = norm(pick(r, ['provincia']));
    if (!provincia.includes('buenos aires') || provincia.includes('ciudad')) continue;
    const depto = norm(pick(r, ['departamento', 'partido']));
    const loc = norm(pick(r, ['localidad']));
    if (!ZONA_NORTE.some((z) => depto.includes(z) || loc.includes(z))) continue;

    const nombre = pick(r, ['nombre', 'establecimiento']);
    if (!nombre) continue;

    out.push({
      nombre,
      tipo,
      zona: 'Zona Norte',
      localidad: titleCase(pick(r, ['localidad', 'departamento', 'partido'])),
      direccion: pick(r, ['direccion', 'domicilio', 'calle_y_numero']),
      lat: num(pick(r, ['latitud', 'lat'])),
      lng: num(pick(r, ['longitud', 'long', 'lng'])),
      tel: pick(r, ['telefono']),
      web: cleanWeb(pick(r, ['web', 'sitio_web'])),
      instagram: cleanInstagram(pick(r, ['instagram'])),
    });
  }
  return out;
}

const titleCase = (s) =>
  (s ?? '').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());

function dedupe(venues) {
  const seen = new Set();
  return venues.filter((v) => {
    const k = `${norm(v.nombre)}|${norm(v.localidad)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ---- main ----

async function main() {
  const all = [];

  try {
    const caba = cabaVenues(parseCSV(await fetchText(CABA_CSV)));
    console.log(`CABA: ${caba.length} lugares`);
    all.push(...caba);
  } catch (e) {
    console.error('CABA falló:', e.message);
  }

  try {
    const centros = sincaVenues(parseCSV(await fetchText(SINCA_CENTROS)), 'Centro cultural');
    const teatros = sincaVenues(parseCSV(await fetchText(SINCA_TEATROS)), 'Teatro / Sala');
    console.log(`Zona Norte: ${centros.length} centros + ${teatros.length} teatros`);
    all.push(...centros, ...teatros);
  } catch (e) {
    console.error('Zona Norte falló:', e.message);
  }

  const venues = dedupe(all).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const payload = {
    actualizado: new Date().toISOString().slice(0, 10),
    total: venues.length,
    fuentes: ['Buenos Aires Data', 'SInCA / datos.cultura.gob.ar'],
    venues,
  };

  await writeFile(new URL('./venues.json', import.meta.url), JSON.stringify(payload, null, 2));
  console.log(`OK -> envivo/venues.json (${venues.length} lugares)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
