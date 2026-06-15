# ¿Dónde hay música en vivo? 🎸 (Buenos Aires)

App web (una sola página, sin dependencias) para descubrir **lugares de música
en vivo** en Buenos Aires: clubes de música en vivo, milongas/tanguerías,
centros culturales, salas/teatros y bares culturales. Filtrás por barrio y tipo,
y entrás al Instagram/web de cada lugar para ver qué toca.

## De dónde sale la data (posta, abierta, sin scraping)

Todo viene de **datos abiertos oficiales** — sin API keys, sin anti-bot:

- **CABA** → [Buenos Aires Data · Espacios culturales](https://data.buenosaires.gob.ar/dataset/espacios-culturales)
- **Zona Norte (GBA)** → [SInCA · Mapa Cultural (datos.cultura.gob.ar)](https://datos.gob.ar/dataset/cultura-mapa-cultural-espacios-culturales)

`build-venues.mjs` baja esos datasets, filtra lo relacionado a música y arma
`venues.json`. El GitHub Action `update-venues.yml` lo regenera **cada lunes**
(y a mano) y lo commitea solo.

```
node envivo/build-venues.mjs   # regenera venues.json
```

## Etapas

- **Etapa 1 (esta):** descubrir *lugares* de música en vivo (dónde ir).
- **Etapa 2 (próxima):** la agenda "qué toca hoy" por lugar.

## Limitaciones

- Es un directorio de **lugares**, no la cartelera del día (para eso, el IG de
  cada lugar).
- Los datos públicos pueden tener errores u omisiones: confirmá con el lugar.
- Zona Norte depende de un dataset nacional; si su servidor bloquea la descarga,
  el build deja CABA y completa Zona Norte cuando la fuente responde.
