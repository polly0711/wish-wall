/* ─────────────────────────────────────────────────────────────── */
/*  display.js — 展示牆主程式                                      */
/* ─────────────────────────────────────────────────────────────── */

const socket = io();
const grid       = document.getElementById('wishes-grid');
const emptyState = document.getElementById('empty-state');
const qrImg      = document.getElementById('qr-img');
const qrUrl      = document.getElementById('qr-url');
const flyContainer = document.getElementById('floating-lanterns');

// ── Stars canvas ─────────────────────────────────────────────────
(function initStars() {
  const canvas = document.getElementById('stars-canvas');
  const ctx = canvas.getContext('2d');
  let stars = [];

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    buildStars();
  }

  function buildStars() {
    stars = [];
    const count = Math.floor((canvas.width * canvas.height) / 4500);
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.4 + 0.3,
        alpha: Math.random(),
        speed: Math.random() * 0.008 + 0.002,
        dir: Math.random() < 0.5 ? 1 : -1
      });
    }
  }

  function drawStars() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach(s => {
      s.alpha += s.speed * s.dir;
      if (s.alpha >= 1) { s.alpha = 1; s.dir = -1; }
      if (s.alpha <= 0) { s.alpha = 0; s.dir =  1; }
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 230, 150, ${s.alpha})`;
      ctx.fill();
    });
    requestAnimationFrame(drawStars);
  }

  window.addEventListener('resize', resize);
  resize();
  drawStars();
})();

// ── Ember particles ──────────────────────────────────────────────
(function initEmbers() {
  const container = document.getElementById('embers');
  function spawnEmber() {
    const el = document.createElement('div');
    el.className = 'ember';
    const size = Math.random() * 5 + 2;
    const dur  = Math.random() * 8 + 6;
    const dx   = (Math.random() - 0.5) * 120;
    el.style.cssText = `
      left: ${Math.random() * 100}%;
      width: ${size}px;
      height: ${size}px;
      --dx: ${dx}px;
      animation-duration: ${dur}s;
      animation-delay: ${Math.random() * 5}s;
    `;
    container.appendChild(el);
    setTimeout(() => el.remove(), (dur + 5) * 1000);
  }
  for (let i = 0; i < 30; i++) spawnEmber();
  setInterval(spawnEmber, 800);
})();

// ── QR Code ──────────────────────────────────────────────────────
async function loadQR() {
  try {
    const res  = await fetch('/api/qrcode');
    const data = await res.json();
    qrImg.src  = data.qr;
    qrUrl.textContent = data.url;
  } catch (e) {
    qrUrl.textContent = '無法產生 QR Code';
  }
}

// ── Format time ─────────────────────────────────────────────────
function formatTime(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleString('zh-TW', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

// ── Helper: get wish ID (supports both id and _id from MongoDB) ──
function getWishId(wish) {
  return wish._id || wish.id;
}

// ── Render one wish card ─────────────────────────────────────────
const DECOS = ['✦', '❋', '✿', '❀', '⚘', '✾'];
let cardIndex = 0;

function createCard(wish, prepend = false) {
  const card = document.createElement('div');
  card.className = 'wish-card';
  card.dataset.id = getWishId(wish);

  const deco = DECOS[cardIndex++ % DECOS.length];
  card.innerHTML = `
    <span class="wish-card-deco">${deco}</span>
    <p class="wish-name">${escapeHtml(wish.name)}</p>
    <p class="wish-content">${escapeHtml(wish.content)}</p>
    <p class="wish-time">${formatTime(wish.created_at)}</p>
  `;

  if (prepend && grid.firstChild) {
    grid.insertBefore(card, grid.firstChild);
  } else {
    grid.appendChild(card);
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Toggle empty state ───────────────────────────────────────────
function updateEmptyState() {
  const hasCards = grid.children.length > 0;
  emptyState.classList.toggle('hidden', hasCards);
}

// ── Flying lantern animation ─────────────────────────────────────
function flyLantern() {
  const el = document.createElement('div');
  el.className = 'fly-lantern';
  el.textContent = '🏮';
  const startX = Math.random() * window.innerWidth;
  const dx = (Math.random() - 0.5) * 200;
  const rotStart = (Math.random() - 0.5) * 20 + 'deg';
  const rotEnd   = (Math.random() - 0.5) * 40 + 'deg';
  el.style.cssText = `left:${startX}px; --dx:${dx}px; --rot-start:${rotStart}; --rot-end:${rotEnd};`;
  flyContainer.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

// ── Load all existing wishes ─────────────────────────────────────
async function loadWishes() {
  try {
    const res   = await fetch('/api/wishes');
    const wishes = await res.json();
    // API returns newest first, display newest first
    wishes.forEach(w => createCard(w, false));
    updateEmptyState();
  } catch (e) {
    console.error('載入心願失敗:', e);
  }
}

// ── Socket.io: receive real-time new wish ────────────────────────
socket.on('new-wish', (wish) => {
  createCard(wish, true);   // prepend newly arrived card
  updateEmptyState();
  for (let i = 0; i < 3; i++) {
    setTimeout(flyLantern, i * 400);
  }
  // Scroll to top so new card is visible
  document.querySelector('.main-content').scrollTo({ top: 0, behavior: 'smooth' });
});

// ── Socket.io: wish updated by admin ─────────────────────────────
socket.on('wish-updated', (wish) => {
  const id = getWishId(wish);
  const card = grid.querySelector(`[data-id="${id}"]`);
  if (card) {
    card.querySelector('.wish-name').textContent = wish.name;
    card.querySelector('.wish-content').textContent = wish.content;
    // Flash animation to indicate update
    card.style.animation = 'none';
    card.offsetHeight; // trigger reflow
    card.style.animation = 'card-appear 0.7s cubic-bezier(0.22, 1, 0.36, 1) both';
  }
});

// ── Socket.io: wish deleted by admin ─────────────────────────────
socket.on('wish-deleted', (data) => {
  const id = getWishId(data);
  const card = grid.querySelector(`[data-id="${id}"]`);
  if (card) {
    card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.8) translateY(20px)';
    setTimeout(() => {
      card.remove();
      updateEmptyState();
    }, 500);
  }
});

// ── Init ─────────────────────────────────────────────────────────
loadWishes();
loadQR();
