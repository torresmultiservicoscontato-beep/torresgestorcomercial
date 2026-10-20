"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Boxes,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Pencil,
  PlugZap,
  Plus,
  Save,
  Search,
  Upload,
  X,
} from "lucide-react";
import AppShell from "../components/AppShell";
import {
  carregarComissoesProdutosPreposto,
  carregarPrepostosProduto,
  carregarProdutosModulo,
  carregarRepresentadasProdutos,
  salvarComissaoProdutoPreposto,
  salvarProduto,
  type PrepostoProduto,
  type ProdutoModulo,
  type RepresentadaProdutoFiltro,
} from "../lib/produtos";
import styles from "./produtos.module.css";

function formVazio() {
  return {
    id: "",
    representadaId: "",
    codigo: "",
    nome: "",
    unidade: "",
    quantidadeMinima: "1",
    ativo: true,
    comissaoPercentual: "",
  };
}

export default function ProdutosPage() {
  const [modo, setModo] = useState<"gestao" | "preposto">("gestao");
  const [representadas, setRepresentadas] = useState<RepresentadaProdutoFiltro[]>([]);
  const [produtos, setProdutos] = useState<ProdutoModulo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroRepresentada, setFiltroRepresentada] = useState("");
  const [filtroComissao, setFiltroComissao] = useState<"todos" | "especifica" | "padrao">("todos");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(formVazio());
  const [salvando, setSalvando] = useState(false);
  const [produtoComissoesId, setProdutoComissoesId] = useState<string | null>(null);
  const [prepostos, setPrepostos] = useState<PrepostoProduto[]>([]);
  const [comissoesDraft, setComissoesDraft] = useState<Record<string, { valor: string; especifica: boolean }>>({});

  async function recarregarProdutos(representadaId = filtroRepresentada) {
    setProdutos(await carregarProdutosModulo(representadaId || undefined));
  }

  useEffect(() => {
    let ativo = true;

    const representadaInicial = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("representada") ?? ""
      : "";

    if (representadaInicial) setFiltroRepresentada(representadaInicial);

    void Promise.all([
      carregarRepresentadasProdutos(),
      carregarProdutosModulo(representadaInicial || undefined),
    ])
      .then(([dadosRepresentadas, listaProdutos]) => {
        if (!ativo) return;
        setModo(dadosRepresentadas.modo);
        setRepresentadas(dadosRepresentadas.representadas);
        setProdutos(listaProdutos);
      })
      .catch((falha: Error) => {
        if (ativo) setErro(falha.message);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => { ativo = false; };
  }, []);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return produtos.filter((produto) => {
      const bateBusca = !termo
        || produto.nome.toLocaleLowerCase("pt-BR").includes(termo)
        || produto.codigo.toLocaleLowerCase("pt-BR").includes(termo);
      const bateRepresentada = !filtroRepresentada || produto.representadaId === filtroRepresentada;
      const bateComissao = modo === "preposto"
        ? true
        : filtroComissao === "todos"
          ? true
          : filtroComissao === "especifica"
            ? produto.comissaoRepresentantePercentual !== null
            : produto.comissaoRepresentantePercentual === null;
      return bateBusca && bateRepresentada && bateComissao;
    });
  }, [produtos, busca, filtroRepresentada, filtroComissao, modo]);

  async function alterarRepresentadaFiltro(id: string) {
    setFiltroRepresentada(id);
    setProdutoComissoesId(null);
    try {
      setProdutos(await carregarProdutosModulo(id || undefined));
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível filtrar produtos.");
    }
  }

  function novoProduto() {
    setForm({
      ...formVazio(),
      representadaId: filtroRepresentada || representadas[0]?.id || "",
    });
    setMostrarForm(true);
    setErro("");
    setMensagem("");
  }

  function editarProduto(produto: ProdutoModulo) {
    setForm({
      id: produto.id,
      representadaId: produto.representadaId,
      codigo: produto.codigo,
      nome: produto.nome,
      unidade: produto.unidade,
      quantidadeMinima: String(produto.quantidadeMinima),
      ativo: produto.ativo,
      comissaoPercentual: produto.comissaoRepresentantePercentual === null
        ? ""
        : String(produto.comissaoRepresentantePercentual),
    });
    setMostrarForm(true);
    setProdutoComissoesId(null);
    setErro("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function salvarCadastro(event: FormEvent) {
    event.preventDefault();
    if (salvando) return;
    if (!form.representadaId) {
      setErro("Selecione a representada do produto.");
      return;
    }

    setSalvando(true);
    setErro("");
    setMensagem("");

    try {
      await salvarProduto({
        id: form.id || null,
        representadaId: form.representadaId,
        codigo: form.codigo,
        nome: form.nome,
        unidade: form.unidade,
        quantidadeMinima: Number(form.quantidadeMinima.replace(",", ".")),
        ativo: form.ativo,
        comissaoPercentual: form.comissaoPercentual === "" ? null : Number(form.comissaoPercentual),
      });
      await recarregarProdutos();
      setForm(formVazio());
      setMostrarForm(false);
      setMensagem("Produto salvo com sucesso.");
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível salvar o produto.");
    } finally {
      setSalvando(false);
    }
  }

  async function abrirComissoes(produto: ProdutoModulo) {
    if (produtoComissoesId === produto.id) {
      setProdutoComissoesId(null);
      return;
    }

    setErro("");
    setProdutoComissoesId(produto.id);

    try {
      const listaPrepostos = await carregarPrepostosProduto(produto.representadaId);
      const detalhes = await Promise.all(
        listaPrepostos.map(async (preposto) => {
          const lista = await carregarComissoesProdutosPreposto(produto.representadaId, preposto.vinculoId);
          const detalhe = lista.find((item) => item.produtoId === produto.id);
          return {
            preposto,
            valor: detalhe?.comissaoPrepostoPercentual ?? preposto.comissaoGeral,
            especifica: Boolean(detalhe?.especifica),
          };
        }),
      );

      setPrepostos(listaPrepostos);
      setComissoesDraft(Object.fromEntries(detalhes.map(({ preposto, valor, especifica }) => [
        preposto.vinculoId,
        { valor: String(valor), especifica },
      ])));
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível carregar as comissões do produto.");
    }
  }

  async function salvarComissaoPreposto(produto: ProdutoModulo, preposto: PrepostoProduto) {
    const draft = comissoesDraft[preposto.vinculoId];
    if (!draft) return;

    try {
      await salvarComissaoProdutoPreposto({
        vinculoId: preposto.vinculoId,
        produtoId: produto.id,
        comissaoPercentual: draft.especifica ? Number(draft.valor || 0) : null,
      });
      setMensagem(
        draft.especifica
          ? `Comissão específica de ${preposto.nome} salva.`
          : `${preposto.nome} voltou a usar a comissão padrão da representada.`,
      );
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível salvar a comissão.");
    }
  }

  const representadaDoForm = representadas.find((item) => item.id === form.representadaId);
  const totalEspecifica = modo === "gestao" ? produtos.filter((produto) => produto.comissaoRepresentantePercentual !== null).length : 0;
  const totalPadrao = modo === "gestao" ? produtos.filter((produto) => produto.comissaoRepresentantePercentual === null).length : 0;

  return (
    <AppShell>
      <header className="pageHeader">
        <div>
          <p className="eyebrow">CATÁLOGO COMERCIAL</p>
          <h1>Produtos</h1>
          <p>
            {modo === "preposto"
              ? "Consulte produtos das suas representadas e a comissão que você recebe em cada item."
              : "Centralize o catálogo de produtos, comissões específicas e futuras importações."}
          </p>
        </div>

        {modo === "gestao" && (
          <button className="primary" type="button" onClick={mostrarForm ? () => setMostrarForm(false) : novoProduto}>
            {mostrarForm ? <X size={18} /> : <Plus size={18} />}
            {mostrarForm ? "Fechar" : "Novo produto"}
          </button>
        )}
      </header>

      {erro && <div className="loginAlert error settingsAlert">{erro}</div>}
      {mensagem && <div className="loginAlert success settingsAlert">{mensagem}</div>}

      {modo === "gestao" && (
        <section className={styles.importBar}>
          <button type="button" className={styles.importCard} disabled title="Importação em próxima etapa">
            <FileCode2 size={20} />
            <strong>Importar XML</strong>
            <span>NF-e / catálogo</span>
          </button>
          <button type="button" className={styles.importCard} disabled title="Importação em próxima etapa">
            <FileText size={20} />
            <strong>Importar PDF</strong>
            <span>Lista ou tabela</span>
          </button>
          <button type="button" className={styles.importCard} disabled title="Importação em próxima etapa">
            <FileSpreadsheet size={20} />
            <strong>Importar Excel</strong>
            <span>XLS / XLSX / CSV</span>
          </button>
          <button type="button" className={styles.importCard} disabled title="Integração em próxima etapa">
            <PlugZap size={20} />
            <strong>Integração API</strong>
            <span>Sincronização futura</span>
          </button>
        </section>
      )}

      {modo === "gestao" && mostrarForm && (
        <form className="panel formPanel" onSubmit={salvarCadastro}>
          <div className="panelTitle">
            <div>
              <p className="eyebrow">{form.id ? "ALTERAR PRODUTO" : "NOVO PRODUTO"}</p>
              <h2>{form.id ? form.nome : "Cadastrar produto"}</h2>
            </div>
          </div>

          <div className="formGrid">
            <label className="field span2">
              Representada *
              <select
                required
                disabled={Boolean(form.id)}
                value={form.representadaId}
                onChange={(event) => setForm({ ...form, representadaId: event.target.value })}
              >
                <option value="">Selecionar representada</option>
                {representadas.map((representada) => (
                  <option value={representada.id} key={representada.id}>{representada.nome}</option>
                ))}
              </select>
            </label>

            <label className="field">
              Código / SKU
              <input value={form.codigo} onChange={(event) => setForm({ ...form, codigo: event.target.value })} />
            </label>

            <label className="field span2">
              Produto *
              <input required value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} />
            </label>

            <label className="field">
              Unidade
              <input value={form.unidade} onChange={(event) => setForm({ ...form, unidade: event.target.value })} placeholder="UN, CX, KG..." />
            </label>

            <label className="field">
              Quantidade mínima *
              <input required type="number" min="0.001" max="999999999.999" step="0.001" value={form.quantidadeMinima} onChange={(event) => setForm({ ...form, quantidadeMinima: event.target.value })} />
              <small>Na unidade informada. Ex.: 1, 2, 3, 12 ou 100. Não define múltiplos de embalagem.</small>
            </label>

            <label className="field">
              Comissão específica do representante (%)
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.comissaoPercentual}
                onChange={(event) => setForm({ ...form, comissaoPercentual: event.target.value })}
                placeholder="Deixe vazio para usar a comissão geral"
              />
              <small>
                {representadaDoForm
                  ? `Comissão geral da representada: ${representadaDoForm.comissaoGeral.toLocaleString("pt-BR")}%`
                  : "Selecione uma representada."}
              </small>
            </label>

            <label className="field">
              Status
              <select value={form.ativo ? "ativo" : "inativo"} onChange={(event) => setForm({ ...form, ativo: event.target.value === "ativo" })}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </label>
          </div>

          <button className="primary" type="submit" disabled={salvando}>
            <Save size={16} /> {salvando ? "Salvando..." : "Salvar produto"}
          </button>
        </form>
      )}

      {modo === "gestao" && (
        <section className={styles.catalogSummary}>
          <div><span>Produtos carregados</span><strong>{produtos.length}</strong></div>
          <div><span>Usando comissão padrão</span><strong>{totalPadrao}</strong></div>
          <div><span>Com comissão específica</span><strong>{totalEspecifica}</strong></div>
        </section>
      )}

      <section className={styles.filters}>
        <label className="field">
          <span><Search size={13} /> Buscar produto</span>
          <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Nome ou código" />
        </label>

        <label className="field">
          Representada
          <select value={filtroRepresentada} onChange={(event) => void alterarRepresentadaFiltro(event.target.value)}>
            <option value="">Todas</option>
            {representadas.map((representada) => (
              <option value={representada.id} key={representada.id}>{representada.nome}</option>
            ))}
          </select>
        </label>

        {modo === "gestao" && (
          <label className="field">
            Regra de comissão
            <select value={filtroComissao} onChange={(event) => setFiltroComissao(event.target.value as "todos" | "especifica" | "padrao")}>
              <option value="todos">Todos os produtos</option>
              <option value="especifica">Somente comissão específica</option>
              <option value="padrao">Somente comissão padrão</option>
            </select>
          </label>
        )}
      </section>

      <section className={styles.list}>
        {carregando && <div className="panel">Carregando produtos...</div>}

        {!carregando && filtrados.map((produto) => (
          <article className={`panel ${styles.productCard}`} key={produto.id}>
            <div className={styles.productHeader}>
              <div className={styles.productIdentity}>
                <Boxes size={18} />
                <div>
                  <strong>{produto.nome}</strong>
                  <span>
                    {produto.representadaNome}
                    {produto.codigo ? ` • Cód. ${produto.codigo}` : ""}
                    {produto.unidade ? ` • ${produto.unidade}` : ""}
                    {` • Mínimo: ${produto.quantidadeMinima.toLocaleString("pt-BR")} ${produto.unidade}` }
                  </span>
                </div>
              </div>

              {modo === "gestao" && (
                <div className={styles.actions}>
                  <button className="secondary" type="button" onClick={() => editarProduto(produto)}>
                    <Pencil size={14} /> Editar
                  </button>
                  <button className="secondary" type="button" onClick={() => void abrirComissoes(produto)}>
                    {produtoComissoesId === produto.id ? "Fechar comissões" : "Comissões dos prepostos"}
                  </button>
                </div>
              )}
            </div>

            {modo === "gestao" ? (
              <div className={styles.commissionSummary}>
                {(() => {
                  const representada = representadas.find((item) => item.id === produto.representadaId);
                  const padrao = representada?.comissaoGeral ?? 0;
                  return produto.comissaoRepresentantePercentual === null ? (
                    <span className={styles.ruleBadge}>
                      Comissão: <strong>Padrão {padrao.toLocaleString("pt-BR")}%</strong>
                      <small>Usando regra geral da representada</small>
                    </span>
                  ) : (
                    <>
                      <span className={styles.ruleBadge}>
                        Comissão específica: <strong>{produto.comissaoRepresentantePercentual.toLocaleString("pt-BR")}%</strong>
                        <small>Exceção deste produto</small>
                      </span>
                      <span>Padrão da representada: <strong>{padrao.toLocaleString("pt-BR")}%</strong></span>
                    </>
                  );
                })()}
                <span>Status: <strong>{produto.ativo ? "Ativo" : "Inativo"}</strong></span>
              </div>
            ) : (
              <div className={styles.prepostoCommission}>
                <span>Sua comissão neste produto</span>
                <strong>{(produto.comissaoPrepostoPercentual ?? 0).toLocaleString("pt-BR")}%</strong>
                <small>{produto.comissaoPrepostoEspecifica ? "Comissão específica deste produto" : "Comissão padrão da representada"}</small>
              </div>
            )}

            {modo === "gestao" && produtoComissoesId === produto.id && (
              <div className={styles.commissionPanel}>
                <div className="settingsSectionTitle">
                  <Upload size={18} />
                  <div>
                    <strong>Comissão do preposto por produto</strong>
                    <span>Por padrão o preposto usa a comissão geral da representada. Ative uma comissão específica somente quando necessário.</span>
                  </div>
                </div>

                {prepostos.map((preposto) => {
                  const draft = comissoesDraft[preposto.vinculoId] ?? {
                    valor: String(preposto.comissaoGeral),
                    especifica: false,
                  };

                  return (
                    <div className={styles.prepostoRow} key={preposto.vinculoId}>
                      <div>
                        <strong>{preposto.nome}</strong>
                        <span>Padrão: {preposto.comissaoGeral.toLocaleString("pt-BR")}%</span>
                      </div>

                      <label className={styles.switchLabel}>
                        <input
                          type="checkbox"
                          checked={draft.especifica}
                          onChange={(event) => setComissoesDraft({
                            ...comissoesDraft,
                            [preposto.vinculoId]: {
                              valor: event.target.checked ? draft.valor : String(preposto.comissaoGeral),
                              especifica: event.target.checked,
                            },
                          })}
                        />
                        Comissão específica
                      </label>

                      <label className="field">
                        Comissão %
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={!draft.especifica}
                          value={draft.valor}
                          onChange={(event) => setComissoesDraft({
                            ...comissoesDraft,
                            [preposto.vinculoId]: { ...draft, valor: event.target.value },
                          })}
                        />
                      </label>

                      <button className="secondary" type="button" onClick={() => void salvarComissaoPreposto(produto, preposto)}>
                        <Save size={14} /> Salvar
                      </button>
                    </div>
                  );
                })}

                {prepostos.length === 0 && <div className="emptyState">Nenhum preposto vinculado a esta representada.</div>}
              </div>
            )}
          </article>
        ))}

        {!carregando && filtrados.length === 0 && (
          <div className="panel emptyState">Nenhum produto encontrado.</div>
        )}
      </section>
    </AppShell>
  );
}
