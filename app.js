/* =========================================================================
   Recomendadas · watchlist grupal
   - Lista compartida de películas/series pendientes, por categoría
   - Plataforma donde verlas · estado "vista" POR PERSONA (alias)
   - Búsqueda / enriquecido con TMDB · guardado en Firestore
   Sin build step: módulo ES cargado directo por el navegador.
   ========================================================================= */

let FS = null; // funciones de Firestore, cargadas bajo demanda

/* ---------------------------------------------------------------- Config */
const CFG = window.APP_CONFIG || {};
const TMDB_KEY = CFG.TMDB_API_KEY || "";
const TMDB_LANG = CFG.TMDB_LANGUAGE || "es-ES";
const FB = CFG.FIREBASE_CONFIG || {};

const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p";
const COLLECTION = "titulos";
const ALIAS_KEY = "reco_alias";

const PLATFORMS = ["Netflix", "Max", "Disney+", "Prime Video", "Paramount+", "Apple TV+", "Alquiler"];

const isPlaceholder = (v) => !v || typeof v !== "string" || v.startsWith("PEGA_AQUI");
const configReady = () => !isPlaceholder(TMDB_KEY) && !isPlaceholder(FB.apiKey) && !isPlaceholder(FB.projectId);

/* ---------------------------------------------------------------- DOM */
const $ = (id) => document.getElementById(id);
const els = {
  config: $("configState"), error: $("errorState"), errorText: $("errorText"),
  loading: $("loadingState"), empty: $("emptyState"), importing: $("importingState"),
  noMatch: $("noMatchState"), sections: $("sections"), controls: $("controls"),
  aliasChip: $("aliasChip"), aliasWho: $("aliasWho"), openAddBtn: $("openAddBtn"),
  statusFilter: $("statusFilter"), catFilter: $("catFilter"), platFilter: $("platFilter"), feedSearch: $("feedSearch"),
  importBtn: $("importBtn"), emptyAddBtn: $("emptyAddBtn"), importBar: $("importBar"), importLbl: $("importLbl"),
  // alias modal
  aliasOverlay: $("aliasOverlay"), aliasCloseBtn: $("aliasCloseBtn"), aliasInput: $("aliasInput"),
  aliasExisting: $("aliasExisting"), aliasSaveBtn: $("aliasSaveBtn"),
  // add modal
  addOverlay: $("addOverlay"), addCloseBtn: $("addCloseBtn"), tmdbSearch: $("tmdbSearch"),
  results: $("results"), resultsHint: $("resultsHint"), addDetails: $("addDetails"),
  catChips: $("catChips"), catCustom: $("catCustom"), platChips: $("platChips"),
  addBtn: $("addBtn"), addMsg: $("addMsg"),
  // edit modal
  editOverlay: $("editOverlay"), editCloseBtn: $("editCloseBtn"), editTitleName: $("editTitleName"),
  editCatChips: $("editCatChips"), editCatCustom: $("editCatCustom"), editPlatChips: $("editPlatChips"),
  editSaveBtn: $("editSaveBtn"), editMsg: $("editMsg"),
  // detail modal
  detailOverlay: $("detailOverlay"), detailCloseBtn: $("detailCloseBtn"), detailContent: $("detailContent"),
};

/* ---------------------------------------------------------------- Estado */
let db = null;
let titles = [];                 // docs de Firestore
let alias = "";
let uiFilter = { status: "pending", cat: "all", plat: "all", text: "" };
let addSel = { item: null, category: null, platforms: new Set() };
let editSel = { id: null, category: null, platforms: new Set() };

function showState(el) {
  [els.config, els.error, els.loading, els.empty, els.importing, els.noMatch].forEach(e => e.style.display = "none");
  els.sections.style.display = "none";
  if (el === els.sections) els.sections.style.display = "block";
  else if (el) el.style.display = "block";
}

