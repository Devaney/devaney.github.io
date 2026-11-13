(function () {
  var nav = document.getElementById("secnav");
  if (!nav) return;
  var links = Array.prototype.slice.call(nav.querySelectorAll("a[data-section]"));
  var sections = links
    .map(function (a) { return document.getElementById(a.getAttribute("data-section")); })
    .filter(Boolean);

  function setActive(id) {
    links.forEach(function (a) {
      var on = a.getAttribute("data-section") === id;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
  }

  if ("IntersectionObserver" in window && sections.length) {
    var visible = new Map();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        visible.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
      });
      var best = sections[0].id;
      var bestScore = -1;
      sections.forEach(function (s) {
        var score = visible.get(s.id) || 0;
        if (score > bestScore) { bestScore = score; best = s.id; }
      });
      if (bestScore > 0) setActive(best);
    }, { rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.15, 0.35, 0.6, 1] });
    sections.forEach(function (s) { io.observe(s); });
  }

  // Keep the active chip in view on a narrow, scrolling nav
  nav.addEventListener("click", function (e) {
    var a = e.target.closest("a");
    if (a) setTimeout(function () {
      a.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    }, 0);
  });
})();
