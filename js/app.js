(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;

  const scenes = $$('.scene-ui');
  const dots = $$('.scene-nav button');
  const topScene = $('#topScene');

  let index = 0;
  let touchY = null;
  let reviewIndex = 0;
  let transitionLockUntil = 0;
  let queuedScene = null;
  let transitionTimer = 0;

  const pointerStates = new WeakMap();
  const pointerTargets = new Set();
  let pointerRaf = 0;

  function setTilt(el, rx, ry, tz) {
    el.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
    el.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
    el.style.setProperty('--tz', `${tz.toFixed(2)}px`);
  }

  function clearTilt(el) {
    el.style.removeProperty('--rx');
    el.style.removeProperty('--ry');
    el.style.removeProperty('--tz');
    el.classList.remove('is-pointer-active');
    pointerTargets.delete(el);
    pointerStates.delete(el);
  }

  function animatePointer(now) {
    pointerRaf = 0;
    if (!pointerTargets.size || reduceMotion) return;

    pointerTargets.forEach((el) => {
      const state = pointerStates.get(el);
      if (!state) return;

      const ease = 1 - Math.pow(0.0008, (now - state.last) / 16.67);
      state.current.rx += (state.target.rx - state.current.rx) * Math.min(ease, 1);
      state.current.ry += (state.target.ry - state.current.ry) * Math.min(ease, 1);
      state.current.tz += (state.target.tz - state.current.tz) * Math.min(ease, 1);
      state.last = now;

      setTilt(el, state.current.rx, state.current.ry, state.current.tz);
    });

    pointerRaf = requestAnimationFrame(animatePointer);
  }

  function wakePointerLoop() {
    if (!pointerRaf && !reduceMotion) pointerRaf = requestAnimationFrame(animatePointer);
  }

  function installPointerMotion() {
    if (!finePointer || reduceMotion) return;

    const interactive = $$('.scene-ui [data-tilt],.scene-ui .service-card,.scene-ui .dash-panel,.scene-ui .orbit-card,.scene-ui .glass-card');

    interactive.forEach((el) => {
      el.addEventListener('pointermove', (event) => {
        const scene = el.closest('.scene-ui');
        if (scene && !scene.classList.contains('is-active')) return;

        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        const strength = el.hasAttribute('data-tilt') ? 4.4 : 5.4;

        let state = pointerStates.get(el);
        if (!state) {
          state = {
            target: { rx: 0, ry: 0, tz: 0 },
            current: { rx: 0, ry: 0, tz: 0 },
            last: performance.now(),
          };
          pointerStates.set(el, state);
        }

        state.target.rx = -y * strength;
        state.target.ry = x * strength;
        state.target.tz = 7;
        el.classList.add('is-pointer-active');
        pointerTargets.add(el);
        wakePointerLoop();
      }, { passive: true });

      el.addEventListener('pointerleave', () => {
        const state = pointerStates.get(el);
        if (state) {
          state.target.rx = 0;
          state.target.ry = 0;
          state.target.tz = 0;
          pointerTargets.add(el);
          wakePointerLoop();
          setTimeout(() => {
            if (!el.matches(':hover')) clearTilt(el);
          }, 180);
        } else {
          clearTilt(el);
        }
      }, { passive: true });
    });

    $$('.magnetic').forEach((el) => {
      el.addEventListener('pointermove', (event) => {
        const r = el.getBoundingClientRect();
        const x = (event.clientX - r.left - r.width / 2) / Math.max(r.width, 1) * 10;
        const y = (event.clientY - r.top - r.height / 2) / Math.max(r.height, 1) * 10;
        el.style.setProperty('--mx', `${x.toFixed(2)}px`);
        el.style.setProperty('--my', `${y.toFixed(2)}px`);
        el.style.transform = `translate3d(var(--mx),var(--my),0)`;
      }, { passive: true });
      el.addEventListener('pointerleave', () => {
        el.style.removeProperty('--mx');
        el.style.removeProperty('--my');
        el.style.transform = '';
      }, { passive: true });
    });
  }

  function applySceneMeta() {
    dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
    if (topScene) topScene.textContent = String(index + 1).padStart(2, '0');
    window.DPWorld?.setScene?.(index);
  }

  function finishTransition() {
    scenes.forEach((scene) => {
      if (scene !== scenes[index]) scene.classList.remove('is-exit');
    });
    transitionLockUntil = 0;
    if (queuedScene != null) {
      const next = queuedScene;
      queuedScene = null;
      setScene(next);
    }
  }

  function setScene(next, force = false) {
    if (!scenes.length) return;

    next = (next + scenes.length) % scenes.length;
    if (!force && next === index) return;

    const now = performance.now();
    if (!force && now < transitionLockUntil) {
      queuedScene = next;
      return;
    }

    const previous = scenes[index];
    const target = scenes[next];

    if (previous === target) {
      target.classList.add('is-active');
      applySceneMeta();
      return;
    }

    clearTimeout(transitionTimer);
    previous?.classList.remove('is-active');
    previous?.classList.add('is-exit');
    target?.classList.add('is-active');

    index = next;
    applySceneMeta();

    transitionLockUntil = now + (reduceMotion ? 80 : 500);
    transitionTimer = window.setTimeout(finishTransition, reduceMotion ? 80 : 560);
  }

  const step = (delta) => {
    if ($('.brief-modal.is-open,.ai-modal.is-open')) return;
    setScene(index + delta);
  };

  $$('[data-goto]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      const n = Number(el.dataset.goto);
      if (Number.isFinite(n)) setScene(n, true);
    });
  });

  addEventListener('wheel', (event) => {
    if ($('.brief-modal.is-open,.ai-modal.is-open')) return;
    if (Math.abs(event.deltaY) < 18) return;
    step(event.deltaY > 0 ? 1 : -1);
  }, { passive: true });

  addEventListener('keydown', (event) => {
    const modal = $('.brief-modal.is-open,.ai-modal.is-open');
    if (modal) {
      if (event.key === 'Escape') $$('.brief-modal,.ai-modal').forEach((m) => m.classList.remove('is-open'));
      return;
    }

    if (['ArrowDown', 'PageDown', ' '].includes(event.key)) {
      event.preventDefault();
      step(1);
    } else if (['ArrowUp', 'PageUp'].includes(event.key)) {
      event.preventDefault();
      step(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setScene(0, true);
    } else if (event.key === 'End') {
      event.preventDefault();
      setScene(scenes.length - 1, true);
    }
  });

  addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') touchY = event.clientY;
  }, { passive: true });

  addEventListener('pointerup', (event) => {
    if (touchY == null) return;
    const delta = event.clientY - touchY;
    if (Math.abs(delta) > 45) step(delta < 0 ? 1 : -1);
    touchY = null;
  }, { passive: true });

  $$('[data-link]').forEach((el) => {
    el.addEventListener('click', () => {
      if (el.dataset.link) location.assign(el.dataset.link);
    });
  });

  const reviews = $$('.review-card');
  const count = $('#reviewCount');

  function showReview(next) {
    if (!reviews.length) return;
    reviewIndex = (next + reviews.length) % reviews.length;
    reviews.forEach((review, i) => review.classList.toggle('is-active', i === reviewIndex));
    if (count) count.textContent = `${String(reviewIndex + 1).padStart(2, '0')} / ${String(reviews.length).padStart(2, '0')}`;
  }

  $('[data-review="prev"]')?.addEventListener('click', () => showReview(reviewIndex - 1));
  $('[data-review="next"]')?.addEventListener('click', () => showReview(reviewIndex + 1));

  const answers = {
    services: 'Performance / paid social, social presence, digital experiences, brand strategy, creator partnerships and growth consulting — connected as one operating system.',
    start: 'Choose a service card, open its dedicated layer, then use the project brief. We scope the pressure point first and build in focused sprints.',
    time: 'First replies are typically within one working day. Delivery time depends on the layer and scope; builds are structured into clear stages.',
    team: 'Yes. Digital Pillars can plug into an existing marketing, design or development team as a specialist layer, lead, or delivery partner.'
  };

  $$('[data-answer]').forEach((question) => {
    question.addEventListener('click', () => {
      const box = question.closest('.ai-window,.ai-panel')?.querySelector('.answer-box');
      if (box) box.textContent = answers[question.dataset.answer] || 'Select another question.';
    });
  });

  const brief = $('#briefModal');
  const ai = $('#aiModal');

  $$('[data-brief]').forEach((button) => button.addEventListener('click', () => brief?.classList.add('is-open')));
  $$('[data-close]').forEach((button) => button.addEventListener('click', () => brief?.classList.remove('is-open')));
  $('[data-open-ai]')?.addEventListener('click', () => ai?.classList.add('is-open'));
  $$('[data-close-ai]').forEach((button) => button.addEventListener('click', () => ai?.classList.remove('is-open')));

  $('#briefForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const subject = encodeURIComponent(`Digital Pillars enquiry — ${form.get('company') || form.get('name')}`);
    const body = encodeURIComponent(`Name: ${form.get('name')}\nEmail: ${form.get('email')}\nCompany: ${form.get('company')}\n\nProject:\n${form.get('message')}`);
    location.href = `mailto:hello@digitalpillars.studio?subject=${subject}&body=${body}`;
  });

  const loader = $('#loader');
  const loadPct = $('#loadPct');
  if (loader && loadPct) {
    const started = performance.now();
    const finish = () => {
      loadPct.textContent = '100';
      loader.classList.add('loader-done');
    };
    const wait = () => window.setTimeout(finish, Math.max(100, 420 - (performance.now() - started)));
    if (document.readyState === 'complete') wait();
    else addEventListener('load', wait, { once: true });
  }

  window.DigitalPillars = Object.freeze({
    go: setScene,
    next: () => step(1),
    previous: () => step(-1)
  });

  applySceneMeta();
  installPointerMotion();
  setScene(0, true);
})();
