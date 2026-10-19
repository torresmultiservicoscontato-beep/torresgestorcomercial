"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  FileCheck2,
  ReceiptText,
  Save,
  WalletCards,
} from "lucide-react";
import AppShell from "../components/AppShell";
import {
  carregarComissoes,
  carregarRecebimentos,
  faturarPedido,
  registrarBaixa,
  registrarPagamentoComissao,
  type ComissaoPedido,
  type RecebimentoPedido,
} from "../lib/comissoes";
import styles from "./comissoes.module.css";

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataBr(valor: string | null) {
  return valor ? valor.split("-").reverse().join("/") : "—";
}

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

export default function ComissoesPage() {
  const [modo, setModo] = useState<"gestao" | "preposto">("gestao");
  const [pedidos, setPedidos] = useState<ComissaoPedido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [recebimentos, setRecebimentos] = useState<RecebimentoPedido[]>([]);
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroRepresentada, setFiltroRepresentada] = useState("");
  const [filtroResponsavel, setFiltroResponsavel] = useState("");

  const [faturamento, setFaturamento] = useState({
    numeroPedido: "",
    numeroDocumento: "",
    data: hoje(),
    valor: "",
    parcelas: [{ numero: 1, vencimento: hoje(), valor: "" }],
  });

  const [baixas, setBaixas] = useState<Record<string, { valor: string; data: string }>>({});
  const [pagamentos, setPagamentos] = useState<Record<string, { repValor: string; repData: string; prepValor: string; prepData: string }>>({});

  async function recarregar() {
    const dados = await carregarComissoes();
    setModo(dados.modo);
    setPedidos(dados.pedidos);
  }

  useEffect(() => {
    let ativo = true;
    void carregarComissoes()
      .then((dados) => {
        if (!ativo) return;
        setModo(dados.modo);
        setPedidos(dados.pedidos);
      })
      .catch((falha: Error) => {
        if (ativo) setErro(falha.message);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => { ativo = false; };
  }, []);

  const representadas = useMemo(() => Array.from(new Set(pedidos.map((item) => item.representadaNome))).sort(), [pedidos]);
  const responsaveis = useMemo(() => Array.from(new Set(pedidos.map((item) => item.responsavelNome))).sort(), [pedidos]);

  const filtrados = useMemo(() => pedidos.filter((item) => {
    const bateStatus = !filtroStatus || item.statusPedido === filtroStatus;
    const bateRep = !filtroRepresentada || item.representadaNome === filtroRepresentada;
    const bateResp = !filtroResponsavel || item.responsavelNome === filtroResponsavel;
    return bateStatus && bateRep && bateResp;
  }), [pedidos, filtroStatus, filtroRepresentada, filtroResponsavel]);

  const resumo = useMemo(() => {
    if (modo === "preposto") {
      return {
        previsto: pedidos.reduce((s, p) => s + p.comissaoPrepostoTotal, 0),
        liberado: pedidos.reduce((s, p) => s + p.comissaoPrepostoLiberada, 0),
        pago: pedidos.reduce((s, p) => s + p.comissaoPrepostoPaga, 0),
        pendente: pedidos.reduce((s, p) => s + Math.max(p.comissaoPrepostoLiberada - p.comissaoPrepostoPaga, 0), 0),
        prepostoPendente: 0,
        prepostoPago: 0,
      };
    }

    return {
      previsto: pedidos.reduce((s, p) => s + (p.comissaoRepresentanteTotal ?? 0), 0),
      liberado: pedidos.reduce((s, p) => s + (p.comissaoRepresentanteLiberada ?? 0), 0),
      pago: pedidos.reduce((s, p) => s + (p.comissaoRepresentanteRecebida ?? 0), 0),
      pendente: pedidos.reduce((s, p) => s + Math.max((p.comissaoRepresentanteLiberada ?? 0) - (p.comissaoRepresentanteRecebida ?? 0), 0), 0),
      prepostoPendente: pedidos.reduce((s, p) => s + Math.max(p.comissaoPrepostoLiberada - p.comissaoPrepostoPaga, 0), 0),
      prepostoPago: pedidos.reduce((s, p) => s + p.comissaoPrepostoPaga, 0),
    };
  }, [pedidos, modo]);

  async function abrir(item: ComissaoPedido) {
    if (abertoId === item.ordemId) {
      setAbertoId(null);
      return;
    }

    setAbertoId(item.ordemId);
    setErro("");

    if (item.statusPedido !== "Pedido lançado") {
      try {
        const lista = await carregarRecebimentos(item.ordemId);
        setRecebimentos(lista);
        setBaixas(Object.fromEntries(lista.map((r) => [r.id, {
          valor: String(r.valorRecebido || r.valorPrevisto),
          data: r.recebidoEm ?? hoje(),
        }])));
      } catch (falha) {
        setErro(falha instanceof Error ? falha.message : "Não foi possível carregar as parcelas.");
      }
    } else {
      setRecebimentos([]);
      setFaturamento({
        numeroPedido: "",
        numeroDocumento: "",
        data: hoje(),
        valor: item.valorFaturado ? String(item.valorFaturado) : "",
        parcelas: [{ numero: 1, vencimento: hoje(), valor: "" }],
      });
    }

    setPagamentos((atual) => ({
      ...atual,
      [item.ordemId]: atual[item.ordemId] ?? {
        repValor: String(Math.max((item.comissaoRepresentanteLiberada ?? 0) - (item.comissaoRepresentanteRecebida ?? 0), 0)),
        repData: hoje(),
        prepValor: String(Math.max(item.comissaoPrepostoLiberada - item.comissaoPrepostoPaga, 0)),
        prepData: hoje(),
      },
    }));
  }

  function alterarQuantidadeParcelas(quantidade: number) {
    const qtd = Math.max(1, Math.min(24, quantidade));
    setFaturamento((atual) => {
      const parcelas = Array.from({ length: qtd }, (_, index) => atual.parcelas[index] ?? {
        numero: index + 1,
        vencimento: atual.data,
        valor: "",
      }).map((p, index) => ({ ...p, numero: index + 1 }));
      return { ...atual, parcelas };
    });
  }

  async function salvarFaturamento(event: FormEvent, item: ComissaoPedido) {
    event.preventDefault();
    setErro("");
    setMensagem("");

    try {
      const valor = Number(faturamento.valor.replace(",", "."));
      await faturarPedido({
        ordemId: item.ordemId,
        numeroPedido: faturamento.numeroPedido,
        numeroDocumento: faturamento.numeroDocumento,
        dataFaturamento: faturamento.data,
        valorFaturado: valor,
        parcelas: faturamento.parcelas.map((parcela) => ({
          numero: parcela.numero,
          vencimento: parcela.vencimento,
          valor: Number(parcela.valor.replace(",", ".")),
        })),
      });
      await recarregar();
      setMensagem("Pedido faturado. As comissões foram calculadas conforme a regra da representada.");
      setAbertoId(null);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível faturar o pedido.");
    }
  }

  async function salvarBaixa(recebimento: RecebimentoPedido) {
    const draft = baixas[recebimento.id];
    if (!draft) return;
    setErro("");
    setMensagem("");

    try {
      await registrarBaixa({
        recebimentoId: recebimento.id,
        valorRecebido: Number(draft.valor.replace(",", ".")),
        dataRecebimento: draft.data,
      });
      await recarregar();
      setRecebimentos(await carregarRecebimentos(recebimento.id === "" ? "" : abertoId ?? ""));
      setMensagem("Baixa registrada. A comissão liberada foi recalculada.");
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível registrar a baixa.");
    }
  }

  async function salvarPagamento(item: ComissaoPedido, tipo: "representante" | "preposto") {
    const draft = pagamentos[item.ordemId];
    if (!draft) return;

    const valor = tipo === "representante" ? draft.repValor : draft.prepValor;
    const data = tipo === "representante" ? draft.repData : draft.prepData;

    setErro("");
    setMensagem("");

    try {
      await registrarPagamentoComissao({
        ordemId: item.ordemId,
        tipo,
        valor: Number(valor.replace(",", ".")),
        data,
      });
      await recarregar();
      setMensagem(tipo === "representante" ? "Recebimento da comissão registrado." : "Pagamento ao preposto registrado.");
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível registrar o pagamento.");
    }
  }

  return (
    <AppShell>
      <header className="pageHeader">
        <div>
          <p className="eyebrow">FINANCEIRO COMERCIAL</p>
          <h1>Comissões</h1>
          <p>
            {modo === "preposto"
              ? "Acompanhe suas comissões previstas, liberadas e pagas."
              : "Controle faturamento, liquidação, comissão a receber e repasses aos prepostos."}
          </p>
        </div>
      </header>

      {erro && <div className="loginAlert error settingsAlert">{erro}</div>}
      {mensagem && <div className="loginAlert success settingsAlert">{mensagem}</div>}

      <section className={styles.stats}>
        <article><ReceiptText size={18} /><span>Comissão prevista</span><strong>{moeda(resumo.previsto)}</strong></article>
        <article><CircleDollarSign size={18} /><span>Comissão liberada</span><strong>{moeda(resumo.liberado)}</strong></article>
        <article><BadgeDollarSign size={18} /><span>A receber</span><strong>{moeda(resumo.pendente)}</strong></article>
        <article><WalletCards size={18} /><span>Já recebida</span><strong>{moeda(resumo.pago)}</strong></article>
        {modo === "gestao" && (
          <>
            <article><Banknote size={18} /><span>A pagar aos prepostos</span><strong>{moeda(resumo.prepostoPendente)}</strong></article>
            <article><CheckCircle2 size={18} /><span>Pago aos prepostos</span><strong>{moeda(resumo.prepostoPago)}</strong></article>
          </>
        )}
      </section>

      <section className={styles.filters}>
        <label className="field">
          Representada
          <select value={filtroRepresentada} onChange={(e) => setFiltroRepresentada(e.target.value)}>
            <option value="">Todas</option>
            {representadas.map((nome) => <option key={nome}>{nome}</option>)}
          </select>
        </label>
        <label className="field">
          Status do pedido
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
            <option value="">Todos</option>
            <option>Pedido lançado</option>
            <option>Faturado</option>
            <option>Liquidado parcial</option>
            <option>Liquidado</option>
            <option>Cancelado</option>
          </select>
        </label>
        {modo === "gestao" && (
          <label className="field">
            Responsável
            <select value={filtroResponsavel} onChange={(e) => setFiltroResponsavel(e.target.value)}>
              <option value="">Todos</option>
              {responsaveis.map((nome) => <option key={nome}>{nome}</option>)}
            </select>
          </label>
        )}
      </section>

      <section className={styles.list}>
        {carregando && <div className="panel">Carregando comissões...</div>}

        {!carregando && filtrados.map((item) => {
          const repPendente = Math.max((item.comissaoRepresentanteLiberada ?? 0) - (item.comissaoRepresentanteRecebida ?? 0), 0);
          const prepPendente = Math.max(item.comissaoPrepostoLiberada - item.comissaoPrepostoPaga, 0);
          const pagamento = pagamentos[item.ordemId];

          return (
            <article className={`panel ${styles.card}`} key={item.ordemId}>
              <button className={styles.cardHeader} type="button" onClick={() => void abrir(item)}>
                <div>
                  <strong>{item.clienteNome}</strong>
                  <span>{item.representadaNome} • {item.responsavelNome} • Venda {dataBr(item.dataVenda)}</span>
                </div>
                <div className={styles.statusArea}>
                  <span className={styles.status}>{item.statusPedido}</span>
                  {abertoId === item.ordemId ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                </div>
              </button>

              <div className={styles.summary}>
                <div><span>Faturado</span><strong>{moeda(item.valorFaturado)}</strong></div>
                <div><span>Liquidado</span><strong>{moeda(item.valorLiquidado)}</strong></div>
                <div><span>Regra</span><strong>{item.baseComissao === "faturado" ? "Faturado" : "Liquidado"}</strong></div>
                {modo === "gestao" ? (
                  <>
                    <div><span>Comissão liberada</span><strong>{moeda(item.comissaoRepresentanteLiberada ?? 0)}</strong></div>
                    <div><span>A receber</span><strong>{moeda(repPendente)}</strong></div>
                  </>
                ) : (
                  <>
                    <div><span>Sua comissão liberada</span><strong>{moeda(item.comissaoPrepostoLiberada)}</strong></div>
                    <div><span>A receber</span><strong>{moeda(prepPendente)}</strong></div>
                  </>
                )}
              </div>

              {abertoId === item.ordemId && (
                <div className={styles.details}>
                  {item.statusPedido === "Pedido lançado" && modo === "gestao" && (
                    <form className={styles.section} onSubmit={(event) => void salvarFaturamento(event, item)}>
                      <div className="settingsSectionTitle">
                        <FileCheck2 size={18} />
                        <div>
                          <strong>Faturar pedido</strong>
                          <span>Ao faturar, o sistema congela as regras de comissão vigentes para este pedido.</span>
                        </div>
                      </div>

                      <div className="formGrid">
                        <label className="field">Nº do pedido<input value={faturamento.numeroPedido} onChange={(e) => setFaturamento({ ...faturamento, numeroPedido: e.target.value })} /></label>
                        <label className="field">NF / documento<input value={faturamento.numeroDocumento} onChange={(e) => setFaturamento({ ...faturamento, numeroDocumento: e.target.value })} /></label>
                        <label className="field">Data do faturamento<input required type="date" value={faturamento.data} onChange={(e) => setFaturamento({ ...faturamento, data: e.target.value })} /></label>
                        <label className="field">Valor faturado<input required inputMode="decimal" value={faturamento.valor} onChange={(e) => setFaturamento({ ...faturamento, valor: e.target.value })} /></label>
                        <label className="field">Quantidade de parcelas<input type="number" min="1" max="24" value={faturamento.parcelas.length} onChange={(e) => alterarQuantidadeParcelas(Number(e.target.value))} /></label>
                      </div>

                      <div className={styles.parcelas}>
                        {faturamento.parcelas.map((parcela, index) => (
                          <div className={styles.parcela} key={parcela.numero}>
                            <strong>{index + 1}ª parcela</strong>
                            <label>Vencimento<input required type="date" value={parcela.vencimento} onChange={(e) => setFaturamento({
                              ...faturamento,
                              parcelas: faturamento.parcelas.map((p, i) => i === index ? { ...p, vencimento: e.target.value } : p),
                            })} /></label>
                            <label>Valor<input required inputMode="decimal" value={parcela.valor} onChange={(e) => setFaturamento({
                              ...faturamento,
                              parcelas: faturamento.parcelas.map((p, i) => i === index ? { ...p, valor: e.target.value } : p),
                            })} /></label>
                          </div>
                        ))}
                      </div>

                      <button className="primary" type="submit"><FileCheck2 size={16} /> Confirmar faturamento</button>
                    </form>
                  )}

                  {item.statusPedido !== "Pedido lançado" && (
                    <section className={styles.section}>
                      <div className="settingsSectionTitle">
                        <Banknote size={18} />
                        <div>
                          <strong>Parcelas e liquidação</strong>
                          <span>Baixas parciais liberam comissão proporcional quando a representada trabalha no liquidado.</span>
                        </div>
                      </div>

                      <div className={styles.parcelList}>
                        {recebimentos.map((r) => {
                          const draft = baixas[r.id] ?? { valor: String(r.valorRecebido), data: r.recebidoEm ?? hoje() };
                          return (
                            <div className={styles.recebimento} key={r.id}>
                              <div><strong>{r.numeroParcela}ª parcela</strong><span>Vence {dataBr(r.vencimento)} • {moeda(r.valorPrevisto)}</span></div>
                              <span className={styles.status}>{r.status}</span>
                              {modo === "gestao" ? (
                                <>
                                  <label>Valor recebido<input inputMode="decimal" value={draft.valor} onChange={(e) => setBaixas({ ...baixas, [r.id]: { ...draft, valor: e.target.value } })} /></label>
                                  <label>Data<input type="date" value={draft.data} onChange={(e) => setBaixas({ ...baixas, [r.id]: { ...draft, data: e.target.value } })} /></label>
                                  <button className="secondary" type="button" onClick={() => void salvarBaixa(r)}><Save size={14} /> Baixar</button>
                                </>
                              ) : (
                                <strong>{moeda(r.valorRecebido)}</strong>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  <section className={styles.section}>
                    <div className="settingsSectionTitle">
                      <CircleDollarSign size={18} />
                      <div>
                        <strong>Comissões deste pedido</strong>
                        <span>Previsões e valores liberados respeitam automaticamente Faturado ou Liquidado.</span>
                      </div>
                    </div>

                    {modo === "gestao" ? (
                      <div className={styles.commissionGrid}>
                        <div className={styles.commissionBox}>
                          <span>Representante</span>
                          <strong>{moeda(item.comissaoRepresentanteTotal ?? 0)}</strong>
                          <small>Liberada: {moeda(item.comissaoRepresentanteLiberada ?? 0)} • Recebida: {moeda(item.comissaoRepresentanteRecebida ?? 0)}</small>
                          <small>Previsão: {dataBr(item.previsaoRepresentante)}</small>
                          {repPendente > 0 && pagamento && (
                            <div className={styles.payForm}>
                              <label>Valor<input inputMode="decimal" value={pagamento.repValor} onChange={(e) => setPagamentos({ ...pagamentos, [item.ordemId]: { ...pagamento, repValor: e.target.value } })} /></label>
                              <label>Data<input type="date" value={pagamento.repData} onChange={(e) => setPagamentos({ ...pagamentos, [item.ordemId]: { ...pagamento, repData: e.target.value } })} /></label>
                              <button className="secondary" type="button" onClick={() => void salvarPagamento(item, "representante")}><CheckCircle2 size={14} /> Registrar recebimento</button>
                            </div>
                          )}
                        </div>

                        {item.responsavelUserId && item.comissaoPrepostoTotal > 0 && (
                          <div className={styles.commissionBox}>
                            <span>Preposto: {item.responsavelNome}</span>
                            <strong>{moeda(item.comissaoPrepostoTotal)}</strong>
                            <small>Liberada: {moeda(item.comissaoPrepostoLiberada)} • Paga: {moeda(item.comissaoPrepostoPaga)}</small>
                            <small>Previsão: {dataBr(item.previsaoPreposto)}</small>
                            {prepPendente > 0 && pagamento && (
                              <div className={styles.payForm}>
                                <label>Valor<input inputMode="decimal" value={pagamento.prepValor} onChange={(e) => setPagamentos({ ...pagamentos, [item.ordemId]: { ...pagamento, prepValor: e.target.value } })} /></label>
                                <label>Data<input type="date" value={pagamento.prepData} onChange={(e) => setPagamentos({ ...pagamentos, [item.ordemId]: { ...pagamento, prepData: e.target.value } })} /></label>
                                <button className="secondary" type="button" onClick={() => void salvarPagamento(item, "preposto")}><CheckCircle2 size={14} /> Registrar pagamento</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className={styles.commissionBox}>
                        <span>Sua comissão</span>
                        <strong>{moeda(item.comissaoPrepostoTotal)}</strong>
                        <small>Liberada: {moeda(item.comissaoPrepostoLiberada)} • Recebida: {moeda(item.comissaoPrepostoPaga)}</small>
                        <small>Previsão: {dataBr(item.previsaoPreposto)}</small>
                      </div>
                    )}
                  </section>
                </div>
              )}
            </article>
          );
        })}

        {!carregando && filtrados.length === 0 && <div className="panel emptyState">Nenhum pedido encontrado para os filtros atuais.</div>}
      </section>
    </AppShell>
  );
}
