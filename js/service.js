(() => {
  'use strict';

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;
  const tiltTargets = [...document.querySelectorAll('[data-tilt]')];

  const state = new WeakMap();
  const active = new Set();
  let rafId = 0;

  function writeTilt(el, rx, ry, tz) {
    el.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
    el.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
    el.style.setProperty('--tz', `${tz.toFixed(2)}px`);
  }

  function frame(now) {
    rafId = 0;
    if (!active.size || reduceMotion) return;

    active.forEach((el) => {
      const item = state.get(el);
      if (!item) return;
      const ease = Math.min(1, 1 - Math.pow(0.0008, (now - item.last) / 16.67));
      item.rx += (item.trx - item.rx) * ease;
      item.ry += (item.try - item.ry) * ease;
      item.tz += (item.ttz - item.tz) * ease;
      item.last = now;
      writeTilt(el, item.rx, item.ry, item.tz);
    });
  }

  function wake() {
    if (!rafId && !reduceMotion) rafId = requestAnimationFrame(function tick(now) {
      frame(now);
      if (active.size) rafId = requestAnimationFrame(tick);
    });
  }

  if (finePointer && !reduceMotion) {
    tiltTargets.forEach((el) => {
      el.addEventListener('pointermove', (event) => {
        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        const item = state.get(el) || {
          rx: 0, ry: 0, tz: 0,
          trx: 0, try: 0, ttz: 0,
          last: performance.now()
        };
        item.trx = -y * 4.6;
        item.try = x * 5.6;
        item.ttz = 9;
        state.set(el, item);
        active.add(el);
        wake();
      }, { passive: true });

      el.addEventListener('pointerleave', () => {
        const item = state.get(el);
        if (!item) return;
        item.trx = 0;
        item.try = 0;
        item.ttz = 0;
        active.add(el);
        wake();
        window.setTimeout(() => {
          if (!el.matches(':hover')) active.delete(el);
        }, 220);
      }, { passive: true });
    });
  }

  document.querySelectorAll('.magnetic').forEach((el) => {
    if (!finePointer || reduceMotion) return;
    el.addEventListener('pointermove', (event) => {
      const rect = el.getBoundingClientRect();
      const x = ((event.clientX - rect.left) - rect.width / 2) / Math.max(rect.width, 1) * 10;
      const y = ((event.clientY - rect.top) - rect.height / 2) / Math.max(rect.height, 1) * 10;
      el.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)`;
    }, { passive: true });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; }, { passive: true });
  });

  const modal = document.getElementById('briefModal');
  document.querySelectorAll('[data-brief]').forEach((button) => button.addEventListener('click', () => modal?.classList.add('is-open')));
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => modal?.classList.remove('is-open')));

  const form = document.getElementById('briefForm');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const subject = encodeURIComponent(`Digital Pillars enquiry — ${fields.get('company') || fields.get('name')}`);
    const body = encodeURIComponent(`Service: ${window.__SERVICE__}\nName: ${fields.get('name')}\nEmail: ${fields.get('email')}\nCompany: ${fields.get('company')}\n\nProject:\n${fields.get('message')}`);
    location.href = `mailto:hello@digitalpillars.studio?subject=${subject}&body=${body}`;
  });
})();
