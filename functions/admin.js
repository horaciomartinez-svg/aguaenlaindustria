/* ============================================================
   Foro Estatal Agua en la Industria — Tamaulipas 2026
   Worker route: /admin — Panel de administración
   Protegido con contraseña (secreto ADMIN_PASSWORD en
   Workers → Settings → Variables and Secrets).
   Incluye CRUD: editar y borrar registros, ambos requieren
   re-ingresar la contraseña de administrador.
   ============================================================ */

const COOKIE_NAME = "foro_admin_session";
const MAX_AGE = 60 * 60 * 8; // sesión de 8 horas

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function expectedToken(env) {
  return sha256Hex("foro-admin::" + env.ADMIN_PASSWORD);
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
  return token === (await expectedToken(env));
}

const redirect = (url) => new Response(null, { status: 303, headers: { Location: url } });

/* ---------- Plantillas HTML ---------- */
const PALETTE_CSS = `
  :root { --guinda-900:#3d0d18; --guinda-800:#541322; --guinda-700:#6e1a2e; --guinda-600:#8a2439;
          --gold-600:#a97f3d; --gold-500:#c6a05b; --gold-400:#d9bd85; --sand:#f7f4ef; --line:#e3dccd;
          --ink:#2b2320; --gray:#6f6660; --green:#2e7d4f; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:"Roboto",system-ui,sans-serif; background:var(--sand); color:var(--ink); }
  h1,h2,h3 { font-family:"Montserrat",system-ui,sans-serif; color:var(--guinda-800); }
`;

function htmlPage(title, body) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${title} — Foro Agua en la Industria</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Roboto:wght@400;500&display=swap" rel="stylesheet" />
  <style>${PALETTE_CSS}</style>
</head>
<body>${body}</body>
</html>`;
}

function loginPage(error = "", sinPassword = false) {
  return htmlPage("Acceso al panel", `
<style>
  .login-wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:2rem;
    background:linear-gradient(160deg, var(--guinda-900), var(--guinda-800)); }
  .login-card { background:#fff; border-radius:14px; box-shadow:0 24px 60px -24px rgba(0,0,0,.5);
    padding:2.6rem 2.4rem; width:min(420px, 100%); text-align:center; }
  .login-card h1 { font-size:1.3rem; margin-bottom:.4rem; }
  .login-card p.sub { color:var(--gray); font-size:.9rem; margin-bottom:1.6rem; }
  .login-card input { width:100%; padding:.8rem 1rem; font-size:1rem; border:1px solid var(--line);
    border-radius:10px; margin-bottom:1rem; background:var(--sand); }
  .login-card input:focus { outline:none; border-color:var(--gold-500); background:#fff;
    box-shadow:0 0 0 3px rgba(198,160,91,.22); }
  .login-card button { width:100%; padding:.9rem; font-family:"Montserrat",sans-serif; font-weight:700;
    text-transform:uppercase; letter-spacing:.05em; border:0; border-radius:8px; cursor:pointer;
    background:linear-gradient(135deg, var(--gold-500), var(--gold-600)); color:var(--guinda-900); }
  .error { background:#fbecec; border:1px solid var(--guinda-600); color:var(--guinda-800);
    border-radius:8px; padding:.7rem; font-size:.88rem; margin-bottom:1rem; }
  .warn { background:#fdf3e0; border:1px solid var(--gold-500); color:#7a5b23;
    border-radius:8px; padding:.7rem; font-size:.85rem; margin-bottom:1rem; text-align:left; }
</style>
<div class="login-wrap">
  <form class="login-card" method="POST" action="/admin">
    <h1>Panel de Administración</h1>
    <p class="sub">Foro Estatal Agua en la Industria · Tamaulipas 2026</p>
    ${sinPassword ? `<div class="warn"><strong>Falta configurar la contraseña.</strong><br>Ve a Cloudflare → tu Worker → <em>Settings → Variables and Secrets</em> y crea el secreto <code>ADMIN_PASSWORD</code>.</div>` : ""}
    ${error ? `<div class="error">${error}</div>` : ""}
    <input type="password" name="password" placeholder="Contraseña de administrador" required autofocus />
    <button type="submit">Entrar</button>
  </form>
