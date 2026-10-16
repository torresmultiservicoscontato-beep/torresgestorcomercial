"use client";

import Link from "next/link";
import { ChevronRight, Search, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AppShell from "./components/AppShell";
import { carregarAcessoAtual } from "./lib/acesso";
import { Cliente, Visita, carregarClientes, carregarVisitas } from "./lib/data";
import { listarPrepostos } from "./lib/prepostos";

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
  const [quantidadePrepostos, setQuantidadePrepostos] = useState(0);
  const [ehPreposto, setEhPreposto] = useState(false);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        const acesso = await carregarAcessoAtual();
        if (!ativo || !acesso) return;

        const [listaClientes, listaVisitas] = await Promise.all([
          carregarClientes(),
          carregarVisitas(),
        ]);

        let prepostos = 0;
        if (acesso.papel !== "preposto") {
          const listaPrepostos = await listarPrepostos();
          prepostos = listaPrepostos.length;
        }

        if (!ativo) return;
        setClientes(listaClientes);
        setVisitas(listaVisitas);
        setNomeUsuario(acesso.nome.split(/\s+/)[0] ?? "");
        setRepresentadasCadastradas(acesso.representadas ?? []);
        setQuantidadePrepostos(prepostos);
        setEhPreposto(acesso.papel === "preposto");
      } catch (falha) {
        if (!ativo) return;
        setErro(falha instanceof Error ? falha.message : "Não foi possível carregar o painel.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void carregar();

    return () => {
      ativo = false;
    };
  }, []);

  const clientesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return clientes.slice(0, 5);

    return clientes
      .filter((cliente) =>
        [
          cliente.nome,
          cliente.cidade,
          cliente.bairro,
          cliente.representada,
          cliente.responsavelNome,
        ]
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
          placeholder="Buscar cliente, cidade, bairro, representada ou responsável..."
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
          <small>Histórico da operação</small>
        </article>
        <article>
          <span>Representadas</span>
          <strong>{carregando ? "—" : representadas}</strong>
          <small>Marcas da conta titular</small>
        </article>
        {!ehPreposto && (
          <article>
            <UsersRound size={20} />
            <span>Prepostos</span>
            <strong>{carregando ? "—" : quantidadePrepostos}</strong>
            <small>Vendedores cadastrados na equipe</small>
          </article>
        )}
        {ehPreposto && (
          <article>
            <span>Próxima ação</span>
            <strong>{clientes.length > 0 ? "Visita" : "Cliente"}</strong>
            <small>{clientes.length > 0 ? "Registre o próximo atendimento" : "Cadastre o primeiro cliente"}</small>
          </article>
        )}
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
                  <span>{[cliente.bairro, cliente.cidade].filter(Boolean).join(" • ") || "Local não informado"}</span>
                </div>
                <span className="tag">{cliente.representada}</span>
                <span className={cliente.responsavelTipo === "preposto" ? "adminBadge" : "tag"}>
                  {cliente.responsavelTipo === "preposto"
                    ? `Preposto: ${cliente.responsavelNome ?? "Não identificado"}`
                    : "Titular"}
                </span>
                <span className={indice === 0 && cliente.status === "Visitar hoje" ? "status attention" : "status"}>
                  {cliente.status}
                </span>
                <ChevronRight size={18} />
              </Link>
            ))}

            {!carregando && clientesFiltrados.length === 0 && (
              <div className="emptyState">Nenhum cliente cadastrado ainda. Use “Novo cliente” para começar sua carteira.</div>
            )}
          </div>
        </section>

        <section className="panel visit quickAction">
          <p className="eyebrow">REGISTRO RÁPIDO</p>
          <h2>Nova visita</h2>
          <p>Registre cliente, data, odômetro, resultado e observações. O histórico fica vinculado à conta titular e ao responsável pelo atendimento.</p>
          <Link className="primary wide" href={clientes.length > 0 ? "/visitas" : "/clientes"}>
            {clientes.length > 0 ? "Registrar visita" : "Cadastrar primeiro cliente"}
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
