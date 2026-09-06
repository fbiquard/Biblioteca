/* =========================================================================
   CONFIGURACIÓN  ·  Recomendadas
   -------------------------------------------------------------------------
   Completá los dos bloques de abajo con tus datos. No hace falta terminal.
   Seguí el paso a paso del archivo README.md (misma carpeta).

   ⚠️  Estos datos van a quedar públicos en el repositorio: está bien.
       - La config de Firebase está PENSADA para ser pública; lo que protege
         tus datos son las "Reglas" de Firestore (ver README).
       - La API key de TMDB es de solo lectura y gratuita; si algún día
         querés, la podés regenerar desde tu cuenta de TMDB.
   ========================================================================= */

window.APP_CONFIG = {

  /* 1) FIREBASE  ---------------------------------------------------------
     Consola → ⚙️ Configuración del proyecto → "Tus apps" → SDK setup and
     configuration → Config.  Copiá y pegá los valores tal cual.            */
  FIREBASE_CONFIG: {
    apiKey:            "AIzaSyDEcQDBKvf-n9NgvlPiFC2MsflXiFu9xdk",
    authDomain:        "recomendadas-4103b.firebaseapp.com",
    projectId:         "recomendadas-4103b",
    storageBucket:     "recomendadas-4103b.firebasestorage.app",
    messagingSenderId: "1091883863450",
    appId:             "1:1091883863450:web:65cb79597b89f565ccbe23",
    measurementId:     "G-9WW8EJHPT0",
  },

  /* 2) TMDB  -------------------------------------------------------------
     themoviedb.org → tu cuenta → Configuración → API → "API Key (v3 auth)". */
  TMDB_API_KEY: "PEGA_AQUI_TU_TMDB_API_KEY",

  /* 3) Opcional: idioma de títulos y sinopsis de TMDB.                     */
  TMDB_LANGUAGE: "es-ES",
};