</div>`);
}

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const SECTORES = {
  agua_potable: "Agua potable", tratamiento: "Tratamiento y reúso", riego_agricola: "Riego agrícola",
  tecnologia_iot: "Tecnología e IoT", construccion: "Construcción", consultoria: "Consultoría",
  equipos_bombas: "Equipos y bombas", quimicos: "Productos químicos", energia: "Energía",
  industria: "Industria / Compras", otro: "Otro"
};
const TIPOS = {
  empresa: "Empresa / Industria", gobierno: "Gobierno", academia: "Academia",
  organizacion: "Org. sociedad civil", publico: "Público general"
};
const TIPO_PART = { ofrezco: "Ofrece", busco: "Busca", ambos: "Ambos" };
const DIAS = { ambos: "Ambos días", "24": "Día 24", "25": "Día 25" };

function fmtFecha(iso) {
  if (!iso) return "—";
  const d = new Date(iso.replace(" ", "T") + "Z");
  return d.toLocaleString("es-MX", { timeZone: "America/Monterrey", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function dashboardPage(stats, participantes, perfiles, aviso) {
  const filasP = participantes.map(p => `
      <tr>
        <td><strong>${esc(p.folio)}</strong></td>
        <td>${esc(p.nombre)} ${esc(p.apellidos)}</td>
        <td><a href="mailto:${esc(p.correo)}">${esc(p.correo)}</a></td>
        <td>${esc(p.telefono)}</td>
        <td>${esc(TIPOS[p.tipo_participante] || p.tipo_participante)}</td>
        <td>${esc(p.organizacion || "—")}</td>
        <td>${esc(p.municipio || "—")}</td>
        <td>${p.dias_asistencia === "ambos" ? "Ambos" : "Día " + esc(p.dias_asistencia)}</td>
        <td>${p.interesa_b2b ? '<span class="pill pill-si">SÍ</span>' : '<span class="pill">No</span>'}</td>
        <td>${fmtFecha(p.created_at)}</td>
        <td class="acciones">
          <button type="button" class="btn-act btn-edit" data-p="${esc(JSON.stringify(p))}">Editar</button>
          <button type="button" class="btn-act btn-del" data-id="${p.id}" data-folio="${esc(p.folio)}" data-nombre="${esc(p.nombre + " " + p.apellidos)}">Borrar</button>
        </td>
      </tr>`).join("");

  const filasB = perfiles.map(b => {
    let sectores = "—", disponibilidad = "—";
    try { sectores = (JSON.parse(b.sectores_interes || "[]")).map(s => SECTORES[s] || s).join(", ") || "—"; } catch {}
    try {
      disponibilidad = (JSON.parse(b.disponibilidad || "[]"))
        .map(s => s.replace("_manana", " mañana").replace("_tarde", " tarde").replace(/^/, "Día ")).join(" · ") || "—";
    } catch {}
    return `
      <tr>
        <td><strong>${esc(b.folio)}</strong></td>
        <td>${esc(b.razon_social)}</td>
        <td>${esc(b.nombre)} ${esc(b.apellidos)}</td>
        <td><a href="mailto:${esc(b.correo)}">${esc(b.correo)}</a><br><small>${esc(b.telefono)}</small></td>
        <td>${esc(SECTORES[b.sector] || b.sector)}</td>
        <td>${esc(TIPO_PART[b.tipo_participacion] || b.tipo_participacion)}</td>
        <td>${esc(b.productos_ofrece || "—")}</td>
        <td>${esc(b.productos_busca || "—")}</td>
        <td><small>${esc(sectores)}</small></td>
        <td><small>${esc(disponibilidad)}</small></td>
        <td>${b.autoriza_contacto ? "Sí" : "No"}</td>
        <td class="acciones">
          <button type="button" class="btn-act btn-del" data-id="${b.participante_id}" data-folio="${esc(b.folio)}" data-nombre="${esc(b.razon_social)}">Borrar</button>
        </td>
      </tr>`;
  }).join("");

  const banner = aviso && aviso.texto
    ? `<div class="banner banner-${aviso.tipo === "error" ? "error" : "ok"}">${esc(aviso.texto)}</div>`
    : "";

  return htmlPage("Panel de administración", `
