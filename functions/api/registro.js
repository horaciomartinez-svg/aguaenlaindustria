/* ============================================================
   Foro Estatal Agua en la Industria — Tamaulipas 2026
   Pages Function: POST /api/registro
   Recibe el preregistro (y el perfil B2B si aplica) y lo guarda
   en la base de datos Cloudflare D1 (binding: "DB").
   ============================================================ */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS }
  });

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/* ---------- Utilidades ---------- */
const str = (v, max = 255) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TIPOS_VALIDOS = ["empresa", "gobierno", "academia", "organizacion", "publico"];
const DIAS_VALIDOS = ["24", "25", "ambos"];
const TIPO_PART_VALIDOS = ["ofrezco", "busco", "ambos"];

/* Verificación opcional de Cloudflare Turnstile (anti-bots).
   Solo se ejecuta si configuraste el secreto TURNSTILE_SECRET
   en Pages → Settings → Environment variables. */
async function verificarTurnstile(token, env, ip) {
  if (!env.TURNSTILE_SECRET) return true; // no configurado: no bloquear
  if (!token) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET,
      response: token,
      remoteip: ip || ""
    })
  });
  const data = await res.json();
  return data.success === true;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.DB) {
    return json({ ok: false, error: "Base de datos no configurada." }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Formato de solicitud inválido." }, 400);
  }

  /* ---------- Validación de datos básicos ---------- */
  const p = {
    nombre: str(body.nombre, 80),
    apellidos: str(body.apellidos, 80),
    correo: str(body.correo, 120).toLowerCase(),
    telefono: str(body.telefono, 20),
    tipo_participante: str(body.tipo_participante, 20),
    organizacion: str(body.organizacion, 150) || null,
    puesto: str(body.puesto, 100) || null,
    municipio: str(body.municipio, 80) || null,
    dias_asistencia: DIAS_VALIDOS.includes(body.dias_asistencia) ? body.dias_asistencia : "ambos",
    interesa_b2b: body.interesa_b2b === 1 || body.interesa_b2b === "1" ? 1 : 0
  };

  if (!p.nombre || !p.apellidos || !p.telefono) {
    return json({ ok: false, error: "Nombre, apellidos y teléfono son obligatorios." }, 400);
  }
  if (!EMAIL_RE.test(p.correo)) {
    return json({ ok: false, error: "El correo electrónico no es válido." }, 400);
  }
  if (!TIPOS_VALIDOS.includes(p.tipo_participante)) {
    return json({ ok: false, error: "Tipo de participante no válido." }, 400);
  }
  if (body.aviso_privacidad !== true) {
    return json({ ok: false, error: "Debes aceptar el aviso de privacidad." }, 400);
  }

  const ip = request.headers.get("CF-Connecting-IP");
  const turnstileOk = await verificarTurnstile(body["cf-turnstile-response"], env, ip);
  if (!turnstileOk) {
    return json({ ok: false, error: "La verificación anti-bots falló. Recarga la página e inténtalo de nuevo." }, 403);
  }

  /* ---------- Validación del perfil B2B (si aplica) ---------- */
  let b2b = null;
  if (p.interesa_b2b === 1) {
    const b = body.b2b || {};
    b2b = {
      razon_social: str(b.razon_social, 150),
      rfc: str(b.rfc, 13) || null,
      sector: str(b.sector, 40),
      tamanio_empresa: str(b.tamanio_empresa, 20) || null,
      sitio_web: str(b.sitio_web, 150) || null,
      tipo_participacion: str(b.tipo_participacion, 20),
      descripcion: str(b.descripcion, 500),
      productos_ofrece: str(b.productos_ofrece, 500) || null,
      productos_busca: str(b.productos_busca, 500) || null,
      sectores_interes: Array.isArray(b.sectores_interes) ? JSON.stringify(b.sectores_interes.slice(0, 15).map(s => str(s, 40))) : null,
      disponibilidad: Array.isArray(b.disponibilidad) ? JSON.stringify(b.disponibilidad.slice(0, 4).map(s => str(s, 20))) : null,
      autoriza_contacto: b.autoriza_contacto === 1 || b.autoriza_contacto === true ? 1 : 0
    };

    if (!b2b.razon_social || !b2b.sector || !b2b.descripcion) {
      return json({ ok: false, error: "Faltan datos del registro B2B (razón social, sector y descripción son obligatorios)." }, 400);
    }
    if (!TIPO_PART_VALIDOS.includes(b2b.tipo_participacion)) {
      return json({ ok: false, error: "Tipo de participación B2B no válido." }, 400);
    }
  }

  /* ---------- Inserción en D1 ---------- */
  let participanteId;
  try {
    const result = await env.DB.prepare(
      `INSERT INTO participantes
        (nombre, apellidos, correo, telefono, tipo_participante, organizacion, puesto, municipio, dias_asistencia, interesa_b2b)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      p.nombre, p.apellidos, p.correo, p.telefono, p.tipo_participante,
      p.organizacion, p.puesto, p.municipio, p.dias_asistencia, p.interesa_b2b
    ).run();

    participanteId = result.meta.last_row_id;
  } catch (err) {
    if (String(err).includes("UNIQUE")) {
      return json({ ok: false, error: "Este correo ya está registrado." }, 409);
    }
    return json({ ok: false, error: "Error al guardar el registro." }, 500);
  }

  /* Folio legible para el asistente: FORO-2026-0001 */
  const folio = "FORO-2026-" + String(participanteId).padStart(4, "0");
  await env.DB.prepare("UPDATE participantes SET folio = ? WHERE id = ?").bind(folio, participanteId).run();

  if (b2b) {
    await env.DB.prepare(
      `INSERT INTO b2b_perfiles
        (participante_id, razon_social, rfc, sector, tamanio_empresa, sitio_web, descripcion,
         tipo_participacion, productos_ofrece, productos_busca, sectores_interes, disponibilidad, autoriza_contacto)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      participanteId, b2b.razon_social, b2b.rfc, b2b.sector, b2b.tamanio_empresa, b2b.sitio_web,
      b2b.descripcion, b2b.tipo_participacion, b2b.productos_ofrece, b2b.productos_busca,
      b2b.sectores_interes, b2b.disponibilidad, b2b.autoriza_contacto
    ).run();
  }

  return json({ ok: true, folio, nombre: p.nombre, b2b: !!b2b }, 201);
}
