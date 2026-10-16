// Angle grinder: ลากได้ + physics (แรงโน้มถ่วง/ชน/เด้ง) + ประกายไฟ + เสียงเครื่อง
(() => {
  const el = document.getElementById('grinder');
  const cv = document.getElementById('sparks');
  const ctx = cv.getContext('2d');
  const snd = document.getElementById('grinderSound');

  // จุดที่ใบเจียร์สัมผัส (สัดส่วนของรูป) = จุดที่ประกายไฟออก
  const DISC = { x: 0.05, y: 0.78 };
  const G = 2200;          // แรงโน้มถ่วง px/s^2
  const BOUNCE = 0.35;     // ความเด้ง
  const FRICTION = 0.4;
  const MASS = 1;

  let W, H, w, h, I;
  const b = { x: 0, y: 0, a: 0, vx: 0, vy: 0, w: 0 }; // x,y = จุดศูนย์กลาง
  const drag = { on: false, id: null, lx: 0, ly: 0, px: 0, py: 0 };
  let sparks = [];

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    w = el.offsetWidth; h = el.offsetHeight;
    I = MASS * (w * w + h * h) / 12;
  }

  function spawn() {
    resize();
    b.x = w / 2; b.y = H - h / 2; b.a = 0; b.vx = b.vy = b.w = 0; // มุมซ้ายล่าง
  }

  const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  const corners = () => [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([x,y]) => rot(x, y, b.a));

  // ---- จับ/ลาก ----
  el.addEventListener('pointerdown', e => {
    el.setPointerCapture(e.pointerId);
    drag.on = true; drag.id = e.pointerId;
    // จุดที่จับ (พิกัด local)
    const [lx, ly] = rot(e.clientX - b.x, e.clientY - b.y, -b.a);
    drag.lx = lx; drag.ly = ly; drag.px = e.clientX; drag.py = e.clientY;
    el.classList.add('dragging');
    snd.currentTime = 0; snd.volume = 1;
    snd.play().catch(() => {});
  });
  el.addEventListener('pointermove', e => {
    if (drag.on && e.pointerId === drag.id) { drag.px = e.clientX; drag.py = e.clientY; }
  });
  const release = e => {
    if (!drag.on || e.pointerId !== drag.id) return;
    drag.on = false;
    el.classList.remove('dragging');
    snd.pause();
  };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);

  // ---- physics ----
  function step(dt) {
    let fx = 0, fy = MASS * G, torque = 0;

    if (drag.on) {
      // สปริงดึงจุดที่จับไปหาเมาส์ → แกว่งตามธรรมชาติ
      const [rx, ry] = rot(drag.lx, drag.ly, b.a);
      const vx = b.vx - b.w * ry, vy = b.vy + b.w * rx;
      const k = 900, c = 38;
      const sx = k * (drag.px - (b.x + rx)) - c * vx;
      const sy = k * (drag.py - (b.y + ry)) - c * vy;
      fx += sx; fy += sy;
      torque += rx * sy - ry * sx;
      b.w *= 0.985; // หน่วงการหมุนเล็กน้อย
    }

    b.vx += fx / MASS * dt; b.vy += fy / MASS * dt; b.w += torque / I * dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.w * dt;

    // ชนขอบจอ (พื้น/ผนัง/เพดาน)
    for (let it = 0; it < 3; it++) {
      for (const [cx, cy] of corners()) {
        const px = b.x + cx, py = b.y + cy;
        let n = null, pen = 0;
        if (py > H) { n = [0, -1]; pen = py - H; }
        else if (py < 0) { n = [0, 1]; pen = -py; }
        else if (px < 0) { n = [1, 0]; pen = -px; }
        else if (px > W) { n = [-1, 0]; pen = px - W; }
        if (!n) continue;
        b.x += n[0] * pen; b.y += n[1] * pen;
        const vx = b.vx - b.w * cy, vy = b.vy + b.w * cx;
        const vn = vx * n[0] + vy * n[1];
        if (vn >= 0) continue;
        const rn = cx * n[1] - cy * n[0];
        const j = -(1 + BOUNCE) * vn / (1 / MASS + rn * rn / I);
        b.vx += j * n[0] / MASS; b.vy += j * n[1] / MASS; b.w += rn * j / I;
        // แรงเสียดทาน
        const t = [-n[1], n[0]];
        const vt = vx * t[0] + vy * t[1];
        const rt = cx * t[1] - cy * t[0];
        const jt = Math.max(-FRICTION * j, Math.min(FRICTION * j, -vt / (1 / MASS + rt * rt / I)));
        b.vx += jt * t[0] / MASS; b.vy += jt * t[1] / MASS; b.w += rt * jt / I;
      }
    }
    // หน่วงเมื่อนิ่ง
    if (!drag.on) { b.vx *= 0.9995; b.w *= 0.998; if (Math.hypot(b.vx, b.vy) < 6 && Math.abs(b.w) < 0.05) { b.vx = b.vy = b.w = 0; } }
  }

  // ---- ประกายไฟ ----
  function emit(dt, speed) {
    const [dx, dy] = rot(-w/2 + DISC.x * w, -h/2 + DISC.y * h, b.a);
    const ox = b.x + dx, oy = b.y + dy;
    const n = Math.round((60 + Math.min(speed, 1200) * 0.08) * dt * 3);
    for (let i = 0; i < n; i++) {
      // ปล่อยไปทางซ้าย/ล่างของใบเจียร์ + สุ่ม + ส่งต่อความเร็วเครื่อง
      const ang = b.a + Math.PI * (0.55 + Math.random() * 0.9);
      const sp = 250 + Math.random() * 550;
      sparks.push({
        x: ox, y: oy,
        vx: Math.cos(ang) * sp + b.vx * 0.3,
        vy: Math.sin(ang) * sp - 150 + b.vy * 0.3,
        life: 0, max: 0.35 + Math.random() * 0.55,
        s: 1 + Math.random() * 1.6
      });
    }
  }

  function drawSparks(dt) {
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';
    sparks = sparks.filter(p => (p.life += dt) < p.max);
    for (const p of sparks) {
      const px = p.x, py = p.y;
      p.vy += 1400 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.y > H) { p.y = H; p.vy *= -0.3; p.vx *= 0.6; }
      const t = p.life / p.max;
      ctx.strokeStyle = `rgba(255,${Math.round(220 - 140 * t)},${Math.round(120 - 100 * t)},${1 - t})`;
      ctx.lineWidth = p.s * (1 - t * 0.5);
      ctx.beginPath(); ctx.moveTo(px - p.vx * 0.02, py - p.vy * 0.02); ctx.lineTo(p.x, p.y); ctx.stroke();
    }
  }

  // ---- loop ----
  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.033); last = now;
    const sub = 4;
    for (let i = 0; i < sub; i++) step(dt / sub);

    let jx = 0, jy = 0;
    if (drag.on) { // สั่นเบาๆ ตอนเครื่องทำงาน
      jx = (Math.random() - 0.5) * 3; jy = (Math.random() - 0.5) * 3;
      emit(dt, Math.hypot(b.vx, b.vy));
    }
    el.style.transform =
      `translate(${b.x - w / 2 + jx}px, ${b.y - h / 2 + jy}px) rotate(${b.a}rad)`;
    drawSparks(dt);
    requestAnimationFrame(frame);
  }

  addEventListener('resize', () => { resize(); b.x = Math.min(Math.max(b.x, 0), W); b.y = Math.min(b.y, H); });
  const start = () => { spawn(); requestAnimationFrame(frame); };
  el.complete && el.naturalWidth ? start() : el.addEventListener('load', start);
})();