<style>
  header.bar { background:linear-gradient(150deg, var(--guinda-800), var(--guinda-900)); color:#fff;
    padding:1.1rem 2rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem; }
  header.bar h1 { color:#fff; font-size:1.15rem; }
  header.bar h1 small { color:var(--gold-400); display:block; font-size:.72rem; letter-spacing:.2em; text-transform:uppercase; }
  .bar-actions { display:flex; gap:.6rem; flex-wrap:wrap; }
  .bar-actions a, .bar-actions button { font-family:"Montserrat",sans-serif; font-size:.75rem; font-weight:700;
    letter-spacing:.06em; text-transform:uppercase; text-decoration:none; padding:.55rem 1rem; border-radius:8px;
    border:1px solid rgba(255,255,255,.35); color:#fff; background:transparent; cursor:pointer; }
  .bar-actions a.gold { background:linear-gradient(135deg, var(--gold-500), var(--gold-600)); color:var(--guinda-900); border:0; }
  main { padding:2rem; max-width:1500px; margin:0 auto; }
  .stats { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px,1fr)); gap:1rem; margin-bottom:2.2rem; }
  .stat { background:#fff; border-radius:12px; padding:1.3rem 1.4rem; box-shadow:0 8px 24px -14px rgba(61,13,24,.25);
    border-top:4px solid var(--gold-500); }
  .stat b { display:block; font-family:"Montserrat",sans-serif; font-size:2rem; color:var(--guinda-800); line-height:1.1; }
  .stat span { font-size:.82rem; color:var(--gray); }
  h2.sec { font-size:1.15rem; margin:2rem 0 .9rem; display:flex; align-items:center; gap:.8rem; flex-wrap:wrap; }
  h2.sec a { font-family:"Roboto",sans-serif; font-size:.78rem; font-weight:500; color:var(--guinda-600); }
  .table-wrap { background:#fff; border-radius:12px; box-shadow:0 8px 24px -14px rgba(61,13,24,.2);
    overflow-x:auto; border:1px solid var(--line); }
  table { width:100%; border-collapse:collapse; font-size:.85rem; min-width:900px; }
  th { font-family:"Montserrat",sans-serif; font-size:.7rem; letter-spacing:.08em; text-transform:uppercase;
    text-align:left; color:var(--guinda-800); background:var(--sand); padding:.75rem .9rem; border-bottom:2px solid var(--line);
    position:sticky; top:0; white-space:nowrap; }
  td { padding:.7rem .9rem; border-bottom:1px solid var(--line); vertical-align:top; }
  tr:hover td { background:#fbf8f2; }
  td a { color:var(--guinda-600); }
  .pill { display:inline-block; font-size:.7rem; font-weight:600; padding:.15rem .6rem; border-radius:999px;
    background:var(--sand); border:1px solid var(--line); color:var(--gray); }
  .pill-si { background:#e9f5ee; border-color:var(--green); color:#1d5c39; }
  .empty { padding:2.5rem; text-align:center; color:var(--gray); }
  .banner { border-radius:10px; padding:.9rem 1.2rem; font-size:.92rem; margin-bottom:1.6rem; }
  .banner-ok { background:#e9f5ee; border:1px solid var(--green); color:#1d5c39; }
  .banner-error { background:#fbecec; border:1px solid var(--guinda-600); color:var(--guinda-800); }
  /* --- Botones de acción --- */
  td.acciones { white-space:nowrap; }
  .btn-act { font-family:"Montserrat",sans-serif; font-size:.68rem; font-weight:700; letter-spacing:.05em;
    text-transform:uppercase; border-radius:6px; padding:.35rem .7rem; cursor:pointer; border:1px solid var(--line);
    background:var(--sand); color:var(--guinda-800); margin-right:.35rem; }
  .btn-edit:hover { border-color:var(--gold-500); color:var(--gold-600); }
  .btn-del { color:var(--guinda-600); }
  .btn-del:hover { background:var(--guinda-700); color:#fff; border-color:var(--guinda-700); }
  /* --- Modales --- */
  .modal-back { display:none; position:fixed; inset:0; background:rgba(29,7,13,.6); backdrop-filter:blur(3px);
    z-index:100; align-items:center; justify-content:center; padding:1.2rem; }
  .modal-back.open { display:flex; }
  .modal { background:#fff; border-radius:14px; box-shadow:0 30px 80px -20px rgba(0,0,0,.55);
    width:min(560px,100%); max-height:92vh; overflow-y:auto; }
  .modal-head { background:linear-gradient(150deg, var(--guinda-800), var(--guinda-900)); color:#fff;
    padding:1.1rem 1.6rem; border-radius:14px 14px 0 0; display:flex; justify-content:space-between; align-items:center; }
  .modal-head h3 { color:#fff; font-size:1rem; }
  .modal-head button { background:none; border:0; color:#fff; font-size:1.3rem; cursor:pointer; line-height:1; }
  .modal form { padding:1.4rem 1.6rem 1.6rem; }
  .modal .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:.8rem; }
  .modal label { display:block; font-size:.75rem; font-weight:600; color:var(--gray); margin-bottom:.25rem;
    text-transform:uppercase; letter-spacing:.04em; }
  .modal input, .modal select { width:100%; padding:.55rem .7rem; font-size:.9rem; border:1px solid var(--line);
    border-radius:8px; background:var(--sand); margin-bottom:.8rem; font-family:inherit; }
  .modal input:focus, .modal select:focus { outline:none; border-color:var(--gold-500); background:#fff;
    box-shadow:0 0 0 3px rgba(198,160,91,.22); }
  .modal .checkline { display:flex; align-items:center; gap:.5rem; margin-bottom:.8rem; font-size:.88rem; }
  .modal .checkline input { width:auto; margin:0; }
  .pwd-box { background:#fdf3e0; border:1px solid var(--gold-500); border-radius:10px; padding:1rem; margin:0.4rem 0 1rem; }
  .pwd-box p { font-size:.8rem; color:#7a5b23; margin-bottom:.5rem; }
  .pwd-box input { margin-bottom:0; }
  .modal-actions { display:flex; gap:.7rem; justify-content:flex-end; }
  .modal-actions button { font-family:"Montserrat",sans-serif; font-size:.78rem; font-weight:700; text-transform:uppercase;
    letter-spacing:.05em; padding:.65rem 1.2rem; border-radius:8px; cursor:pointer; border:1px solid var(--line); background:#fff; color:var(--gray); }
  .modal-actions .btn-primary { background:linear-gradient(135deg, var(--gold-500), var(--gold-600)); color:var(--guinda-900); border:0; }
  .modal-actions .btn-danger { background:var(--guinda-700); color:#fff; border:0; }
  .del-warn { background:#fbecec; border:1px solid var(--guinda-600); border-radius:10px; padding:.9rem 1rem;
    font-size:.88rem; color:var(--guinda-800); margin-bottom:1rem; }
  @media (max-width:560px){ .modal .grid2 { grid-template-columns:1fr; } }
</style>
<header class="bar">
  <h1>Panel de Administración<small>Foro Estatal Agua en la Industria · 2026</small></h1>
  <div class="bar-actions">
    <a class="gold" href="/admin/export?tabla=participantes">⬇ Participantes CSV</a>
    <a class="gold" href="/admin/export?tabla=b2b">⬇ Perfiles B2B CSV</a>
    <a href="/admin/export?tabla=citas">⬇ Citas CSV</a>
    <a href="/">Ver sitio</a>
    <form method="POST" action="/admin" style="display:inline"><input type="hidden" name="logout" value="1" /><button type="submit">Salir</button></form>
  </div>
</header>
<main>
  ${banner}
  <div class="stats">
    <div class="stat"><b>${stats.total}</b><span>Participantes registrados</span></div>
    <div class="stat"><b>${stats.b2b}</b><span>Perfiles B2B (matchmaking)</span></div>
    <div class="stat"><b>${stats.hoy}</b><span>Registros de hoy</span></div>
    <div class="stat"><b>${stats.empresas}</b><span>De empresa / industria</span></div>
  </div>

  <h2 class="sec">Perfiles B2B — Networking y matchmaking <a href="/admin/export?tabla=b2b">(exportar CSV)</a></h2>
  <div class="table-wrap">
    ${perfiles.length ? `<table>
      <thead><tr><th>Folio</th><th>Empresa</th><th>Contacto</th><th>Correo / Tel.</th><th>Sector</th><th>Tipo</th><th>Ofrece</th><th>Busca</th><th>Interesa reunirse con</th><th>Disponibilidad</th><th>Autoriza contacto</th><th>Acciones</th></tr></thead>
      <tbody>${filasB}</tbody>
    </table>` : `<p class="empty">Aún no hay perfiles B2B registrados.</p>`}
  </div>

  <h2 class="sec">Todos los participantes <a href="/admin/export?tabla=participantes">(exportar CSV)</a></h2>
  <div class="table-wrap">
    ${participantes.length ? `<table>
      <thead><tr><th>Folio</th><th>Nombre</th><th>Correo</th><th>Teléfono</th><th>Tipo</th><th>Organización</th><th>Municipio</th><th>Días</th><th>B2B</th><th>Registrado</th><th>Acciones</th></tr></thead>
      <tbody>${filasP}</tbody>
    </table>` : `<p class="empty">Aún no hay participantes registrados.</p>`}
  </div>
</main>

<!-- ===== Modal: EDITAR ===== -->
<div class="modal-back" id="modalEdit">
  <div class="modal">
    <div class="modal-head"><h3>Editar participante <span id="editFolio" style="color:var(--gold-400)"></span></h3><button type="button" data-close>&times;</button></div>
    <form method="POST" action="/admin">
      <input type="hidden" name="action" value="update" />
      <input type="hidden" name="id" id="editId" />
      <div class="grid2">
        <div><label>Nombre *</label><input name="nombre" id="editNombre" required /></div>
        <div><label>Apellidos *</label><input name="apellidos" id="editApellidos" required /></div>
      </div>
      <div class="grid2">
        <div><label>Correo *</label><input type="email" name="correo" id="editCorreo" required /></div>
        <div><label>Teléfono *</label><input name="telefono" id="editTelefono" required /></div>
      </div>
      <div class="grid2">
        <div><label>Tipo de participante</label>
          <select name="tipo_participante" id="editTipo">
            <option value="empresa">Empresa / Industria</option>
            <option value="gobierno">Gobierno</option>
            <option value="academia">Academia</option>
            <option value="organizacion">Org. sociedad civil</option>
            <option value="publico">Público general</option>
          </select></div>
        <div><label>Días de asistencia</label>
          <select name="dias_asistencia" id="editDias">
            <option value="ambos">Ambos días</option>
            <option value="24">Día 24</option>
            <option value="25">Día 25</option>
          </select></div>
      </div>
      <div class="grid2">
        <div><label>Organización</label><input name="organizacion" id="editOrg" /></div>
        <div><label>Puesto</label><input name="puesto" id="editPuesto" /></div>
      </div>
      <div><label>Municipio</label><input name="municipio" id="editMunicipio" /></div>
      <div class="checkline"><input type="checkbox" name="interesa_b2b" id="editB2b" value="1" /><label for="editB2b" style="margin:0;text-transform:none;font-size:.88rem;color:var(--ink)">Interesa participar en Networking B2B</label></div>
      <div class="pwd-box">
        <p><strong>Confirmación de seguridad:</strong> ingresa nuevamente la contraseña de administrador para guardar los cambios.</p>
        <input type="password" name="password" placeholder="Contraseña de administrador" required autocomplete="off" />
      </div>
      <div class="modal-actions">
        <button type="button" data-close>Cancelar</button>
        <button type="submit" class="btn-primary">Guardar cambios</button>
      </div>
    </form>
  </div>
</div>

<!-- ===== Modal: BORRAR ===== -->
<div class="modal-back" id="modalDelete">
  <div class="modal">
    <div class="modal-head"><h3>Borrar registro</h3><button type="button" data-close>&times;</button></div>
    <form method="POST" action="/admin">
      <input type="hidden" name="action" value="delete" />
      <input type="hidden" name="id" id="delId" />
      <div class="del-warn">
        <strong>⚠ Esta acción no se puede deshacer.</strong><br>
        Se eliminará permanentemente el registro <strong id="delFolio"></strong> de <strong id="delNombre"></strong>,
        junto con su perfil B2B y sus citas de networking (si existen).
      </div>
      <div class="pwd-box">
        <p><strong>Confirmación de seguridad:</strong> ingresa nuevamente la contraseña de administrador para borrar.</p>
        <input type="password" name="password" placeholder="Contraseña de administrador" required autocomplete="off" />
      </div>
      <div class="modal-actions">
        <button type="button" data-close>Cancelar</button>
        <button type="submit" class="btn-danger">Borrar definitivamente</button>
      </div>
    </form>
  </div>
</div>

<script>
(function () {
  var modalEdit = document.getElementById("modalEdit");
  var modalDelete = document.getElementById("modalDelete");

  function open(modal) { modal.classList.add("open"); }
  function closeAll() {
    modalEdit.classList.remove("open");
    modalDelete.classList.remove("open");
  }

  document.querySelectorAll(".btn-edit").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var p = JSON.parse(btn.getAttribute("data-p"));
      document.getElementById("editId").value = p.id;
      document.getElementById("editFolio").textContent = "· " + (p.folio || "");
      document.getElementById("editNombre").value = p.nombre || "";
      document.getElementById("editApellidos").value = p.apellidos || "";
      document.getElementById("editCorreo").value = p.correo || "";
      document.getElementById("editTelefono").value = p.telefono || "";
      document.getElementById("editTipo").value = p.tipo_participante || "publico";
      document.getElementById("editDias").value = p.dias_asistencia || "ambos";
      document.getElementById("editOrg").value = p.organizacion || "";
      document.getElementById("editPuesto").value = p.puesto || "";
      document.getElementById("editMunicipio").value = p.municipio || "";
      document.getElementById("editB2b").checked = !!p.interesa_b2b;
      open(modalEdit);
    });
  });

  document.querySelectorAll(".btn-del").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.getElementById("delId").value = btn.getAttribute("data-id");
      document.getElementById("delFolio").textContent = btn.getAttribute("data-folio");
      document.getElementById("delNombre").textContent = btn.getAttribute("data-nombre");
      open(modalDelete);
    });
  });

  document.querySelectorAll("[data-close]").forEach(function (el) {
    el.addEventListener("click", closeAll);
  });
  [modalEdit, modalDelete].forEach(function (m) {
    m.addEventListener("click", function (e) { if (e.target === m) closeAll(); });
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeAll(); });
})();
</script>`);
}

/* ---------- CRUD sobre D1 ---------- */
const TIPOS_VALIDOS = ["empresa", "gobierno", "academia", "organizacion", "publico"];
const DIAS_VALIDOS = ["24", "25", "ambos"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const s = (v, max = 255) => (typeof v === "string" ? v.trim().slice(0, max) : "");

async function handleUpdate(env, form) {
  const id = parseInt(form.get("id"), 10);
  if (!id) return redirect("/admin?error=datos");

  const data = {
    nombre: s(form.get("nombre"), 80),
    apellidos: s(form.get("apellidos"), 80),
    correo: s(form.get("correo"), 120).toLowerCase(),
    telefono: s(form.get("telefono"), 20),
    tipo_participante: TIPOS_VALIDOS.includes(form.get("tipo_participante")) ? form.get("tipo_participante") : "publico",
    organizacion: s(form.get("organizacion"), 150) || null,
    puesto: s(form.get("puesto"), 100) || null,
    municipio: s(form.get("municipio"), 80) || null,
    dias_asistencia: DIAS_VALIDOS.includes(form.get("dias_asistencia")) ? form.get("dias_asistencia") : "ambos",
    interesa_b2b: form.get("interesa_b2b") ? 1 : 0
  };

  if (!data.nombre || !data.apellidos || !data.telefono || !EMAIL_RE.test(data.correo)) {
    return redirect("/admin?error=datos");
  }

  try {
    await env.DB.prepare(
      `UPDATE participantes SET nombre=?, apellidos=?, correo=?, telefono=?, tipo_participante=?,
        organizacion=?, puesto=?, municipio=?, dias_asistencia=?, interesa_b2b=? WHERE id=?`
    ).bind(
      data.nombre, data.apellidos, data.correo, data.telefono, data.tipo_participante,
      data.organizacion, data.puesto, data.municipio, data.dias_asistencia, data.interesa_b2b, id
    ).run();
  } catch (err) {
    if (String(err).includes("UNIQUE")) return redirect("/admin?error=duplicado");
    return redirect("/admin?error=guardar");
  }
  return redirect("/admin?msg=actualizado");
}

async function handleDelete(env, form) {
  const id = parseInt(form.get("id"), 10);
  if (!id) return redirect("/admin?error=datos");

  // D1/SQLite no aplica ON DELETE CASCADE por defecto: borrar explícitamente
  await env.DB.prepare(
    "DELETE FROM b2b_citas WHERE solicitante_id IN (SELECT id FROM b2b_perfiles WHERE participante_id = ?) OR invitado_id IN (SELECT id FROM b2b_perfiles WHERE participante_id = ?)"
  ).bind(id, id).run();
  await env.DB.prepare("DELETE FROM b2b_perfiles WHERE participante_id = ?").bind(id).run();
  await env.DB.prepare("DELETE FROM participantes WHERE id = ?").bind(id).run();
  return redirect("/admin?msg=borrado");
}

/* ---------- Handlers ---------- */
export async function onRequestPost(context) {
  const { request, env } = context;
  const form = await request.formData();

  // Cerrar sesión
  if (form.get("logout")) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/admin",
        "Set-Cookie": `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
      }
    });
  }

  if (!env.ADMIN_PASSWORD) {
    return new Response(loginPage("", true), { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  /* ---- Acciones CRUD: requieren sesión activa + re-autenticación ---- */
  const action = String(form.get("action") || "");
  if (action === "update" || action === "delete") {
    if (!(await isAuthenticated(request, env))) {
      return new Response(loginPage("Tu sesión expiró. Ingresa de nuevo."), { status: 401, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    if (!env.DB) return new Response("Base de datos no configurada (binding DB).", { status: 500 });

    // Verificar la contraseña ingresada en la ventana emergente
    const confirmPwd = String(form.get("password") || "");
    if (confirmPwd !== env.ADMIN_PASSWORD) {
      return redirect("/admin?error=clave");
    }

    return action === "update" ? handleUpdate(env, form) : handleDelete(env, form);
  }

  /* ---- Login ---- */
  const password = String(form.get("password") || "");
  if (password !== env.ADMIN_PASSWORD) {
    return new Response(loginPage("Contraseña incorrecta. Inténtalo de nuevo."), {
      status: 401, headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  const token = await expectedToken(env);
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/admin",
      "Set-Cookie": `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE}`
    }
  });
}

const MSGS = {
  actualizado: { tipo: "ok", texto: "Registro actualizado correctamente." },
  borrado: { tipo: "ok", texto: "Registro borrado correctamente." }
};
const ERRORES = {
  clave: { tipo: "error", texto: "Contraseña incorrecta. No se aplicó ningún cambio." },
  duplicado: { tipo: "error", texto: "No se guardó: ese correo ya pertenece a otro registro." },
  datos: { tipo: "error", texto: "Datos incompletos o inválidos. Revisa nombre, apellidos, correo y teléfono." },
  guardar: { tipo: "error", texto: "Error al guardar en la base de datos." }
};

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.ADMIN_PASSWORD) {
    return new Response(loginPage("", true), { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  if (!(await isAuthenticated(request, env))) {
    return new Response(loginPage(), { status: 401, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  if (!env.DB) {
    return new Response("Base de datos no configurada (binding DB).", { status: 500 });
  }

  const url = new URL(request.url);
  const aviso = MSGS[url.searchParams.get("msg")] || ERRORES[url.searchParams.get("error")] || null;

  const [tot] = (await env.DB.prepare("SELECT COUNT(*) AS n FROM participantes").all()).results;
  const [b2b] = (await env.DB.prepare("SELECT COUNT(*) AS n FROM b2b_perfiles").all()).results;
  const [hoy] = (await env.DB.prepare("SELECT COUNT(*) AS n FROM participantes WHERE date(created_at) = date('now')").all()).results;
  const [emp] = (await env.DB.prepare("SELECT COUNT(*) AS n FROM participantes WHERE tipo_participante = 'empresa'").all()).results;

  const participantes = (await env.DB.prepare(
    "SELECT * FROM participantes ORDER BY id DESC LIMIT 1000"
  ).all()).results;

  const perfiles = (await env.DB.prepare(
    `SELECT b.*, p.folio, p.nombre, p.apellidos, p.correo, p.telefono
     FROM b2b_perfiles b JOIN participantes p ON p.id = b.participante_id
     ORDER BY b.id DESC LIMIT 1000`
  ).all()).results;

  const stats = { total: tot.n, b2b: b2b.n, hoy: hoy.n, empresas: emp.n };
  return new Response(dashboardPage(stats, participantes, perfiles, aviso), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
  });
}
