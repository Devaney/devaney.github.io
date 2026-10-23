(function () {
  var menuButton = document.getElementById('menu-btn-js');
  var nav = document.getElementById('stickyheader');
  if (!menuButton || !nav) {
    return;
  }

  var animationToken = 0;

  function viewportWidth() {
    return document.documentElement.clientWidth;
  }

  function swing(progress) {
    return 0.5 - Math.cos(progress * Math.PI) / 2;
  }

  function animateLeft(target, onDone) {
    var from = parseFloat(window.getComputedStyle(nav).left) || 0;
    var token = ++animationToken;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      nav.style.left = target + 'px';
      if (onDone) {
        onDone();
      }
      return;
    }

    var start = null;
    function frame(now) {
      if (token !== animationToken) {
        return;
      }
      if (start === null) {
        start = now;
      }
      var progress = Math.min(1, (now - start) / 250);
      nav.style.left = (from + (target - from) * swing(progress)) + 'px';
      if (progress < 1) {
        window.requestAnimationFrame(frame);
      } else if (onDone) {
        onDone();
      }
    }
    window.requestAnimationFrame(frame);
  }

  function onActivate(event) {
    var label = (event.currentTarget.textContent || '').replace(/\s+/g, ' ').trim();
    var open = label === 'Menu';
    menuButton.textContent = open ? 'Close' : 'Menu';

    if (viewportWidth() >= 699) {
      menuButton.setAttribute('aria-expanded', 'false');
      return;
    }

    if (nav.classList.contains('hidden')) {
      nav.classList.remove('hidden');
      nav.classList.add('active');
      menuButton.setAttribute('aria-expanded', 'true');
      animateLeft(0);
    } else if (nav.classList.contains('active')) {
      menuButton.setAttribute('aria-expanded', 'false');
      animateLeft(-280, function () {
        nav.classList.remove('active');
        nav.classList.add('hidden');
      });
    }
  }

  menuButton.addEventListener('click', onActivate);
  var links = nav.querySelectorAll('a');
  for (var i = 0; i < links.length; i++) {
    links[i].addEventListener('click', onActivate);
  }
})();
