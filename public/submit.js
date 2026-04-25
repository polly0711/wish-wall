/* ─────────────────────────────────────────────────────────────── */
/*  submit.js — 手機端送出心願程式                                  */
/* ─────────────────────────────────────────────────────────────── */

const form       = document.getElementById('wish-form');
const nameInput  = document.getElementById('name-input');
const wishInput  = document.getElementById('wish-input');
const charCount  = document.getElementById('char-count');
const nameError  = document.getElementById('name-error');
const wishError  = document.getElementById('wish-error');
const submitBtn  = document.getElementById('submit-btn');
const formCard   = document.getElementById('form-card');
const successCard = document.getElementById('success-card');
const againBtn   = document.getElementById('again-btn');

// ── Floating particles BG ─────────────────────────────────────────
(function initParticles() {
  const container = document.getElementById('particles');
  function spawn() {
    const el = document.createElement('div');
    el.className = 'particle';
    const size = Math.random() * 4 + 1.5;
    const dur  = Math.random() * 10 + 8;
    const dx   = (Math.random() - 0.5) * 80;
    el.style.cssText = `
      left:${Math.random() * 100}%;
      bottom:-20px;
      width:${size}px; height:${size}px;
      --dx:${dx}px;
      animation-duration:${dur}s;
      animation-delay:${Math.random() * 6}s;
    `;
    container.appendChild(el);
    setTimeout(() => el.remove(), (dur + 6) * 1000);
  }
  for (let i = 0; i < 20; i++) spawn();
  setInterval(spawn, 1000);
})();

// ── Character counter ─────────────────────────────────────────────
wishInput.addEventListener('input', () => {
  const len = wishInput.value.length;
  charCount.textContent = `${len} / 200`;
  charCount.classList.toggle('near-limit', len >= 160 && len < 200);
  charCount.classList.toggle('at-limit',   len >= 200);
  if (len > 0) clearError(wishInput, wishError);
});

// Clear error on typing
nameInput.addEventListener('input', () => {
  if (nameInput.value.trim()) clearError(nameInput, nameError);
});

function showError(input, errorEl, msg) {
  input.classList.add('invalid');
  errorEl.textContent = msg;
}

function clearError(input, errorEl) {
  input.classList.remove('invalid');
  errorEl.textContent = '';
}

// ── Ripple effect on button ───────────────────────────────────────
submitBtn.addEventListener('click', (e) => {
  const rect = submitBtn.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  const size = Math.max(rect.width, rect.height) * 2;
  ripple.style.cssText = `width:${size}px; height:${size}px; left:${x - size/2}px; top:${y - size/2}px;`;
  submitBtn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
});

// ── Form Submission ───────────────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name    = nameInput.value.trim();
  const content = wishInput.value.trim();
  let valid = true;

  // Validate name
  if (!name) {
    showError(nameInput, nameError, '請填寫您的姓名或暱稱');
    valid = false;
  } else if (name.length > 30) {
    showError(nameInput, nameError, '姓名不可超過 30 字');
    valid = false;
  } else {
    clearError(nameInput, nameError);
  }

  // Validate wish
  if (!content) {
    showError(wishInput, wishError, '請寫下您的心願');
    valid = false;
  } else if (content.length > 200) {
    showError(wishInput, wishError, '心願不可超過 200 字');
    valid = false;
  } else {
    clearError(wishInput, wishError);
  }

  if (!valid) return;

  // Set loading state
  submitBtn.disabled = true;
  submitBtn.classList.add('loading');

  try {
    const res = await fetch('/api/wishes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, content })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || '送出失敗，請再試一次');
    }

    // Show success screen
    showSuccess();

  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.classList.remove('loading');
    showError(wishInput, wishError, err.message || '網路錯誤，請稍後再試');
  }
});

// ── Success screen ────────────────────────────────────────────────
function showSuccess() {
  formCard.classList.add('hidden');
  successCard.classList.remove('hidden');
  launchSuccessLanterns();
}

function launchSuccessLanterns() {
  const container = document.getElementById('success-lanterns');
  container.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.textContent = '🏮';
      const startX = Math.random() * 100;
      const dx = (Math.random() - 0.5) * 60;
      el.style.cssText = `
        position:absolute;
        bottom:-20px;
        left:${startX}%;
        font-size:${1.2 + Math.random() * 1.2}rem;
        animation: particle-float ${5 + Math.random() * 3}s ease-out forwards;
        --dx:${dx}px;
        opacity:0;
        filter: drop-shadow(0 0 8px rgba(255,140,0,0.8));
      `;
      container.appendChild(el);
      setTimeout(() => el.remove(), 9000);
    }, i * 250);
  }
}

// ── Again button ──────────────────────────────────────────────────
againBtn.addEventListener('click', () => {
  // Reset form
  form.reset();
  charCount.textContent = '0 / 200';
  charCount.classList.remove('near-limit', 'at-limit');
  clearError(nameInput, nameError);
  clearError(wishInput, wishError);
  submitBtn.disabled = false;
  submitBtn.classList.remove('loading');

  successCard.classList.add('hidden');
  formCard.classList.remove('hidden');

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
