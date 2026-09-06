# Recomendadas 🍿 · nuestra lista para ver

Lista **compartida** de películas y series **pendientes de ver**, al estilo del
Excel familiar: organizada por **categoría**, mostrando **en qué plataforma**
verlas, y con la posibilidad de que **cada persona marque lo que ya vio** (con un
alias, sin cuentas ni contraseñas).

- **Frontend**: HTML + CSS + JavaScript, una sola página, sin build ni framework.
- **Datos de títulos**: [TMDB](https://www.themoviedb.org/) (búsqueda + póster + sinopsis).
- **Guardado de la lista**: [Firebase / Firestore](https://firebase.google.com/) (plan gratis).
- **Semilla**: `seed.json` con las 70 películas del Excel, ya normalizadas
  (categorías propias, plataformas en lista, IMDb). Se importan con **un botón**
  y se enriquecen con póster/sinopsis de TMDB.
- **Hosting**: GitHub Pages → **series.biquard.com** (es la home del sitio).

## Cómo funciona

1. **Ponés tu nombre** (alias) la primera vez. Queda guardado en tu dispositivo.
2. Ves la lista **agrupada por categoría**, con la plataforma de cada título y su
   nota de IMDb.
3. Filtrás por **Pendientes / Todas / Vistas**, por **categoría** y por
   **plataforma** (ej: "mostrame solo lo que hay en Max y todavía no vi").
4. **"Marcar como vista"** suma tu alias a esa peli; se ve **quién la vio**.
5. **Agregás** títulos buscándolos (TMDB autocompleta póster/año), eligiendo
   categoría y plataforma(s).

---

## 🟢 Puesta en marcha (sin terminal, ~10 minutos)

Necesitás dos llaves gratis: **Firebase** (guarda la lista) y **TMDB** (busca los
títulos). Se pegan en `config.js`.

### Paso 1 — Crear el proyecto de Firebase

1. Entrá a **https://console.firebase.google.com** con tu cuenta de Google.
2. **Agregar proyecto** → nombre (ej. `recomendadas`) → seguí los pasos
   (podés desactivar Analytics).
3. Hacé clic en el ícono **`</>`** ("Web") para **registrar una app web**,
   ponele un apodo y **Registrar app**.
4. Copiá el bloque `const firebaseConfig = { … }` (lo usás en el Paso 4). Si lo
   cerraste: ⚙️ **Configuración del proyecto → Tus apps → Config**.

### Paso 2 — Activar la base de datos (Firestore) y pegar las reglas

1. Menú izquierdo: **Compilación → Firestore Database → Crear base de datos** →
   ubicación (ej. `southamerica-east1`) → **modo producción**.
2. Pestaña **Reglas** (Rules) → borrá todo y pegá esto → **Publicar**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {

       match /titulos/{doc} {
         // Todos pueden LEER la lista
         allow read: if true;

         // Cualquiera del grupo puede AGREGAR un título válido
         allow create: if
           request.resource.data.title is string
           && request.resource.data.title.size() > 0
           && request.resource.data.title.size() <= 200
           && request.resource.data.category is string
           && request.resource.data.category.size() > 0
           && request.resource.data.category.size() <= 60
           && request.resource.data.seenBy is list
           && request.resource.data.createdAt == request.time;

         // Solo se pueden editar estos campos (marcar vista, ajustar plataforma/categoría)
         allow update: if
           request.resource.data.diff(resource.data).affectedKeys()
             .hasOnly(['seenBy', 'platforms', 'category', 'rental'])
           && request.resource.data.seenBy is list;

         // Nadie borra (por ahora)
         allow delete: if false;
       }

     }
   }
   ```

   > **Modelo de confianza**: como no hay login, cualquiera que entre puede
   > agregar títulos y marcar vistas. Es a propósito — es una lista de un
   > **grupo de confianza** (la familia). Las reglas igual impiden borrar y
   > limitan qué campos se editan. Si más adelante querés login real o listas
   > por grupo, se puede sumar.

### Paso 3 — API key de TMDB (gratis)

1. **https://www.themoviedb.org** → creá cuenta.
2. **Configuración → API → Create → Developer** → completá el formulario.
3. Copiá la **API Key (v3 auth)**.

### Paso 4 — Pegar todo en `config.js`

Abrí **`config.js`** y reemplazá los `PEGA_AQUI_...`:
- `FIREBASE_CONFIG` ← valores del Paso 1.
- `TMDB_API_KEY` ← key del Paso 3.

Guardá / commiteá.

### Paso 5 — Abrir e importar la lista base

Entrá a **https://series.biquard.com**. Como la lista arranca
vacía, vas a ver el botón **"📥 Importar lista base (70)"**: hacé clic **una vez**
y la app carga las 70 películas del Excel, buscando el póster y la sinopsis de
cada una en TMDB. ¡Listo! 🎉

> Después, cualquiera agrega títulos nuevos con **＋ Agregar**.

---

## ¿Y si algo no anda?

| Qué ves | Significa | Se arregla |
| --- | --- | --- |
| "Falta configurar la app" | `config.js` con `PEGA_AQUI_...` | Paso 4 |
| "No pudimos conectar con Firebase" | Config mal pegada o Firestore sin activar | Pasos 1 y 2 |
| "No se pudo agregar" | Faltan las reglas de Firestore | Paso 2 |
| "No pudimos buscar en TMDB" | API key inválida o sin conexión | Paso 3 |

---

## Correr en tu computadora (opcional, requiere terminal)

Usa módulos JS y `fetch`, así que **no funciona con doble clic** (`file://`):

```bash
npx http-server -p 8080 .
# abrí http://localhost:8080
```

---

## Estructura

La app es la home del sitio (raíz del repo):

```
index.html          # UI: filtros, grilla por categoría, modales
app.js              # alias + Firestore (un doc por título, seenBy) + TMDB + import
seed.json           # las 70 pelis del Excel, normalizadas (semilla)
config.js           # TUS llaves (Firebase + TMDB)
recomendadas/       # redirect a / (para links viejos)
```

## Notas

- Cada título es **un documento** en la colección `titulos`. `seenBy` guarda los
  alias de quienes ya lo vieron.
- El alias vive en tu navegador (`localStorage`); podés cambiarlo tocando el chip
  👤 del header.
- La semilla respeta las **categorías propias** de la familia y sus notas de
  **IMDb**; TMDB solo agrega póster y sinopsis.
- 13 títulos venían **sin plataforma** en el Excel: quedan como "por confirmar" y
  se pueden completar editando (o al re-cargar).
- Los valores de `config.js` quedan públicos en el repo: es **normal y seguro**
  (Firebase se protege con las reglas; la key de TMDB es de solo lectura).
