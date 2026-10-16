"use client";

import { FormEvent, useEffect, useState } from "react";
import { Eye, Pencil, Plus, ShieldCheck, UserCheck, UserX, X } from "lucide-react";
import { useRouter } from "next/navigation";
import AppShell from "../components/AppShell";
import { definirPrepostoAdministrado } from "../lib/prepostoContext";
import {
  atualizarPreposto,
  criarPreposto,
  listarPrepostos,
  permissoesPadrao,
  type AcaoPermissao,
  type ModuloPermissao,
  type PermissoesPreposto,
  type Preposto,
} from "../lib/prepostos";

const modulos: { id: ModuloPermissao; label: string }[] = [
  { id: "clientes", label: "Clientes" },
  { id: "rotas", label: "Rotas" },
  { id: "visitas", label: "Visitas" },
  { id: "vendas", label: "Vendas" },
  { id: "agenda", label: "Agenda" },
  { id: "relatorios", label: "Relatórios" },
];

const acoes: { id: AcaoPermissao; label: string }[] = [
  { id: "visualizar", label: "Visualizar" },
  { id: "cadastrar", label: "Cadastrar" },
  { id: "editar", label: "Editar" },
];

function copiarPermissoes(permissoes: PermissoesPreposto): PermissoesPreposto {
  return JSON.parse(JSON.stringify(permissoes));
}

const formNovo = () => ({
  nome: "",
  email: "",
  whatsapp: "",
  senhaTemporaria: "",
  status: "ativo" as "ativo" | "inativo",
  permissoes: copiarPermissoes(permissoesPadrao),
});

