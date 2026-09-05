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