const escapeHtml = (s) => (s || "").replace(/[&<>"']/g, c => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

/* ======================================================================
   TMDB
   ====================================================================== */
async function tmdb(path, params = {}) {
  const url = new URL(TMDB_BASE + path);
  url.searchParams.set("api_key", TMDB_KEY);
  url.searchParams.set("language", TMDB_LANG);
  for (const [k, v] of Object.entries(params)) if (v != null && v !== "") url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) throw new Error("TMDB " + res.status);
  return res.json();
}

const posterUrl = (p, size = "w342") => (p ? `${IMG_BASE}/${size}${p}` : null);

function normalizeResult(r) {
  const isMovie = r.media_type ? r.media_type === "movie" : true;
  const title = isMovie ? (r.title || r.name) : (r.name || r.title);
  const date = isMovie ? r.release_date : r.first_air_date;
  return {
    tmdbId: r.id,
    mediaType: r.media_type || "movie",
    title: title || "(sin título)",
    year: date ? Number(date.slice(0, 4)) : null,
    posterPath: r.poster_path || null,
    overview: r.overview || "",
  };
}

async function searchTMDB(q) {
  const data = await tmdb("/search/multi", { query: q, include_adult: "false", page: 1 });
  return (data.results || [])
    .filter(r => (r.media_type === "movie" || r.media_type === "tv") && (r.title || r.name))
    .slice(0, 12).map(normalizeResult);
}

// Trae director, elenco y rating de un título ya elegido (para autocompletar al agregar).
async function fetchCredits(mediaType, id) {
  try {
    const d = await tmdb(`/${mediaType}/${id}`, { append_to_response: "credits" });
    const credits = d.credits || {};
    let director = "";
    if (mediaType === "tv") director = (d.created_by || []).map(c => c.name).slice(0, 2).join(", ");
    if (!director) {
      const dir = (credits.crew || []).find(c => c.job === "Director");
      director = dir ? dir.name : "";
    }
    const cast = (credits.cast || []).slice(0, 3).map(c => c.name).join(", ");
    const imdb = d.vote_average ? Math.round(d.vote_average * 10) / 10 : null;
    return { director, cast, imdb };
  } catch (e) { return { director: "", cast: "", imdb: null }; }
}

function pickTrailer(vids) {
  const yt = (vids || []).filter(v => v.site === "YouTube");
  return yt.find(v => v.type === "Trailer" && v.official)
    || yt.find(v => v.type === "Trailer")
    || yt.find(v => v.type === "Teaser")
    || yt[0] || null;
}

function fmtRuntime(d, mediaType) {
  if (mediaType === "tv") {
    const s = d.number_of_seasons;
    const perEp = (d.episode_run_time || [])[0];
    const parts = [];
    if (s) parts.push(`${s} temporada${s > 1 ? "s" : ""}`);
    if (perEp) parts.push(`${perEp} min/ep`);
    return parts.join(" · ");
  }
  const m = d.runtime;
  if (!m) return "";
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}

// Trae la ficha completa de un título (en vivo, al abrir la card).
async function fetchDetail(mediaType, id) {
  const d = await tmdb(`/${mediaType}/${id}`, { append_to_response: "credits,videos,external_ids" });
  // Preferimos el tráiler en inglés; si no hay, caemos al del idioma por defecto.
  let trailer = null;
  try { const v = await tmdb(`/${mediaType}/${id}/videos`, { language: "en-US" }); trailer = pickTrailer(v.results || []); } catch (e) {}
  if (!trailer) trailer = pickTrailer((d.videos && d.videos.results) || []);
  const credits = d.credits || {};
  let director = "";
  if (mediaType === "tv") director = (d.created_by || []).map(c => c.name).slice(0, 2).join(", ");
  if (!director) { const dir = (credits.crew || []).find(c => c.job === "Director"); director = dir ? dir.name : ""; }
  const cast = (credits.cast || []).slice(0, 6).map(c => c.name).join(", ");
  const date = mediaType === "tv" ? d.first_air_date : d.release_date;
  const imdbId = d.imdb_id || (d.external_ids && d.external_ids.imdb_id) || null;
  return {
    title: mediaType === "tv" ? (d.name || d.original_name) : (d.title || d.original_title),
    year: date ? date.slice(0, 4) : "",
    runtime: fmtRuntime(d, mediaType),
    genres: (d.genres || []).map(g => g.name),
    rating: d.vote_average ? Math.round(d.vote_average * 10) / 10 : null,
    overview: d.overview || "",
    director, cast,
    backdrop: d.backdrop_path ? `${IMG_BASE}/w780${d.backdrop_path}` : (d.poster_path ? `${IMG_BASE}/w500${d.poster_path}` : null),
    trailerKey: trailer ? trailer.key : null,
    imdbUrl: imdbId ? `https://www.imdb.com/title/${imdbId}/` : null,
    tmdbUrl: `https://www.themoviedb.org/${mediaType}/${id}`,
  };
}

// Busca la mejor coincidencia para un item de la semilla (título + año).
async function enrichSeed(item) {
  try {
    const data = await tmdb("/search/movie", { query: item.title, year: item.year || "", page: 1 });
    let best = (data.results || [])[0];
    // si hay año, preferir match exacto de año
    if (item.year) {
      const exact = (data.results || []).find(r => (r.release_date || "").slice(0, 4) === String(item.year));
      if (exact) best = exact;
    }
    if (best) return { tmdbId: best.id, posterPath: best.poster_path || null, overview: best.overview || "" };
  } catch (e) { /* seguimos sin enriquecer */ }
  return { tmdbId: null, posterPath: null, overview: "" };
}

/* ======================================================================
   Firestore
   ====================================================================== */
async function initFirebase() {
  const [{ initializeApp }, firestore] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"),
  ]);
  FS = firestore;
  db = FS.getFirestore(initializeApp(FB));
}

