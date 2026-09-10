/* Foro Estatal Agua en la Industria — Tamaulipas 2026 */
(function () {
  "use strict";

  /* ---------- Menú móvil ---------- */
  var toggle = document.getElementById("navToggle");
  var nav = document.getElementById("mainNav");

  toggle.addEventListener("click", function () {
    var open = nav.classList.toggle("open");
    toggle.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
  });

  nav.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      nav.classList.remove("open");
      toggle.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });

  /* ---------- Sombra del header al hacer scroll ---------- */
  var header = document.getElementById("siteHeader");
  function onScroll() {
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Resaltar enlace activo ---------- */
  var sections = Array.prototype.slice.call(document.querySelectorAll("section[id]"));
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav-link"));

  var spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var id = entry.target.getAttribute("id");
      navLinks.forEach(function (l) {
        l.classList.toggle("active", l.getAttribute("href") === "#" + id);
      });
    });
  }, { rootMargin: "-40% 0px -55% 0px" });
  sections.forEach(function (s) { spy.observe(s); });

  /* ---------- Animaciones de revelado ---------- */
  var revealer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        revealer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach(function (el) { revealer.observe(el); });

  /* ---------- Cuenta regresiva: 24 de septiembre de 2026, 9:00 a.m. (Centro de México) ---------- */
  var target = new Date("2026-09-24T09:00:00-06:00").getTime();
  var el = {
    d: document.getElementById("cdDays"),
    h: document.getElementById("cdHours"),
    m: document.getElementById("cdMins"),
    s: document.getElementById("cdSecs")
  };

  function pad(n) { return String(n).padStart(2, "0"); }

  function tick() {
    var diff = target - Date.now();
    if (diff <= 0) {
      el.d.textContent = "0";
      el.h.textContent = "00";
      el.m.textContent = "00";
      el.s.textContent = "00";
      return;
    }
    var days = Math.floor(diff / 86400000);
    var hours = Math.floor((diff % 86400000) / 3600000);
    var mins = Math.floor((diff % 3600000) / 60000);
    var secs = Math.floor((diff % 60000) / 1000);
    el.d.textContent = days;
    el.h.textContent = pad(hours);
    el.m.textContent = pad(mins);
    el.s.textContent = pad(secs);
  }
  tick();
  setInterval(tick, 1000);
})();

/* ---------- Registro de participantes (formulario 2 pasos) ---------- */
(function () {
  "use strict";

  var form = document.getElementById("registroForm");
  if (!form) return;

  var paso2 = document.getElementById("paso2");
  var msg = document.getElementById("registroMsg");
  var submitBtn = document.getElementById("registroSubmit");
  var b2bRadios = form.querySelectorAll('input[name="interesa_b2b"]');

  // Campos obligatorios solo cuando el paso 2 está activo
  var b2bRequired = ["razon_social", "sector", "tipo_participacion", "descripcion"];

  function syncB2B() {
    var quiere = form.querySelector('input[name="interesa_b2b"]:checked');
    var activo = quiere && quiere.value === "1";
    paso2.hidden = !activo;
    b2bRequired.forEach(function (name) {
      var field = form.elements[name];
      if (field) field.required = activo;
    });
  }

  b2bRadios.forEach(function (r) { r.addEventListener("change", syncB2B); });
  syncB2B();

  function showMsg(kind, html) {
    msg.className = "form-msg " + kind;
    msg.innerHTML = html;
    msg.hidden = false;
    msg.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function clearInvalid() {
    form.querySelectorAll(".invalid").forEach(function (el) { el.classList.remove("invalid"); });
  }

  form.addEventListener("input", function (e) {
    if (e.target.classList) e.target.classList.remove("invalid");
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearInvalid();
    msg.hidden = true;

    // Validación nativa + marcado visual
    if (!form.checkValidity()) {
      var firstBad = form.querySelector(":invalid");
      if (firstBad) {
        firstBad.classList.add("invalid");
        firstBad.scrollIntoView({ behavior: "smooth", block: "center" });
        firstBad.focus({ preventScroll: true });
      }
      showMsg("error", "Revisa los campos marcados: falta información obligatoria o algún dato no es válido.");
      return;
    }

    var fd = new FormData(form);
    var interesa = fd.get("interesa_b2b") === "1";

    var payload = {
      nombre: fd.get("nombre").trim(),
      apellidos: fd.get("apellidos").trim(),
      correo: fd.get("correo").trim().toLowerCase(),
      telefono: fd.get("telefono").trim(),
      tipo_participante: fd.get("tipo_participante"),
      organizacion: (fd.get("organizacion") || "").trim(),
      puesto: (fd.get("puesto") || "").trim(),
      municipio: (fd.get("municipio") || "").trim(),
      dias_asistencia: fd.get("dias_asistencia"),
      interesa_b2b: interesa ? 1 : 0,
      aviso_privacidad: fd.get("aviso_privacidad") === "1"
    };

    if (interesa) {
      payload.b2b = {
        razon_social: (fd.get("razon_social") || "").trim(),
        rfc: (fd.get("rfc") || "").trim().toUpperCase(),
        sector: fd.get("sector"),
        tamanio_empresa: fd.get("tamanio_empresa") || "",
        sitio_web: (fd.get("sitio_web") || "").trim(),
        tipo_participacion: fd.get("tipo_participacion"),
        descripcion: (fd.get("descripcion") || "").trim(),
        productos_ofrece: (fd.get("productos_ofrece") || "").trim(),
        productos_busca: (fd.get("productos_busca") || "").trim(),
        sectores_interes: fd.getAll("sectores_interes"),
        disponibilidad: fd.getAll("disponibilidad"),
        autoriza_contacto: fd.get("autoriza_contacto") === "1" ? 1 : 0
      };
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando…";

    fetch("/api/registro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json().then(function (data) { return { status: res.status, data: data }; }); })
      .then(function (r) {
        if (r.status === 201 && r.data.ok) {
          form.reset();
          syncB2B();
          showMsg(
            "ok",
            "<strong>¡Registro exitoso!</strong>" +
            "Gracias, <b>" + r.data.nombre + "</b>. Tu lugar en el Foro Estatal Agua en la Industria quedó registrado." +
            (r.data.b2b ? " Tu perfil de Networking B2B también fue capturado." : "") +
            "<br>Presenta este folio el día del evento:<br><span class='folio'>" + r.data.folio + "</span>"
          );
        } else if (r.status === 409) {
          showMsg("error", "Este correo electrónico ya tiene un registro. Si necesitas actualizar tus datos, escríbenos a hector.azua@tamaulipas.gob.mx.");
        } else {
          showMsg("error", r.data.error || "No pudimos completar el registro. Inténtalo de nuevo en unos minutos.");
        }
      })
      .catch(function () {
        showMsg("error", "Error de conexión. Verifica tu internet e inténtalo nuevamente.");
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = "Enviar registro";
      });
  });
})();
