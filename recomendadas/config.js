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
    apiKey:            "PEGA_AQUI_TU_apiKey",
    authDomain:        "PEGA_AQUI_TU_authDomain",
    projectId:         "PEGA_AQUI_TU_projectId",
    storageBucket:     "PEGA_AQUI_TU_storageBucket",
    messagingSenderId: "PEGA_AQUI_TU_messagingSenderId",
    appId:             "PEGA_AQUI_TU_appId",
  },

  /* 2) TMDB  -------------------------------------------------------------
     themoviedb.org → tu cuenta → Configuración → API → "API Key (v3 auth)". */
  TMDB_API_KEY: "PEGA_AQUI_TU_TMDB_API_KEY",

  /* 3) Opcional: idioma de títulos y sinopsis de TMDB.                     */
  TMDB_LANGUAGE: "es-ES",
};
