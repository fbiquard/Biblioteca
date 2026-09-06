# Recomendadas 🍿

Series y películas **recomendadas por la comunidad**. Cualquiera entra, busca un
título (con póster, año y sinopsis que trae TMDB), cuenta por qué lo recomienda
y esa recomendación queda visible para todos. Es **anónimo** (no hay cuentas ni
login) y **sin costo**.

- **Frontend**: HTML + CSS + JavaScript, una sola página, sin build ni framework.
- **Datos de títulos**: [TMDB](https://www.themoviedb.org/) (búsqueda, póster, año, sinopsis, géneros).
- **Guardado de recomendaciones**: [Firebase / Firestore](https://firebase.google.com/) (plan gratis).
- **Hosting**: GitHub Pages → queda en **series.biquard.com/recomendadas/**.

---

## 🟢 Puesta en marcha (sin terminal, ~10 minutos)

La app necesita dos "llaves" gratis: una de **Firebase** (para guardar las
recomendaciones) y una de **TMDB** (para buscar los títulos). Después las pegás
en el archivo `config.js` y listo.

### Paso 1 — Crear el proyecto de Firebase

1. Entrá a **https://console.firebase.google.com** con tu cuenta de Google.
2. **Agregar proyecto** → ponele un nombre (ej. `recomendadas`) → seguí los
   pasos. (Podés desactivar Google Analytics, no hace falta.)
3. Cuando esté creado, en el panel de inicio hacé clic en el ícono **`</>`**
   ("Web") para **registrar una app web**. Ponele un apodo y **Registrar app**.
4. Te va a mostrar un bloque `const firebaseConfig = { … }`. **Esos son los
   valores que vas a copiar** en el Paso 4. (Si lo cerraste: ⚙️ **Configuración
   del proyecto → Tus apps → SDK setup and configuration → Config**.)

### Paso 2 — Activar la base de datos (Firestore)

1. En el menú de la izquierda: **Compilación → Firestore Database**.
2. **Crear base de datos** → elegí una ubicación (ej. `southamerica-east1`) →
   empezá en **modo producción** (después pegamos las reglas correctas).
3. Cuando esté creada, andá a la pestaña **Reglas** (Rules), **borrá todo** y
   pegá exactamente esto, luego **Publicar**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {

       match /recomendaciones/{doc} {
         // Todos pueden LEER las recomendaciones
         allow read: if true;

         // Cualquiera puede CREAR una recomendación, pero validada:
         allow create: if
           request.resource.data.tmdbId is int
           && (request.resource.data.mediaType == 'movie'
               || request.resource.data.mediaType == 'tv')
           && request.resource.data.title is string
           && request.resource.data.title.size() > 0
           && request.resource.data.title.size() <= 200
           && request.resource.data.comment is string
           && request.resource.data.comment.size() <= 280
           && request.resource.data.createdAt == request.time;

         // Nadie puede editar ni borrar lo de otros
         allow update, delete: if false;
       }

     }
   }
   ```

   > Estas reglas dejan **leer a todos** y **crear** recomendaciones válidas de
   > forma anónima, pero **impiden editar o borrar**. Así nadie puede romper las
   > recomendaciones de los demás. La colección se llama `recomendaciones` y se
   > crea sola con la primera carga.

### Paso 3 — Conseguir la API key de TMDB (gratis)

1. Entrá a **https://www.themoviedb.org** y creá una cuenta.
2. **Configuración (perfil) → API → Solicitar / Create → Developer**. Completá
   el formulario (podés poner un uso "personal/educativo").
3. Copiá la **API Key (v3 auth)** — una tira de letras y números.

### Paso 4 — Pegar todo en `config.js`

Abrí el archivo **`config.js`** (en esta misma carpeta) y reemplazá los
`PEGA_AQUI_...` por tus valores:

- En `FIREBASE_CONFIG`, pegá los valores del bloque `firebaseConfig` del Paso 1
  (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`,
  `appId`).
- En `TMDB_API_KEY`, pegá la key del Paso 3.

Guardá el archivo. Si editás por la web de GitHub, con **Commit** ya queda.

### Paso 5 — ¡Listo!

GitHub Pages sirve la carpeta automáticamente. Abrí:

**https://series.biquard.com/recomendadas/**

Buscá una serie o peli, agregá tu comentario y publicá. La recomendación
aparece al toque para todos. 🎉

---

## ¿Y si algo no anda?

La app te avisa en pantalla:

| Qué ves | Qué significa | Cómo se arregla |
| --- | --- | --- |
| "Falta configurar la app" | `config.js` todavía tiene los `PEGA_AQUI_...` | Completá el Paso 4 |
| "No pudimos conectar con Firebase" | Config mal pegada o Firestore sin activar | Revisá Pasos 1 y 2 |
| "No se pudo publicar" | Faltan las reglas de Firestore | Pegá las reglas del Paso 2 |
| "No pudimos buscar en TMDB" | API key inválida o sin conexión | Revisá el Paso 3 |

---

## Correr en tu computadora (opcional, requiere terminal)

Como la app usa módulos JS y `fetch`, **no funciona abriendo el HTML con doble
clic** (`file://`). Serví la carpeta:

```bash
cd recomendadas
npx http-server -p 8080 .
# abrí http://localhost:8080
```

---

## Estructura

```
recomendadas/
├── index.html   # estructura + estilos (dark, mobile-first)
├── app.js       # búsqueda TMDB + alta/lectura en Firestore + render
├── config.js    # TUS llaves (Firebase + TMDB) — editá este archivo
└── README.md    # esta guía
```

## Notas

- Las recomendaciones son **anónimas**: no se guarda quién las hizo.
- Si un mismo título lo recomiendan varias personas, se agrupa y se muestra el
  contador **👍 N** con todos los comentarios.
- Los valores de `config.js` quedan públicos en el repo: es **normal y seguro**.
  La config de Firebase está pensada para ser pública (lo que protege los datos
  son las **reglas**), y la key de TMDB es de solo lectura y regenerable.
