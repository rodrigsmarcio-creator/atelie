/* Casca comum das Árvores (ATL-57): topo com as variantes, busca, paleta, volume, legenda, controles e card de detalhe.
   Cada variante só entrega o desenho. A paleta vem de ?tema=tokyo|borgonha|verde (padrão: borgonha). */
(function () {
  'use strict';
  const A = window.Atl;
  const $ = (s, r = document) => r.querySelector(s);

  A.VARIANTES = [
    { id: 'atlas', arq: 'atlas.html', nome: 'Atlas', ref: 'Path of Exile 2' },
    { id: 'troncos', arq: 'troncos.html', nome: 'Troncos', ref: 'Arc Raiders' },
    { id: 'roda', arq: 'roda.html', nome: 'Roda', ref: 'Albion Online' },
    { id: 'constelacoes', arq: 'constelacoes.html', nome: 'Constelações', ref: 'Skyrim' },
    { id: 'galhos', arq: 'galhos.html', nome: 'Galhos', ref: 'Diablo 4' },
  ];
  const ICONES = {
    mais: '<path d="M12 5v14M5 12h14"/>', menos: '<path d="M5 12h14"/>',
    ajustar: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  };
  const icone = (n) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONES[n]}</svg>`;
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* Parâmetros que as páginas passam adiante (paleta e volume), para a comparação ser justa. */
  A.consulta = (extra) => {
    const q = new URLSearchParams(location.search);
    q.delete('materia');
    Object.entries(extra || {}).forEach(([k, val]) => q.set(k, val));
    const s = q.toString();
    return s ? `?${s}` : '';
  };

  /* Em tela estreita os títulos das matérias usam só a primeira palavra, para não se sobreporem. */
  A.nomeCurto = (m, largura) => (largura < 640 ? m.nome.split(' ')[0] : m.nome);

  let vivo = null;
  A.anunciar = (texto) => { if (vivo) { vivo.textContent = ''; setTimeout(() => { vivo.textContent = texto; }, 30); } };

  /* cfg: id, titulo, legenda (html extra), acoes [{rotulo, fn}], irPara(id), detalheAcao(o) -> {rotulo, fn} */
  A.montar = function (cfg) {
    const v = A.VARIANTES.find((x) => x.id === cfg.id);
    document.title = `${v.nome} · Árvore do Ateliê (protótipo)`;
    const q = A.consulta();
    const tema = document.documentElement.dataset.theme;
    const volumes = [...new Set([0, 100, 500, 1000, 2000, A.volume])].sort((a, b) => a - b);
    $('#app').innerHTML = `
      <a class="skip" href="#tela">Pular para a Árvore</a>
      <header class="topo">
        <a class="voltar" href="index.html${q}">‹ Árvores</a>
        <div class="marca"><span class="eyebrow">Inspirada em ${v.ref}</span><h1>${esc(cfg.titulo || v.nome)}</h1></div>
        <nav class="variantes" aria-label="Variantes da Árvore">${A.VARIANTES.map((x) => `<a href="${x.arq}${q}"${x.id === cfg.id ? ' aria-current="page"' : ''}>${x.nome}</a>`).join('')}</nav>
        <div class="busca">
          <input id="busca" type="search" placeholder="Buscar Ofício" aria-label="Buscar Ofício pelo nome" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="resultados">
          <ul class="resultados" id="resultados" role="listbox" aria-label="Ofícios encontrados" hidden></ul>
        </div>
        <div class="ctl"><label for="vol">Ofícios a mais por matéria</label>
          <select id="vol" aria-label="Ofícios a mais por matéria">${volumes.map((n) => `<option value="${n}"${n === A.volume ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
        <fieldset class="seg" style="margin:0;border-color:var(--muted)"><legend class="sr">Paleta</legend>
          ${[['borgonha', 'Borgonha'], ['tokyo', 'Tokyo'], ['verde', 'Verde']].map(([id, nome]) => `<label><input type="radio" name="paleta" value="${id}"${id === tema ? ' checked' : ''}><span>${nome}</span></label>`).join('')}
        </fieldset>
      </header>
      <main class="palco" id="palco">
        <canvas id="tela" tabindex="0" role="application" aria-label="Árvore de Ofícios. Setas andam entre Ofícios ligados, Enter escolhe, mais e menos dão zoom, zero ajusta a vista, Esc limpa."></canvas>
        <details class="card legenda"${window.innerWidth >= 1100 ? ' open' : ''}><summary>Legenda</summary><ul>
          <li><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle class="g bloqueado" cx="11" cy="11" r="8"/></svg>Bloqueado: falta pré-requisito</li>
          <li><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle class="g" cx="11" cy="11" r="8"/></svg>Disponível: nenhuma dimensão</li>
          <li><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle class="g pratica" cx="11" cy="11" r="8"/></svg>Em prática</li>
          <li><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle class="g liberado" cx="11" cy="11" r="8"/></svg>Liberado: abre os dependentes</li>
          <li><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle class="g dominado" cx="11" cy="11" r="8"/></svg>Dominado</li>
          <li><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle class="g selo" cx="11" cy="11" r="6"/></svg>Precisa revisar</li>
          ${cfg.legenda || ''}
        </ul></details>
        <div class="controles">
          <button class="icon-btn" id="z-mais" type="button" aria-label="Aproximar">${icone('mais')}</button>
          <button class="icon-btn" id="z-menos" type="button" aria-label="Afastar">${icone('menos')}</button>
          <button class="icon-btn" id="z-fit" type="button" aria-label="Ajustar a vista">${icone('ajustar')}</button>
          ${(cfg.acoes || []).map((a, i) => `<button class="btn-pill" type="button" data-acao="${i}">${esc(a.rotulo)}</button>`).join('')}
        </div>
        <aside class="card detalhe" id="detalhe" aria-label="Detalhe do Ofício" hidden></aside>
      </main>
      <div class="sr" id="anuncio" role="status" aria-live="polite"></div>`;
    vivo = $('#anuncio');

    /* Paleta e volume: a paleta troca na hora; o volume recarrega a página. */
    const url = (k, val) => { const u = new URL(location.href); if (val === null) u.searchParams.delete(k); else u.searchParams.set(k, val); return u; };
    document.querySelectorAll('input[name="paleta"]').forEach((r) => r.addEventListener('change', () => {
      document.documentElement.dataset.theme = r.value;
      history.replaceState(null, '', url('tema', r.value));
      document.querySelectorAll('.variantes a, .voltar').forEach((a) => { const h = new URL(a.href); h.searchParams.set('tema', r.value); a.href = h.pathname.split('/').pop() + h.search; });
      if (cfg.aoTema) cfg.aoTema();
    }));
    $('#vol').addEventListener('change', (e) => { location.href = url('volume', e.target.value === '0' ? null : e.target.value).href; });

    /* Busca por nome */
    const campo = $('#busca'), lista = $('#resultados');
    const fechar = () => { lista.hidden = true; campo.setAttribute('aria-expanded', 'false'); };
    const escolher = (o) => { fechar(); campo.value = ''; cfg.irPara(o.id); };
    campo.addEventListener('input', () => {
      const r = A.buscar(campo.value);
      lista.innerHTML = r.map((o) => `<li role="presentation"><button type="button" role="option" data-id="${o.id}"><i class="dot" style="--c: var(${A.matDe(o.mat).cor})"></i>${esc(o.nome)}</button></li>`).join('');
      lista.hidden = r.length === 0; campo.setAttribute('aria-expanded', String(r.length > 0));
    });
    campo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const o = A.buscar(campo.value, 1)[0]; if (o) escolher(o); }
      else if (e.key === 'Escape') { campo.value = ''; fechar(); }
      else if (e.key === 'ArrowDown') { const b = lista.querySelector('button'); if (b) { e.preventDefault(); b.focus(); } }
    });
    lista.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) escolher(A.indice.get(b.dataset.id)); });
    lista.addEventListener('keydown', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (e.key === 'ArrowDown' && b.parentElement.nextElementSibling) { e.preventDefault(); b.parentElement.nextElementSibling.querySelector('button').focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); (b.parentElement.previousElementSibling ? b.parentElement.previousElementSibling.querySelector('button') : campo).focus(); }
      if (e.key === 'Escape') { fechar(); campo.focus(); }
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.busca')) fechar(); });

    /* Card de detalhe: dimensões, pré-requisitos e o que o Ofício abre. */
    const painel = $('#detalhe');
    const rel = (itens) => (itens.length
      ? `<div class="rel">${itens.slice(0, 8).map((o) => `<button type="button" data-id="${o.id}">${esc(o.nome)}</button>`).join('')}${itens.length > 8 ? `<span class="chip">+${itens.length - 8}</span>` : ''}</div>`
      : '<p class="vazio">Nenhum.</p>');
    const api = {
      canvas: $('#tela'), palco: $('#palco'), painel,
      detalhe(o) {
        if (!o) { painel.hidden = true; return; }
        const i = A.info.get(o.id), m = A.matDe(o.mat), acao = cfg.detalheAcao ? cfg.detalheAcao(o) : null;
        painel.style.setProperty('--c', `var(${m.cor})`);
        painel.innerHTML = `
          <button class="icon-btn fechar" type="button" aria-label="Fechar detalhe">${icone('x')}</button>
          <span class="eyebrow"><i class="dot" style="--c: var(${m.cor}); margin-right:6px"></i>${esc(m.nome)}</span>
          <h2>${esc(o.nome)}</h2>
          <p style="margin:0;display:flex;flex-wrap:wrap;gap:6px"><span class="chip chip-xp">${i.est}</span><span class="chip">${i.prov} de ${i.total} dimensões</span>${i.revisar ? '<span class="chip chip-bad">Precisa revisar</span>' : ''}</p>
          <h3 class="eyebrow">Dimensões</h3>
          <ul>${A.dimsDe(o).map((d) => `<li class="${d.na ? 'na' : d.on ? 'on' : ''}"><span class="letra">${d.na ? '–' : d.letra}</span>${d.nome}<span class="est">${d.texto}</span></li>`).join('')}</ul>
          <h3 class="eyebrow">Pré-requisitos</h3>${rel(o.req.map((id) => A.indice.get(id)))}
          <h3 class="eyebrow">Abre</h3>${rel(A.abre.get(o.id))}
          ${acao ? `<p style="margin:16px 0 0"><button class="btn-pill" type="button" data-extra>${esc(acao.rotulo)}</button></p>` : ''}`;
        painel.hidden = false;
        painel.querySelector('.fechar').onclick = () => api.v.escolher(null, false);
        painel.querySelectorAll('.rel button').forEach((b) => { b.onclick = () => cfg.irPara(b.dataset.id); });
        const extra = painel.querySelector('[data-extra]');
        if (extra) extra.onclick = acao.fn;
      },
      /* Liga o motor aos botões de zoom e às ações extras. */
      ligar(vista) {
        api.v = vista;
        $('#z-mais').onclick = () => vista.zoomar(1.4);
        $('#z-menos').onclick = () => vista.zoomar(1 / 1.4);
        $('#z-fit').onclick = () => vista.ajustar();
        document.querySelectorAll('[data-acao]').forEach((b) => { b.onclick = () => cfg.acoes[Number(b.dataset.acao)].fn(); });
        if (A.params.has('medir')) {
          const hud = document.createElement('div');
          hud.id = 'hud'; hud.setAttribute('aria-hidden', 'true');
          document.body.append(hud);
          setInterval(() => {
            const s = vista.stats;
            hud.textContent = `Ofícios: ${s.vis} desenhados de ${vista.nos.length} · ligações: ${s.lig} de ${vista.ligs.length}\n`
              + `Elementos da página: ${document.querySelectorAll('*').length}\nDesenho: ${s.ms.toFixed(1)} ms (pior dos últimos 60: ${s.pior.toFixed(1)} ms)`;
          }, 500);
        }
      },
    };
    return api;
  };
})();
