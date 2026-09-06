/* =========================================================================
   Recomendadas · lógica de la app
   - Búsqueda de títulos en TMDB
   - Alta anónima y lectura de recomendaciones en Firestore (Firebase)
   Sin build step: módulo ES cargado directo por el navegador.
   ========================================================================= */

/* El SDK de Firebase se importa de forma dinámica dentro de initFirebase(),
   solo cuando hay config válida (ver más abajo). Así la pantalla de "falta
   configurar" no depende de ninguna red. */
let FS = null; // funciones de Firestore, cargadas bajo demanda

/* ---------------------------------------------------------------- Config */
const CFG = window.APP_CONFIG || {};
const TMDB_KEY = CFG.TMDB_API_KEY || "";
const TMDB_LANG = CFG.TMDB_LANGUAGE || "es-ES";
const FB = CFG.FIREBASE_CONFIG || {};

const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p";
const COLLECTION = "recomendaciones";

function isPlaceholder(v) {
  return !v || typeof v !== "string" || v.startsWith("PEGA_AQUI");
}
function configReady() {
  return !isPlaceholder(TMDB_KEY) && !isPlaceholder(FB.apiKey) && !isPlaceholder(FB.projectId);
}

/* ---------------------------------------------------------------- DOM */
const $ = (id) => document.getElementById(id);
const grid = $("grid");
const els = {
  config: $("configState"), error: $("errorState"), errorText: $("errorText"),
  loading: $("loadingState"), empty: $("emptyState"), noMatch: $("noMatchState"),
  typeFilter: $("typeFilter"), feedSearch: $("feedSearch"), sortSelect: $("sortSelect"),
  overlay: $("modalOverlay"), openBtn: $("openModalBtn"), closeBtn: $("closeModalBtn"),
  tmdbSearch: $("tmdbSearch"), results: $("results"), resultsHint: $("resultsHint"),
  commentField: $("commentField"), commentInput: $("commentInput"), charCount: $("charCount"),
  modalFooter: $("modalFooter"), publishBtn: $("publishBtn"), modalMsg: $("modalMsg"),
};

/* ---------------------------------------------------------------- Estado */
let db = null;
let allRecos = [];      // docs crudos de Firestore
let grouped = [];       // agrupados por título
let genreMap = {};      // id -> nombre (movie + tv combinados)
let selected = null;    // título elegido en el modal
let uiFilter = { type: "all", text: "", sort: "top" };

function showOnly(stateEl) {
  [els.config, els.error, els.loading, els.empty, els.noMatch].forEach(e => e.style.display = "none");
  grid.style.display = "none";
  if (stateEl === grid) grid.style.display = "grid";
  else if (stateEl) stateEl.style.display = "block";
}

/* ======================================================================
   TMDB
   ====================================================================== */
async function tmdb(path, params = {}) {
  const url = new URL(TMDB_BASE + path);
  url.searchParams.set("api_key", TMDB_KEY);
  url.searchParams.set("language", TMDB_LANG);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) throw new Error("TMDB " + res.status);
  return res.json();
}

async function loadGenres() {
  try {
    const [mv, tv] = await Promise.all([
      tmdb("/genre/movie/list"),
      tmdb("/genre/tv/list"),
    ]);
    for (const g of [...(mv.genres || []), ...(tv.genres || [])]) genreMap[g.id] = g.name;
  } catch (e) {
    console.warn("No se pudieron cargar los géneros de TMDB", e);
  }
}

function posterUrl(path, size = "w200") {
  return path ? `${IMG_BASE}/${size}${path}` : null;
}

function normalizeResult(r) {
  const isMovie = r.media_type === "movie";
  const title = isMovie ? r.title : r.name;
  const date = isMovie ? r.release_date : r.first_air_date;
  return {
    tmdbId: r.id,
    mediaType: r.media_type,
    title: title || "(sin título)",
    year: date ? date.slice(0, 4) : "",
    posterPath: r.poster_path || null,
    overview: r.overview || "",
    genres: (r.genre_ids || []).map(id => genreMap[id]).filter(Boolean).slice(0, 3),
  };
}

async function searchTMDB(q) {
  const data = await tmdb("/search/multi", { query: q, include_adult: "false", page: "1" });
  return (data.results || [])
    .filter(r => (r.media_type === "movie" || r.media_type === "tv") && (r.title || r.name))
    .slice(0, 12)
    .map(normalizeResult);
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
  const app = initializeApp(FB);
  db = FS.getFirestore(app);
}

async function loadRecos() {
  const q = FS.query(FS.collection(db, COLLECTION), FS.orderBy("createdAt", "desc"), FS.limit(1000));
  const snap = await FS.getDocs(q);
  allRecos = snap.docs.map(d => {
    const x = d.data();
    return {
      id: d.id,
      tmdbId: x.tmdbId,
      mediaType: x.mediaType,
      title: x.title || "",
      year: x.year || "",
      posterPath: x.posterPath || null,
      overview: x.overview || "",
      genres: Array.isArray(x.genres) ? x.genres : [],
      comment: (x.comment || "").trim(),
      createdAt: x.createdAt && x.createdAt.toDate ? x.createdAt.toDate() : null,
    };
  });
}

