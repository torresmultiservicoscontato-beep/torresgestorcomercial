"use client";

import { FormEvent, useEffect, useState } from "react";
import { Eye, MailPlus, Pencil, ShieldCheck, UserCheck, UserX, X } from "lucide-react";
import { useRouter } from "next/navigation";
import AppShell from "../components/AppShell";
import { definirPrepostoAdministrado } from "../lib/prepostoContext";
import {
  atualizarPreposto,
  listarPrepostos,
  permissoesPadrao,
  solicitarVinculoPreposto,
  type AcaoPermissao,
  type ModuloPermissao,
  type PermissoesPreposto,
  type Preposto,
  type StatusVinculoPreposto,
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
  email: "",
  status: "pendente" as StatusVinculoPreposto,
  permissoes: copiarPermissoes(permissoesPadrao),
});

function rotuloStatus(status: StatusVinculoPreposto) {
  if (status === "pendente") return "Aguardando aceite";
  if (status === "ativo") return "Ativo";
  if (status === "inativo") return "Inativo";
  return "Recusado";
}

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
        [modulo]: { ...atual.permissoes[modulo], [acao]: valor },
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
      email: preposto.email,
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

    setSalvando(true);
    setErro("");
    setMensagem("");

    try {
      if (editando) {
        const atualizado = await atualizarPreposto({ ...editando, status: form.status, permissoes: form.permissoes });
        setPrepostos((lista) => lista.map((item) => (item.id === atualizado.id ? atualizado : item)));
        setMensagem("Permissões do vínculo atualizadas.");
      } else {
        const criado = await solicitarVinculoPreposto({ email: form.email, permissoes: form.permissoes });
        setPrepostos((lista) => [criado, ...lista]);
        setMensagem(`Solicitação enviada para ${criado.nome}. O vínculo só ficará ativo depois que o preposto aceitar.`);
      }
      fechar();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível salvar o vínculo.");
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
          <p>Localize um preposto já cadastrado pelo e-mail e solicite o vínculo com a sua operação.</p>
        </div>
        <button className="primary" type="button" onClick={mostrarForm ? fechar : novo}>
          {mostrarForm ? <X size={18} /> : <MailPlus size={18} />}
          {mostrarForm ? "Fechar" : "Vincular preposto"}
        </button>
      </header>

      {erro && <div className="loginAlert error settingsAlert">{erro}</div>}
      {mensagem && <div className="loginAlert success settingsAlert">{mensagem}</div>}

      {mostrarForm && (
        <form className="panel formPanel" onSubmit={salvar}>
          <div className="panelTitle">
            <div>
              <p className="eyebrow">{editando ? "ALTERAR VÍNCULO" : "NOVO VÍNCULO"}</p>
              <h2>{editando ? editando.nome : "Localizar preposto"}</h2>
            </div>
          </div>

          <div className="formGrid">
            <label className="field span2">
              E-mail do preposto
              <input
                type="email"
                required
                readOnly={Boolean(editando)}
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="preposto@exemplo.com"
              />
              <small>O preposto precisa criar a própria conta antes. Nome, WhatsApp e demais dados pessoais não podem ser alterados pelo representante.</small>
            </label>

            {editando && editando.status !== "pendente" && (
              <label className="field">
                Status nesta operação
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as StatusVinculoPreposto })}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </label>
            )}
          </div>

          <div className="permissionsBlock">
            <div className="settingsSectionTitle">
              <ShieldCheck size={18} />
              <div>
                <strong>Permissões nesta operação</strong>
                <span>Essas permissões pertencem somente ao vínculo com este representante.</span>
              </div>
            </div>

            <div className="permissionsTableWrap">
              <table className="permissionsTable">
                <thead><tr><th>Módulo</th>{acoes.map((acao) => <th key={acao.id}>{acao.label}</th>)}</tr></thead>
                <tbody>
                  {modulos.map((modulo) => (
                    <tr key={modulo.id}>
                      <td><strong>{modulo.label}</strong></td>
                      {acoes.map((acao) => (
                        <td key={acao.id}>
                          <input type="checkbox" checked={form.permissoes[modulo.id][acao.id]} onChange={(event) => alterarPermissao(modulo.id, acao.id, event.target.checked)} />
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
            <button className="primary" type="submit" disabled={salvando}>{salvando ? "Salvando..." : editando ? "Salvar permissões" : "Enviar solicitação"}</button>
          </div>
        </form>
      )}

      <section className="panel teamPanel">
        <div className="panelTitle">
          <div>
            <p className="eyebrow">EQUIPE COMERCIAL</p>
            <h2>{carregando ? "Carregando equipe..." : `${prepostos.length} vínculos`}</h2>
          </div>
        </div>

        {!carregando && prepostos.length === 0 && <div className="emptyState">Nenhum preposto vinculado a esta operação.</div>}

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
                {rotuloStatus(preposto.status)}
              </span>
              <button className="secondary adminAccessButton" type="button" onClick={() => acessarPainel(preposto)} disabled={!preposto.userId || preposto.status !== "ativo"}>
                <Eye size={15} />
                Acessar painel
              </button>
              <button className="iconBtn" type="button" onClick={() => editar(preposto)} title="Editar permissões do vínculo">
                <Pencil size={16} />
              </button>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