async function loadTitles() {
  const snap = await FS.getDocs(FS.query(FS.collection(db, COLLECTION), FS.orderBy("createdAt", "desc"), FS.limit(2000)));
  titles = snap.docs.map(d => {
    const x = d.data();
    return {
      id: d.id,
      tmdbId: x.tmdbId ?? null,
      mediaType: x.mediaType || "movie",
      title: x.title || "",
      year: x.year || null,
      posterPath: x.posterPath || null,
      overview: x.overview || "",
      category: x.category || "Sin categoría",
      platforms: Array.isArray(x.platforms) ? x.platforms : [],
      rental: !!x.rental,
      director: x.director || "",
      cast: x.cast || "",
      imdb: x.imdb ?? null,
      addedBy: x.addedBy || "",
      seenBy: Array.isArray(x.seenBy) ? x.seenBy : [],
    };
  });
}

async function addTitle(doc) {
  await FS.addDoc(FS.collection(db, COLLECTION), { ...doc, createdAt: FS.serverTimestamp() });
}

async function toggleSeen(t) {
  if (!alias) { openAliasModal(); return; }
  const ref = FS.doc(db, COLLECTION, t.id);
  const has = t.seenBy.includes(alias);
  await FS.updateDoc(ref, { seenBy: has ? FS.arrayRemove(alias) : FS.arrayUnion(alias) });
  // update local
  t.seenBy = has ? t.seenBy.filter(a => a !== alias) : [...t.seenBy, alias];
  renderFeed();
}

/* ======================================================================
   Identidad (alias)
   ====================================================================== */