function groupRecos() {
  const map = new Map();
  for (const r of allRecos) {
    const key = `${r.mediaType}:${r.tmdbId}`;
    if (!map.has(key)) {
      map.set(key, {
        key, tmdbId: r.tmdbId, mediaType: r.mediaType, title: r.title, year: r.year,
        posterPath: r.posterPath, overview: r.overview, genres: r.genres,
        count: 0, comments: [], latest: r.createdAt || new Date(0),
      });
    }
    const g = map.get(key);
    g.count += 1;
    if (r.comment) g.comments.push({ text: r.comment, when: r.createdAt });
    if (r.createdAt && r.createdAt > g.latest) g.latest = r.createdAt;
    // completar metadata si algún doc viejo la tuviera vacía
    if (!g.posterPath && r.posterPath) g.posterPath = r.posterPath;
    if (!g.genres.length && r.genres.length) g.genres = r.genres;
  }
  grouped = [...map.values()];
}

async function publishReco(item, comment) {
  await FS.addDoc(FS.collection(db, COLLECTION), {
    tmdbId: item.tmdbId,
    mediaType: item.mediaType,
    title: item.title,
    year: item.year,
    posterPath: item.posterPath,
    overview: item.overview,
    genres: item.genres,
    comment: comment || "",
    createdAt: FS.serverTimestamp(),
  });
}

/* ======================================================================
   Render del feed
   ====================================================================== */
function timeAgo(date) {
  if (!date) return "";
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "recién";
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24); if (d < 30) return `hace ${d} d`;
  const mo = Math.floor(d / 30); if (mo < 12) return `hace ${mo} mes${mo > 1 ? "es" : ""}`;
  return `hace ${Math.floor(mo / 12)} año${mo >= 24 ? "s" : ""}`;
}

function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function applyFilters() {
  let list = grouped.slice();
  if (uiFilter.type !== "all") list = list.filter(g => g.mediaType === uiFilter.type);
  if (uiFilter.text) {
    const t = uiFilter.text.toLowerCase();
    list = list.filter(g => g.title.toLowerCase().includes(t));
  }
  if (uiFilter.sort === "recent") {
    list.sort((a, b) => b.latest - a.latest);
  } else { // top
    list.sort((a, b) => b.count - a.count || b.latest - a.latest);
  }
  return list;
}

function renderFeed() {
  const list = applyFilters();
  if (!grouped.length) { showOnly(els.empty); return; }
  if (!list.length) { showOnly(els.noMatch); return; }

  grid.innerHTML = list.map(g => {
    const img = posterUrl(g.posterPath, "w342");
    const typeLabel = g.mediaType === "movie" ? "🎬 Peli" : "📺 Serie";
    const genres = g.genres.map(x => `<span class="genre-chip">${escapeHtml(x)}</span>`).join("");
    const comments = g.comments
      .sort((a, b) => (b.when || 0) - (a.when || 0))
      .map(c => `<div class="comment">${escapeHtml(c.text)}<span class="when">${timeAgo(c.when)}</span></div>`)
      .join("");
    const commentsBlock = g.comments.length
      ? `<button class="comments-toggle" data-key="${g.key}">💬 ${g.comments.length} comentario${g.comments.length > 1 ? "s" : ""}</button>
         <div class="comments" data-comments="${g.key}">${comments}</div>`
      : "";
    return `
      <article class="card">
        <div class="poster">
          ${img ? `<img loading="lazy" src="${img}" alt="${escapeHtml(g.title)}">` : `<div class="no-img">🎞️</div>`}
          <span class="type-badge ${g.mediaType}">${typeLabel}</span>
          <span class="reco-badge">👍 ${g.count}</span>
        </div>
        <div class="card-body">
          <div class="card-title">${escapeHtml(g.title)}</div>
          <div class="card-meta">${g.year ? escapeHtml(g.year) : ""}</div>
          ${genres ? `<div class="genres">${genres}</div>` : ""}
          ${commentsBlock}
        </div>
      </article>`;
  }).join("");

  grid.querySelectorAll(".comments-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const box = grid.querySelector(`[data-comments="${btn.dataset.key}"]`);
      if (box) box.classList.toggle("open");
    });
  });

  showOnly(grid);
}

/* ======================================================================
   Modal: buscar y publicar
   ====================================================================== */
let searchTimer = null;

function openModal() {
  els.overlay.classList.add("open");
  document.body.style.overflow = "hidden";
  els.tmdbSearch.focus();
}
function closeModal() {
  els.overlay.classList.remove("open");
  document.body.style.overflow = "";
  resetModal();
}
function resetModal() {
  els.tmdbSearch.value = "";
  els.results.innerHTML = "";
  els.resultsHint.style.display = "block";
  els.resultsHint.textContent = "Escribí un título para buscar.";
  els.commentField.style.display = "none";
  els.modalFooter.style.display = "none";
  els.commentInput.value = "";
  els.charCount.textContent = "0";
  els.modalMsg.className = "modal-msg";
  els.publishBtn.disabled = true;
  selected = null;
}

