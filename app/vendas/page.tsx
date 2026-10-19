"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, ChevronDown, ChevronUp, FileText, ShoppingCart } from "lucide-react";
import AppShell from "../components/AppShell";
import {
  abrirDocumentoVenda,
  buscarClientesVenda,
  carregarRepresentadasFiltroVendas,
  carregarVendas,
  type ClienteBuscaVenda,
  type Venda,
} from "../lib/vendas";
import styles from "./vendas.module.css";

const situacoes = ["Pedido lançado", "Faturado", "Liquidado parcial", "Liquidado", "Cancelado"];

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: string) {
  return data ? data.split("-").reverse().join("/") : "—";
}

export default function VendasPage() {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [abertaId, setAbertaId] = useState<string | null>(null);

  const [buscaProduto, setBuscaProduto] = useState("");
  const [buscaCliente, setBuscaCliente] = useState("");
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState("");
  const [sugestoesClientes, setSugestoesClientes] = useState<ClienteBuscaVenda[]>([]);
  const [buscandoClientes, setBuscandoClientes] = useState(false);

  const [representadasFiltro, setRepresentadasFiltro] = useState<Array<{ id: string; nome: string }>>([]);
  const [filtroRepresentada, setFiltroRepresentada] = useState("");
  const [filtroResponsavel, setFiltroResponsavel] = useState("");
  const [filtroSituacao, setFiltroSituacao] = useState("");

  useEffect(() => {
    let ativo = true;

    void Promise.all([carregarVendas(), carregarRepresentadasFiltroVendas()])
      .then(([listaVendas, listaRepresentadas]) => {
        if (!ativo) return;
        setVendas(listaVendas);
        setRepresentadasFiltro(listaRepresentadas);
      })
      .catch((falha: Error) => {
        if (ativo) setErro(falha.message);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    const termo = buscaCliente.trim();

    if (clienteSelecionadoId || termo.length < 2) {
      setSugestoesClientes([]);
      setBuscandoClientes(false);
      return;
    }

    let ativo = true;
    const timer = window.setTimeout(() => {
      setBuscandoClientes(true);
      void buscarClientesVenda(termo)
        .then((lista) => {
          if (ativo) setSugestoesClientes(lista);
        })
        .catch((falha: Error) => {
          if (ativo) setErro(falha.message);
        })
        .finally(() => {
          if (ativo) setBuscandoClientes(false);
        });
    }, 250);

    return () => {
      ativo = false;
      window.clearTimeout(timer);
    };
  }, [buscaCliente, clienteSelecionadoId]);

  const responsaveis = useMemo(() => {
    const mapa = new Map<string, string>();
    vendas.forEach((venda) => mapa.set(venda.responsavelUserId, venda.responsavelNome));
    return Array.from(mapa.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [vendas]);

  const filtradas = useMemo(() => vendas.filter((venda) => {
    const termoProduto = buscaProduto.trim().toLowerCase();
    const bateCliente = !clienteSelecionadoId || venda.clienteId === clienteSelecionadoId;
    const bateProduto = !termoProduto || venda.itens.some((item) => item.produto.toLowerCase().includes(termoProduto));
    const bateRepresentada = !filtroRepresentada || venda.representadas.some((rep) => rep.id === filtroRepresentada);
    const bateResponsavel = !filtroResponsavel || venda.responsavelUserId === filtroResponsavel;
    const bateSituacao = !filtroSituacao || venda.situacao === filtroSituacao;
    return bateCliente && bateProduto && bateRepresentada && bateResponsavel && bateSituacao;
  }), [vendas, buscaProduto, clienteSelecionadoId, filtroRepresentada, filtroResponsavel, filtroSituacao]);

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

  function selecionarClienteFiltro(cliente: ClienteBuscaVenda) {
    setClienteSelecionadoId(cliente.id);
    setBuscaCliente(cliente.nome);
    setSugestoesClientes([]);
  }

  function alterarBuscaCliente(valor: string) {
    setBuscaCliente(valor);
    if (clienteSelecionadoId) setClienteSelecionadoId("");
  }

  return (
    <AppShell>
      <header className="pageHeader">
        <div>
          <p className="eyebrow">CONSULTA COMERCIAL</p>
          <h1>Vendas</h1>
          <p>Consulte as vendas registradas nas visitas. O lançamento e a edição comercial acontecem em Visitas; faturamento, baixas e comissões ficam no módulo Comissões.</p>
        </div>
        <Link className="secondary" href="/comissoes">
          <BadgeDollarSign size={16} />
          Gerenciar faturamento e comissões
        </Link>
      </header>

      {erro && <div className="loginAlert error settingsAlert">{erro}</div>}

      <section className={`stats ${styles.salesStats}`}>
        <article><span>Vendas no mês</span><strong>{resumoMes.quantidade}</strong><small>Pedidos registrados</small></article>
        <article><span>Valor no mês</span><strong>{formatarMoeda(resumoMes.total)}</strong><small>Sem canceladas</small></article>
        <article><span>Ticket médio</span><strong>{formatarMoeda(resumoMes.ticket)}</strong><small>Média por venda</small></article>
        <article><span>Itens registrados</span><strong>{resumoMes.itens}</strong><small>Produtos vinculados às vendas</small></article>
      </section>

      <section className={styles.filters}>
        <label className={`field ${styles.clientSearchField}`}>
          Cliente
          <input
            value={buscaCliente}
            onChange={(event) => alterarBuscaCliente(event.target.value)}
            placeholder="Digite pelo menos 2 letras"
            autoComplete="off"
          />
          {buscandoClientes && <small>Buscando clientes...</small>}

          {sugestoesClientes.length > 0 && (
            <div className={styles.clientSuggestions}>
              {sugestoesClientes.map((cliente) => (
                <button type="button" key={cliente.id} onClick={() => selecionarClienteFiltro(cliente)}>
                  <strong>{cliente.nome}</strong>
                  <span>{[cliente.bairro, cliente.cidade].filter(Boolean).join(" • ")}</span>
                </button>
              ))}
            </div>
          )}

          {clienteSelecionadoId && (
            <button
              className={styles.clearClient}
              type="button"
              onClick={() => {
                setClienteSelecionadoId("");
                setBuscaCliente("");
              }}
            >
              Limpar cliente
            </button>
          )}
        </label>

        <label className="field">
          Produto
          <input
            value={buscaProduto}
            onChange={(event) => setBuscaProduto(event.target.value)}
            placeholder="Buscar produto vendido"
          />
        </label>

        <label className="field">
          Representada
          <select value={filtroRepresentada} onChange={(event) => setFiltroRepresentada(event.target.value)}>
            <option value="">Todas</option>
            {representadasFiltro.map((rep) => <option key={rep.id} value={rep.id}>{rep.nome}</option>)}
          </select>
        </label>

        <label className="field">
          Vendedor
          <select value={filtroResponsavel} onChange={(event) => setFiltroResponsavel(event.target.value)}>
            <option value="">Todos</option>
            {responsaveis.map((responsavel) => <option key={responsavel.id} value={responsavel.id}>{responsavel.nome}</option>)}
          </select>
          <small>Representante titular ou preposto que realizou a venda.</small>
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

          return (
            <article className={`panel ${styles.saleCard}`} key={venda.id}>
              <button className={styles.saleHead} type="button" onClick={() => setAbertaId(aberta ? null : venda.id)}>
                <div className={styles.saleClient}>
                  <strong>{venda.clienteNome}</strong>
                  <span>{venda.representadas.map((rep) => rep.nome).join(" • ") || "Sem representada"}</span>
                </div>
                <div><span className="tag">{venda.situacao}</span></div>
                <div className={styles.saleValue}>{formatarMoeda(venda.valor)}</div>
                <div className={styles.saleMeta}>
                  {formatarData(venda.data)}<br />
                  {venda.responsavelNome}
                  {aberta ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {aberta && (
                <div className={styles.saleDetail}>
                  <div className={styles.detailGrid}>
                    <section className={styles.block}>
                      <h3>Forma de pagamento</h3>
                      <div className={styles.choices}>
                        {venda.formasPagamento.length > 0
                          ? venda.formasPagamento.map((forma) => <span className={`${styles.choice} ${styles.choiceActive}`} key={forma}>{forma}</span>)
                          : <span className="emptyState">Não informada.</span>}
                      </div>
                    </section>

                    <section className={styles.block}>
                      <h3>Condição / prazo</h3>
                      <div className={styles.choices}>
                        {venda.condicoesPrazo.length > 0
                          ? venda.condicoesPrazo.map((prazo) => <span className={`${styles.choice} ${styles.choiceActive}`} key={prazo}>{prazo}</span>)
                          : <span className="emptyState">Não informado.</span>}
                      </div>
                    </section>

                    <section className={styles.block}>
                      <h3>Situação</h3>
                      <div className={styles.choices}>
                        <span className={`${styles.choice} ${styles.choiceActive}`}>{venda.situacao}</span>
                      </div>
                    </section>

                    <section className={styles.block}>
                      <h3>Documentos do pedido</h3>
                      <div className={styles.documents}>
                        {venda.anexos.map((anexo) => (
                          <div className={styles.document} key={anexo.id}>
                            <div>
                              <strong>{anexo.nomeArquivo}</strong>
                              <span>{anexo.statusExtracao === "pendente" ? "Arquivo original guardado" : anexo.statusExtracao}</span>
                            </div>
                            <button
                              className="iconBtn"
                              type="button"
                              onClick={() => void abrirDocumentoVenda(anexo.caminhoStorage)}
                              title="Abrir documento"
                            >
                              <FileText size={14} />
                            </button>
                          </div>
                        ))}
                        {venda.anexos.length === 0 && <div className="emptyState">Nenhum documento anexado.</div>}
                      </div>
                    </section>

                    <section className={`${styles.block} ${styles.sectionWide}`}>
                      <h3>Produtos e mercadorias</h3>
                      {venda.itens.length > 0 ? (
                        <div className={styles.documents}>
                          {venda.itens.map((item) => (
                            <div className={styles.document} key={item.id}>
                              <div>
                                <strong>{item.produto}</strong>
                                <span>
                                  {item.quantidade !== null ? `${item.quantidade}${item.unidade ? ` ${item.unidade}` : ""}` : "Quantidade não informada"}
                                  {item.valorUnitario !== null ? ` • ${formatarMoeda(item.valorUnitario)} un.` : ""}
                                  {item.valorTotal !== null ? ` • Total ${formatarMoeda(item.valorTotal)}` : ""}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="emptyState">Nenhum produto informado nesta venda.</div>
                      )}
                    </section>
                  </div>
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
