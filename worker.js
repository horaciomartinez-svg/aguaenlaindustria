/* ============================================================
   Foro Estatal Agua en la Industria — Tamaulipas 2026
   Worker principal (enrutador)
   - /api/registro   → función de registro (D1)
   - /admin          → panel de administración
   - /admin/export   → exportación CSV
   - todo lo demás   → archivos estáticos del sitio (assets)
   ============================================================ */

import * as registro from "./functions/api/registro.js";
import * as admin from "./functions/admin.js";
import * as adminExport from "./functions/admin/export.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    /* ----- API de registro ----- */
    if (path === "/api/registro") {
      if (request.method === "OPTIONS") return registro.onRequestOptions({ request, env });
      if (request.method === "POST") return registro.onRequestPost({ request, env, ctx });
      return new Response(JSON.stringify({ ok: false, error: "Método no permitido." }), {
        status: 405, headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    /* ----- Panel de administración ----- */
    if (path === "/admin") {
      if (request.method === "POST") return admin.onRequestPost({ request, env, ctx });
      return admin.onRequestGet({ request, env, ctx });
    }

    /* ----- Exportación CSV ----- */
    if (path === "/admin/export") {
      return adminExport.onRequestGet({ request, env, ctx });
    }

    /* ----- Archivos estáticos (sitio público) ----- */
    return env.ASSETS.fetch(request);
  }
};
