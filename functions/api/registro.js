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

/* ---------- Correo de confirmación (Resend) ----------
   Requiere los secretos RESEND_API_KEY y EMAIL_FROM en
   Workers → Settings → Variables and Secrets.
   Si no están configurados, el registro funciona igual,
   solo que no se envía correo. */
function emailHtml(p, folio, conB2b) {
  const dias = p.dias_asistencia === "ambos" ? "24 y 25 de septiembre de 2026" :
    (p.dias_asistencia === "24" ? "24 de septiembre de 2026" : "25 de septiembre de 2026");
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f4ef;font-family:Arial,Helvetica,sans-serif;color:#2b2320;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:linear-gradient(160deg,#3d0d18,#6e1a2e);border-radius:14px 14px 0 0;padding:28px 32px;text-align:center;">
      <p style="color:#d9bd85;font-size:12px;letter-spacing:3px;text-transform:uppercase;margin:0 0 6px;">Registro confirmado</p>
      <h1 style="color:#ffffff;font-size:22px;margin:0;">Foro Estatal Agua en la Industria</h1>
      <p style="color:rgba(255,255,255,.75);font-size:13px;margin:8px 0 0;">Tamaulipas 2026 · Secretaría de Recursos Hidráulicos para el Desarrollo Social</p>
    </div>
    <div style="background:#ffffff;padding:32px;border:1px solid #e3dccd;border-top:0;border-radius:0 0 14px 14px;">
      <p style="font-size:15px;">Hola <strong>${p.nombre} ${p.apellidos}</strong>,</p>
      <p style="font-size:15px;line-height:1.6;">Tu registro al <strong>Foro Estatal Agua en la Industria</strong> quedó confirmado.${conB2b ? " Tu perfil de <strong>Networking B2B</strong> también fue capturado para el matchmaking." : ""}</p>
      <div style="background:#f3e9d3;border:1px dashed #a97f3d;border-radius:10px;text-align:center;padding:18px;margin:22px 0;">
        <p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#6f6660;">Tu folio de acceso</p>
        <p style="margin:0;font-size:26px;font-weight:bold;color:#6e1a2e;letter-spacing:2px;">${folio}</p>
        <p style="margin:8px 0 0;font-size:12px;color:#6f6660;">Preséntalo el día del evento</p>
      </div>
      <table style="width:100%;font-size:14px;line-height:1.8;">
        <tr><td style="color:#6f6660;width:90px;vertical-align:top;">Fecha</td><td><strong>${dias}</strong></td></tr>
        <tr><td style="color:#6f6660;vertical-align:top;">Sede</td><td>Centro de Convenciones "Mundo Nuevo", Matamoros, Tamaulipas</td></tr>
        <tr><td style="color:#6f6660;vertical-align:top;">Horario</td><td>9:00 a.m. a 3:30 p.m. · Registro y acceso desde las 8:00 a.m.</td></tr>
      </table>
      <p style="font-size:13px;color:#6f6660;margin-top:24px;line-height:1.6;">¿Dudas o cambios en tu registro? Escríbenos a
        <a href="mailto:hector.azua@tamaulipas.gob.mx" style="color:#8a2439;">hector.azua@tamaulipas.gob.mx</a> o llama al 834 106-7039.</p>
    </div>
    <p style="text-align:center;font-size:11px;color:#6f6660;padding:16px;">© 2026 Gobierno del Estado de Tamaulipas · www.foroaguaenlaindustria.lat</p>
  </div>
</body></html>`;
}

async function enviarConfirmacion(env, p, folio, conB2b) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return; // correo no configurado
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + env.RESEND_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [p.correo],
        subject: `Registro confirmado · ${folio} · Foro Estatal Agua en la Industria`,
        html: emailHtml(p, folio, conB2b)
      })
    });
    if (!res.ok) console.log("Resend error:", res.status, await res.text());
  } catch (err) {
    console.log("Error enviando correo:", String(err));
  }
}

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
  const { request, env, ctx } = context;

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

  /* Envío del correo de confirmación (no bloquea la respuesta;
     si falla el envío, el registro ya quedó guardado) */
  const envio = enviarConfirmacion(env, p, folio, !!b2b);
  if (ctx && ctx.waitUntil) ctx.waitUntil(envio); else await envio;

  return json({ ok: true, folio, nombre: p.nombre, b2b: !!b2b }, 201);
}
