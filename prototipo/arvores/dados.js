/* Dados fictícios e regras de estado das Árvores (ATL-57). Os mesmos 20 Ofícios do prototipo/index.html.
   Estado do Ofício, Bloqueado e domínio seguem o glossário (docs/07-glossario.md). Nada aqui toca em DOM. */
(function () {
  'use strict';
  const A = (window.Atl = window.Atl || {});
  const params = new URLSearchParams(location.search);
  A.params = params;

  A.DIMS = [
    { id: 'conceitual', nome: 'Compreensão conceitual', letra: 'C' },
    { id: 'fluencia', nome: 'Fluência procedimental', letra: 'F' },
    { id: 'problemas', nome: 'Resolução de problemas', letra: 'R' },
    { id: 'autonomia', nome: 'Autonomia', letra: 'A' },
    { id: 'explicacao', nome: 'Explicação', letra: 'E' },
  ];
  A.MATERIAS = [
    { id: 'calc', nome: 'Cálculo', cor: '--mat-1' },
    { id: 'redes', nome: 'Redes de Computadores', cor: '--mat-2' },
    { id: 'fil', nome: 'Filosofia', cor: '--mat-3' },
  ];
  const TODAS = A.DIMS.map((d) => d.id);
  const base = [
    { id: 'lim', mat: 'calc', nome: 'Limites', req: [], provas: TODAS },
    { id: 'limites', mat: 'calc', nome: 'Limites laterais', req: ['lim'], provas: ['autonomia'] },
    { id: 'cont', mat: 'calc', nome: 'Continuidade', req: ['lim'], provas: TODAS },
    { id: 'der', mat: 'calc', nome: 'Derivadas', req: ['cont'], provas: ['conceitual', 'fluencia', 'autonomia', 'problemas'] },
    { id: 'cadeia', mat: 'calc', nome: 'Regra da cadeia', req: ['der'], provas: ['conceitual', 'fluencia'], revisar: true },
    { id: 'int', mat: 'calc', nome: 'Integrais', req: ['der'], provas: ['autonomia', 'conceitual'], aguardaJane: true },
    { id: 'implicitas', mat: 'calc', nome: 'Derivadas implícitas', req: ['cadeia'], provas: ['autonomia', 'conceitual'], revisar: true },
    { id: 'otim', mat: 'calc', nome: 'Otimização', req: ['cadeia'], provas: [] },
    { id: 'osi', mat: 'redes', nome: 'Modelo OSI', req: [], provas: ['conceitual', 'autonomia'], naoSeAplica: ['fluencia'] },
    { id: 'enl', mat: 'redes', nome: 'Camada de enlace', req: ['osi'], provas: ['conceitual', 'autonomia', 'fluencia'] },
    { id: 'ip', mat: 'redes', nome: 'IP e roteamento', req: ['enl'], provas: ['conceitual', 'fluencia'] },
    { id: 'sub', mat: 'redes', nome: 'Sub-redes', req: ['ip'], provas: [] },
    { id: 'tcp', mat: 'redes', nome: 'TCP e UDP', req: ['ip'], provas: ['conceitual', 'autonomia'] },
    { id: 'handshake', mat: 'redes', nome: 'Handshake do TCP', req: ['tcp'], provas: ['autonomia', 'conceitual'], naoSeAplica: ['fluencia'], revisar: true },
    { id: 'dns', mat: 'redes', nome: 'DNS e HTTP', req: ['tcp', 'sub'], provas: [], naoSeAplica: ['fluencia'] },
    { id: 'l1', mat: 'fil', nome: 'Livro I · O que é justiça', req: [], provas: ['conceitual', 'autonomia', 'explicacao'] },
    { id: 'l2', mat: 'fil', nome: 'Livro II · A cidade nasce', req: ['l1'], provas: ['autonomia', 'explicacao'] },
    { id: 'just', mat: 'fil', nome: 'Justiça na alma', req: ['l1'], provas: [], naoSeAplica: ['fluencia'] },
    { id: 'l3', mat: 'fil', nome: 'Livro III · Educação', req: ['l2'], provas: [] },
    { id: 'cav', mat: 'fil', nome: 'Alegoria da caverna', req: ['l3'], provas: [], naoSeAplica: ['fluencia'] },
  ];
  const lista = base.map((o) => ({ ...o, provas: new Set(o.provas), naoSeAplica: o.naoSeAplica || [] }));

  /* ?volume=N soma N Ofícios fictícios a cada matéria (até 2000), para ver a Árvore cheia. Sorteio fixo: sempre o mesmo resultado. */
  const volume = Math.min(2000, Math.max(0, Number.parseInt(params.get('volume') || '0', 10) || 0));
  A.volume = volume;
  if (volume > 0) {
    let semente = 7;
    const sorteio = () => { semente = (semente * 16807) % 2147483647; return semente / 2147483647; };
    A.MATERIAS.forEach((m) => {
      const pool = lista.filter((o) => o.mat === m.id);
      for (let i = 0; i < volume; i++) {
        const pai = pool[Math.floor(sorteio() * pool.length)];
        const sorte = sorteio();
        const o = { id: `${m.id}-t${i}`, mat: m.id, nome: `${m.nome.split(' ')[0]} · tópico ${i + 1}`, req: [pai.id],
          provas: new Set(sorte < 0.3 ? ['conceitual', 'autonomia'] : sorte < 0.5 ? ['conceitual'] : []), naoSeAplica: [], revisar: sorteio() < 0.05 };
        pool.push(o);
        lista.push(o);
      }
    });
  }
  A.OFICIOS = lista;
  const indice = new Map(lista.map((o) => [o.id, o]));
  A.indice = indice;

  /* ----- Estado (glossário) ----- */
  const aplicaveis = (o) => A.DIMS.filter((d) => !o.naoSeAplica.includes(d.id));
  function estadoBase(o) {
    const n = A.DIMS.filter((d) => o.provas.has(d.id)).length;
    if (n === 0) return 'Disponível';
    if (aplicaveis(o).every((d) => o.provas.has(d.id))) return 'Dominado';
    return n >= 2 && o.provas.has('conceitual') ? 'Liberado' : 'Em prática';
  }
  const FOLGADOS = ['Liberado', 'Dominado'];
  const basicos = new Map(lista.map((o) => [o.id, estadoBase(o)]));
  A.SLUG = { Bloqueado: 'bloqueado', Disponível: 'disponivel', 'Em prática': 'pratica', Liberado: 'liberado', Dominado: 'dominado' };
  /* info: estado, dimensões provadas, dimensões que se aplicam, selo "precisa revisar", espera da Jane. Calculado uma vez. */
  A.info = new Map(lista.map((o) => {
    const aberto = o.req.every((id) => FOLGADOS.includes(basicos.get(id)));
    const ap = aplicaveis(o);
    return [o.id, { est: aberto ? basicos.get(o.id) : 'Bloqueado', prov: ap.filter((d) => o.provas.has(d.id)).length, total: ap.length,
      revisar: Boolean(o.revisar), espera: Boolean(o.aguardaJane) && !o.provas.has('explicacao') }];
  }));
  A.dimsDe = (o) => A.DIMS.map((d) => {
    const na = o.naoSeAplica.includes(d.id), on = o.provas.has(d.id);
    const espera = d.id === 'explicacao' && Boolean(o.aguardaJane) && !on;
    return { ...d, na, on, espera, texto: na ? 'não se aplica' : on ? 'provada' : espera ? 'aguardando a Jane' : 'pendente' };
  });
  /* Domínio = dimensões provadas ÷ as que se aplicam, arredondado para baixo (hipótese, igual ao Painel). */
  A.dominioDe = (itens) => {
    const total = itens.reduce((s, o) => s + A.info.get(o.id).total, 0);
    const prov = itens.reduce((s, o) => s + A.info.get(o.id).prov, 0);
    return { total, prov, pct: Math.floor((prov / total) * 100) };
  };
  A.deMateria = (id) => lista.filter((o) => o.mat === id);

  /* ----- Estrutura: pai principal = primeiro pré-requisito; os outros viram linhas extras ----- */
  const filhosDe = new Map(lista.map((o) => [o.id, []]));
  const pai = new Map();
  const abre = new Map(lista.map((o) => [o.id, []]));
  const arestas = [];
  lista.forEach((o) => {
    o.req.forEach((rid, i) => {
      abre.get(rid).push(o);
      arestas.push({ de: rid, para: o.id, extra: i > 0 });
    });
    if (o.req.length) { filhosDe.get(o.req[0]).push(o); pai.set(o.id, indice.get(o.req[0])); }
  });
  A.filhosDe = filhosDe; A.pai = pai; A.abre = abre; A.arestas = arestas;
  A.raizesDe = (matId) => lista.filter((o) => o.mat === matId && !pai.has(o.id));

  /* Profundidade (raiz = 1) e tamanho do ramo (o Ofício e tudo que está abaixo). */
  const prof = new Map(), tam = new Map();
  (function medir() {
    const visita = (o, d) => {
      prof.set(o.id, d);
      let t = 1;
      filhosDe.get(o.id).forEach((c) => { t += visita(c, d + 1); });
      tam.set(o.id, t);
      return t;
    };
    lista.filter((o) => !pai.has(o.id)).forEach((r) => visita(r, 1));
  })();
  A.prof = prof; A.tamanho = tam;
  A.profMax = Math.max(...prof.values());

  /* Estado da linha: apagada (destino Bloqueado), acesa (origem aberta e destino já com prova), aberta (o resto). */
  A.tipoAresta = (a, b) => {
    const ib = A.info.get(b.id), ia = A.info.get(a.id);
    if (ib.est === 'Bloqueado') return 'apagada';
    return FOLGADOS.includes(ia.est) && ib.prov > 0 ? 'acesa' : 'aberta';
  };
  A.ligacoes = arestas.map((e) => ({ a: indice.get(e.de), b: indice.get(e.para), extra: e.extra }))
    .map((e) => ({ ...e, tipo: A.tipoAresta(e.a, e.b) }));

  /* Ramo visível: `abertos` diz quais Ofícios mostram os filhos (ou tudo = true). Devolve a ordem em pré-ordem,
     a profundidade e o "slot" vertical/horizontal de cada um (folhas em 0, 1, 2..., pais no meio dos filhos). */
  A.visivel = function (matId, abertos, tudo) {
    const pre = [], pf = new Map(), slot = new Map();
    let folha = 0;
    const visita = (o, d) => {
      pf.set(o.id, d); pre.push(o);
      const f = tudo || abertos.has(o.id) ? filhosDe.get(o.id) : [];
      if (!f.length) { slot.set(o.id, folha++); return; }
      f.forEach((c) => visita(c, d + 1));
      slot.set(o.id, (slot.get(f[0].id) + slot.get(f[f.length - 1].id)) / 2);
    };
    A.raizesDe(matId).forEach((r) => visita(r, 1));
    return { pre, prof: pf, slot, folhas: folha };
  };
  const cacheOrdem = new Map();
  A.ordem = (matId) => {
    if (!cacheOrdem.has(matId)) cacheOrdem.set(matId, A.visivel(matId, null, true));
    return cacheOrdem.get(matId);
  };
  /* Conjunto de Ofícios abertos até a profundidade n (os filhos de quem tem profundidade < n aparecem). */
  A.abrirAte = (n) => new Set(lista.filter((o) => prof.get(o.id) <= n && filhosDe.get(o.id).length).map((o) => o.id));

  /* ----- Busca por nome (sem acento, sem caixa) ----- */
  const norm = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const nomes = lista.map((o) => ({ o, n: norm(o.nome) }));
  A.buscar = (texto, max = 8) => {
    const t = norm(texto.trim());
    if (!t) return [];
    const ini = [], meio = [];
    for (const { o, n } of nomes) {
      const i = n.indexOf(t);
      if (i === 0) ini.push(o); else if (i > 0) meio.push(o);
      if (ini.length >= max) break;
    }
    return [...ini, ...meio].slice(0, max);
  };
  A.matDe = (id) => A.MATERIAS.find((m) => m.id === id);
})();
