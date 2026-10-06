(() => {
  const body = document.body;
  const nav = document.querySelector('.nav');
  const progress = document.querySelector('.progress span');
  const dock = document.querySelector('.dock');
  const hero = document.querySelector('.hero');
  const heroTitle = document.querySelector('.hero-title');
  const profile = document.querySelector('.profile-card');
  const stickers = [...document.querySelectorAll('[data-float]')];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let ticking = false;
  let previousY = scrollY;

  function updateScrollScene() {
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    const ratio = max > 0 ? y / max : 0;
    progress.style.transform = `scaleX(${ratio})`;
    nav.classList.toggle('scrolled', y > innerHeight * .7);
    if (!reduceMotion && y < innerHeight * 1.15) {
      hero.style.backgroundPosition = `50% calc(50% + ${y * .12}px)`;
      heroTitle.style.transform = `translate3d(0, ${y * .16}px, 0) scale(${1 - Math.min(y / innerHeight, 1) * .04})`;
      profile.style.transform = `translate(-50%, calc(-50% + ${y * .08}px))`;
      stickers.forEach(el => {
        const amount = Number(el.dataset.float) || 0;
        el.style.translate = `0 ${y * amount * .18}px`;
      });
    }
    previousY = y;
    ticking = false;
  }

  addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateScrollScene);
      ticking = true;
    }
  }, { passive: true });
  updateScrollScene();

  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: .12, rootMargin: '0px 0px -7% 0px' });
  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', event => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', anchor.getAttribute('href'));
      closeMenu();
    });
  });

  const menuButton = document.querySelector('.menu-button');
  const menu = document.querySelector('.mobile-menu');
  function closeMenu() {
    menuButton.setAttribute('aria-expanded', 'false');
    menu.classList.remove('open');
    body.classList.remove('menu-open');
  }
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('open', open);
    body.classList.toggle('menu-open', open);
  });

  document.querySelectorAll('.faq-item button').forEach(button => {
    button.addEventListener('click', () => {
      const item = button.closest('.faq-item');
      const willOpen = !item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(other => {
        other.classList.remove('open');
        other.querySelector('button').setAttribute('aria-expanded', 'false');
        other.querySelector('button i').textContent = '+';
      });
      if (willOpen) {
        item.classList.add('open');
        button.setAttribute('aria-expanded', 'true');
        button.querySelector('i').textContent = '−';
      }
    });
  });

  const track = document.querySelector('.review-track');
  const cards = [...document.querySelectorAll('.review-card')];
  let reviewIndex = 0;
  function moveReviews(direction) {
    reviewIndex = (reviewIndex + direction + cards.length) % cards.length;
    const gap = 22;
    const cardWidth = cards[0].getBoundingClientRect().width;
    track.style.transform = `translate3d(-${reviewIndex * (cardWidth + gap)}px,0,0)`;
  }
  document.querySelector('.review-prev').addEventListener('click', () => moveReviews(-1));
  document.querySelector('.review-next').addEventListener('click', () => moveReviews(1));

  let dragStart = null;
  track.addEventListener('pointerdown', event => {
    dragStart = event.clientX;
    track.setPointerCapture(event.pointerId);
  });
  track.addEventListener('pointerup', event => {
    if (dragStart === null) return;
    const delta = event.clientX - dragStart;
    if (Math.abs(delta) > 45) moveReviews(delta < 0 ? 1 : -1);
    dragStart = null;
  });

  document.querySelectorAll('.services-list button').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.services-list button').forEach(b => b.classList.remove('active'));
      button.classList.add('active');
    });
  });

  if (matchMedia('(pointer:fine)').matches && !reduceMotion) {
    const cursor = document.querySelector('.cursor-bubble');
    let mouseX = 0, mouseY = 0, cursorX = 0, cursorY = 0;
    addEventListener('pointermove', event => { mouseX = event.clientX; mouseY = event.clientY; });
    const animateCursor = () => {
      cursorX += (mouseX - cursorX) * .17;
      cursorY += (mouseY - cursorY) * .17;
      cursor.style.left = `${cursorX}px`;
      cursor.style.top = `${cursorY}px`;
      requestAnimationFrame(animateCursor);
    };
    animateCursor();

    document.querySelectorAll('.project-card').forEach(card => {
      card.style.setProperty('--card-color', card.dataset.color);
      card.addEventListener('pointerenter', () => cursor.classList.add('show'));
      card.addEventListener('pointerleave', () => cursor.classList.remove('show'));
    });

    document.querySelectorAll('.tilt-card').forEach(card => {
      card.addEventListener('pointermove', event => {
        const rect = card.getBoundingClientRect();
        const rx = ((event.clientY - rect.top) / rect.height - .5) * -9;
        const ry = ((event.clientX - rect.left) / rect.width - .5) * 9;
        card.style.rotate = `${ry * .08}deg`;
        card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-8px)`;
      });
      card.addEventListener('pointerleave', () => {
        card.style.rotate = '';
        card.style.transform = '';
      });
    });

    document.querySelectorAll('.magnetic').forEach(button => {
      button.addEventListener('pointermove', event => {
        const rect = button.getBoundingClientRect();
        const x = (event.clientX - rect.left - rect.width / 2) * .18;
        const y = (event.clientY - rect.top - rect.height / 2) * .18;
        button.style.translate = `${x}px ${y}px`;
      });
      button.addEventListener('pointerleave', () => { button.style.translate = ''; });
    });
  } else {
    document.querySelectorAll('.project-card').forEach(card => card.style.setProperty('--card-color', card.dataset.color));
  }

  const activeObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      dock.querySelectorAll('a').forEach(a => a.removeAttribute('aria-current'));
      const active = dock.querySelector(`a[href="#${entry.target.id}"]`);
      if (active) active.setAttribute('aria-current', 'true');
    });
  }, { threshold: .45 });
  document.querySelectorAll('main > section, footer').forEach(section => activeObserver.observe(section));
})();
