/* ============================================================
   Foro Estatal Agua en la Industria — Tamaulipas 2026
   Pages Function: /admin/export?tabla=participantes|b2b|citas
   Exporta la tabla indicada como CSV (compatible con Excel).
   Protegido con la misma sesión de /admin (cookie).
   ============================================================ */

const COOKIE_NAME = "foro_admin_session";

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

async function isAuthenticated(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const token = getCookie(request, COOKIE_NAME);
  if (!token) return false;
  return token === (await sha256Hex("foro-admin::" + env.ADMIN_PASSWORD));
}

/* Escapado CSV: comillas dobles duplicadas y celda entrecomillada */
function csvCell(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers, rows) {
  const lines = [headers.map(csvCell).join(",")];
  for (const r of rows) lines.push(r.map(csvCell).join(","));
  // BOM para que Excel detecte UTF-8 correctamente (acentos)
  return "\uFEFF" + lines.join("\r\n");
}

const SECTORES = {
  agua_potable: "Agua potable", tratamiento: "Tratamiento y reúso", riego_agricola: "Riego agrícola",
  tecnologia_iot: "Tecnología e IoT", construccion: "Construcción", consultoria: "Consultoría",
  equipos_bombas: "Equipos y bombas", quimicos: "Productos químicos", energia: "Energía",
  industria: "Industria / Compras", otro: "Otro"
};
const TIPOS = {
  empresa: "Empresa / Industria", gobierno: "Gobierno / Dependencia pública", academia: "Academia / Universidad",
  organizacion: "Organización de la sociedad civil", publico: "Público general"
};
const TIPO_PART = { ofrezco: "Ofrezco productos o servicios", busco: "Busco productos o servicios", ambos: "Ambos" };
const TAMANIOS = { micro: "Micro (1-10)", pequena: "Pequeña (11-50)", mediana: "Mediana (51-250)", grande: "Grande (250+)" };

function parseJsonList(text, map = null) {
  try {
    const arr = JSON.parse(text || "[]");
    return arr.map(s => (map && map[s]) || s).join(" | ");
  } catch { return ""; }
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!(await isAuthenticated(request, env))) {
    return new Response("No autorizado. Inicia sesión en /admin", { status: 401 });
  }
  if (!env.DB) return new Response("Base de datos no configurada.", { status: 500 });

  const tabla = new URL(request.url).searchParams.get("tabla") || "participantes";
  let csv, filename;

  if (tabla === "participantes") {
    const rows = (await env.DB.prepare("SELECT * FROM participantes ORDER BY id").all()).results;
    csv = toCsv(
      ["Folio", "Nombre", "Apellidos", "Correo", "Teléfono", "Tipo de participante", "Organización",
       "Puesto", "Municipio", "Días de asistencia", "Interesa B2B", "Estado", "Fecha de registro (UTC)"],
      rows.map(p => [
        p.folio, p.nombre, p.apellidos, p.correo, p.telefono,
        TIPOS[p.tipo_participante] || p.tipo_participante,
        p.organizacion, p.puesto, p.municipio,
        p.dias_asistencia === "ambos" ? "Ambos días" : "Día " + p.dias_asistencia,
        p.interesa_b2b ? "Sí" : "No", p.estado, p.created_at
      ])
    );
    filename = "participantes_foro2026.csv";
  } else if (tabla === "b2b") {
    const rows = (await env.DB.prepare(
      `SELECT b.*, p.folio, p.nombre, p.apellidos, p.correo, p.telefono, p.organizacion
       FROM b2b_perfiles b JOIN participantes p ON p.id = b.participante_id ORDER BY b.id`
    ).all()).results;
    csv = toCsv(
      ["Folio", "Contacto", "Correo", "Teléfono", "Razón social", "RFC", "Sector", "Tamaño",
       "Sitio web", "Descripción", "Tipo de participación", "Productos/Servicios que ofrece",
       "Qué busca", "Sectores de interés", "Disponibilidad", "Autoriza contacto", "Fecha de registro (UTC)"],
      rows.map(b => [
        b.folio, `${b.nombre} ${b.apellidos}`, b.correo, b.telefono,
        b.razon_social, b.rfc, SECTORES[b.sector] || b.sector, TAMANIOS[b.tamanio_empresa] || b.tamanio_empresa,
        b.sitio_web, b.descripcion, TIPO_PART[b.tipo_participacion] || b.tipo_participacion,
        b.productos_ofrece, b.productos_busca,
        parseJsonList(b.sectores_interes, SECTORES),
        parseJsonList(b.disponibilidad),
        b.autoriza_contacto ? "Sí" : "No", b.created_at
      ])
    );
    filename = "perfiles_b2b_foro2026.csv";
  } else if (tabla === "citas") {
    const rows = (await env.DB.prepare(
      `SELECT c.*,
              ps.razon_social AS solicitante, pi.razon_social AS invitado
       FROM b2b_citas c
       JOIN b2b_perfiles ps ON ps.id = c.solicitante_id
       JOIN b2b_perfiles pi ON pi.id = c.invitado_id
       ORDER BY c.fecha_hora, c.mesa`
    ).all()).results;
    csv = toCsv(
      ["ID", "Solicitante", "Invitado", "Fecha y hora", "Mesa", "Estado"],
      rows.map(c => [c.id, c.solicitante, c.invitado, c.fecha_hora, c.mesa, c.estado])
    );
    filename = "citas_b2b_foro2026.csv";
  } else {
    return new Response("Tabla no válida. Usa: participantes, b2b o citas.", { status: 400 });
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store"
    }
  });
}
