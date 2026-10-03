/* WGAAB motion studies. Original Canvas implementations inspired by the
   requested interaction concepts; these are not installed OriginKit sources.
   OriginKit CLI requires authentication before delivering those components. */
const root = document.documentElement;
const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
let reduced = reduceQuery.matches;
const scenes = [];
const motionButton = document.querySelector('#motion-toggle');
function setMotion(value) {
  reduced = value;
  root.classList.toggle('motion-off', value);
  motionButton.setAttribute('aria-pressed', String(value));
  motionButton.textContent = value ? 'Movimento reduzido' : 'Reduzir movimento';
  scenes.forEach(scene => scene.reset());
}
motionButton.addEventListener('click', () => setMotion(!reduced));
reduceQuery.addEventListener?.('change', event => setMotion(event.matches));
setMotion(reduced);
if ('IntersectionObserver' in window) {
  root.classList.add('motion-ready');
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
}

// A shared scheduler runs only for visible, changing scenes. No scroll loop.
class MotionField {
  constructor(canvas, kind) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.kind = kind;
    this.width = 1;
    this.height = 1;
    this.current = { x: 0, y: 0, angle: 0 };
    this.target = { x: 0, y: 0, angle: 0 };
    this.goal = 0;
    this.frame = 0;
    this.visible = true;
    this.inside = false;
    this.lastTime = 0;
    this.previousPointer = null;
    if (!this.ctx) return;
    this.canvas.addEventListener('pointermove', event => this.pointer(event), { passive: true });
    this.canvas.addEventListener('pointerleave', () => this.leave(), { passive: true });
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas.parentElement);
    } else window.addEventListener('resize', () => this.resize(), { passive: true });
    if ('IntersectionObserver' in window) {
      this.visibilityObserver = new IntersectionObserver(entries => {
        this.visible = entries[0].isIntersecting;
        if (this.visible) this.wake(); else this.stop();
      });
      this.visibilityObserver.observe(canvas);
    }
    this.resize();
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.round(this.width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.draw();
  }
  pointer(event) {
    if (reduced || !finePointer.matches || event.pointerType === 'touch') return;
    const bounds = this.canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / this.width - 0.5;
    const y = (event.clientY - bounds.top) / this.height - 0.5;
    const now = performance.now();
    const dt = this.previousPointer ? Math.max(12, now - this.previousPointer.time) : 16;
    const velocityX = this.previousPointer ? (x - this.previousPointer.x) / dt : 0;
    const velocityY = this.previousPointer ? (y - this.previousPointer.y) / dt : 0;
    const lead = this.kind === 'arc' ? 90 : 0;
    this.target.x = Math.max(-0.65, Math.min(0.65, x + velocityX * lead));
    this.target.y = Math.max(-0.65, Math.min(0.65, y + velocityY * lead));
    this.target.angle = this.goal * 0.72 + x * 0.45;
    this.previousPointer = { x, y, time: now };
    this.inside = true;
    this.wake();
  }
  leave() {
    this.inside = false;
    this.previousPointer = null;
    this.target.x = 0;
    this.target.y = 0;
    this.target.angle = this.goal * 0.72;
    this.wake();
  }
  select(index) {
    this.goal = index;
    this.target.angle = index * 0.72;
    if (reduced) { this.current.angle = this.target.angle; this.draw(); }
    else this.wake();
  }
  reset() {
    this.stop();
    this.inside = false;
    this.target = { x: 0, y: 0, angle: this.goal * 0.72 };
    this.current = { ...this.target };
    this.draw();
  }
  stop() { cancelAnimationFrame(this.frame); this.frame = 0; this.lastTime = 0; }
  wake() {
    if (!this.ctx || this.frame || !this.visible || document.hidden) return;
    if (reduced) { this.current = { ...this.target }; this.draw(); return; }
    this.frame = requestAnimationFrame(time => this.tick(time));
  }
  tick(time) {
    this.frame = 0;
    if (!this.visible || document.hidden || reduced) return;
    const elapsed = this.lastTime ? Math.min(time - this.lastTime, 50) : 16.67;
    this.lastTime = time;
    const ease = 1 - Math.exp(-elapsed / 125);
    let distance = 0;
    for (const key of ['x', 'y', 'angle']) {
      const delta = this.target[key] - this.current[key];
      this.current[key] += delta * ease;
      distance += Math.abs(delta);
    }
    this.draw();
    if (distance > 0.0005) this.wake();
    else this.lastTime = 0;
  }
  draw() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.width, h = this.height;
    ctx.clearRect(0, 0, w, h);
    if (this.kind === 'ring') this.rings(ctx, w, h);
    else this.arcs(ctx, w, h);
  }
  rings(ctx, w, h) {
    const spread = Math.min(w * 0.39, h * 0.91);
    const { x, y } = this.current;
    for (let i = 0; i < 11; i++) {
      const factor = i / 10;
      const cx = w * 0.5 + x * 65 * factor;
      const cy = h * 0.48 + y * 34 * factor;
      const rx = Math.max(2, spread * (0.3 + factor * 0.72));
      const ry = Math.max(2, Math.min(h * 0.39, w * 0.24) * (0.25 + factor * 0.75));
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, -0.38 + x * 0.18 + factor * 0.07, 0, Math.PI * 2);
      ctx.strokeStyle = i % 4 === 0 ? 'rgba(196,250,87,0.72)' : 'rgba(156,175,127,0.28)';
      ctx.lineWidth = i === 10 ? 1.2 : 0.8;
      ctx.stroke();
    }
  }
  arcs(ctx, w, h) {
    const radius = Math.min(w, h) * 0.43;
    const cx = w / 2 + this.current.x * 18;
    const cy = h / 2 + this.current.y * 16;
    // Small ticks give the geometry a training-instrument character.
    for (let i = 0; i < 72; i++) {
      const angle = i / 72 * Math.PI * 2;
      const inner = radius + (i % 6 === 0 ? 8 : 13);
      ctx.beginPath();ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
      ctx.lineTo(cx + Math.cos(angle) * (radius + 17), cy + Math.sin(angle) * (radius + 17));
      ctx.strokeStyle = i % 6 === 0 ? '#768665' : '#394330';ctx.lineWidth = 1;ctx.stroke();
    }
    for (let i = 0; i < 9; i++) {
      const r = Math.max(6, radius - i * 7);
      const start = this.current.angle + i * 0.115 - 1.8;
      const end = start + Math.PI * (1.18 + i * 0.035);
      ctx.beginPath();ctx.arc(cx, cy, r, start, end);
      ctx.strokeStyle = i % 3 === 0 ? '#c4fa57' : `rgba(196,250,87,${0.17 + i * 0.045})`;
      ctx.lineWidth = i % 3 === 0 ? 1.6 : 1;ctx.stroke();
      if (i === 0) {
        ctx.beginPath();ctx.arc(cx + Math.cos(end) * r, cy + Math.sin(end) * r, 3.5, 0, Math.PI * 2);ctx.fillStyle = '#c4fa57';ctx.fill();
      }
    }
  }
}
const ringField = new MotionField(document.querySelector('#ring-field'), 'ring');
const arcField = new MotionField(document.querySelector('#predictive-arc'), 'arc');
scenes.push(ringField, arcField);
document.addEventListener('visibilitychange', () => scenes.forEach(scene => document.hidden ? scene.stop() : scene.wake()));
finePointer.addEventListener?.('change', () => scenes.forEach(scene => scene.reset()));
const goals = {
  forca: { index: 0, number: '01', label: 'CONSTRUIR FORÇA', text: 'ganhar força' },
  folego: { index: 1, number: '02', label: 'GANHAR DISPOSIÇÃO', text: 'melhorar meu condicionamento' },
  rotina: { index: 2, number: '03', label: 'CRIAR CONSTÂNCIA', text: 'criar uma rotina de treino' }
};
const copyButton = document.querySelector('#copy-message');
const copyStatus = document.querySelector('#copy-status');
document.querySelectorAll('.goal-option').forEach(button => button.addEventListener('click', () => {
  const goal = goals[button.dataset.goal];
  document.querySelectorAll('.goal-option').forEach(option => {
    const selected = option === button;
    option.classList.toggle('selected', selected);
    option.setAttribute('aria-pressed', String(selected));
    option.querySelector('.option-symbol').textContent = selected ? '−' : '+';
  });
  document.querySelector('#arc-number').textContent = goal.number;
  document.querySelector('#arc-label').textContent = goal.label;
  document.querySelector('#message').textContent = `Oi! Conheci seu trabalho pelo site. Quero ${goal.text} e gostaria de saber como funciona o seu atendimento.`;
  copyButton.firstChild.textContent = 'Copiar mensagem ';
  copyStatus.textContent = 'EDITE DO SEU JEITO AO ENVIAR.';
  arcField.select(goal.index);
}));
copyButton.addEventListener('click', async () => {
  try {
    if (!navigator.clipboard) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(document.querySelector('#message').textContent);
    copyButton.firstChild.textContent = 'Mensagem copiada ';
    copyStatus.textContent = 'AGORA É SÓ COLAR NO DIRECT DO INSTAGRAM.';
  } catch {
    const range = document.createRange();range.selectNodeContents(document.querySelector('#message'));
    const selection = getSelection();selection.removeAllRanges();selection.addRange(range);
    copyStatus.textContent = 'COPIE O TEXTO SELECIONADO E COLE NO DIRECT.';
  }
});
document.querySelectorAll('details').forEach(detail => detail.addEventListener('toggle', () => {
  if (detail.open) document.querySelectorAll('details').forEach(other => { if (other !== detail) other.open = false; });
}));