export default function EquipePage() {
  const router = useRouter();
  const [prepostos, setPrepostos] = useState<Preposto[]>([]);
  const [form, setForm] = useState(formNovo());
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState<Preposto | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    void listarPrepostos()
      .then(setPrepostos)
      .catch((falha: Error) => setErro(falha.message))
      .finally(() => setCarregando(false));
  }, []);

  function alterarPermissao(modulo: ModuloPermissao, acao: AcaoPermissao, valor: boolean) {
    setForm((atual) => ({
      ...atual,
      permissoes: {
        ...atual.permissoes,
        [modulo]: {
          ...atual.permissoes[modulo],
          [acao]: valor,
        },
      },
    }));
  }

  function novo() {
    setEditando(null);
    setForm(formNovo());
    setErro("");
    setMensagem("");
    setMostrarForm(true);
  }

  function editar(preposto: Preposto) {
    setEditando(preposto);
    setForm({
      nome: preposto.nome,
      email: preposto.email,
      whatsapp: preposto.whatsapp,
      senhaTemporaria: "",
      status: preposto.status,
      permissoes: copiarPermissoes(preposto.permissoes),
    });
    setErro("");
    setMensagem("");
    setMostrarForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function acessarPainel(preposto: Preposto) {
    if (!preposto.userId || preposto.status !== "ativo") return;

    definirPrepostoAdministrado({
      titularUserId: preposto.titularUserId,
      userId: preposto.userId,
      nome: preposto.nome,
      email: preposto.email,
    });

    router.push("/");
    router.refresh();
  }

  function fechar() {
    setMostrarForm(false);
    setEditando(null);
    setForm(formNovo());
  }

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (salvando) return;

    if (!editando && form.senhaTemporaria.length < 8) {
      setErro("Defina uma senha temporária com pelo menos 8 caracteres.");
      return;
    }

    setSalvando(true);
    setErro("");
    setMensagem("");

    try {
      if (editando) {
        const atualizado = await atualizarPreposto({
          ...editando,
          nome: form.nome,
          whatsapp: form.whatsapp,
          status: form.status,
          permissoes: form.permissoes,
        });
        setPrepostos((lista) => lista.map((item) => (item.id === atualizado.id ? atualizado : item)));
        setMensagem("Preposto atualizado com sucesso.");
      } else {
        const criado = await criarPreposto({
          nome: form.nome,
          email: form.email,
          whatsapp: form.whatsapp,
          senhaTemporaria: form.senhaTemporaria,
          permissoes: form.permissoes,
        });
        setPrepostos((lista) => [criado, ...lista]);
        setMensagem(
          `Acesso criado para ${criado.email}. Entregue a senha temporária ao preposto. No primeiro login ele será obrigado a criar uma senha definitiva.`,
        );
      }
      fechar();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível salvar o preposto.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <AppShell>
      <header className="pageHeader">
        <div>
          <p className="eyebrow">GESTÃO DA EQUIPE</p>
          <h1>Prepostos</h1>
          <p>Crie os acessos da sua equipe, controle permissões e entre na operação individual de cada vendedor.</p>
        </div>
        <button className="primary" type="button" onClick={mostrarForm ? fechar : novo}>
          {mostrarForm ? <X size={18} /> : <Plus size={18} />}
          {mostrarForm ? "Fechar" : "Adicionar preposto"}
        </button>
      </header>

      {erro && <div className="loginAlert error settingsAlert">{erro}</div>}
      {mensagem && <div className="loginAlert success settingsAlert">{mensagem}</div>}

      {mostrarForm && (
        <form className="panel formPanel" onSubmit={salvar}>
          <div className="panelTitle">
            <div>
              <p className="eyebrow">{editando ? "ALTERAR ACESSO" : "NOVO ACESSO"}</p>
              <h2>{editando ? "Editar preposto" : "Cadastrar preposto"}</h2>
            </div>
          </div>

          <div className="formGrid">
            <label className="field">
              Nome
              <input required value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} />
            </label>
            <label className="field">
              WhatsApp
              <input value={form.whatsapp} onChange={(event) => setForm({ ...form, whatsapp: event.target.value })} placeholder="(21) 99999-9999" />
            </label>
            <label className="field">
              E-mail de login
              <input
                type="email"
                required
                readOnly={Boolean(editando)}
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="preposto@exemplo.com"
              />
            </label>
            {editando ? (
              <label className="field">
                Status
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as "ativo" | "inativo" })}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </label>
            ) : (
              <label className="field">
                Senha temporária
                <input
                  type="password"
                  minLength={8}
                  required
                  value={form.senhaTemporaria}
                  onChange={(event) => setForm({ ...form, senhaTemporaria: event.target.value })}
                  placeholder="Mínimo de 8 caracteres"
                />
                <small>O preposto trocará essa senha obrigatoriamente no primeiro login.</small>
              </label>
            )}
          </div>

          <div className="permissionsBlock">
            <div className="settingsSectionTitle">
              <ShieldCheck size={18} />
              <div>
                <strong>Permissões</strong>
                <span>Configurações, Equipe e Administração nunca são liberadas para prepostos.</span>
              </div>
            </div>

            <div className="permissionsTableWrap">
              <table className="permissionsTable">
                <thead>
                  <tr>
                    <th>Módulo</th>
                    {acoes.map((acao) => <th key={acao.id}>{acao.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {modulos.map((modulo) => (
                    <tr key={modulo.id}>
                      <td><strong>{modulo.label}</strong></td>
                      {acoes.map((acao) => (
                        <td key={acao.id}>
                          <input
                            type="checkbox"
                            checked={form.permissoes[modulo.id][acao.id]}
                            onChange={(event) => alterarPermissao(modulo.id, acao.id, event.target.checked)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="formActions">
            <button className="secondary" type="button" onClick={fechar}>Cancelar</button>
            <button className="primary" type="submit" disabled={salvando}>{salvando ? "Salvando..." : editando ? "Salvar alterações" : "Criar login do preposto"}</button>
          </div>
        </form>
      )}

      <section className="panel teamPanel">
        <div className="panelTitle">
          <div>
            <p className="eyebrow">EQUIPE COMERCIAL</p>
            <h2>{carregando ? "Carregando equipe..." : `${prepostos.length} prepostos cadastrados`}</h2>
          </div>
        </div>

        {!carregando && prepostos.length === 0 && (
          <div className="emptyState">Nenhum preposto cadastrado ainda.</div>
        )}

        <div className="teamList">
          {prepostos.map((preposto) => (
            <article className="teamMember" key={preposto.id}>
              <div className="avatar">{preposto.nome.slice(0, 1).toUpperCase()}</div>
              <div className="teamMemberInfo">
                <strong>{preposto.nome}</strong>
                <span>{preposto.email}</span>
                {preposto.whatsapp && <span>{preposto.whatsapp}</span>}
              </div>
              <span className={preposto.status === "ativo" ? "status" : "status attention"}>
                {preposto.status === "ativo" ? <UserCheck size={13} /> : <UserX size={13} />}
                {preposto.status === "ativo" ? "Ativo" : "Inativo"}
              </span>
              <button
                className="secondary adminAccessButton"
                type="button"
                onClick={() => acessarPainel(preposto)}
                disabled={!preposto.userId || preposto.status !== "ativo"}
                title={preposto.status === "ativo" ? "Acessar painel do preposto" : "Ative o preposto para acessar o painel"}
              >
                <Eye size={15} />
                Acessar painel
              </button>
              <button className="iconBtn" type="button" onClick={() => editar(preposto)} title="Editar preposto">
                <Pencil size={16} />
              </button>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