function loadAlias() {
  try { alias = localStorage.getItem(ALIAS_KEY) || ""; } catch (e) { alias = ""; }
  els.aliasWho.textContent = alias || "¿quién sos?";
}
function saveAlias(name) {
  alias = name.trim();
  try { localStorage.setItem(ALIAS_KEY, alias); } catch (e) {}
  els.aliasWho.textContent = alias || "¿quién sos?";
}
function knownAliases() {
  const set = new Set();
  for (const t of titles) { for (const a of t.seenBy) set.add(a); if (t.addedBy) set.add(t.addedBy); }
  return [...set].sort((a, b) => a.localeCompare(b));
}
function openAliasModal() {
  els.aliasInput.value = alias;
  els.aliasSaveBtn.disabled = !alias;
  const others = knownAliases().filter(a => a !== alias);
  els.aliasExisting.innerHTML = others.length
    ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">O elegí uno ya usado:</div>
       <div class="alias-list">${others.map(a => `<button class="who-opt" data-a="${escapeHtml(a)}">${escapeHtml(a)}</button>`).join("")}</div>`
    : "";
  els.aliasExisting.querySelectorAll(".who-opt").forEach(b =>
    b.addEventListener("click", () => { saveAlias(b.dataset.a); closeAliasModal(); renderFeed(); }));
  els.aliasOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
  els.aliasInput.focus();
}
function closeAliasModal() { els.aliasOverlay.classList.remove("open"); document.body.style.overflow = ""; }

/* ======================================================================
   Render del feed
   ====================================================================== */
function distinct(getter) {
  const c = new Map();
  for (const t of titles) for (const v of [].concat(getter(t))) if (v) c.set(v, (c.get(v) || 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1]);
}

function populateFilters() {
  const cats = distinct(t => t.category);
  els.catFilter.innerHTML = `<option value="all">Todas las categorías</option>` +
    cats.map(([c, n]) => `<option value="${escapeHtml(c)}">${escapeHtml(c)} (${n})</option>`).join("");
  els.catFilter.value = uiFilter.cat;

  const plats = distinct(t => (t.platforms.length ? t.platforms : ["Por confirmar"]));
  els.platFilter.innerHTML = `<option value="all">Todas las plataformas</option>` +
    plats.map(([p, n]) => `<option value="${escapeHtml(p)}">${escapeHtml(p)} (${n})</option>`).join("");
  els.platFilter.value = uiFilter.plat;
}

function matchesFilters(t) {
  if (uiFilter.status === "pending" && alias && t.seenBy.includes(alias)) return false;
  if (uiFilter.status === "seen" && !(alias && t.seenBy.includes(alias))) return false;
  if (uiFilter.cat !== "all" && t.category !== uiFilter.cat) return false;
  if (uiFilter.plat !== "all") {
    const plats = t.platforms.length ? t.platforms : ["Por confirmar"];
    if (!plats.includes(uiFilter.plat)) return false;
  }
  if (uiFilter.text && !t.title.toLowerCase().includes(uiFilter.text.toLowerCase())) return false;
  return true;
}

function cardHTML(t) {
  const img = posterUrl(t.posterPath, "w342");
  const seenMine = alias && t.seenBy.includes(alias);
  const plats = t.platforms.length
    ? t.platforms.map(p => `<span class="plat-chip">${escapeHtml(p)}</span>`).join("")
    : `<span class="plat-chip na">Plataforma por confirmar</span>`;
  const seenLine = t.seenBy.length
    ? `👁 <b>${escapeHtml(t.seenBy.join(", "))}</b>`
    : `Nadie la vio todavía`;
  const rental = t.rental ? `<span class="rental-badge">💲 Alquiler</span>` : "";
  const imdb = t.imdb ? `<span class="imdb-badge">★ ${t.imdb}</span>` : "";
  return `
    <article class="card ${seenMine ? "seen-mine" : ""}" data-id="${t.id}">
      <div class="poster">
        ${img ? `<img loading="lazy" src="${img}" alt="${escapeHtml(t.title)}">` : `<div class="no-img">🎞️</div>`}
        <div class="badges-tl"><span class="cat-badge">${escapeHtml(t.category)}</span>${rental}</div>
        ${imdb}
      </div>
      <div class="card-body">
        <div class="card-title">${escapeHtml(t.title)}</div>
        ${t.year ? `<div class="card-year">${t.year}${t.mediaType === "tv" ? " · Serie" : ""}</div>` : ""}
        ${t.director ? `<div class="card-crew"><span class="lbl">Dir.</span> ${escapeHtml(t.director)}</div>` : ""}
        ${t.cast ? `<div class="card-crew cast">${escapeHtml(t.cast)}</div>` : ""}
        <div class="platforms">${plats}</div>
        <div class="card-foot">
          <div class="seen-line">${seenLine}</div>
          <div class="foot-actions">
            <button class="btn-seen ${seenMine ? "on" : ""}" data-id="${t.id}">${seenMine ? "✓ La vi" : "Marcar como vista"}</button>
            <button class="btn-edit" data-edit="${t.id}" title="Editar categoría y plataforma" aria-label="Editar">✏️</button>
          </div>
        </div>
      </div>
    </article>`;
}

function renderFeed() {
  populateFilters();
  if (!titles.length) { showState(els.empty); return; }
  const list = titles.filter(matchesFilters);
  if (!list.length) { showState(els.noMatch); return; }

  // agrupar por categoría (ordenadas por cantidad)
  const groups = new Map();
  for (const t of list) { if (!groups.has(t.category)) groups.set(t.category, []); groups.get(t.category).push(t); }
  const ordered = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

  els.sections.innerHTML = ordered.map(([cat, items]) => {
    items.sort((a, b) => (b.imdb || 0) - (a.imdb || 0) || a.title.localeCompare(b.title));
    return `
      <section class="cat-section">
        <div class="cat-head"><h2>${escapeHtml(cat)}</h2><span class="n">${items.length}</span></div>
        <div class="grid">${items.map(cardHTML).join("")}</div>
      </section>`;
  }).join("");

  els.sections.querySelectorAll(".btn-seen").forEach(btn =>
    btn.addEventListener("click", () => { const t = titles.find(x => x.id === btn.dataset.id); if (t) toggleSeen(t); }));
  els.sections.querySelectorAll(".btn-edit").forEach(btn =>
    btn.addEventListener("click", () => { const t = titles.find(x => x.id === btn.dataset.edit); if (t) openEditModal(t); }));
  els.sections.querySelectorAll(".card").forEach(card =>
    card.addEventListener("click", (e) => {
      if (e.target.closest(".btn-seen, .btn-edit")) return; // los botones tienen su propia acción
      const t = titles.find(x => x.id === card.dataset.id); if (t) openDetail(t);
    }));

  showState(els.sections);
  els.controls.style.display = "block";
}

/* ======================================================================
   Importar semilla (una vez)
   ====================================================================== */
async function importSeed() {
  showState(els.importing);
  let seed;
  try {
    seed = (await (await fetch("seed.json")).json()).titulos || [];
  } catch (e) {
    showState(els.error); els.errorText.textContent = "No encontramos seed.json para importar."; return;
  }
  const total = seed.length;
  let done = 0;
  const setProg = () => { els.importBar.style.width = `${Math.round(done / total * 100)}%`; els.importLbl.textContent = `${done} / ${total}`; };
  setProg();

  // procesar en tandas de 5 para no saturar TMDB
  for (let i = 0; i < seed.length; i += 5) {
    const chunk = seed.slice(i, i + 5);
    await Promise.all(chunk.map(async (s) => {
      const enr = await enrichSeed(s);
      await addTitle({
        tmdbId: enr.tmdbId, mediaType: s.mediaType || "movie",
        title: s.title, year: s.year || null,
        posterPath: enr.posterPath, overview: enr.overview,
        category: s.category || "Sin categoría",
        platforms: Array.isArray(s.platforms) ? s.platforms : [],
        rental: !!s.rental, director: s.director || "", cast: s.cast || "",
        imdb: s.imdb ?? null, addedBy: "lista base", seenBy: [],
      });
      done++; setProg();
    }));
  }
  await refresh();
}

/* ======================================================================
   Modal: agregar título
   ====================================================================== */
let searchTimer = null;

function openAddModal() {
  resetAddModal();
  els.addOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
  els.tmdbSearch.focus();
}
function closeAddModal() { els.addOverlay.classList.remove("open"); document.body.style.overflow = ""; }
function resetAddModal() {
  els.tmdbSearch.value = ""; els.results.innerHTML = "";
  els.resultsHint.style.display = "block"; els.resultsHint.textContent = "Escribí un título para buscar.";
  els.addDetails.style.display = "none"; els.catCustom.value = "";
  els.addMsg.className = "modal-msg"; els.addBtn.disabled = true;
  addSel = { item: null, category: null, platforms: new Set() };
}

function renderResults(items) {
  if (!items.length) { els.results.innerHTML = ""; els.resultsHint.style.display = "block"; els.resultsHint.textContent = "No encontramos nada con ese título."; return; }
  els.resultsHint.style.display = "none";
  els.results.innerHTML = items.map((it, i) => {
    const img = posterUrl(it.posterPath, "w92");
    const tag = it.mediaType === "movie" ? `<span class="tag movie">🎬 Peli</span>` : `<span class="tag tv">📺 Serie</span>`;
    return `<button class="result" data-i="${i}">
        ${img ? `<img src="${img}" alt="">` : `<div class="no-img">🎞️</div>`}
        <div class="result-info"><span class="t">${escapeHtml(it.title)}</span>
        <span class="m">${tag}${it.year ? `<span>${it.year}</span>` : ""}</span></div></button>`;
  }).join("");
  els.results.querySelectorAll(".result").forEach(b => b.addEventListener("click", () => selectResult(items[+b.dataset.i], b)));
}

function selectResult(item, btn) {
  addSel.item = item;
  els.results.querySelectorAll(".result").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
  // chips de categoría (las existentes)
  const cats = distinct(t => t.category).map(([c]) => c);
  els.catChips.innerHTML = cats.map(c => `<button class="chip-opt" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join("");
  els.catChips.querySelectorAll(".chip-opt").forEach(b => b.addEventListener("click", () => {
    els.catCustom.value = "";
    els.catChips.querySelectorAll(".chip-opt").forEach(x => x.classList.remove("on"));
    b.classList.add("on"); addSel.category = b.dataset.cat; updateAddBtn();
  }));
  // chips de plataforma
  els.platChips.innerHTML = PLATFORMS.map(p => `<button class="chip-opt plat" data-p="${escapeHtml(p)}">${escapeHtml(p)}</button>`).join("");
  els.platChips.querySelectorAll(".chip-opt").forEach(b => b.addEventListener("click", () => {
    const p = b.dataset.p;
    if (addSel.platforms.has(p)) { addSel.platforms.delete(p); b.classList.remove("on"); }
    else { addSel.platforms.add(p); b.classList.add("on"); }
  }));
  els.addDetails.style.display = "block";
  updateAddBtn();
}

