"use client";

import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AppShell from "./components/AppShell";
import {
  Cliente,
  Visita,
  carregarClientes,
  carregarVisitas,
  clientesIniciais,
} from "./lib/data";

export default function HomePage() {
  const [clientes, setClientes] = useState<Cliente[]>(clientesIniciais);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;

    void Promise.all([carregarClientes(), carregarVisitas()])
      .then(([listaClientes, listaVisitas]) => {
        if (!ativo) return;
        setClientes(listaClientes);
        setVisitas(listaVisitas);
      })
      .catch((falha: Error) => {
        if (!ativo) return;
        setErro(falha.message);
      });

    return () => {
      ativo = false;
    };
  }, []);

  const clientesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return clientes.slice(0, 5);

    return clientes
      .filter((cliente) =>
        [cliente.nome, cliente.cidade, cliente.bairro, cliente.representada]
          .join(" ")
          .toLowerCase()
          .includes(termo),
      )
      .slice(0, 5);
  }, [busca, clientes]);

  const representadas = new Set(clientes.map((cliente) => cliente.representada)).size;

  return (
    <AppShell>
      <header>
        <div>
          <p className="eyebrow">PAINEL COMERCIAL</p>
          <h1>Boa noite, Torres.</h1>
          <p>Seu dia comercial em um só lugar.</p>
        </div>
        <div className="actions">
          <Link className="primary" href="/clientes">+ Novo cliente</Link>
        </div>
      </header>

      {erro && <div className="emptyState">{erro}</div>}

      <div className="search">
        <Search size={19} />
        <input
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          placeholder="Buscar cliente, cidade, bairro ou representada..."
        />
      </div>

      <section className="stats">
        <article>
          <span>Clientes cadastrados</span>
          <strong>{clientes.length}</strong>
          <small>Carteira atual</small>
        </article>
        <article>
          <span>Visitas registradas</span>
          <strong>{visitas.length}</strong>
          <small>Histórico do usuário</small>
        </article>
        <article>
          <span>Representadas</span>
          <strong>{representadas}</strong>
          <small>Marcas na carteira</small>
        </article>
        <article>
          <span>Próxima ação</span>
          <strong>Visita</strong>
          <small>Registre o próximo atendimento</small>
        </article>
      </section>

      <div className="grid">
        <section className="panel">
          <div className="panelTitle">
            <div>
              <p className="eyebrow">CARTEIRA</p>
              <h2>Clientes</h2>
            </div>
            <Link className="textLink" href="/clientes">Ver todos</Link>
          </div>

          <div className="clientList">
            {clientesFiltrados.map((cliente, indice) => (
              <Link className="client clientLink" href="/clientes" key={cliente.id}>
                <div className="avatar">{cliente.nome.slice(0, 1).toUpperCase()}</div>
                <div className="clientInfo">
                  <strong>{cliente.nome}</strong>
                  <span>
                    {[cliente.bairro, cliente.cidade].filter(Boolean).join(" • ") || "Local não informado"}
                  </span>
                </div>
                <span className="tag">{cliente.representada}</span>
                <span className={indice === 0 && cliente.status === "Visitar hoje" ? "status attention" : "status"}>
                  {cliente.status}
                </span>
                <ChevronRight size={18} />
              </Link>
            ))}

            {clientesFiltrados.length === 0 && (
              <div className="emptyState">Nenhum cliente encontrado.</div>
            )}
          </div>
        </section>

        <section className="panel visit quickAction">
          <p className="eyebrow">REGISTRO RÁPIDO</p>
          <h2>Nova visita</h2>
          <p>
            Registre cliente, data, odômetro, resultado e observações. O histórico fica salvo e aparece na tela de visitas.
          </p>
          <Link className="primary wide" href="/visitas">Registrar visita</Link>
        </section>
      </div>
    </AppShell>
  );
}
