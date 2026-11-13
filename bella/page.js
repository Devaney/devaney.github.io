(function () {
  var nav = document.getElementById("secnav");
  if (!nav) return;

  var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));

  function idFrom(a) {
    var href = a.getAttribute("href") || "";
    return href.charAt(0) === "#" ? href.slice(1) : "";
  }

  function setActive(id) {
    links.forEach(function (a) {
      var on = idFrom(a) === id;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
  }

  function offsetTop(el) {
    var y = 0;
    var node = el;
    while (node) {
      y += node.offsetTop;
      node = node.offsetParent;
    }
    return y;
  }

  function scrollToSection(id) {
    var el = document.getElementById(id);
    if (!el) return false;
    var top = offsetTop(el) - nav.offsetHeight - 8;
    window.scrollTo(0, Math.max(0, top));
    return true;
  }

  nav.addEventListener("click", function (e) {
    var a = e.target.closest("a");
    if (!a || !nav.contains(a)) return;
    var id = idFrom(a);
    if (!id || !document.getElementById(id)) return;
    e.preventDefault();
    scrollToSection(id);
    if (history.replaceState) history.replaceState(null, "", "#" + id);
    else location.hash = id;
    setActive(id);
  });

  if (location.hash) {
    var startId = location.hash.replace("#", "");
    if (document.getElementById(startId)) {
      setTimeout(function () {
        scrollToSection(startId);
        setActive(startId);
      }, 0);
    }
  }

  var sections = links
    .map(function (a) { return document.getElementById(idFrom(a)); })
    .filter(Boolean);

  if ("IntersectionObserver" in window && sections.length) {
    var visible = new Map();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
      });
      var best = sections[0].id;
      var bestScore = -1;
      sections.forEach(function (section) {
        var score = visible.get(section.id) || 0;
        if (score > bestScore) {
          bestScore = score;
          best = section.id;
        }
      });
      if (bestScore > 0) setActive(best);
    }, { rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.15, 0.35, 0.6, 1] });
    sections.forEach(function (section) { io.observe(section); });
  }
})();