function currentCategory() { return els.catCustom.value.trim() || addSel.category; }
function updateAddBtn() { els.addBtn.disabled = !(addSel.item && currentCategory()); }

async function onAdd() {
  const cat = currentCategory();
  if (!addSel.item || !cat) return;
  els.addBtn.disabled = true; els.addBtn.textContent = "Agregando…";
  try {
    const it = addSel.item;
    const cr = await fetchCredits(it.mediaType, it.tmdbId); // director + elenco + rating
    await addTitle({
      tmdbId: it.tmdbId, mediaType: it.mediaType, title: it.title, year: it.year,
      posterPath: it.posterPath, overview: it.overview,
      category: cat, platforms: [...addSel.platforms],
      rental: addSel.platforms.has("Alquiler"),
      director: cr.director, cast: cr.cast, imdb: cr.imdb,
      addedBy: alias || "anónimo", seenBy: [],
    });
    els.addMsg.className = "modal-msg success show"; els.addMsg.textContent = "¡Agregada a la lista! 🎉";
    await refresh();
    setTimeout(closeAddModal, 900);
  } catch (e) {
    console.error(e);
    els.addMsg.className = "modal-msg error show"; els.addMsg.textContent = "No se pudo agregar. Revisá las reglas de Firestore (ver README).";
    els.addBtn.disabled = false;
  } finally { els.addBtn.textContent = "Agregar a la lista"; }
}

