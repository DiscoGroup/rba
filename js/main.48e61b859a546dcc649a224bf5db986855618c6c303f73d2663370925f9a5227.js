/* Raise The Bar Agency — main.js */

// ── Theme set by inline <script> in <head> before first paint (see head.html)

document.addEventListener('DOMContentLoaded', () => {

  const mq = window.matchMedia('(prefers-color-scheme: dark)');

  // Live-update whenever the OS theme changes — only if user hasn't manually overridden
  mq.addEventListener('change', e => {
    if (!localStorage.getItem('rtb-theme')) {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    }
  });

  // Wire the toggle button — manual click overrides system preference
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const next = isDark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('rtb-theme', next);
    });
  }

  // ── Mobile Navigation ───────────────────────────────────────────────────
  const toggle = document.querySelector('.nav__toggle');
  const nav    = document.querySelector('.nav');

  if (toggle && nav) {
    function closeMenu() {
      nav.classList.remove('nav--open');
      toggle.setAttribute('aria-expanded', 'false');
    }

    // 1. Hamburger toggle
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('nav--open');
      toggle.setAttribute('aria-expanded', String(open));
    });

    // 2. Click a nav link — close before navigation
    nav.querySelectorAll('.nav__link').forEach(link => {
      link.addEventListener('click', closeMenu);
    });

    // 3. Click outside nav
    document.addEventListener('click', e => {
      if (!nav.contains(e.target)) closeMenu();
    });

    // 4. Escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeMenu();
    });

    // Scrolled state
    window.addEventListener('scroll', () => {
      nav.classList.toggle('nav--scrolled', window.scrollY > 50);
    }, { passive: true });
  }

  // ── Hero YouTube-lite facade — inject iframe ONLY on click ──────────────
  // Zero YouTube network requests until the visitor explicitly plays the
  // video (thumbnail is Hugo-processed at build time, served from our CDN).
  document.addEventListener('click', e => {
    const facade = e.target.closest('.hero-yt-facade');
    if (!facade || facade.classList.contains('hero-yt-facade--playing')) return;
    const id = facade.dataset.videoid;
    const iframe = document.createElement('iframe');
    iframe.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) +
      '?autoplay=1&playsinline=1&rel=0&modestbranding=1';
    iframe.className = 'hero-phone__yt';
    iframe.title = 'Hero video';
    iframe.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.tabIndex = -1;
    facade.querySelectorAll('.hero-yt-facade__thumb, .hero-yt-facade__play').forEach(el => el.remove());
    facade.appendChild(iframe);
    facade.classList.add('hero-yt-facade--playing');
  });

  // ── Feature video facade (horizontal) — inject iframe ONLY on click ─────
  document.addEventListener('click', e => {
    // Pause/play toggle button
    const toggleBtn = e.target.closest('.yt-facade__pause-btn');
    if (toggleBtn) {
      const facade = toggleBtn.closest('.yt-facade');
      const iframe = facade && facade.querySelector('.yt-facade__iframe');
      if (!iframe) return;
      const isPlaying = facade.dataset.playing !== 'false';
      if (isPlaying) {
        iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
        facade.dataset.playing = 'false';
        toggleBtn.setAttribute('aria-label', 'Play video');
        toggleBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
      } else {
        iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
        facade.dataset.playing = 'true';
        toggleBtn.setAttribute('aria-label', 'Pause video');
        toggleBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
      }
      return;
    }

    const facade = e.target.closest('.yt-facade');
    if (!facade || facade.querySelector('.yt-facade__iframe')) return;
    const id = facade.dataset.videoid;
    const title = facade.getAttribute('aria-label') || 'Video';
    const iframe = document.createElement('iframe');
    iframe.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) +
      '?autoplay=1&rel=0&modestbranding=1&enablejsapi=1';
    iframe.className = 'yt-facade__iframe';
    iframe.title = title;
    iframe.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    facade.querySelectorAll('.yt-facade__thumb, .yt-facade__thumb-placeholder, .yt-facade__play').forEach(el => el.remove());
    facade.appendChild(iframe);
    facade.dataset.playing = 'true';

    // Add pause/play overlay button
    const btn = document.createElement('button');
    btn.className = 'yt-facade__pause-btn';
    btn.setAttribute('aria-label', 'Pause video');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
    facade.appendChild(btn);
  });

  // ── Testimonial Carousel ─────────────────────────────────────────────────
  // Infinite slide-by-ONE carousel — always shows perPage cards simultaneously.
  // The track is: [clone(last perPage slides) | real slides | clone(first perPage slides)]
  // Each click moves exactly 1 slide. Navigating into a clone zone animates
  // naturally, then silently snaps to the matching real position.
  const carousel = document.querySelector('.tc-carousel');
  if (carousel) {
    const track   = carousel.querySelector('.tc-carousel__track');
    const btnPrev = carousel.querySelector('.tc-carousel__btn--prev');
    const btnNext = carousel.querySelector('.tc-carousel__btn--next');

    // Capture originals ONCE before any cloning
    const origSlides = Array.from(track.querySelectorAll('.tc-carousel__slide'));
    const N = origSlides.length;

    let perPage      = 3;
    let currentIdx   = 0;   // absolute track index of the leftmost visible slide
    let clonesBefore = 0;
    let transitioning = false;

    function getPerPage() {
      if (window.innerWidth <= 600) return 1;
      if (window.innerWidth <= 900) return 2;
      return 3;
    }
    function slideW() {
      const s = track.querySelector('.tc-carousel__slide');
      return s ? s.offsetWidth : 0;
    }
    function gapPx() {
      return parseInt(getComputedStyle(track).gap) || 24;
    }

    function buildTrack() {
      perPage      = getPerPage();
      clonesBefore = perPage;

      // Restore originals, remove any previous clones
      track.innerHTML = '';
      origSlides.forEach(s => { s.style.height = ''; track.appendChild(s); });

      // Prepend: last `perPage` originals in order  [N-p, N-p+1 … N-1]
      for (let i = N - 1; i >= N - clonesBefore; i--) {
        const c = origSlides[i].cloneNode(true);
        c.setAttribute('aria-hidden', 'true');
        track.insertBefore(c, track.firstChild);
      }

      // Append: first `perPage` originals  [0, 1 … p-1]
      for (let i = 0; i < clonesBefore; i++) {
        const c = origSlides[i].cloneNode(true);
        c.setAttribute('aria-hidden', 'true');
        track.appendChild(c);
      }

      // Real slides now live at absolute indices clonesBefore … clonesBefore+N-1
      currentIdx = clonesBefore;
    }

    function setPos(idx, animated) {
      if (!animated) track.style.transition = 'none';
      track.style.transform = 'translateX(-' + (idx * (slideW() + gapPx())) + 'px)';
      if (!animated) { void track.getBoundingClientRect(); track.style.transition = ''; }
    }

    function equalizeHeights() {
      const all = Array.from(track.querySelectorAll('.tc-carousel__slide'));
      all.forEach(s => { s.style.height = ''; });
      const maxH = Math.max(...origSlides.map(s => s.offsetHeight));
      all.forEach(s => { s.style.height = maxH + 'px'; });
    }

    function goTo(dir) {
      if (transitioning) return;
      transitioning = true;
      const newIdx = currentIdx + dir;
      setPos(newIdx, true);
      setTimeout(() => {
        if (newIdx < clonesBefore) {
          // Stepped into before-clone zone — snap to matching real position
          currentIdx = clonesBefore + N + (newIdx - clonesBefore);
        } else if (newIdx >= clonesBefore + N) {
          // Stepped into after-clone zone — snap to matching real position
          currentIdx = clonesBefore + (newIdx - (clonesBefore + N));
        } else {
          currentIdx = newIdx;
        }
        setPos(currentIdx, false);
        transitioning = false;
      }, 450); // must match CSS transition duration
    }

    function init() {
      buildTrack();
      setPos(clonesBefore, false);
      equalizeHeights();
    }

    btnPrev.addEventListener('click', () => goTo(-1));
    btnNext.addEventListener('click', () => goTo(1));

    carousel.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') goTo(-1);
      if (e.key === 'ArrowRight') goTo(1);
    });

    let touchStartX = 0;
    track.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    track.addEventListener('touchend', e => {
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) goTo(diff > 0 ? 1 : -1);
    });

    init();
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(init, 120);
    });
  }

  // ── Contact form — validation + AJAX submission to Formspree ────────────
  const form = document.querySelector('.contact-form');
  if (form) {
    const status = form.querySelector('.form-status');
    const submitBtn = form.querySelector('[type="submit"]');

    function showStatus(msg, isError) {
      if (!status) return;
      status.textContent = msg;
      status.classList.toggle('form-status--error', !!isError);
      status.classList.toggle('form-status--success', !isError);
      status.hidden = false;
    }

    form.addEventListener('submit', e => {
      const name  = form.querySelector('[name="name"]');
      const email = form.querySelector('[name="email"]');
      let valid = true;

      [name, email].forEach(field => {
        if (!field) return;
        if (!field.value.trim()) {
          field.style.borderColor = '#c0392b';
          valid = false;
        } else {
          field.style.borderColor = '';
        }
      });

      if (!valid) {
        e.preventDefault();
        const first = form.querySelector('[style*="c0392b"]');
        if (first) first.focus();
        return;
      }

      // AJAX submit — no page navigation
      e.preventDefault();
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }

      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      })
        .then(res => {
          if (res.ok) {
            window.location.href = '/contact/thank-you/';
          } else {
            return res.json().then(data => {
              const msg = data && data.errors && data.errors.length
                ? data.errors.map(err => err.message).join(', ')
                : 'Something went wrong. Please try again or email us directly.';
              showStatus(msg, true);
            });
          }
        })
        .catch(() => {
          showStatus('Network error — please try again or email us directly.', true);
        })
        .finally(() => {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Send Message'; }
        });
    });
  }

  // ── Article Table of Contents ──────────────────────────────────────────
  // Auto-builds a TOC from H2 headings only inside .post__content and injects
  // it directly after the Key Takeaways bullet list.
  (function buildTOC() {
    const content = document.querySelector('.post__content');
    if (!content) return;

    const headings = Array.from(content.querySelectorAll('h2, h3'));
    const tocItems = headings.filter(h => h.textContent.trim() !== 'Key Takeaways' && h.tagName === 'H2');
    if (tocItems.length < 2) return;

    // Ensure every heading has an id (goldmark sets these, but just in case)
    tocItems.forEach(h => {
      if (!h.id) {
        h.id = h.textContent.trim()
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .trim()
          .replace(/\s+/g, '-');
      }
    });

    // Build list
    const ul = document.createElement('ul');
    ul.className = 'toc__list';
    tocItems.forEach(h => {
      const li = document.createElement('li');
      li.className = 'toc__item';
      const a = document.createElement('a');
      a.href = '#' + h.id;
      a.className = 'toc__link';
      a.textContent = h.textContent.trim();
      li.appendChild(a);
      ul.appendChild(li);
    });

    const toc = document.createElement('nav');
    toc.className = 'toc';
    toc.setAttribute('aria-label', 'Table of contents');
    const label = document.createElement('p');
    label.className = 'toc__title';
    label.textContent = 'In This Article';
    toc.appendChild(label);
    toc.appendChild(ul);

    // Inject after the last element of the Key Takeaways section
    const keyH2 = headings.find(h => h.textContent.trim() === 'Key Takeaways');
    if (keyH2) {
      let anchor = keyH2;
      let sib = keyH2.nextElementSibling;
      while (sib && sib.tagName !== 'H2' && sib.tagName !== 'H3') {
        anchor = sib;
        sib = sib.nextElementSibling;
      }
      anchor.after(toc);
    } else {
      content.insertBefore(toc, content.firstChild);
    }
  })();

});
