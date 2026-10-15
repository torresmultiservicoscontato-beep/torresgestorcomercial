"use client";

import { useEffect, useState } from "react";
import { Building2, ClipboardCheck, ShieldCheck, Users } from "lucide-react";
import AppShell from "../components/AppShell";
import { carregarResumoAdmin, listarUsuariosAdmin, type ResumoAdmin, type UsuarioAdmin } from "../lib/admin";
import { carregarPerfilAtual } from "../lib/perfil";

const resumoInicial: ResumoAdmin = {
  usuarios: 0,
  clientes: 0,
  visitas: 0,
  representadas: 0,
};

export default function AdminPage() {
  const [resumo, setResumo] = useState<ResumoAdmin>(resumoInicial);
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [autorizado, setAutorizado] = useState(false);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        const perfil = await carregarPerfilAtual();
        if (!perfil || perfil.papel !== "admin") {
          throw new Error("Seu usuário não possui acesso administrativo.");
        }

        const [novoResumo, lista] = await Promise.all([
          carregarResumoAdmin(),
          listarUsuariosAdmin(),
        ]);

        if (!ativo) return;
        setAutorizado(true);
        setResumo(novoResumo);
        setUsuarios(lista);
      } catch (falha) {
        if (!ativo) return;
        setErro(falha instanceof Error ? falha.message : "Não foi possível abrir o painel administrativo.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void carregar();

    return () => {
      ativo = false;
    };
  }, []);

  return (
    <AppShell>
      <header className="pageHeader">
        <div>
          <p className="eyebrow">ADMINISTRAÇÃO</p>
          <h1>Painel do Admin</h1>
          <p>Visão geral dos usuários e da utilização do Torres Gestor Comercial.</p>
        </div>
      </header>

      {carregando && <section className="panel settingsPanel">Carregando dados administrativos...</section>}
      {erro && <div className="loginAlert error settingsAlert">{erro}</div>}

      {!carregando && autorizado && (
        <>
          <section className="stats adminStats">
            <article>
              <Users size={20} />
              <span>Usuários</span>
              <strong>{resumo.usuarios}</strong>
              <small>Contas cadastradas</small>
            </article>
            <article>
              <Building2 size={20} />
              <span>Representadas</span>
              <strong>{resumo.representadas}</strong>
              <small>Vínculos cadastrados</small>
            </article>
            <article>
              <Users size={20} />
              <span>Clientes</span>
              <strong>{resumo.clientes}</strong>
              <small>Na base completa</small>
            </article>
            <article>
              <ClipboardCheck size={20} />
              <span>Visitas</span>
              <strong>{resumo.visitas}</strong>
              <small>Registros acumulados</small>
            </article>
          </section>

          <section className="panel adminPanel">
            <div className="panelTitle">
              <div>
                <p className="eyebrow">USUÁRIOS</p>
                <h2>Contas do sistema</h2>
              </div>
              <span className="tag"><ShieldCheck size={13} /> Acesso administrador</span>
            </div>

            <div className="adminTableWrap">
              <table className="adminTable">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Representação</th>
                    <th>Acesso</th>
                    <th>Representadas</th>
                    <th>Clientes</th>
                    <th>Visitas</th>
                    <th>Cadastro</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((usuario) => (
                    <tr key={usuario.userId}>
                      <td>
                        <strong>{usuario.nome}</strong>
                        <span>{usuario.email}</span>
                      </td>
                      <td>{usuario.nomeRepresentacao}</td>
                      <td>
                        <span className={usuario.papel === "admin" ? "adminBadge" : "tag"}>
                          {usuario.papel === "admin" ? "Administrador" : "Usuário"}
                        </span>
                      </td>
                      <td>{usuario.representadas}</td>
                      <td>{usuario.clientes}</td>
                      <td>{usuario.visitas}</td>
                      <td>{new Date(usuario.criadoEm).toLocaleDateString("pt-BR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}