function onSearchInput() {
  const q = els.tmdbSearch.value.trim();
  clearTimeout(searchTimer);
  addSel.item = null; els.addDetails.style.display = "none";
  if (q.length < 2) { els.results.innerHTML = ""; els.resultsHint.style.display = "block"; els.resultsHint.textContent = "Escribí un título para buscar."; return; }
  els.resultsHint.style.display = "block"; els.resultsHint.textContent = "Buscando…";
  searchTimer = setTimeout(async () => {
    try { const items = await searchTMDB(q); if (els.tmdbSearch.value.trim() === q) renderResults(items); }
    catch (e) { els.resultsHint.textContent = "No pudimos buscar en TMDB. Revisá tu conexión o la API key."; }
  }, 350);
}

/* ======================================================================
   Modal: editar título (categoría + plataformas)
   ====================================================================== */
function bindChipGroup(container, isPlatform, onCatPick) {
  container.querySelectorAll(".chip-opt").forEach(b => b.addEventListener("click", () => {
    if (isPlatform) {
      const p = b.dataset.p;
      if (editSel.platforms.has(p)) { editSel.platforms.delete(p); b.classList.remove("on"); }
      else { editSel.platforms.add(p); b.classList.add("on"); }
    } else {
      els.editCatCustom.value = "";
      container.querySelectorAll(".chip-opt").forEach(x => x.classList.remove("on"));
      b.classList.add("on"); editSel.category = b.dataset.cat;
    }
  }));
}

