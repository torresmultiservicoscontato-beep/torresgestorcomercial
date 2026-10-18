"use client";

import { FormEvent, useEffect, useState } from "react";
import { Building2, PackagePlus, Pencil, Plus, Save, Users, X } from "lucide-react";
import AppShell from "../components/AppShell";
import {
  carregarPrepostosRepresentada,
  carregarProdutosRepresentada,
  carregarRepresentadasModulo,
  salvarProdutoRepresentada,
  salvarRepresentada,
  salvarRepassePreposto,
  type PrepostoRepresentada,
  type ProdutoRepresentada,
  type RepresentadaModulo,
} from "../lib/representadas";
import styles from "./representadas.module.css";

function vazio() {
  return {
    id: "" as string,
    nome: "",
    endereco: "",
    email: "",
    telefone: "",
    cnpj: "",
    comissaoPercentual: "",
    baseComissao: "liquidado" as "liquidado" | "faturado",
    diaRecebimentoComissao: "",
    observacaoComissao: "",
  };
}

export default function RepresentadasPage() {
  const [modo, setModo] = useState<"gestao" | "preposto">("gestao");
  const [representadas, setRepresentadas] = useState<RepresentadaModulo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(vazio());
  const [salvando, setSalvando] = useState(false);
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [produtos, setProdutos] = useState<ProdutoRepresentada[]>([]);
  const [prepostos, setPrepostos] = useState<PrepostoRepresentada[]>([]);
  const [produtoForm, setProdutoForm] = useState({ id: "", codigo: "", nome: "", unidade: "", ativo: true });
  const [repasseDraft, setRepasseDraft] = useState<Record<string, { comissao: string; dia: string }>>({});

  async function recarregar() {
    const dados = await carregarRepresentadasModulo();
    setModo(dados.modo);
    setRepresentadas(dados.representadas);
  }

  useEffect(() => {
    let ativo = true;
    void carregarRepresentadasModulo()
      .then((dados) => {
        if (!ativo) return;
        setModo(dados.modo);
        setRepresentadas(dados.representadas);
      })
      .catch((falha: Error) => {
        if (ativo) setErro(falha.message);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => { ativo = false; };
  }, []);

  function nova() {
    setForm(vazio());
    setMostrarForm(true);
    setErro("");
    setMensagem("");
  }

  function editar(item: RepresentadaModulo) {
    setForm({
      id: item.id,
      nome: item.nome,
      endereco: item.endereco,
      email: item.email,
      telefone: item.telefone,
      cnpj: item.cnpj,
      comissaoPercentual: item.comissaoPercentual === null ? "" : String(item.comissaoPercentual),
      baseComissao: item.baseComissao,
      diaRecebimentoComissao: item.diaRecebimentoComissao === null ? "" : String(item.diaRecebimentoComissao),
      observacaoComissao: item.observacaoComissao,
    });
    setMostrarForm(true);
    setErro("");
    setMensagem("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function salvar(event: FormEvent) {
    event.preventDefault();
    if (salvando) return;
    setSalvando(true);
    setErro("");
    setMensagem("");

    try {
      await salvarRepresentada({
        id: form.id || null,
        nome: form.nome,
        endereco: form.endereco,
        email: form.email,
        telefone: form.telefone,
        cnpj: form.cnpj,
        comissaoPercentual: Number(form.comissaoPercentual || 0),
        baseComissao: form.baseComissao,
        diaRecebimentoComissao: form.diaRecebimentoComissao ? Number(form.diaRecebimentoComissao) : null,
        observacaoComissao: form.observacaoComissao,
      });
      await recarregar();
      setMostrarForm(false);
      setForm(vazio());
      setMensagem("Representada salva com sucesso.");
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível salvar a representada.");
    } finally {
      setSalvando(false);
    }
  }

  async function abrirDetalhes(item: RepresentadaModulo) {
    if (modo === "preposto") return;
    const novoId = abertaId === item.id ? null : item.id;
    setAbertaId(novoId);
    if (!novoId) return;

    try {
      const [listaProdutos, listaPrepostos] = await Promise.all([
        carregarProdutosRepresentada(item.id),
        carregarPrepostosRepresentada(item.id),
      ]);
      setProdutos(listaProdutos);
      setPrepostos(listaPrepostos);
      setRepasseDraft(Object.fromEntries(listaPrepostos.map((preposto) => [
        preposto.vinculoId,
        {
          comissao: String(preposto.comissaoPrepostoPercentual),
          dia: preposto.diaPagamentoComissao === null ? "" : String(preposto.diaPagamentoComissao),
        },
      ])));
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível abrir os detalhes da representada.");
    }
  }

  async function salvarProduto(event: FormEvent, representadaId: string) {
    event.preventDefault();
    try {
      await salvarProdutoRepresentada(representadaId, {
        id: produtoForm.id || null,
        codigo: produtoForm.codigo,
        nome: produtoForm.nome,
        unidade: produtoForm.unidade,
        ativo: produtoForm.ativo,
      });
      setProdutos(await carregarProdutosRepresentada(representadaId));
      setProdutoForm({ id: "", codigo: "", nome: "", unidade: "", ativo: true });
      setMensagem("Produto salvo.");
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível salvar o produto.");
    }
  }

  async function salvarRepasse(item: RepresentadaModulo, preposto: PrepostoRepresentada) {
    const draft = repasseDraft[preposto.vinculoId];
    if (!draft) return;
    try {
      await salvarRepassePreposto({
        representadaId: item.id,
        vinculoId: preposto.vinculoId,
        comissaoPercentual: Number(draft.comissao || 0),
        diaPagamento: draft.dia ? Number(draft.dia) : null,
      });
      setMensagem(`Repasse de ${preposto.nome} atualizado.`);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível salvar o repasse.");
    }
  }

  return (
    <AppShell>
      <header className="pageHeader">
        <div>
          <p className="eyebrow">GESTÃO COMERCIAL</p>
          <h1>Representadas</h1>
          <p>
            {modo === "preposto"
              ? "Consulte as representadas vinculadas à sua operação e as condições da sua comissão."
              : "Cadastre dados comerciais, produtos, regras de comissão e repasses para prepostos."}
          </p>
        </div>
        {modo === "gestao" && (
          <button className="primary" type="button" onClick={mostrarForm ? () => setMostrarForm(false) : nova}>
            {mostrarForm ? <X size={18} /> : <Plus size={18} />}
            {mostrarForm ? "Fechar" : "Nova representada"}
          </button>
        )}
      </header>

      {erro && <div className="loginAlert error settingsAlert">{erro}</div>}
      {mensagem && <div className="loginAlert success settingsAlert">{mensagem}</div>}

      {modo === "gestao" && mostrarForm && (
        <form className="panel formPanel" onSubmit={salvar}>
          <div className="panelTitle">
            <div>
              <p className="eyebrow">{form.id ? "ALTERAR" : "NOVO CADASTRO"}</p>
              <h2>{form.id ? form.nome : "Cadastrar representada"}</h2>
            </div>
          </div>

          <div className="formGrid">
            <label className="field span2">
              Nome da representada *
              <input required value={form.nome} readOnly={Boolean(form.id)} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </label>
            <label className="field">
              CNPJ
              <input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
            </label>
            <label className="field">
              Telefone
              <input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            </label>
            <label className="field span2">
              E-mail
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="field span2">
              Endereço
              <input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
            </label>
          </div>

          <div className="permissionsBlock">
            <div className="settingsSectionTitle">
              <Building2 size={18} />
              <div>
                <strong>Comissão do representante</strong>
                <span>Defina quanto a representada paga e qual é o fato gerador da comissão.</span>
              </div>
            </div>
            <div className="formGrid">
              <label className="field">
                Comissão (%)
                <input type="number" min="0" max="100" step="0.01" value={form.comissaoPercentual} onChange={(e) => setForm({ ...form, comissaoPercentual: e.target.value })} />
              </label>
              <label className="field">
                Comissão calculada sobre
                <select value={form.baseComissao} onChange={(e) => setForm({ ...form, baseComissao: e.target.value as "liquidado" | "faturado" })}>
                  <option value="liquidado">Liquidado</option>
                  <option value="faturado">Faturado</option>
                </select>
              </label>
              <label className="field">
                Dia previsto para receber
                <input type="number" min="1" max="31" value={form.diaRecebimentoComissao} onChange={(e) => setForm({ ...form, diaRecebimentoComissao: e.target.value })} placeholder="Ex.: 15" />
              </label>
              <label className="field span2">
                Observação da comissão
                <textarea rows={3} value={form.observacaoComissao} onChange={(e) => setForm({ ...form, observacaoComissao: e.target.value })} placeholder="Ex.: comissão paga no mês seguinte ao fechamento." />
              </label>
            </div>
          </div>

          <button className="primary" type="submit" disabled={salvando}>
            <Save size={16} /> {salvando ? "Salvando..." : "Salvar representada"}
          </button>
        </form>
      )}

      <section className={styles.list}>
        {carregando && <div className="panel">Carregando representadas...</div>}

        {!carregando && representadas.map((item) => (
          <article className="panel" key={item.id}>
            <div className={styles.header}>
              <div>
                <strong>{item.nome}</strong>
                {modo === "gestao" && <span>{item.cnpj || "CNPJ não informado"}</span>}
              </div>

              {modo === "gestao" && (
                <div className={styles.actions}>
                  <button className="secondary" type="button" onClick={() => editar(item)}>
                    <Pencil size={14} /> Editar
                  </button>
                  <button className="secondary" type="button" onClick={() => void abrirDetalhes(item)}>
                    {abertaId === item.id ? "Fechar detalhes" : "Produtos e prepostos"}
                  </button>
                </div>
              )}
            </div>

            {modo === "preposto" ? (
              <div className={styles.prepostoGrid}>
                <div><span>Sua comissão</span><strong>{(item.comissaoPrepostoPercentual ?? 0).toLocaleString("pt-BR")}%</strong></div>
                <div><span>Base</span><strong>{item.baseComissao === "liquidado" ? "Liquidado" : "Faturado"}</strong></div>
                <div><span>Previsão de pagamento</span><strong>{item.diaPagamentoPreposto ? `Dia ${item.diaPagamentoPreposto}` : "Não informada"}</strong></div>
              </div>
            ) : (
              <div className={styles.summary}>
                <span>Comissão: <strong>{(item.comissaoPercentual ?? 0).toLocaleString("pt-BR")}%</strong></span>
                <span>Base: <strong>{item.baseComissao === "liquidado" ? "Liquidado" : "Faturado"}</strong></span>
                <span>Recebimento: <strong>{item.diaRecebimentoComissao ? `dia ${item.diaRecebimentoComissao}` : "não informado"}</strong></span>
              </div>
            )}

            {modo === "gestao" && abertaId === item.id && (
              <div className={styles.details}>
                <section>
                  <div className="settingsSectionTitle">
                    <PackagePlus size={18} />
                    <div>
                      <strong>Produtos da representada</strong>
                      <span>Este catálogo será usado depois para relatórios e identificação de itens vendidos.</span>
                    </div>
                  </div>

                  <form className={styles.productForm} onSubmit={(e) => void salvarProduto(e, item.id)}>
                    <input placeholder="Código" value={produtoForm.codigo} onChange={(e) => setProdutoForm({ ...produtoForm, codigo: e.target.value })} />
                    <input required placeholder="Produto" value={produtoForm.nome} onChange={(e) => setProdutoForm({ ...produtoForm, nome: e.target.value })} />
                    <input placeholder="Unidade" value={produtoForm.unidade} onChange={(e) => setProdutoForm({ ...produtoForm, unidade: e.target.value })} />
                    <button className="primary" type="submit"><Plus size={14} /> Salvar produto</button>
                  </form>

                  <div className={styles.simpleList}>
                    {produtos.map((produto) => (
                      <button type="button" key={produto.id} onClick={() => setProdutoForm({ id: produto.id, codigo: produto.codigo, nome: produto.nome, unidade: produto.unidade, ativo: produto.ativo })}>
                        <strong>{produto.nome}</strong>
                        <span>{[produto.codigo, produto.unidade].filter(Boolean).join(" • ") || "Sem código/unidade"}</span>
                      </button>
                    ))}
                    {produtos.length === 0 && <div className="emptyState">Nenhum produto cadastrado.</div>}
                  </div>
                </section>

                <section>
                  <div className="settingsSectionTitle">
                    <Users size={18} />
                    <div>
                      <strong>Repasse para prepostos</strong>
                      <span>Defina a comissão que cada preposto receberá e o dia previsto para pagamento.</span>
                    </div>
                  </div>

                  <div className={styles.simpleList}>
                    {prepostos.map((preposto) => {
                      const draft = repasseDraft[preposto.vinculoId] ?? { comissao: "", dia: "" };
                      return (
                        <div className={styles.repasse} key={preposto.vinculoId}>
                          <strong>{preposto.nome}</strong>
                          <label>Comissão %<input type="number" min="0" max="100" step="0.01" value={draft.comissao} onChange={(e) => setRepasseDraft({ ...repasseDraft, [preposto.vinculoId]: { ...draft, comissao: e.target.value } })} /></label>
                          <label>Dia do pagamento<input type="number" min="1" max="31" value={draft.dia} onChange={(e) => setRepasseDraft({ ...repasseDraft, [preposto.vinculoId]: { ...draft, dia: e.target.value } })} /></label>
                          <button className="secondary" type="button" onClick={() => void salvarRepasse(item, preposto)}><Save size={14} /> Salvar</button>
                        </div>
                      );
                    })}
                    {prepostos.length === 0 && <div className="emptyState">Nenhum preposto vinculado a esta representada.</div>}
                  </div>
                </section>
              </div>
            )}
          </article>
        ))}

        {!carregando && representadas.length === 0 && (
          <div className="panel emptyState">Nenhuma representada cadastrada nesta operação.</div>
        )}
      </section>
    </AppShell>
  );
}