function renderResults(items) {
  if (!items.length) {
    els.results.innerHTML = "";
    els.resultsHint.style.display = "block";
    els.resultsHint.textContent = "No encontramos nada con ese título.";
    return;
  }
  els.resultsHint.style.display = "none";
  els.results.innerHTML = items.map((it, i) => {
    const img = posterUrl(it.posterPath, "w92");
    const tag = it.mediaType === "movie" ? `<span class="tag movie">🎬 Peli</span>` : `<span class="tag tv">📺 Serie</span>`;
    return `
      <button class="result" data-i="${i}">
        ${img ? `<img src="${img}" alt="">` : `<div class="no-img">🎞️</div>`}
        <div class="result-info">
          <span class="t">${escapeHtml(it.title)}</span>
          <span class="m">${tag}${it.year ? `<span>${escapeHtml(it.year)}</span>` : ""}</span>
          ${it.overview ? `<span class="o">${escapeHtml(it.overview)}</span>` : ""}
        </div>
      </button>`;
  }).join("");

  els.results.querySelectorAll(".result").forEach(btn => {
    btn.addEventListener("click", () => selectResult(items[+btn.dataset.i], btn));
  });
}

function selectResult(item, btn) {
  selected = item;
  els.results.querySelectorAll(".result").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
  els.commentField.style.display = "block";
  els.modalFooter.style.display = "block";
  els.publishBtn.disabled = false;
  els.commentInput.focus();
}

function onSearchInput() {
  const q = els.tmdbSearch.value.trim();
  clearTimeout(searchTimer);
  selected = null;
  els.commentField.style.display = "none";
  els.modalFooter.style.display = "none";
  if (q.length < 2) {
    els.results.innerHTML = "";
    els.resultsHint.style.display = "block";
    els.resultsHint.textContent = "Escribí un título para buscar.";
    return;
  }
  els.resultsHint.style.display = "block";
  els.resultsHint.textContent = "Buscando…";
  searchTimer = setTimeout(async () => {
    try {
      const items = await searchTMDB(q);
      // evita pisar resultados si el usuario siguió escribiendo
      if (els.tmdbSearch.value.trim() === q) renderResults(items);
    } catch (e) {
      console.error(e);
      els.resultsHint.style.display = "block";
      els.resultsHint.textContent = "No pudimos buscar en TMDB. Revisá tu conexión o la API key.";
    }
  }, 350);
}

async function onPublish() {
  if (!selected) return;
  els.publishBtn.disabled = true;
  els.publishBtn.textContent = "Publicando…";
  els.modalMsg.className = "modal-msg";
  try {
    await publishReco(selected, els.commentInput.value.trim());
    els.modalMsg.className = "modal-msg success show";
    els.modalMsg.textContent = "¡Gracias! Tu recomendación ya está publicada. 🎉";
    await refresh();
    setTimeout(closeModal, 1100);
  } catch (e) {
    console.error(e);
    els.modalMsg.className = "modal-msg error show";
    els.modalMsg.textContent = "No se pudo publicar. Revisá las reglas de Firestore (ver README).";
    els.publishBtn.disabled = false;
  } finally {
    els.publishBtn.textContent = "Publicar recomendación";
  }
}

/* ======================================================================
   Refresh + eventos
   ====================================================================== */
async function refresh() {
  await loadRecos();
  groupRecos();
  renderFeed();
}

function wireEvents() {
  els.openBtn.addEventListener("click", openModal);
  els.closeBtn.addEventListener("click", closeModal);
  els.overlay.addEventListener("click", (e) => { if (e.target === els.overlay) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && els.overlay.classList.contains("open")) closeModal(); });

  els.tmdbSearch.addEventListener("input", onSearchInput);
  els.commentInput.addEventListener("input", () => { els.charCount.textContent = els.commentInput.value.length; });
  els.publishBtn.addEventListener("click", onPublish);

  els.typeFilter.querySelectorAll(".seg").forEach(seg => {
    seg.addEventListener("click", () => {
      els.typeFilter.querySelectorAll(".seg").forEach(s => s.classList.remove("active"));
      seg.classList.add("active");
      uiFilter.type = seg.dataset.type;
      renderFeed();
    });
  });
  els.feedSearch.addEventListener("input", () => { uiFilter.text = els.feedSearch.value.trim(); renderFeed(); });
  els.sortSelect.addEventListener("change", () => { uiFilter.sort = els.sortSelect.value; renderFeed(); });
}

/* ======================================================================
   Arranque
   ====================================================================== */
async function main() {
  if (!configReady()) { showOnly(els.config); return; }
  wireEvents();
  showOnly(els.loading);
  try {
    initFirebase();
    await loadGenres();
    await refresh();
  } catch (e) {
    console.error(e);
    showOnly(els.error);
    els.errorText.textContent = "No pudimos conectar con Firebase. Revisá config.js y las reglas de Firestore (ver README).";
  }
}

main();
