"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import AppShell from "../components/AppShell";
import {
  bancoRemotoAtivo,
  Cliente,
  carregarClientes,
  clientesIniciais,
  criarCliente,
} from "../lib/data";

const formInicial = {
  nome: "",
  cidade: "",
  bairro: "",
  representada: "King Ouro",
  telefone: "",
  status: "Ativo",
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>(clientesIniciais);
  const [busca, setBusca] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(formInicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    void carregarClientes()
      .then(setClientes)
      .catch((falha: Error) => setErro(falha.message));
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
      ]
        .join(" ")
        .toLowerCase()
        .includes(termo),
    );
  }, [busca, clientes]);

  async function cadastrarCliente(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.nome.trim() || salvando) return;

    const novoCliente: Cliente = {
      id: `cliente-${Date.now()}`,
      nome: form.nome.trim(),
      cidade: form.cidade.trim(),
      bairro: form.bairro.trim(),
      representada: form.representada.trim() || "Não informada",
      telefone: form.telefone.trim(),
      status: form.status,
    };

    setSalvando(true);
    setErro("");

    try {
      const clienteSalvo = await criarCliente(novoCliente);
      setClientes((lista) => [
        clienteSalvo,
        ...lista.filter((cliente) => cliente.id !== clienteSalvo.id),
      ]);
      setForm(formInicial);
      setMostrarForm(false);
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
          <p>Cadastre, localize e acompanhe sua carteira de clientes.</p>
          <span className="tag">{bancoRemotoAtivo ? "Banco online" : "Modo local"}</span>
        </div>
        <button className="primary" onClick={() => setMostrarForm((valor) => !valor)}>
          {mostrarForm ? <X size={18} /> : <Plus size={18} />}
          {mostrarForm ? "Fechar" : "Novo cliente"}
        </button>
      </header>

      {erro && <div className="emptyState">{erro}</div>}

      {mostrarForm && (
        <form className="panel formPanel" onSubmit={cadastrarCliente}>
          <div className="panelTitle">
            <div>
              <p className="eyebrow">CADASTRO</p>
              <h2>Novo cliente</h2>
            </div>
          </div>

          <div className="formGrid">
            <label className="field span2">
              Nome do cliente
              <input
                autoFocus
                required
                value={form.nome}
                onChange={(event) => setForm({ ...form, nome: event.target.value })}
                placeholder="Ex.: Loja Central Materiais"
              />
            </label>
            <label className="field">
              Cidade
              <input
                value={form.cidade}
                onChange={(event) => setForm({ ...form, cidade: event.target.value })}
                placeholder="Ex.: Magé"
              />
            </label>
            <label className="field">
              Bairro
              <input
                value={form.bairro}
                onChange={(event) => setForm({ ...form, bairro: event.target.value })}
                placeholder="Ex.: Centro"
              />
            </label>
            <label className="field">
              Representada
              <select
                value={form.representada}
                onChange={(event) => setForm({ ...form, representada: event.target.value })}
              >
                <option>King Ouro</option>
                <option>Argamil</option>
                <option>Outra</option>
              </select>
            </label>
            <label className="field">
              Telefone / WhatsApp
              <input
                value={form.telefone}
                onChange={(event) => setForm({ ...form, telefone: event.target.value })}
                placeholder="(21) 99999-9999"
              />
            </label>
            <label className="field">
              Status
              <select
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
              >
                <option>Ativo</option>
                <option>Visitar hoje</option>
                <option>Retorno pendente</option>
                <option>Inativo</option>
              </select>
            </label>
          </div>

          <div className="formActions">
            <button className="secondary" type="button" onClick={() => setMostrarForm(false)}>
              Cancelar
            </button>
            <button className="primary" type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar cliente"}
            </button>
          </div>
        </form>
      )}

      <div className="search">
        <Search size={19} />
        <input
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          placeholder="Buscar por cliente, cidade, bairro, telefone ou representada..."
        />
      </div>

      <section className="panel">
        <div className="panelTitle">
          <div>
            <p className="eyebrow">CARTEIRA</p>
            <h2>{clientesFiltrados.length} clientes encontrados</h2>
          </div>
        </div>

        <div className="clientList">
          {clientesFiltrados.map((cliente, indice) => (
            <div className="client clientDetailed" key={cliente.id}>
              <div className="avatar">{cliente.nome.slice(0, 1).toUpperCase()}</div>
              <div className="clientInfo">
                <strong>{cliente.nome}</strong>
                <span>
                  {[cliente.bairro, cliente.cidade].filter(Boolean).join(" • ") || "Local não informado"}
                </span>
                {cliente.telefone && <span>{cliente.telefone}</span>}
              </div>
              <span className="tag">{cliente.representada}</span>
              <span className={indice === 0 && cliente.status === "Visitar hoje" ? "status attention" : "status"}>
                {cliente.status}
              </span>
            </div>
          ))}

          {clientesFiltrados.length === 0 && (
            <div className="emptyState">Nenhum cliente encontrado com esse filtro.</div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
