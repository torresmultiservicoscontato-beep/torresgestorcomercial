"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, X } from "lucide-react";
import AppShell from "../components/AppShell";
import { carregarAcessoAtual, pode } from "../lib/acesso";
import { Cliente, atualizarCliente, carregarClientes, criarCliente } from "../lib/data";

const formInicial = {
  nome: "",
  cidade: "",
  bairro: "",
  representada: "",
  telefone: "",
  status: "Ativo",
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [representadas, setRepresentadas] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(formInicial);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [podeCadastrar, setPodeCadastrar] = useState(false);
  const [podeEditar, setPodeEditar] = useState(false);

  useEffect(() => {
    let ativo = true;

    void Promise.all([carregarClientes(), carregarAcessoAtual()])
      .then(([listaClientes, acesso]) => {
        if (!ativo) return;
        setClientes(listaClientes);
        const listaRepresentadas = acesso?.representadas ?? [];
        setRepresentadas(listaRepresentadas);
        setPodeCadastrar(pode(acesso, "clientes", "cadastrar"));
        setPodeEditar(pode(acesso, "clientes", "editar"));
        setForm((atual) => ({
          ...atual,
          representada: atual.representada || listaRepresentadas[0] || "Não informada",
        }));
      })
      .catch((falha: Error) => {
        if (!ativo) return;
        setErro(falha.message);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  const clientesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return clientes;

    return clientes.filter((cliente) =>
      [
        cliente.nome,
        cliente.cidade,
        cliente.bairro,
        cliente.representada,
        cliente.telefone,
        cliente.responsavelNome,
      ]
        .join(" ")
        .toLowerCase()
        .includes(termo),
    );
  }, [busca, clientes]);

  function fecharFormulario() {
    setEditandoId(null);
    setMostrarForm(false);
    setForm({ ...formInicial, representada: representadas[0] || "Não informada" });
  }

  function editar(cliente: Cliente) {
    if (!podeEditar) return;
    setEditandoId(cliente.id);
    setForm({
      nome: cliente.nome,
      cidade: cliente.cidade,
      bairro: cliente.bairro,
      representada: cliente.representada,
      telefone: cliente.telefone,
      status: cliente.status,
    });
    setMostrarForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function salvarCliente(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.nome.trim() || salvando) return;

    const clienteExistente = editandoId
      ? clientes.find((cliente) => cliente.id === editandoId)
      : null;

    const clienteParaSalvar: Cliente = {
      id: editandoId ?? `cliente-${crypto.randomUUID()}`,
      nome: form.nome.trim(),
      cidade: form.cidade.trim(),
      bairro: form.bairro.trim(),
      representada: form.representada.trim() || "Não informada",
      telefone: form.telefone.trim(),
      status: form.status,
      responsavelUserId: clienteExistente?.responsavelUserId,
      responsavelNome: clienteExistente?.responsavelNome,
      responsavelTipo: clienteExistente?.responsavelTipo,
    };

    setSalvando(true);
    setErro("");

    try {
      const clienteSalvo = editandoId
        ? await atualizarCliente(clienteParaSalvar)
        : await criarCliente(clienteParaSalvar);

      setClientes((lista) =>
        editandoId
          ? lista.map((cliente) => (cliente.id === clienteSalvo.id ? clienteSalvo : cliente))
          : [clienteSalvo, ...lista],
      );
      fecharFormulario();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível salvar o cliente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <AppShell>
      <header className="pageHeader">
        <div>
          <p className="eyebrow">CARTEIRA COMERCIAL</p>
          <h1>Clientes</h1>
          <p>Cadastre, localize e acompanhe a carteira comercial da operação.</p>
          <span className="tag">Banco online</span>
        </div>
        {podeCadastrar && (
          <button
            className="primary"
            onClick={() => {
              if (mostrarForm) fecharFormulario();
              else setMostrarForm(true);
            }}
          >
            {mostrarForm ? <X size={18} /> : <Plus size={18} />}
            {mostrarForm ? "Fechar" : "Novo cliente"}
          </button>
        )}
      </header>

      {erro && <div className="emptyState">{erro}</div>}

      {mostrarForm && (
        <form className="panel formPanel" onSubmit={salvarCliente}>
          <div className="panelTitle">
            <div>
              <p className="eyebrow">{editandoId ? "ALTERAÇÃO" : "CADASTRO"}</p>
              <h2>{editandoId ? "Editar cliente" : "Novo cliente"}</h2>
            </div>
          </div>

          <div className="formGrid">
            <label className="field span2">
              Nome do cliente
              <input autoFocus required value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} placeholder="Ex.: Loja Central Materiais" />
            </label>
            <label className="field">
              Cidade
              <input value={form.cidade} onChange={(event) => setForm({ ...form, cidade: event.target.value })} placeholder="Ex.: Magé" />
            </label>
            <label className="field">
              Bairro
              <input value={form.bairro} onChange={(event) => setForm({ ...form, bairro: event.target.value })} placeholder="Ex.: Centro" />
            </label>
            <label className="field">
              Representada
              <select value={form.representada} onChange={(event) => setForm({ ...form, representada: event.target.value })}>
                {representadas.length > 0 ? representadas.map((representada) => (
                  <option key={representada} value={representada}>{representada}</option>
                )) : <option>Não informada</option>}
              </select>
            </label>
            <label className="field">
              Telefone / WhatsApp
              <input value={form.telefone} onChange={(event) => setForm({ ...form, telefone: event.target.value })} placeholder="(21) 99999-9999" />
            </label>
            <label className="field">
              Status
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option>Ativo</option>
                <option>Visitar hoje</option>
                <option>Retorno pendente</option>
                <option>Inativo</option>
              </select>
            </label>
          </div>

          <div className="formActions">
            <button className="secondary" type="button" onClick={fecharFormulario}>Cancelar</button>
            <button className="primary" type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : editandoId ? "Salvar alterações" : "Salvar cliente"}
            </button>
          </div>
        </form>
      )}

      <div className="search">
        <Search size={19} />
        <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar por cliente, cidade, bairro, telefone, representada ou responsável..." />
      </div>

      <section className="panel">
        <div className="panelTitle">
          <div>
            <p className="eyebrow">CARTEIRA</p>
            <h2>{carregando ? "Carregando clientes..." : `${clientesFiltrados.length} clientes encontrados`}</h2>
          </div>
        </div>

        <div className="clientList">
          {!carregando && clientesFiltrados.map((cliente, indice) => (
            <div className="client clientDetailed" key={cliente.id}>
              <div className="avatar">{cliente.nome.slice(0, 1).toUpperCase()}</div>
              <div className="clientInfo">
                <strong>{cliente.nome}</strong>
                <span>{[cliente.bairro, cliente.cidade].filter(Boolean).join(" • ") || "Local não informado"}</span>
                {cliente.telefone && <span>{cliente.telefone}</span>}
              </div>
              <span className="tag">{cliente.representada}</span>
              <span className={cliente.responsavelTipo === "preposto" ? "adminBadge" : "tag"}>
                {cliente.responsavelTipo === "preposto"
                  ? `Preposto: ${cliente.responsavelNome ?? "Não identificado"}`
                  : "Titular"}
              </span>
              <span className={indice === 0 && cliente.status === "Visitar hoje" ? "status attention" : "status"}>{cliente.status}</span>
              {podeEditar && (
                <button className="iconBtn editDataButton" type="button" onClick={() => editar(cliente)} title="Editar cliente">
                  <Pencil size={15} />
                </button>
              )}
            </div>
          ))}

          {!carregando && clientesFiltrados.length === 0 && <div className="emptyState">Nenhum cliente cadastrado ainda.</div>}
        </div>
      </section>
    </AppShell>
  );
}
