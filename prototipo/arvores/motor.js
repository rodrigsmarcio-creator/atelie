/* Motor de desenho das Árvores (ATL-57): um único <canvas>, zoom e arrasto, teclado, busca por vizinho e
   desenho só do que está na tela. Cada variante entrega os nós, as ligações e as funções de desenho.
   Nada de DOM por Ofício: com 6000 Ofícios a página continua com poucas dezenas de elementos. */
(function () {
  'use strict';
  const A = window.Atl;

  /* ----- Cores: lidas dos tokens da paleta ativa (o canvas não enxerga var(--x)) ----- */
  const hex = (c) => {
    const m = /^#([0-9a-f]{6})$/i.exec(String(c).trim());
    if (!m) return null;
    const n = Number.parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  A.rgba = (c, a) => { const h = hex(c); return h ? `rgba(${h[0]},${h[1]},${h[2]},${a})` : c; };
  A.mix = (c1, c2, t) => {
    const a = hex(c1), b = hex(c2);
    if (!a || !b) return c1;
    return `rgb(${a.map((x, i) => Math.round(x * t + b[i] * (1 - t))).join(',')})`;
  };
  A.cores = function () {
    const s = getComputedStyle(document.documentElement);
    const g = (n) => s.getPropertyValue(n).trim();
    const c = { bg: g('--bg'), surface: g('--surface'), surface2: g('--surface-2'), line: g('--line'), text: g('--text'), muted: g('--muted'),
      accent: g('--accent'), onAccent: g('--on-accent'), hot: g('--hot'), hot2: g('--hot-2'), xp: g('--xp'), ok: g('--ok'), bad: g('--bad'),
      halo: g('--halo'), glow: g('--glow'), hairline: g('--hairline'), fTitle: g('--f-title'), fText: g('--f-text'), mat: {} };
    A.MATERIAS.forEach((m) => { c.mat[m.id] = g(m.cor); });
    return c;
  };
  /* Estilo do disco por estado e matéria (o estado aparece na forma, não só na cor). */
  A.estilos = function (c) {
    const out = {};
    ['Bloqueado', 'Disponível', 'Em prática', 'Liberado', 'Dominado'].forEach((est) => {
      out[est] = {};
      A.MATERIAS.forEach((m) => {
        const cor = c.mat[m.id];
        out[est][m.id] = est === 'Bloqueado' ? { fill: c.surface, stroke: c.muted, lw: 2, dash: true, cor }
          : est === 'Disponível' ? { fill: c.surface, stroke: cor, lw: 2, cor }
          : est === 'Em prática' ? { fill: c.surface2, stroke: cor, lw: 3, cor }
          : est === 'Liberado' ? { fill: A.mix(cor, c.surface, 0.3), stroke: cor, lw: 3, cor }
          : { fill: cor, stroke: cor, lw: 3, cor, aro: true };
      });
    });
    return out;
  };
  const TAU = Math.PI * 2;

  /* ----- Motor ----- */
  /* cfg: canvas, kMax, kFoco, fundo(ctx,v), ligacoes(ctx,lista,v), nos(ctx,lista,v), rotulos(ctx,lista,v), aoEscolher(no) */
  A.palco = function (cfg) {
    const canvas = cfg.canvas, ctx = canvas.getContext('2d');
    const v = { cx: 0, cy: 0, k: 1, W: 1, H: 1, dpr: 1, hover: null, sel: null, foco: null, c: A.cores(), nos: [], ligs: [],
      lim: { x0: -1, y0: -1, x1: 1, y1: 1 }, kMin: 0.01, kMax: cfg.kMax || 4, fit: { k: 1, cx: 0, cy: 0 }, stats: { ms: 0, pior: 0, vis: 0, lig: 0 } };
    let grade = new Map(), celula = 100, maxR = 10, adj = new Map(), porId = new Map(), agendado = false, mexeu = false;
    const tempos = [];
    const chave = (ix, iy) => (ix + 32768) * 65536 + (iy + 32768);

    v.sx = (x) => (x - v.cx) * v.k + v.W / 2;
    v.sy = (y) => (y - v.cy) * v.k + v.H / 2;
    v.wx = (sx) => (sx - v.W / 2) / v.k + v.cx;
    v.wy = (sy) => (sy - v.H / 2) / v.k + v.cy;
    /* Aplica a transformação do mundo (use entre ctx.save() e ctx.restore()). */
    v.mundo = (g) => { g.translate(v.W / 2 - v.cx * v.k, v.H / 2 - v.cy * v.k); g.scale(v.k, v.k); };
    v.porId = (id) => porId.get(id);
    v.vizinhos = (n) => adj.get(n) || [];

    /* nos: {id, o, x, y, r, ...}. ligs: {a, b, tipo, extra} com a e b sendo nós. lim: caixa do desenho. */
    v.setDados = function (nos, ligs, lim, manterVista) {
      v.nos = nos; v.ligs = ligs; v.lim = lim;
      porId = new Map(nos.map((n) => [n.id, n]));
      adj = new Map(nos.map((n) => [n, []]));
      ligs.forEach((l) => { adj.get(l.a).push(l.b); adj.get(l.b).push(l.a); });
      maxR = nos.reduce((m, n) => Math.max(m, n.r), 10);
      const area = Math.max(1, (lim.x1 - lim.x0) * (lim.y1 - lim.y0));
      celula = Math.max(40, Math.sqrt(area / Math.max(1, nos.length)) * 3);
      grade = new Map();
      nos.forEach((n) => {
        const k = chave(Math.floor(n.x / celula), Math.floor(n.y / celula));
        const l = grade.get(k);
        if (l) l.push(n); else grade.set(k, [n]);
      });
      v.sel = v.sel ? porId.get(v.sel.id) || null : null;
      v.foco = v.foco ? porId.get(v.foco.id) || null : null;
      v.hover = null;
      if (manterVista) pedir(); else v.ajustar();
    };

    function visiveis(x0, y0, x1, y1) {
      x0 -= maxR; y0 -= maxR; x1 += maxR; y1 += maxR;
      const ix0 = Math.floor(x0 / celula), ix1 = Math.floor(x1 / celula), iy0 = Math.floor(y0 / celula), iy1 = Math.floor(y1 / celula);
      const out = [];
      if ((ix1 - ix0 + 1) * (iy1 - iy0 + 1) > v.nos.length) {
        for (const n of v.nos) if (n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1) out.push(n);
        return out;
      }
      for (let ix = ix0; ix <= ix1; ix++) {
        for (let iy = iy0; iy <= iy1; iy++) {
          const c = grade.get(chave(ix, iy));
          if (c) for (const n of c) out.push(n);
        }
      }
      return out;
    }
    function ligsVisiveis(x0, y0, x1, y1) {
      const out = [];
      for (const l of v.ligs) {
        const a = l.a, b = l.b;
        if ((a.x < x0 && b.x < x0) || (a.x > x1 && b.x > x1) || (a.y < y0 && b.y < y0) || (a.y > y1 && b.y > y1)) continue;
        out.push(l);
      }
      return out;
    }
    function achar(sx, sy, tolPx) {
      const wx = v.wx(sx), wy = v.wy(sy), tol = tolPx / v.k, R = maxR + tol;
      let melhor = null, md = Infinity;
      for (const n of visiveis(wx - R, wy - R, wx + R, wy + R)) {
        const d = Math.hypot(n.x - wx, n.y - wy);
        if (d <= n.r * (n.hit || 1) + tol && d < md) { md = d; melhor = n; }
      }
      return melhor;
    }

    /* ----- Vista ----- */
    function limitar() {
      v.cx = Math.min(v.lim.x1, Math.max(v.lim.x0, v.cx));
      v.cy = Math.min(v.lim.y1, Math.max(v.lim.y0, v.cy));
    }
    v.ajustar = function () {
      const w = Math.max(1, v.lim.x1 - v.lim.x0), h = Math.max(1, v.lim.y1 - v.lim.y0);
      const k = Math.min(v.W / w, v.H / h) * 0.92;
      v.fit = { k, cx: (v.lim.x0 + v.lim.x1) / 2, cy: (v.lim.y0 + v.lim.y1) / 2 };
      v.k = k; v.cx = v.fit.cx; v.cy = v.fit.cy;
      v.kMin = k * 0.5; v.kMax = Math.max(cfg.kMax || 4, k * 6);
      mexeu = false;
      pedir();
    };
    v.zoomar = function (f, sx = v.W / 2, sy = v.H / 2) {
      const wx = v.wx(sx), wy = v.wy(sy);
      v.k = Math.min(v.kMax, Math.max(v.kMin, v.k * f));
      v.cx = wx - (sx - v.W / 2) / v.k; v.cy = wy - (sy - v.H / 2) / v.k;
      mexeu = true; limitar(); pedir();
    };
    v.mover = function (dx, dy) { v.cx -= dx / v.k; v.cy -= dy / v.k; mexeu = true; limitar(); pedir(); };
    v.irPara = function (n, kMin) {
      v.cx = n.x; v.cy = n.y;
      v.k = Math.min(v.kMax, Math.max(v.k, kMin || cfg.kFoco || 1.4));
      mexeu = true; pedir();
    };
    v.escolher = function (n, centrar) {
      v.sel = n; v.foco = n;
      if (n && centrar) v.irPara(n);
      if (cfg.aoEscolher) cfg.aoEscolher(n);
      if (n) A.anunciar(resumo(n));
      pedir();
    };
    const resumo = (n) => {
      const i = A.info.get(n.o.id);
      return `${n.o.nome}: ${i.est}, ${i.prov} de ${i.total} dimensões provadas${i.revisar ? ', precisa revisar' : ''}`;
    };

    /* ----- Desenho ----- */
    function pedir() {
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(() => { agendado = false; desenhar(); });
    }
    v.pedir = pedir;
    function anel(n, tipo) {
      const x = v.sx(n.x), y = v.sy(n.y), r = Math.max(8, n.r * v.k) + (tipo === 'foco' ? 8 : 5);
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
      ctx.lineWidth = tipo === 'foco' ? 3 : 2.5; ctx.strokeStyle = v.c.text;
      ctx.setLineDash(tipo === 'foco' ? [6, 4] : []); ctx.stroke(); ctx.setLineDash([]);
    }
    function etiqueta(n) {
      const i = A.info.get(n.o.id);
      const t1 = n.o.nome, t2 = `${A.matDe(n.o.mat).nome} · ${i.est} · ${i.prov}/${i.total}${i.revisar ? ' · revisar' : ''}`;
      ctx.font = `700 13px ${v.c.fText}`; const w1 = ctx.measureText(t1).width;
      ctx.font = `500 11px ${v.c.fText}`; const w2 = ctx.measureText(t2).width;
      const w = Math.max(w1, w2) + 24, h = 46, sx = v.sx(n.x), sy = v.sy(n.y), rr = Math.max(8, n.r * v.k);
      let x = Math.min(v.W - w - 6, Math.max(6, sx - w / 2)), y = sy - rr - 16 - h;
      if (y < 6) y = sy + rr + 16;
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 10);
      ctx.fillStyle = v.c.surface2; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = v.c.hairline; ctx.stroke();
      ctx.fillStyle = v.c.text; ctx.font = `700 13px ${v.c.fText}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(t1, x + 12, y + 20);
      ctx.fillStyle = v.c.muted; ctx.font = `500 11px ${v.c.fText}`; ctx.fillText(t2, x + 12, y + 36);
    }
    function desenhar() {
      const t0 = performance.now();
      ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
      ctx.clearRect(0, 0, v.W, v.H);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (cfg.fundo) cfg.fundo(ctx, v);
      const x0 = v.cx - v.W / 2 / v.k, x1 = v.cx + v.W / 2 / v.k, y0 = v.cy - v.H / 2 / v.k, y1 = v.cy + v.H / 2 / v.k;
      const m = 30 / v.k;
      const nos = visiveis(x0 - m, y0 - m, x1 + m, y1 + m);
      const ligs = ligsVisiveis(x0 - m, y0 - m, x1 + m, y1 + m);
      ctx.save(); v.mundo(ctx);
      cfg.ligacoes(ctx, ligs, v);
      cfg.nos(ctx, nos, v);
      ctx.restore();
      if (cfg.rotulos) cfg.rotulos(ctx, nos, v);
      const marcados = new Set();
      if (v.sel) { anel(v.sel, 'sel'); marcados.add(v.sel); }
      if (v.foco && v.foco !== v.sel && document.activeElement === canvas) { anel(v.foco, 'foco'); marcados.add(v.foco); }
      if (v.hover) marcados.add(v.hover);
      marcados.forEach((n) => etiqueta(n));
      const ms = performance.now() - t0;
      tempos.push(ms); if (tempos.length > 60) tempos.shift();
      v.stats = { ms, pior: Math.max(...tempos), vis: nos.length, lig: ligs.length };
    }

    /* ----- Tamanho ----- */
    function medir() {
      const r = canvas.getBoundingClientRect();
      v.dpr = Math.min(2, window.devicePixelRatio || 1);
      v.W = Math.max(1, Math.round(r.width)); v.H = Math.max(1, Math.round(r.height));
      canvas.width = Math.round(v.W * v.dpr); canvas.height = Math.round(v.H * v.dpr);
      if (!mexeu && v.nos.length) v.ajustar(); else pedir();
    }
    new ResizeObserver(medir).observe(canvas);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(pedir);
    v.tema = () => { v.c = A.cores(); pedir(); };

    /* ----- Mouse, toque e roda ----- */
    const ponteiros = new Map();
    let arrasto = 0, pinca = 0, inicio = null;
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      ponteiros.set(e.pointerId, pos(e));
      if (ponteiros.size === 1) { arrasto = 0; inicio = pos(e); }
      if (ponteiros.size === 2) { const [a, b] = [...ponteiros.values()]; pinca = Math.hypot(a.x - b.x, a.y - b.y); arrasto = 99; }
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = pos(e);
      if (!ponteiros.has(e.pointerId)) {
        if (e.pointerType === 'mouse') {
          const n = achar(p.x, p.y, 8);
          if (n !== v.hover) { v.hover = n; canvas.classList.toggle('sobre', Boolean(n)); pedir(); }
        }
        return;
      }
      const ant = ponteiros.get(e.pointerId);
      ponteiros.set(e.pointerId, p);
      if (ponteiros.size === 2) {
        const [a, b] = [...ponteiros.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinca > 0) v.zoomar(d / pinca, (a.x + b.x) / 2, (a.y + b.y) / 2);
        pinca = d;
        v.mover((p.x - ant.x) / 2, (p.y - ant.y) / 2);
        return;
      }
      arrasto += Math.abs(p.x - ant.x) + Math.abs(p.y - ant.y);
      if (arrasto > 6) { canvas.classList.add('arrastando'); v.mover(p.x - ant.x, p.y - ant.y); }
    });
    const soltar = (e) => {
      const clique = ponteiros.size === 1 && arrasto <= 6 && e.type === 'pointerup';
      ponteiros.delete(e.pointerId);
      if (ponteiros.size === 0) { canvas.classList.remove('arrastando'); pinca = 0; }
      if (clique && inicio) {
        const n = achar(inicio.x, inicio.y, e.pointerType === 'touch' ? 18 : 8);
        v.escolher(n || null, false);
        canvas.focus({ preventScroll: true });
      }
    };
    canvas.addEventListener('pointerup', soltar);
    canvas.addEventListener('pointercancel', soltar);
    canvas.addEventListener('pointerleave', () => { if (v.hover) { v.hover = null; canvas.classList.remove('sobre'); pedir(); } });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = pos(e);
      v.zoomar(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), p.x, p.y);
    }, { passive: false });
    canvas.addEventListener('dblclick', (e) => { const p = pos(e); v.zoomar(2, p.x, p.y); });

    /* ----- Teclado: setas andam pelos vizinhos, Enter escolhe, +/- zoom, 0 ajusta, Esc limpa ----- */
    function vizinho(a, dx, dy) {
      const R = celula * 3, cand = new Set(adj.get(a));
      visiveis(a.x - R, a.y - R, a.x + R, a.y + R).forEach((n) => cand.add(n));
      cand.delete(a);
      let melhor = null, ms = -Infinity;
      const lig = new Set(adj.get(a));
      cand.forEach((n) => {
        const vx = n.x - a.x, vy = n.y - a.y, d = Math.hypot(vx, vy) || 1, cos = (vx * dx + vy * dy) / d;
        if (cos < 0.35) return;
        const s = cos * 2 - d / R + (lig.has(n) ? 1.5 : 0);
        if (s > ms) { ms = s; melhor = n; }
      });
      return melhor;
    }
    function garantir(n) {
      const x = v.sx(n.x), y = v.sy(n.y);
      if (x < 70 || x > v.W - 70 || y < 70 || y > v.H - 70) { v.cx = n.x; v.cy = n.y; mexeu = true; }
    }
    canvas.addEventListener('keydown', (e) => {
      const setas = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (setas[e.key]) {
        e.preventDefault();
        if (e.shiftKey) { v.mover(-setas[e.key][0] * 80, -setas[e.key][1] * 80); return; }
        if (!v.foco) {
          const c = achar(v.W / 2, v.H / 2, 400) || v.nos[0];
          if (c) { v.foco = c; garantir(c); A.anunciar(resumo(c)); pedir(); }
          return;
        }
        const n = vizinho(v.foco, ...setas[e.key]);
        if (n) { v.foco = n; garantir(n); A.anunciar(resumo(n)); pedir(); }
      } else if ((e.key === 'Enter' || e.key === ' ') && v.foco) { e.preventDefault(); v.escolher(v.foco, false); }
      else if (e.key === '+' || e.key === '=') v.zoomar(1.3);
      else if (e.key === '-' || e.key === '_') v.zoomar(1 / 1.3);
      else if (e.key === '0') v.ajustar();
      else if (e.key === 'Escape') { v.foco = null; v.escolher(null, false); }
    });
    canvas.addEventListener('focus', pedir);
    canvas.addEventListener('blur', pedir);

    medir();
    return v;
  };
})();