function openEditModal(t) {
  editSel = { id: t.id, category: t.category, platforms: new Set(t.platforms) };
  els.editTitleName.textContent = t.title + (t.year ? ` (${t.year})` : "");
  els.editCatCustom.value = "";
  els.editMsg.className = "modal-msg";

  const cats = distinct(x => x.category).map(([c]) => c);
  if (!cats.includes(t.category)) cats.unshift(t.category);
  els.editCatChips.innerHTML = cats.map(c =>
    `<button class="chip-opt ${c === t.category ? "on" : ""}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join("");
  bindChipGroup(els.editCatChips, false);

  els.editPlatChips.innerHTML = PLATFORMS.map(p =>
    `<button class="chip-opt plat ${editSel.platforms.has(p) ? "on" : ""}" data-p="${escapeHtml(p)}">${escapeHtml(p)}</button>`).join("");
  bindChipGroup(els.editPlatChips, true);

  els.editOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeEditModal() { els.editOverlay.classList.remove("open"); document.body.style.overflow = ""; }

async function onEditSave() {
  const cat = els.editCatCustom.value.trim() || editSel.category;
  if (!cat) { els.editMsg.className = "modal-msg error show"; els.editMsg.textContent = "Elegí o escribí una categoría."; return; }
  els.editSaveBtn.disabled = true; els.editSaveBtn.textContent = "Guardando…";
  try {
    const platforms = [...editSel.platforms];
    const rental = editSel.platforms.has("Alquiler");
    await FS.updateDoc(FS.doc(db, COLLECTION, editSel.id), { category: cat, platforms, rental });
    const t = titles.find(x => x.id === editSel.id);
    if (t) { t.category = cat; t.platforms = platforms; t.rental = rental; }
    els.editMsg.className = "modal-msg success show"; els.editMsg.textContent = "¡Guardado! ✅";
    renderFeed();
    setTimeout(closeEditModal, 700);
  } catch (e) {
    console.error(e);
    els.editMsg.className = "modal-msg error show"; els.editMsg.textContent = "No se pudo guardar. Revisá las reglas de Firestore.";
  } finally { els.editSaveBtn.disabled = false; els.editSaveBtn.textContent = "Guardar cambios"; }
}

/* ======================================================================
   Modal: ficha (detalle en vivo desde TMDB)
   ====================================================================== */
function closeDetail() { els.detailOverlay.classList.remove("open"); document.body.style.overflow = ""; els.detailContent.innerHTML = ""; }

async function openDetail(t) {
  els.detailOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
  els.detailContent.innerHTML = `<div class="detail-loading"><div class="spinner"></div>Cargando ficha…</div>`;

  if (!t.tmdbId) {
    els.detailContent.innerHTML = `<div class="detail-loading">No hay datos de TMDB para este título.</div>`;
    return;
  }
  let d;
  try { d = await fetchDetail(t.mediaType, t.tmdbId); }
  catch (e) {
    els.detailContent.innerHTML = `<div class="detail-loading">No pudimos cargar la ficha. Probá de nuevo.</div>`;
    return;
  }
  if (!els.detailOverlay.classList.contains("open")) return; // se cerró mientras cargaba

  const overview = d.overview || t.overview || "Sin sinopsis disponible.";
  const sub = [d.year, d.runtime, t.category].filter(Boolean)
    .map(x => `<span>${escapeHtml(x)}</span>`).join(`<span class="dot">·</span>`);
  const genres = d.genres.map(g => `<span class="genre-chip">${escapeHtml(g)}</span>`).join("");
  const seenMine = alias && t.seenBy.includes(alias);

  els.detailContent.innerHTML = `
    <div class="detail-hero" style="${d.backdrop ? `background-image:url('${d.backdrop}')` : ""}">
      <div class="scrim"></div>
      <div class="htext">
        <h2>${escapeHtml(d.title || t.title)}</h2>
        <div class="detail-sub">${sub}${d.rating ? `<span class="dot">·</span><span class="rate">★ ${d.rating}</span>` : ""}</div>
      </div>
    </div>
    <div class="detail-body">
      ${genres ? `<div class="detail-genres">${genres}</div>` : ""}
      <div class="detail-overview">${escapeHtml(overview)}</div>
      ${d.director ? `<div class="detail-crew"><span class="lbl">Dirección:</span> ${escapeHtml(d.director)}</div>` : ""}
      ${d.cast ? `<div class="detail-crew"><span class="lbl">Elenco:</span> ${escapeHtml(d.cast)}</div>` : ""}
      ${d.trailerKey ? `<div class="trailer-wrap"><iframe src="https://www.youtube.com/embed/${d.trailerKey}" title="Tráiler" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>` : ""}
      <div class="detail-actions">
        <button class="btn-seen ${seenMine ? "on" : ""}" id="detailSeenBtn">${seenMine ? "✓ La vi" : "Marcar como vista"}</button>
        <button class="btn-edit" id="detailEditBtn" style="width:auto;padding:9px 14px;">✏️ Editar</button>
        ${d.imdbUrl ? `<a class="link-btn" href="${d.imdbUrl}" target="_blank" rel="noopener">IMDb ↗</a>` : ""}
        <a class="link-btn" href="${d.tmdbUrl}" target="_blank" rel="noopener">TMDB ↗</a>
      </div>
    </div>`;

  els.detailContent.querySelector("#detailSeenBtn").addEventListener("click", async () => {
    await toggleSeen(t);
    const nowSeen = alias && t.seenBy.includes(alias);
    const b = els.detailContent.querySelector("#detailSeenBtn");
    if (b) { b.classList.toggle("on", nowSeen); b.textContent = nowSeen ? "✓ La vi" : "Marcar como vista"; }
  });
  els.detailContent.querySelector("#detailEditBtn").addEventListener("click", () => { closeDetail(); openEditModal(t); });
}

/* ======================================================================
   Refresh + eventos
   ====================================================================== */
async function refresh() { await loadTitles(); renderFeed(); }

function wireEvents() {
  els.openAddBtn.addEventListener("click", openAddModal);
  els.emptyAddBtn.addEventListener("click", openAddModal);
  els.addCloseBtn.addEventListener("click", closeAddModal);
  els.addOverlay.addEventListener("click", e => { if (e.target === els.addOverlay) closeAddModal(); });
  els.tmdbSearch.addEventListener("input", onSearchInput);
  els.catCustom.addEventListener("input", () => {
    if (els.catCustom.value.trim()) els.catChips.querySelectorAll(".chip-opt").forEach(x => x.classList.remove("on"));
    updateAddBtn();
  });
  els.addBtn.addEventListener("click", onAdd);

  els.aliasChip.addEventListener("click", openAliasModal);
  els.aliasCloseBtn.addEventListener("click", closeAliasModal);
  els.aliasOverlay.addEventListener("click", e => { if (e.target === els.aliasOverlay) closeAliasModal(); });
  els.aliasInput.addEventListener("input", () => { els.aliasSaveBtn.disabled = !els.aliasInput.value.trim(); });
  els.aliasSaveBtn.addEventListener("click", () => { if (els.aliasInput.value.trim()) { saveAlias(els.aliasInput.value); closeAliasModal(); renderFeed(); } });

  els.importBtn.addEventListener("click", importSeed);

  els.editCloseBtn.addEventListener("click", closeEditModal);
  els.editOverlay.addEventListener("click", e => { if (e.target === els.editOverlay) closeEditModal(); });
  els.editSaveBtn.addEventListener("click", onEditSave);

  els.detailCloseBtn.addEventListener("click", closeDetail);
  els.detailOverlay.addEventListener("click", e => { if (e.target === els.detailOverlay) closeDetail(); });

  els.statusFilter.querySelectorAll(".seg").forEach(seg => seg.addEventListener("click", () => {
    els.statusFilter.querySelectorAll(".seg").forEach(s => s.classList.remove("active"));
    seg.classList.add("active"); uiFilter.status = seg.dataset.status; renderFeed();
  }));
  els.catFilter.addEventListener("change", () => { uiFilter.cat = els.catFilter.value; renderFeed(); });
  els.platFilter.addEventListener("change", () => { uiFilter.plat = els.platFilter.value; renderFeed(); });
  els.feedSearch.addEventListener("input", () => { uiFilter.text = els.feedSearch.value.trim(); renderFeed(); });

  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (els.addOverlay.classList.contains("open")) closeAddModal();
    if (els.aliasOverlay.classList.contains("open")) closeAliasModal();
    if (els.editOverlay.classList.contains("open")) closeEditModal();
    if (els.detailOverlay.classList.contains("open")) closeDetail();
  });
}

/* ======================================================================
   Arranque
   ====================================================================== */
async function main() {
  if (!configReady()) { showState(els.config); return; }
  loadAlias();
  wireEvents();
  showState(els.loading);
  try {
    await initFirebase();
    await refresh();
    if (!alias && titles.length) openAliasModal(); // pedir nombre la primera vez
  } catch (e) {
    console.error(e);
    showState(els.error);
    els.errorText.textContent = "No pudimos conectar con Firebase. Revisá config.js y las reglas de Firestore (ver README).";
  }
}

main();
