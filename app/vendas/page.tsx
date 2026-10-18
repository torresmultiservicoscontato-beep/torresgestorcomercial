"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, FileText, Paperclip, Plus, Save, ShoppingCart, Trash2 } from "lucide-react";
import AppShell from "../components/AppShell";
import { carregarAcessoAtual, pode } from "../lib/acesso";
import {
  abrirDocumentoVenda,
  anexarDocumentoVenda,
  carregarVendas,
  salvarComplementoVenda,
  type ItemVendaInput,
  type Venda,
} from "../lib/vendas";
import styles from "./vendas.module.css";

const formasPagamento = ["Boleto", "Pix", "Cartão de crédito", "Dinheiro", "Transferência"];
const condicoesPrazo = ["À vista", "7 dias", "14 dias", "21 dias", "28 dias", "30 dias", "30/60", "30/60/90"];
const situacoes = ["Pedido lançado", "Faturado", "Liquidado parcial", "Liquidado", "Cancelado"];

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: string) {
  return data ? data.split("-").reverse().join("/") : "—";
}

function itemVazio(): ItemVendaInput {
  return { produto: "", codigo: "", quantidade: "", unidade: "", valorUnitario: "", valorTotal: "", representadaId: "" };
}

export default function VendasPage() {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [podeEditar, setPodeEditar] = useState(false);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroRepresentada, setFiltroRepresentada] = useState("");
  const [filtroResponsavel, setFiltroResponsavel] = useState("");
  const [filtroSituacao, setFiltroSituacao] = useState("");
  const [rascunhos, setRascunhos] = useState<Record<string, {
    formasPagamento: string[];
    condicoesPrazo: string[];
    situacao: string;
    itens: ItemVendaInput[];
  }>>({});

  async function recarregar() {
    const lista = await carregarVendas();
    setVendas(lista);
    setRascunhos(Object.fromEntries(lista.map((venda) => [venda.id, {
      formasPagamento: venda.formasPagamento,
      condicoesPrazo: venda.condicoesPrazo,
      situacao: venda.situacao,
      itens: venda.itens.length > 0
        ? venda.itens.map((item) => ({
            produto: item.produto,
            codigo: item.codigo,
            quantidade: item.quantidade === null ? "" : String(item.quantidade),
            unidade: item.unidade,
            valorUnitario: item.valorUnitario === null ? "" : String(item.valorUnitario),
            valorTotal: item.valorTotal === null ? "" : String(item.valorTotal),
            representadaId: item.representadaId ?? "",
          }))
        : [],
    }])));
  }

  useEffect(() => {
    let ativo = true;
    Promise.all([carregarVendas(), carregarAcessoAtual()])
      .then(([lista, acesso]) => {
        if (!ativo) return;
        setVendas(lista);
        setPodeEditar(pode(acesso, "vendas", "editar"));
        setRascunhos(Object.fromEntries(lista.map((venda) => [venda.id, {
          formasPagamento: venda.formasPagamento,
          condicoesPrazo: venda.condicoesPrazo,
          situacao: venda.situacao,
          itens: venda.itens.map((item) => ({
            produto: item.produto,
            codigo: item.codigo,
            quantidade: item.quantidade === null ? "" : String(item.quantidade),
            unidade: item.unidade,
            valorUnitario: item.valorUnitario === null ? "" : String(item.valorUnitario),
            valorTotal: item.valorTotal === null ? "" : String(item.valorTotal),
            representadaId: item.representadaId ?? "",
          })),
        }])));
      })
      .catch((falha: Error) => {
        if (ativo) setErro(falha.message);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => { ativo = false; };
  }, []);

  const representadas = useMemo(() => {
    const mapa = new Map<string, string>();
    vendas.forEach((venda) => venda.representadas.forEach((rep) => mapa.set(rep.id, rep.nome)));
    return Array.from(mapa.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [vendas]);

  const responsaveis = useMemo(() => {
    const mapa = new Map<string, string>();
    vendas.forEach((venda) => mapa.set(venda.responsavelUserId, venda.responsavelNome));
    return Array.from(mapa.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [vendas]);

  const filtradas = useMemo(() => vendas.filter((venda) => {
    const termo = busca.trim().toLowerCase();
    const bateBusca = !termo
      || venda.clienteNome.toLowerCase().includes(termo)
      || venda.itens.some((item) => item.produto.toLowerCase().includes(termo));
    const bateRepresentada = !filtroRepresentada || venda.representadas.some((rep) => rep.id === filtroRepresentada);
    const bateResponsavel = !filtroResponsavel || venda.responsavelUserId === filtroResponsavel;
    const bateSituacao = !filtroSituacao || venda.situacao === filtroSituacao;
    return bateBusca && bateRepresentada && bateResponsavel && bateSituacao;
  }), [vendas, busca, filtroRepresentada, filtroResponsavel, filtroSituacao]);

  const resumoMes = useMemo(() => {
    const agora = new Date();
    const prefixo = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
    const doMes = vendas.filter((venda) => venda.data.startsWith(prefixo) && venda.situacao !== "Cancelado");
    const total = doMes.reduce((soma, venda) => soma + venda.valor, 0);
    return {
      quantidade: doMes.length,
      total,
      ticket: doMes.length ? total / doMes.length : 0,
      itens: doMes.reduce((soma, venda) => soma + venda.itens.length, 0),
    };
  }, [vendas]);

  function alternarArray(vendaId: string, campo: "formasPagamento" | "condicoesPrazo", valor: string, marcado: boolean) {
    setRascunhos((atual) => {
      const base = atual[vendaId];
      if (!base) return atual;
      return {
        ...atual,
        [vendaId]: {
          ...base,
          [campo]: marcado
            ? Array.from(new Set([...base[campo], valor]))
            : base[campo].filter((item) => item !== valor),
        },
      };
    });
  }

  function atualizarItem(vendaId: string, indice: number, campo: keyof ItemVendaInput, valor: string) {
    setRascunhos((atual) => {
      const base = atual[vendaId];
      if (!base) return atual;
      const itens = [...base.itens];
      itens[indice] = { ...itens[indice], [campo]: valor };
      return { ...atual, [vendaId]: { ...base, itens } };
    });
  }

  function adicionarItem(vendaId: string) {
    setRascunhos((atual) => {
      const base = atual[vendaId];
      if (!base) return atual;
      return { ...atual, [vendaId]: { ...base, itens: [...base.itens, itemVazio()] } };
    });
  }

  function removerItem(vendaId: string, indice: number) {
    setRascunhos((atual) => {
      const base = atual[vendaId];
      if (!base) return atual;
      return { ...atual, [vendaId]: { ...base, itens: base.itens.filter((_, i) => i !== indice) } };
    });
  }

  async function salvar(venda: Venda) {
    const rascunho = rascunhos[venda.id];
    if (!rascunho || salvandoId) return;
    setSalvandoId(venda.id);
    setErro("");
    setMensagem("");
    try {
      await salvarComplementoVenda(venda, rascunho);
      await recarregar();
      setMensagem("Venda atualizada com sucesso.");
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível atualizar a venda.");
    } finally {
      setSalvandoId(null);
    }
  }

  async function anexar(venda: Venda, event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    event.target.value = "";
    if (!arquivo || enviandoId) return;
    setEnviandoId(venda.id);
    setErro("");
    setMensagem("");
    try {
      await anexarDocumentoVenda(venda, arquivo);
      await recarregar();
      setMensagem("Documento anexado à venda.");
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível anexar o documento.");
    } finally {
      setEnviandoId(null);
    }
  }

  return (
    <AppShell>
      <header className="pageHeader">
        <div>
          <p className="eyebrow">GESTÃO COMERCIAL</p>
          <h1>Vendas</h1>
          <p>As vendas nascem das visitas. Aqui ficam pedidos, produtos, condições e documentos da negociação.</p>
        </div>
      </header>

      {erro && <div className="loginAlert error settingsAlert">{erro}</div>}
      {mensagem && <div className="loginAlert success settingsAlert">{mensagem}</div>}

      <section className={`stats ${styles.salesStats}`}>
        <article><span>Vendas no mês</span><strong>{resumoMes.quantidade}</strong><small>Pedidos registrados</small></article>
        <article><span>Valor no mês</span><strong>{formatarMoeda(resumoMes.total)}</strong><small>Sem canceladas</small></article>
        <article><span>Ticket médio</span><strong>{formatarMoeda(resumoMes.ticket)}</strong><small>Média por venda</small></article>
        <article><span>Itens registrados</span><strong>{resumoMes.itens}</strong><small>Base para análise de produtos</small></article>
      </section>

      <section className={styles.filters}>
        <label className="field">
          Buscar
          <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Cliente ou produto" />
        </label>
        <label className="field">
          Representada
          <select value={filtroRepresentada} onChange={(event) => setFiltroRepresentada(event.target.value)}>
            <option value="">Todas</option>
            {representadas.map((rep) => <option key={rep.id} value={rep.id}>{rep.nome}</option>)}
          </select>
        </label>
        <label className="field">
          Responsável
          <select value={filtroResponsavel} onChange={(event) => setFiltroResponsavel(event.target.value)}>
            <option value="">Todos</option>
            {responsaveis.map((responsavel) => <option key={responsavel.id} value={responsavel.id}>{responsavel.nome}</option>)}
          </select>
        </label>
        <label className="field">
          Situação
          <select value={filtroSituacao} onChange={(event) => setFiltroSituacao(event.target.value)}>
            <option value="">Todas</option>
            {situacoes.map((situacao) => <option key={situacao}>{situacao}</option>)}
          </select>
        </label>
      </section>

      <section className={styles.list}>
        {carregando && <div className="panel">Carregando vendas...</div>}
        {!carregando && filtradas.map((venda) => {
          const aberta = abertaId === venda.id;
          const rascunho = rascunhos[venda.id];
          return (
            <article className={`panel ${styles.saleCard}`} key={venda.id}>
              <button className={styles.saleHead} type="button" onClick={() => setAbertaId(aberta ? null : venda.id)}>
                <div className={styles.saleClient}>
                  <strong>{venda.clienteNome}</strong>
                  <span>{venda.representadas.map((rep) => rep.nome).join(" • ") || "Sem representada"}</span>
                </div>
                <div>
                  <span className="tag">{venda.situacao}</span>
                </div>
                <div className={styles.saleValue}>{formatarMoeda(venda.valor)}</div>
                <div className={styles.saleMeta}>
                  {formatarData(venda.data)}<br />{venda.responsavelNome}
                  {aberta ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {aberta && rascunho && (
                <div className={styles.saleDetail}>
                  <div className={styles.detailGrid}>
                    <section className={styles.block}>
                      <h3>Forma de pagamento</h3>
                      <div className={styles.choices}>
                        {formasPagamento.map((forma) => {
                          const marcado = rascunho.formasPagamento.includes(forma);
                          return (
                            <label className={`${styles.choice} ${marcado ? styles.choiceActive : ""}`} key={forma}>
                              <input type="checkbox" disabled={!podeEditar} checked={marcado} onChange={(event) => alternarArray(venda.id, "formasPagamento", forma, event.target.checked)} />
                              {forma}
                            </label>
                          );
                        })}
                      </div>
                    </section>

                    <section className={styles.block}>
                      <h3>Condição / prazo</h3>
                      <div className={styles.choices}>
                        {condicoesPrazo.map((prazo) => {
                          const marcado = rascunho.condicoesPrazo.includes(prazo);
                          return (
                            <label className={`${styles.choice} ${marcado ? styles.choiceActive : ""}`} key={prazo}>
                              <input type="checkbox" disabled={!podeEditar} checked={marcado} onChange={(event) => alternarArray(venda.id, "condicoesPrazo", prazo, event.target.checked)} />
                              {prazo}
                            </label>
                          );
                        })}
                      </div>
                    </section>

                    <section className={styles.block}>
                      <h3>Situação</h3>
                      <div className={styles.choices}>
                        {situacoes.map((situacao) => (
                          <label className={`${styles.choice} ${rascunho.situacao === situacao ? styles.choiceActive : ""}`} key={situacao}>
                            <input
                              type="radio"
                              name={`situacao-${venda.id}`}
                              disabled={!podeEditar}
                              checked={rascunho.situacao === situacao}
                              onChange={() => setRascunhos((atual) => ({
                                ...atual,
                                [venda.id]: { ...atual[venda.id], situacao },
                              }))}
                            />
                            {situacao}
                          </label>
                        ))}
                      </div>
                    </section>

                    <section className={styles.block}>
                      <h3>Documento do pedido</h3>
                      <div className={styles.documents}>
                        {venda.anexos.map((anexo) => (
                          <div className={styles.document} key={anexo.id}>
                            <div>
                              <strong>{anexo.nomeArquivo}</strong>
                              <span>{anexo.statusExtracao === "pendente" ? "Guardado • aguardando extração estruturada" : anexo.statusExtracao}</span>
                            </div>
                            <div className={styles.docActions}>
                              <button className="iconBtn" type="button" onClick={() => void abrirDocumentoVenda(anexo.caminhoStorage)} title="Abrir documento">
                                <FileText size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                        {venda.anexos.length === 0 && <span className="emptyState">Nenhum documento anexado.</span>}
                      </div>
                      {podeEditar && (
                        <label className={styles.uploadBox}>
                          <Paperclip size={16} />
                          <span>{enviandoId === venda.id ? "Enviando..." : "Anexar PDF, Excel, CSV ou imagem"}</span>
                          <input
                            type="file"
                            disabled={enviandoId === venda.id}
                            accept=".pdf,.xls,.xlsx,.csv,image/jpeg,image/png,image/webp"
                            onChange={(event) => void anexar(venda, event)}
                          />
                        </label>
                      )}
                    </section>

                    <section className={`${styles.block} ${styles.sectionWide}`}>
                      <div className="panelTitle">
                        <h3>Produtos e mercadorias</h3>
                        {podeEditar && (
                          <button className="secondary" type="button" onClick={() => adicionarItem(venda.id)}>
                            <Plus size={14} /> Adicionar item
                          </button>
                        )}
                      </div>
                      <div className={styles.items}>
                        {rascunho.itens.map((item, indice) => (
                          <div className={styles.itemRow} key={indice}>
                            <label className="field">
                              Produto
                              <input disabled={!podeEditar} value={item.produto} onChange={(event) => atualizarItem(venda.id, indice, "produto", event.target.value)} placeholder="Descrição da mercadoria" />
                            </label>
                            <label className="field">
                              Qtd.
                              <input disabled={!podeEditar} value={item.quantidade ?? ""} onChange={(event) => atualizarItem(venda.id, indice, "quantidade", event.target.value)} inputMode="decimal" />
                            </label>
                            <label className="field">
                              Unidade
                              <input disabled={!podeEditar} value={item.unidade ?? ""} onChange={(event) => atualizarItem(venda.id, indice, "unidade", event.target.value)} placeholder="UN, CX..." />
                            </label>
                            <label className="field">
                              Valor un.
                              <input disabled={!podeEditar} value={item.valorUnitario ?? ""} onChange={(event) => atualizarItem(venda.id, indice, "valorUnitario", event.target.value)} inputMode="decimal" />
                            </label>
                            {podeEditar && <button className={styles.itemRemove} type="button" onClick={() => removerItem(venda.id, indice)} title="Remover item"><Trash2 size={14} /></button>}
                          </div>
                        ))}
                        {rascunho.itens.length === 0 && <div className="emptyState">Nenhum produto estruturado nesta venda.</div>}
                      </div>
                    </section>
                  </div>

                  {podeEditar && (
                    <div className={styles.saveBar}>
                      <button className="primary" type="button" disabled={salvandoId === venda.id} onClick={() => void salvar(venda)}>
                        <Save size={15} /> {salvandoId === venda.id ? "Salvando..." : "Salvar complementos"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
        {!carregando && filtradas.length === 0 && (
          <div className={`panel ${styles.empty}`}>
            <ShoppingCart size={24} />
            <p>Nenhuma venda encontrada com os filtros selecionados.</p>
          </div>
        )}
      </section>
    </AppShell>
  );
}
