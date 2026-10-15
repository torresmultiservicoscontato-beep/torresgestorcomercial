"use client";

import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AppShell from "./components/AppShell";
import { Cliente, Visita, carregarClientes, carregarVisitas } from "./lib/data";
import { carregarPerfilAtual } from "./lib/perfil";

function saudacaoAtual() {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

export default function HomePage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [nomeUsuario, setNomeUsuario] = useState("");
  const [representadasCadastradas, setRepresentadasCadastradas] = useState<string[]>([]);

  useEffect(() => {
    let ativo = true;

    void Promise.all([carregarClientes(), carregarVisitas(), carregarPerfilAtual()])
      .then(([listaClientes, listaVisitas, perfil]) => {
        if (!ativo) return;
        setClientes(listaClientes);
        setVisitas(listaVisitas);
        setNomeUsuario(perfil?.nome.split(/\s+/)[0] ?? "");
        setRepresentadasCadastradas(perfil?.representadas ?? []);
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

  const representadas = representadasCadastradas.length;
  const tituloSaudacao = nomeUsuario ? `${saudacaoAtual()}, ${nomeUsuario}.` : `${saudacaoAtual()}.`;

  return (
    <AppShell>
      <header>
        <div>
          <p className="eyebrow">PAINEL COMERCIAL</p>
          <h1>{tituloSaudacao}</h1>
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
          <strong>{carregando ? "—" : clientes.length}</strong>
          <small>Carteira salva no banco</small>
        </article>
        <article>
          <span>Visitas registradas</span>
          <strong>{carregando ? "—" : visitas.length}</strong>
          <small>Histórico do usuário</small>
        </article>
        <article>
          <span>Representadas</span>
          <strong>{carregando ? "—" : representadas}</strong>
          <small>Definidas no primeiro acesso</small>
        </article>
        <article>
          <span>Próxima ação</span>
          <strong>{clientes.length > 0 ? "Visita" : "Cliente"}</strong>
          <small>{clientes.length > 0 ? "Registre o próximo atendimento" : "Cadastre o primeiro cliente"}</small>
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
            {!carregando && clientesFiltrados.map((cliente, indice) => (
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

            {!carregando && clientesFiltrados.length === 0 && (
              <div className="emptyState">
                Nenhum cliente cadastrado ainda. Use “Novo cliente” para começar sua carteira.
              </div>
            )}
          </div>
        </section>

        <section className="panel visit quickAction">
          <p className="eyebrow">REGISTRO RÁPIDO</p>
          <h2>Nova visita</h2>
          <p>
            Registre cliente, data, odômetro, resultado e observações. O histórico fica salvo no Supabase e vinculado ao seu usuário.
          </p>
          <Link className="primary wide" href={clientes.length > 0 ? "/visitas" : "/clientes"}>
            {clientes.length > 0 ? "Registrar visita" : "Cadastrar primeiro cliente"}
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
