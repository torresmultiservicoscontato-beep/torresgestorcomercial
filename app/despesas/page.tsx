"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowDownLeft, CheckCircle2, ChevronLeft, ChevronRight, CircleDollarSign, Clock3, Pencil, Plus, RefreshCw, Search, Wallet, X } from "lucide-react";
import AppShell from "../components/AppShell";
import { carregarOpcoesDespesas, carregarRotasDespesas, listarDespesas, salvarDespesa, type ContextoDespesas, type ResponsavelDespesa, type RotaDespesa } from "../lib/despesas";
import { categoriasDespesa, formasPagamento, hojeDespesa, resumirDespesas, type Despesa, type FormaPagamento, type FormDespesa, type GrupoDespesa, type StatusDespesa } from "../lib/despesasModelo";
import styles from "./despesas.module.css";

const moeda = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataTexto = (valor: string | null) => valor ? valor.split("-").reverse().join("/") : "—";
const dias = ["", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
const nomeRota = (r: RotaDespesa) => `${dias[r.dia_semana]} • ${r.municipio}`;
function periodoMes() {
  const hoje = hojeDespesa();
  const [ano, mes] = hoje.split("-").map(Number);
  return { inicio: `${hoje.slice(0, 7)}-01`, fim: `${hoje.slice(0, 7)}-${new Date(ano, mes, 0).getDate()}` };
}
function formularioInicial(responsavel = ""): FormDespesa {
  return { responsavel_user_id: responsavel, grupo: "Dia a dia", categoria: "Combustível", descricao: "", valor: "", data: hojeDespesa(), vencimento: "", status: "Pago", pago_em: hojeDespesa(), forma_pagamento: "Pix", fornecedor: "", documento: "", observacao: "", rota_id: "" };
}
function formularioDespesa(d: Despesa): FormDespesa {
  return { ...d, valor: (d.valor_centavos / 100).toFixed(2).replace(".", ","), vencimento: d.vencimento ?? "", pago_em: d.pago_em ?? "", forma_pagamento: d.forma_pagamento ?? "", rota_id: d.rota_id ?? "" };
}

export default function DespesasPage() {
  const [periodo, setPeriodo] = useState(periodoMes);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [contexto, setContexto] = useState<ContextoDespesas | null>(null);
  const [responsaveis, setResponsaveis] = useState<ResponsavelDespesa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [busca, setBusca] = useState("");
  const [grupo, setGrupo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [situacao, setSituacao] = useState("");
  const [rota, setRota] = useState("");
  const [pagina, setPagina] = useState(1);
  const [form, setForm] = useState<FormDespesa>(formularioInicial);
  const [editando, setEditando] = useState<Despesa | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState("");
  const [rotas, setRotas] = useState<RotaDespesa[]>([]);
  const [erroRotas, setErroRotas] = useState("");
  const [carregandoRotas, setCarregandoRotas] = useState(false);
  const formularioRef = useRef<HTMLElement>(null);
  const requisicao = useRef(0);
  const salvandoRef = useRef(false);
  const hoje = hojeDespesa();

  const carregar = useCallback(async () => {
    const numero = ++requisicao.current;
    setCarregando(true);
    setErro("");
    try {
      const [opcoes, lista] = await Promise.all([carregarOpcoesDespesas(), listarDespesas(periodo.inicio, periodo.fim)]);
      if (numero !== requisicao.current) return;
      setContexto(opcoes.contexto);
      setResponsaveis(opcoes.responsaveis);
      setDespesas(lista);
    } catch (falha) {
      if (numero !== requisicao.current) return;
      setDespesas([]);
      setContexto(null);
      setErro(falha instanceof Error ? falha.message : "Não foi possível carregar as despesas.");
    } finally {
      if (numero === requisicao.current) setCarregando(false);
    }
  }, [periodo.inicio, periodo.fim]);

  useEffect(() => { void carregar(); return () => { requisicao.current++; }; }, [carregar]);
  useEffect(() => { setPagina(1); }, [busca, grupo, categoria, responsavel, situacao, rota, periodo]);
  useEffect(() => {
    if (formAberto) formularioRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [formAberto]);
  useEffect(() => {
    if (!formAberto || !form.responsavel_user_id || form.grupo !== "Dia a dia") { setRotas([]); return; }
    let ativo = true;
    setCarregandoRotas(true);
    setRotas([]);
    setErroRotas("");
    void carregarRotasDespesas(form.responsavel_user_id).then((lista) => {
      if (ativo) setRotas(lista);
    }).catch((falha: Error) => { if (ativo) setErroRotas(falha.message); })
      .finally(() => { if (ativo) setCarregandoRotas(false); });
    return () => { ativo = false; };
  }, [formAberto, form.responsavel_user_id, form.grupo]);

  const responsaveisFiltro = useMemo(() => {
    const mapa = new Map(responsaveis.map((r) => [r.user_id, r.nome]));
    despesas.forEach((d) => { if (!mapa.has(d.responsavel_user_id)) mapa.set(d.responsavel_user_id, d.responsavel_nome); });
    return Array.from(mapa, ([id, nome]) => ({ id, nome }));
  }, [responsaveis, despesas]);
  const rotasFiltro = useMemo(() => Array.from(new Map(despesas.filter((d) => d.rota_id).map((d) => [d.rota_id!, d.rota_nome])), ([id, nome]) => ({ id, nome })), [despesas]);
  const filtradas = useMemo(() => despesas.filter((d) => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    const texto = `${d.descricao} ${d.fornecedor} ${d.documento} ${d.responsavel_nome} ${d.observacao}`.toLocaleLowerCase("pt-BR");
    return (!termo || texto.includes(termo)) && (!grupo || d.grupo === grupo) && (!categoria || d.categoria === categoria)
      && (!responsavel || d.responsavel_user_id === responsavel)
      && (!rota || (rota === "sem-rota" ? !d.rota_id : d.rota_id === rota))
      && (!situacao || (situacao === "Vencido" ? d.status === "Pendente" && !!d.vencimento && d.vencimento < hoje : d.status === situacao));
  }), [despesas, busca, grupo, categoria, responsavel, situacao, rota, hoje]);
  const resumo = useMemo(() => resumirDespesas(filtradas, hoje), [filtradas, hoje]);
  const paginas = Math.max(1, Math.ceil(filtradas.length / 20));
  const paginaAtual = Math.min(pagina, paginas);
  const visiveis = filtradas.slice((paginaAtual - 1) * 20, paginaAtual * 20);
  const categoriasFiltro = grupo ? categoriasDespesa[grupo as GrupoDespesa] : Object.values(categoriasDespesa).flat();

  function novo() {
    setEditando(null);
    setForm(formularioInicial(contexto?.responsavelForcadoId ?? contexto?.titularId ?? ""));
    setErroForm(""); setMensagem(""); setFormAberto(true);
  }
  function editar(despesa: Despesa, pagar = false) {
    setEditando(despesa);
    setForm({ ...formularioDespesa(despesa), ...(pagar ? { status: "Pago" as const, pago_em: hoje, forma_pagamento: "Pix" as const } : {}) });
    setErroForm(""); setMensagem(""); setFormAberto(true);
    formularioRef.current?.scrollIntoView({ behavior: "smooth" });
  }
  function alterar<K extends keyof FormDespesa>(campo: K, valor: FormDespesa[K]) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }
  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (salvandoRef.current) return;
    salvandoRef.current = true; setSalvando(true); setErroForm("");
    try {
      const salvo = await salvarDespesa(form, editando);
      setDespesas((atual) => {
        const lista = atual.filter((d) => d.id !== salvo.id);
        if (salvo.data >= periodo.inicio && salvo.data <= periodo.fim) lista.push(salvo);
        return lista.sort((a, b) => b.data.localeCompare(a.data) || a.id.localeCompare(b.id));
      });
      setMensagem(`Despesa ${editando ? "atualizada" : "cadastrada"} com sucesso.${salvo.data < periodo.inicio || salvo.data > periodo.fim ? " A data está fora do período exibido; ajuste os filtros para visualizá-la." : ""}`);
      setFormAberto(false); setEditando(null);
    } catch (falha) { setErroForm(falha instanceof Error ? falha.message : "Não foi possível salvar a despesa."); }
    finally { salvandoRef.current = false; setSalvando(false); }
  }

  return <AppShell>
    <div className={styles.page}>
      <header className={`pageHeader ${styles.header}`}>
        <div><p className="eyebrow">CONTROLE FINANCEIRO</p><h1>Despesas</h1><p>Organize os gastos da operação e acompanhe o que falta pagar.</p></div>
        <div className={styles.acoes}><button className="secondary" type="button" onClick={() => void carregar()} disabled={carregando || salvando}><RefreshCw size={16} /> Atualizar</button>
          {contexto?.podeCadastrar && <button className="primary" type="button" onClick={novo} disabled={salvando || carregando}><Plus size={18} /> Nova despesa</button>}</div>
      </header>
      {mensagem && <div className={styles.sucesso} role="status"><CheckCircle2 size={18} />{mensagem}</div>}
      {erro && <div className={styles.erro} role="alert"><AlertCircle size={18} />{erro}</div>}

      {formAberto && <section className={`panel ${styles.formulario}`} ref={formularioRef} aria-labelledby="titulo-despesa">
        <div className={styles.tituloForm}><div><p className="eyebrow">LANÇAMENTO</p><h2 id="titulo-despesa">{editando ? "Editar despesa" : "Nova despesa"}</h2></div><button type="button" className="iconBtn" aria-label="Fechar formulário" disabled={salvando} onClick={() => setFormAberto(false)}><X size={18} /></button></div>
        <form onSubmit={salvar}>
          <fieldset disabled={salvando} className={styles.fieldset}>
            <div className={styles.formGrid}>
              <label className={styles.campo}>Grupo<select value={form.grupo} onChange={(e) => { const g = e.target.value as GrupoDespesa; setForm((atual) => ({ ...atual, grupo: g, categoria: categoriasDespesa[g][0], rota_id: g === "Administrativa" ? "" : atual.rota_id })); }}>{Object.keys(categoriasDespesa).map((g) => <option key={g}>{g}</option>)}</select></label>
              <label className={styles.campo}>Categoria<select value={form.categoria} onChange={(e) => alterar("categoria", e.target.value)}>{categoriasDespesa[form.grupo].map((c) => <option key={c}>{c}</option>)}</select></label>
              <label className={styles.campo}>Responsável<select required value={form.responsavel_user_id} disabled={!!editando || !!contexto?.responsavelForcadoId} onChange={(e) => setForm((atual) => ({ ...atual, responsavel_user_id: e.target.value, rota_id: "" }))}><option value="">Selecione</option>{responsaveis.map((r) => <option key={r.user_id} value={r.user_id}>{r.nome} · {r.tipo}</option>)}{editando && !responsaveis.some((r) => r.user_id === editando.responsavel_user_id) && <option value={editando.responsavel_user_id}>{editando.responsavel_nome}</option>}</select></label>
              <label className={`${styles.campo} ${styles.span2}`}>Descrição<input autoFocus required maxLength={160} placeholder="Ex.: Abastecimento para as visitas de hoje" value={form.descricao} onChange={(e) => alterar("descricao", e.target.value)} /></label>
              <label className={styles.campo}>Valor (R$)<input required inputMode="decimal" placeholder="0,00" value={form.valor} onChange={(e) => alterar("valor", e.target.value)} /></label>
              <label className={styles.campo}>Data da despesa<input required type="date" min="1900-01-01" max="2199-12-31" value={form.data} onChange={(e) => alterar("data", e.target.value)} /></label>
              <label className={styles.campo}>Vencimento <small>opcional</small><input type="date" min="1900-01-01" max="2199-12-31" value={form.vencimento} onChange={(e) => alterar("vencimento", e.target.value)} /></label>
              <label className={styles.campo}>Situação<select value={form.status} onChange={(e) => { const status = e.target.value as StatusDespesa; setForm((atual) => ({ ...atual, status, pago_em: status === "Pago" ? atual.pago_em || hoje : "", forma_pagamento: status === "Pago" ? atual.forma_pagamento || "Pix" : "" })); }}>{["Pago", "Pendente", "Cancelado"].map((s) => <option key={s}>{s}</option>)}</select></label>
              {form.status === "Pago" && <><label className={styles.campo}>Pago em<input required type="date" min="1900-01-01" max={hoje} value={form.pago_em} onChange={(e) => alterar("pago_em", e.target.value)} /></label><label className={styles.campo}>Forma de pagamento<select required value={form.forma_pagamento} onChange={(e) => alterar("forma_pagamento", e.target.value as FormaPagamento)}><option value="">Selecione</option>{formasPagamento.map((f) => <option key={f}>{f}</option>)}</select></label></>}
              {form.grupo === "Dia a dia" && <label className={`${styles.campo} ${styles.spanAll}`}>Rota <small>opcional</small><select value={form.rota_id} disabled={carregandoRotas} onChange={(e) => alterar("rota_id", e.target.value)}><option value="">{carregandoRotas ? "Carregando rotas…" : "Sem vínculo com rota"}</option>{rotas.map((r) => <option key={r.id} value={r.id}>{nomeRota(r)}</option>)}{editando?.rota_id && !rotas.some((r) => r.id === editando.rota_id) && <option value={editando.rota_id}>{editando.rota_nome}</option>}</select><small>O vínculo identifica a rota do responsável. A data da despesa identifica o dia do gasto. Só aparecem rotas que você pode consultar.</small>{erroRotas && <span role="alert" className={styles.aviso}>{erroRotas} Você pode salvar sem rota.</span>}</label>}
              <label className={styles.campo}>Fornecedor / estabelecimento <small>opcional</small><input maxLength={160} value={form.fornecedor} onChange={(e) => alterar("fornecedor", e.target.value)} placeholder="Ex.: Posto, restaurante ou escritório" /></label>
              <label className={styles.campo}>Número do comprovante <small>opcional</small><input maxLength={80} value={form.documento} onChange={(e) => alterar("documento", e.target.value)} placeholder="Nota fiscal, recibo ou referência" /></label>
              <label className={`${styles.campo} ${styles.spanAll}`}>Observações <small>opcional</small><textarea rows={3} maxLength={2000} value={form.observacao} onChange={(e) => alterar("observacao", e.target.value)} placeholder="Detalhes que ajudem a identificar este gasto" /></label>
            </div>
            {form.status === "Cancelado" && <p className={styles.aviso}>Ao salvar, o lançamento ficará cancelado, preservado no histórico e fora dos totais.</p>}
            {erroForm && <div className={styles.erro} role="alert">{erroForm}</div>}
            <div className={styles.formAcoes}><button type="button" className="secondary" onClick={() => setFormAberto(false)}>Voltar</button><button type="submit" className="primary">{salvando ? "Salvando…" : form.status === "Cancelado" ? "Salvar cancelamento" : "Salvar despesa"}</button></div>
          </fieldset>
        </form>
      </section>}

      <section className={`panel ${styles.filtros}`} aria-label="Filtros de despesas">
        <div className={styles.filtrosTopo}><h2>Consultar despesas</h2><button className={styles.link} type="button" onClick={() => { setPeriodo(periodoMes()); setBusca(""); setGrupo(""); setCategoria(""); setResponsavel(""); setSituacao(""); setRota(""); }}>Limpar filtros</button></div>
        <div className={styles.filtrosGrid}>
          <label className={styles.campo}>De<input type="date" value={periodo.inicio} onChange={(e) => setPeriodo((p) => ({ ...p, inicio: e.target.value }))} /></label>
          <label className={styles.campo}>Até<input type="date" value={periodo.fim} onChange={(e) => setPeriodo((p) => ({ ...p, fim: e.target.value }))} /></label>
          <label className={styles.campo}>Grupo<select value={grupo} onChange={(e) => { setGrupo(e.target.value); setCategoria(""); }}><option value="">Todos os grupos</option>{Object.keys(categoriasDespesa).map((g) => <option key={g}>{g}</option>)}</select></label>
          <label className={styles.campo}>Categoria<select value={categoria} onChange={(e) => setCategoria(e.target.value)}><option value="">Todas as categorias</option>{categoriasFiltro.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className={styles.campo}>Responsável<select value={responsavel} onChange={(e) => setResponsavel(e.target.value)}><option value="">{contexto?.responsavelForcadoId ? "Meu contexto atual" : "Todos os responsáveis"}</option>{responsaveisFiltro.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</select></label>
          <label className={styles.campo}>Situação<select value={situacao} onChange={(e) => setSituacao(e.target.value)}><option value="">Todas as situações</option>{["Pago", "Pendente", "Vencido", "Cancelado"].map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className={styles.campo}>Rota<select value={rota} onChange={(e) => setRota(e.target.value)}><option value="">Todas as rotas</option><option value="sem-rota">Sem vínculo com rota</option>{rotasFiltro.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</select></label>
          <label className={styles.campo}>Buscar<div className={styles.busca}><Search size={16} /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Descrição, fornecedor, documento…" /></div></label>
        </div>
        <p className={styles.nota}>Período pela data da despesa. Os indicadores acompanham todos os filtros. Canceladas não entram nos totais; vencidas fazem parte das pendentes.</p>
      </section>
      <div className={styles.stats} aria-busy={carregando}>
        {[{ texto: "Total lançado", valor: resumo.total, Icone: Wallet, cor: "azul" }, { texto: "Pago", valor: resumo.pago, Icone: CheckCircle2, cor: "verde" }, { texto: "Pendente", valor: resumo.pendente, Icone: Clock3, cor: "amarelo" }, { texto: "Vencido", valor: resumo.vencido, Icone: AlertCircle, cor: "vermelho" }].map(({ texto, valor, Icone, cor }) => <article key={texto}><div><span>{texto}</span><Icone size={20} className={styles[cor]} /></div><strong>{carregando || erro ? "—" : moeda(valor)}</strong></article>)}
      </div>
      <section className={styles.listagem} aria-label="Lançamentos de despesas" aria-busy={carregando}>
        <div className={styles.listaTitulo}><h2>Lançamentos</h2><span>{!carregando && !erro ? `${filtradas.length} ${filtradas.length === 1 ? "despesa encontrada" : "despesas encontradas"}` : ""}</span></div>
        {carregando ? <div className={styles.vazio} role="status">Carregando despesas…</div> : erro ? <div className={styles.vazio}>Não foi possível consultar os lançamentos. Clique em Atualizar para tentar novamente.</div> : !filtradas.length ? <div className={styles.vazio}><CircleDollarSign size={38} /><h3>Nenhuma despesa neste filtro</h3><p>Ajuste o período ou registre o primeiro gasto da operação.</p>{contexto?.podeCadastrar && <button className="primary" onClick={novo} type="button"><Plus size={16} /> Nova despesa</button>}</div> : <>
          <div className={styles.lista}>{visiveis.map((d) => {
            const vencida = d.status === "Pendente" && !!d.vencimento && d.vencimento < hoje;
            return <article key={d.id} className={styles.card}>
              <div className={styles.cardTopo}><div className={styles.despesaIcon}><ArrowDownLeft size={21} /></div><div className={styles.identificacao}><strong>{d.descricao}</strong><span>{d.grupo} · {d.categoria}</span></div><div className={styles.valor}><strong>{moeda(d.valor_centavos)}</strong><span className={`${styles.badge} ${d.status === "Pago" ? styles.pago : d.status === "Cancelado" ? styles.cancelado : vencida ? styles.vencido : styles.pendente}`}>{vencida ? "Vencido" : d.status}</span></div></div>
              <dl className={styles.metadados}><div><dt>Data da despesa</dt><dd>{dataTexto(d.data)}</dd></div><div><dt>Responsável</dt><dd>{d.responsavel_nome}</dd></div><div><dt>{d.status === "Pago" ? "Pagamento" : "Vencimento"}</dt><dd>{dataTexto(d.status === "Pago" ? d.pago_em : d.vencimento)}</dd></div><div><dt>Rota</dt><dd>{d.rota_nome || "Sem vínculo"}</dd></div></dl>
              <div className={styles.cardRodape}><details><summary>Detalhes do lançamento</summary><div className={styles.detalhes}><p><b>Fornecedor:</b> {d.fornecedor || "Não informado"}</p><p><b>Comprovante:</b> {d.documento || "Não informado"}</p><p><b>Forma de pagamento:</b> {d.forma_pagamento || "Não informada"}</p>{d.observacao && <p className={styles.observacao}><b>Observações:</b> {d.observacao}</p>}</div></details>{contexto?.podeEditar && <div className={styles.acoes}>{d.status === "Pendente" && <button type="button" className={styles.link} onClick={() => editar(d, true)}><CheckCircle2 size={15} /> Registrar pagamento</button>}<button type="button" className="secondary" onClick={() => editar(d)}><Pencil size={15} /> Editar</button></div>}</div>
            </article>;
          })}</div>
          {paginas > 1 && <div className={styles.paginacao}><button type="button" className="secondary" disabled={paginaAtual === 1} onClick={() => setPagina(paginaAtual - 1)} aria-label="Página anterior"><ChevronLeft size={17} /></button><span>Página {paginaAtual} de {paginas}</span><button type="button" className="secondary" disabled={paginaAtual === paginas} onClick={() => setPagina(paginaAtual + 1)} aria-label="Próxima página"><ChevronRight size={17} /></button></div>}
        </>}
      </section>
    </div>
  </AppShell>;
}
