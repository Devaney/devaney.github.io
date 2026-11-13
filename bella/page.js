(function () {
  "use strict";

  // In-page nav: scroll the section to just below the sticky nav.
  // Do not scrollIntoView the chip — that used to fight the section jump.
  var nav = document.querySelector(".nav");

  function scrollToSection(id) {
    var section = document.getElementById(id);
    if (!section) return;
    var navHeight = nav ? nav.offsetHeight : 0;
    var top = window.scrollY + section.getBoundingClientRect().top - navHeight - 4;
    window.scrollTo(0, Math.max(0, top));
  }

  if (nav) {
    nav.addEventListener("click", function (event) {
      var link = event.target.closest("a[href^='#']");
      if (!link) return;
      var href = link.getAttribute("href");
      if (!href || href === "#") return;
      var id = href.slice(1);
      if (!document.getElementById(id)) return;
      event.preventDefault();
      scrollToSection(id);
      if (history.replaceState) {
        history.replaceState(null, "", href);
      }
    });
  }

  // Open any in-document hash on load (e.g. shared link).
  if (location.hash && location.hash.length > 1) {
    var startId = location.hash.slice(1);
    if (document.getElementById(startId)) {
      window.setTimeout(function () { scrollToSection(startId); }, 0);
    }
  }

  // --- Your list ---------------------------------------------------------
  var KEY = "bella-subject-list-v1";
  var dataEl = document.getElementById("play-data");
  var listEl = document.getElementById("play-list");
  var statusEl = document.getElementById("play-status");
  var resetBtn = document.getElementById("play-reset");
  if (!dataEl || !listEl) return;

  var subjects;
  try {
    subjects = JSON.parse(dataEl.textContent);
  } catch (err) {
    return;
  }

  var byId = {};
  subjects.forEach(function (s) { byId[s.id] = s; });

  function alphaOrder() {
    return subjects
      .slice()
      .sort(function (a, b) {
        return a.sortName.localeCompare(b.sortName);
      })
      .map(function (s) { return s.id; });
  }

  function defaultState() {
    return { order: alphaOrder(), marks: {}, t: Date.now() };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      var known = {};
      subjects.forEach(function (s) { known[s.id] = true; });
      var order = (parsed.order || []).filter(function (id) { return known[id]; });
      alphaOrder().forEach(function (id) {
        if (order.indexOf(id) === -1) order.push(id);
      });
      var marks = {};
      var src = parsed.marks || {};
      Object.keys(src).forEach(function (id) {
        if (known[id] && (src[id] === "yes" || src[id] === "maybe" || src[id] === "no")) {
          marks[id] = src[id];
        }
      });
      return { order: order, marks: marks, t: parsed.t || Date.now() };
    } catch (err) {
      return defaultState();
    }
  }

  var state = load();

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  function save() {
    try {
      state.t = Date.now();
      localStorage.setItem(KEY, JSON.stringify(state));
      setStatus("Saved on this device only.");
    } catch (err) {
      setStatus("Could not save on this device.");
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function listItems(items) {
    if (!items || !items.length) return "<p>None noted.</p>";
    return "<ul>" + items.map(function (t) {
      return "<li>" + escapeHtml(t) + "</li>";
    }).join("") + "</ul>";
  }

  function render() {
    var html = "";
    state.order.forEach(function (id, index) {
      var s = byId[id];
      if (!s) return;
      var mark = state.marks[id] || "";
      var markClass = mark ? " mark-" + mark : "";
      var upDisabled = index === 0 ? " disabled" : "";
      var downDisabled = index === state.order.length - 1 ? " disabled" : "";
      html += '<li class="play-item' + markClass + '" data-id="' + escapeHtml(id) + '" draggable="true">';
      html += '<div class="play-top">';
      html += '<span class="drag" aria-hidden="true" title="Drag to reorder">::</span>';
      html += '<div class="play-name">' + escapeHtml(s.name) + '</div>';
      html += '<div class="play-kind">' + escapeHtml(s.kind || "") + '</div>';
      html += '<div class="play-moves">';
      html += '<button type="button" class="move-up" data-id="' + escapeHtml(id) + '"' + upDisabled + ' aria-label="Move ' + escapeHtml(s.name) + ' up">Up</button>';
      html += '<button type="button" class="move-down" data-id="' + escapeHtml(id) + '"' + downDisabled + ' aria-label="Move ' + escapeHtml(s.name) + ' down">Down</button>';
      html += '</div>';
      html += '<div class="play-marks" role="radiogroup" aria-label="Mark for ' + escapeHtml(s.name) + '">';
      ["yes", "maybe", "no"].forEach(function (val) {
        var checked = mark === val ? " checked" : "";
        var label = val === "yes" ? "Yes" : val === "maybe" ? "Maybe" : "No";
        html += '<label><input type="radio" name="mark-' + escapeHtml(id) + '" value="' + val + '"' + checked + '> ' + label + '</label>';
      });
      html += '<button type="button" class="clear-mark" data-id="' + escapeHtml(id) + '"' + (mark ? "" : " disabled") + ' aria-label="Clear mark for ' + escapeHtml(s.name) + '">Clear</button>';
      html += '</div>';
      html += '</div>';
      html += '<div class="reasons">';
      html += '<div class="draw"><div class="rk">Might draw you to it</div>' + listItems(s.mightDrawYou) + '</div>';
      html += '<div class="weigh"><div class="rk">Things to weigh up</div>' + listItems(s.thingsToWeighUp) + '</div>';
      html += '</div>';
      html += '</li>';
    });
    listEl.innerHTML = html;
  }

  function move(id, dir) {
    var i = state.order.indexOf(id);
    var j = i + dir;
    if (i < 0 || j < 0 || j >= state.order.length) return;
    var tmp = state.order[i];
    state.order[i] = state.order[j];
    state.order[j] = tmp;
    save();
    render();
  }

  listEl.addEventListener("click", function (event) {
    var up = event.target.closest(".move-up");
    var down = event.target.closest(".move-down");
    var clear = event.target.closest(".clear-mark");
    if (up && !up.disabled) move(up.getAttribute("data-id"), -1);
    if (down && !down.disabled) move(down.getAttribute("data-id"), 1);
    if (clear && !clear.disabled) {
      delete state.marks[clear.getAttribute("data-id")];
      save();
      render();
    }
  });

  listEl.addEventListener("change", function (event) {
    var input = event.target;
    if (!input.matches('input[type="radio"]')) return;
    var id = input.name.replace(/^mark-/, "");
    state.marks[id] = input.value;
    save();
    var item = input.closest(".play-item");
    if (item) {
      item.classList.remove("mark-yes", "mark-maybe", "mark-no");
      item.classList.add("mark-" + input.value);
      var clear = item.querySelector(".clear-mark");
      if (clear) clear.disabled = false;
    }
  });

  // Drag and drop (desktop). Phone and touch use the Up / Down buttons.
  var dragId = null;
  listEl.addEventListener("dragstart", function (event) {
    var item = event.target.closest(".play-item");
    if (!item) return;
    dragId = item.getAttribute("data-id");
    item.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    try { event.dataTransfer.setData("text/plain", dragId); } catch (err) {}
  });
  listEl.addEventListener("dragend", function (event) {
    var item = event.target.closest(".play-item");
    if (item) item.classList.remove("dragging");
    dragId = null;
  });
  listEl.addEventListener("dragover", function (event) {
    var item = event.target.closest(".play-item");
    if (!item) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  });
  listEl.addEventListener("drop", function (event) {
    var item = event.target.closest(".play-item");
    if (!item) return;
    event.preventDefault();
    var toId = item.getAttribute("data-id");
    var fromId = dragId || (event.dataTransfer && event.dataTransfer.getData("text/plain"));
    if (!fromId || !toId || fromId === toId) return;
    var from = state.order.indexOf(fromId);
    var to = state.order.indexOf(toId);
    if (from < 0 || to < 0) return;
    state.order.splice(from, 1);
    state.order.splice(to, 0, fromId);
    save();
    render();
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      try { localStorage.removeItem(KEY); } catch (err) {}
      state = defaultState();
      render();
      setStatus("Back to A–Z, marks cleared. Saved on this device only.");
    });
  }

  render();
  if (localStorage.getItem(KEY)) {
    setStatus("Saved on this device only.");
  }
})();
