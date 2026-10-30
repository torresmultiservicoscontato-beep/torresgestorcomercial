"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "../../components/AppShell";
import { carregarPerfilAtual } from "../../lib/perfil";
import { listarUsuariosAdmin, type UsuarioAdmin } from "../../lib/admin";
import { supabase } from "../../lib/supabase";

type Plano = { id: string; nome: string; descricao: string; preco_mensal: number; ativo: boolean; modulos_incluidos: string[]; limite_representantes: number; limite_prepostos: number };
type Assinatura = { id: string; titular_user_id: string; plano_id: string | null; status: string; inicio_em: string | null; vencimento_em: string | null; valor_mensal: number; observacoes: string };
const modulosDisponiveis = [
  { id: "inicio", nome: "Início" }, { id: "clientes", nome: "Clientes" },
  { id: "representadas", nome: "Representadas" }, { id: "produtos", nome: "Produtos" },
  { id: "rotas", nome: "Rotas" }, { id: "visitas", nome: "Visitas" },
  { id: "vendas", nome: "Vendas" }, { id: "comissoes", nome: "Comissões" },
  { id: "despesas", nome: "Despesas" }, { id: "agenda", nome: "Agenda" },
  { id: "relatorios", nome: "Relatórios" }, { id: "equipe", nome: "Equipe" },
  { id: "configuracoes", nome: "Configurações" }, { id: "historico", nome: "Histórico" },
] as const;
const statusDisponiveis = ["pendente", "teste", "ativa", "atrasada", "suspensa", "cancelada"];
const moeda = (valor: number) => Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PlanosAssinaturasPage() {
  const router = useRouter();
  const [autorizado, setAutorizado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [descricao, setDescricao] = useState("");
  const [modulosSelecionados, setModulosSelecionados] = useState<string[]>([]);
  const [limiteRepresentantes, setLimiteRepresentantes] = useState("1");
  const [limitePrepostos, setLimitePrepostos] = useState("0");
  const [titular, setTitular] = useState("");
  const [planoId, setPlanoId] = useState("");
  const [status, setStatus] = useState("pendente");
  const [vencimento, setVencimento] = useState("");
  const [editandoPlano, setEditandoPlano] = useState<string | null>(null);
  const [editandoAssinatura, setEditandoAssinatura] = useState<string | null>(null);
  const [observacoes, setObservacoes] = useState("");

  const carregar = useCallback(async () => {
    if (!supabase) throw new Error("Supabase indisponível.");
    const [p, a, u] = await Promise.all([
      supabase.from("planos_assinatura").select("id,nome,descricao,preco_mensal,ativo,modulos_incluidos,limite_representantes,limite_prepostos").order("nome"),
      supabase.from("assinaturas_contas").select("id,titular_user_id,plano_id,status,inicio_em,vencimento_em,valor_mensal,observacoes").order("vencimento_em"),
      listarUsuariosAdmin(),
    ]);
    if (p.error) throw new Error(p.error.message);
    if (a.error) throw new Error(a.error.message);
    setPlanos(p.data ?? []);
    setAssinaturas(a.data ?? []);
    setUsuarios(u);
  }, []);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const perfil = await carregarPerfilAtual();
        if (!perfil || perfil.papel !== "admin") {
          router.replace("/");
          return;
        }
        if (!ativo) return;
        setAutorizado(true);
        await carregar();
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : "Erro ao carregar planos e assinaturas.");
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
  }, [router, carregar]);

  async function gravarPlano(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || salvando) return;
    setSalvando(true); setErro(""); setMensagem("");
    try {
      const valor = Number(preco.replace(",", "."));
      if (!Number.isFinite(valor) || valor < 0) throw new Error("Informe um preço válido.");
      const representantes = Number(limiteRepresentantes);
      const prepostos = Number(limitePrepostos);
      if (!Number.isInteger(representantes) || representantes < 0 || !Number.isInteger(prepostos) || prepostos < 0) throw new Error("Informe limites inteiros e não negativos.");
      if (modulosSelecionados.length === 0) throw new Error("Selecione ao menos uma funcionalidade para o plano.");
      const dados = { nome: nome.trim(), descricao: descricao.trim(), preco_mensal: valor,
        modulos_incluidos: modulosSelecionados, limite_representantes: representantes, limite_prepostos: prepostos };
      const consulta = editandoPlano
        ? supabase.from("planos_assinatura").update(dados).eq("id", editandoPlano)
        : supabase.from("planos_assinatura").insert(dados);
      const { error } = await consulta;
      if (error) throw new Error(error.message);
      setNome(""); setPreco(""); setDescricao(""); setModulosSelecionados([]); setLimiteRepresentantes("1"); setLimitePrepostos("0");
      setEditandoPlano(null);
      await carregar(); setMensagem(editandoPlano ? "Plano atualizado." : "Plano cadastrado.");
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível cadastrar o plano."); }
    finally { setSalvando(false); }
  }

  async function gravarAssinatura(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || salvando) return;
    setSalvando(true); setErro(""); setMensagem("");
    try {
      const plano = planos.find(p => p.id === planoId);
      if (!plano || !titular) throw new Error("Selecione a conta e o plano.");
      const existente = assinaturas.find(a => a.titular_user_id === titular);
      if (existente && editandoAssinatura !== existente.id) throw new Error("Esta conta já possui uma assinatura. Clique em Editar na assinatura existente.");
      const { error } = await supabase.from("assinaturas_contas").upsert({
        ...(existente ? { id: existente.id } : {}),
        titular_user_id: titular, plano_id: plano.id, status,
        valor_mensal: plano.preco_mensal,
        vencimento_em: vencimento || null,
        observacoes: observacoes.trim(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "titular_user_id" });
      if (error) throw new Error(error.message);
      setEditandoAssinatura(null); setTitular(""); setPlanoId(""); setStatus("pendente"); setVencimento(""); setObservacoes("");
      await carregar(); setMensagem("Assinatura registrada/atualizada.");
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar a assinatura."); }
    finally { setSalvando(false); }
  }

  async function alterarStatus(id: string, proximo: string) {
    if (!supabase || salvando) return;
    setSalvando(true); setErro(""); setMensagem("");
    try {
      const { error } = await supabase.from("assinaturas_contas").update({ status: proximo, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw new Error(error.message);
      await carregar(); setMensagem("Status atualizado.");
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível alterar o status."); }
    finally { setSalvando(false); }
  }

  function editarPlano(plano: Plano) {
    setEditandoPlano(plano.id);
    setNome(plano.nome); setPreco(String(plano.preco_mensal)); setDescricao(plano.descricao);
    setModulosSelecionados(plano.modulos_incluidos ?? []);
    setLimiteRepresentantes(String(plano.limite_representantes));
    setLimitePrepostos(String(plano.limite_prepostos));
    document.getElementById("form-plano")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function cancelarEdicaoPlano() {
    setEditandoPlano(null); setNome(""); setPreco(""); setDescricao("");
    setModulosSelecionados([]); setLimiteRepresentantes("1"); setLimitePrepostos("0");
  }

  function editarAssinatura(assinatura: Assinatura) {
    setEditandoAssinatura(assinatura.id); setTitular(assinatura.titular_user_id);
    setPlanoId(assinatura.plano_id ?? ""); setStatus(assinatura.status);
    setVencimento(assinatura.vencimento_em ?? ""); setObservacoes(assinatura.observacoes ?? "");
    document.getElementById("form-assinatura")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function cancelarEdicaoAssinatura() {
    setEditandoAssinatura(null); setTitular(""); setPlanoId("");
    setStatus("pendente"); setVencimento(""); setObservacoes("");
  }

  async function excluirPlano(plano: Plano) {
    if (!supabase || salvando) return;
    const vinculadas = assinaturas.filter(a => a.plano_id === plano.id).length;
    if (vinculadas > 0) { setErro("Não é possível excluir este plano: há " + vinculadas + " assinatura(s) vinculada(s). Remova ou altere os vínculos primeiro."); return; }
    if (!window.confirm('Excluir definitivamente o plano "' + plano.nome + '"? Esta ação não pode ser desfeita.')) return;
    setSalvando(true); setErro(""); setMensagem("");
    try {
      const { error } = await supabase.from("planos_assinatura").delete().eq("id", plano.id);
      if (error) throw new Error(error.message);
      if (editandoPlano === plano.id) cancelarEdicaoPlano();
      await carregar(); setMensagem("Plano excluído.");
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao excluir plano."); }
    finally { setSalvando(false); }
  }

  async function excluirAssinatura(assinatura: Assinatura) {
    if (!supabase || salvando) return;
    const conta = usuarios.find(u => u.userId === assinatura.titular_user_id);
    if (!window.confirm('Excluir a assinatura de "' + (conta?.nome ?? "esta conta") + '"? A conta do usuário será preservada.')) return;
    setSalvando(true); setErro(""); setMensagem("");
    try {
      const { error } = await supabase.from("assinaturas_contas").delete().eq("id", assinatura.id);
      if (error) throw new Error(error.message);
      if (editandoAssinatura === assinatura.id) cancelarEdicaoAssinatura();
      await carregar(); setMensagem("Assinatura excluída. A conta do usuário foi mantida.");
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao excluir assinatura."); }
    finally { setSalvando(false); }
  }

  const titularPorId = new Map(usuarios.map(u => [u.userId, u]));
  const planoPorId = new Map(planos.map(p => [p.id, p]));
  const totalAtivas = assinaturas.filter(a => a.status === "ativa").length;
  const receitaPrevista = assinaturas.filter(a => a.status === "ativa").reduce((total, a) => total + Number(a.valor_mensal || 0), 0);
  const atrasadas = assinaturas.filter(a => a.status === "atrasada" || (a.status === "ativa" && a.vencimento_em && a.vencimento_em < new Date().toISOString().slice(0, 10))).length;

  return <AppShell>
    <header className="pageHeader"><div>
      <p className="eyebrow">ADMINISTRAÇÃO</p>
      <h1>Planos e Assinaturas</h1>
      <p>Acompanhe os planos, contas e vencimentos. Controle administrativo, sem cobrança automática.</p>
      <Link href="/admin">Voltar ao painel administrativo</Link>
    </div></header>
    {carregando && <section className="panel settingsPanel">Carregando...</section>}
    {erro && <div className="loginAlert error settingsAlert" role="alert">{erro}</div>}
    {mensagem && <div className="panel settingsPanel" role="status">{mensagem}</div>}
    {!carregando && autorizado && <>
      <section className="stats adminStats">
        <article><span>Planos</span><strong>{planos.length}</strong><small>Cadastrados</small></article>
        <article><span>Assinaturas ativas</span><strong>{totalAtivas}</strong><small>Contas ativas</small></article>
        <article><span>Em atraso</span><strong>{atrasadas}</strong><small>Acompanhar vencimentos</small></article>
        <article><span>Receita mensal prevista</span><strong>{moeda(receitaPrevista)}</strong><small>Estimativa, não recebimento confirmado</small></article>
      </section>
      <section className="panel settingsPanel">
        <div className="panelTitle"><div><p className="eyebrow">CATÁLOGO</p><h2>Planos disponíveis</h2></div></div>
        {planos.length === 0 ? <p>Nenhum plano cadastrado.</p> : <div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Plano</th><th>Descrição</th><th>Valor mensal</th><th>Representantes</th><th>Prepostos</th><th>Funcionalidades</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{planos.map(p => <tr key={p.id}><td><strong>{p.nome}</strong></td><td>{p.descricao || "—"}</td><td>{moeda(p.preco_mensal)}</td><td>{p.limite_representantes}</td><td>{p.limite_prepostos}</td><td>{p.modulos_incluidos?.length ? p.modulos_incluidos.map(id => modulosDisponiveis.find(m => m.id === id)?.nome ?? id).join(", ") : "Nenhuma selecionada"}</td><td>{p.ativo ? "Ativo" : "Inativo"}</td><td><div style={{display:"flex",gap:8}}><button type="button" className="secondary" disabled={salvando} onClick={() => editarPlano(p)}>Editar</button><button type="button" className="secondary" title={"Excluir " + p.nome} aria-label={"Excluir plano " + p.nome} disabled={salvando} onClick={() => void excluirPlano(p)}>🗑 Excluir</button></div></td></tr>)}</tbody></table></div>}
        <h3 id="form-plano">{editandoPlano ? "Editar plano" : "Novo plano"}</h3>
        <form onSubmit={gravarPlano} className="signupGrid">
          <label className="field">Nome<input required value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Profissional" /></label>
          <label className="field">Mensalidade (R$)<input required type="number" min="0" step="0.01" value={preco} onChange={e => setPreco(e.target.value)} /></label>
          <label className="field signupSpan2">Descrição<input value={descricao} onChange={e => setDescricao(e.target.value)} /></label>
          <label className="field">Quantidade máxima de representantes<input type="number" required min="0" step="1" value={limiteRepresentantes} onChange={e => setLimiteRepresentantes(e.target.value)} /></label>
          <label className="field">Quantidade máxima de prepostos<input type="number" required min="0" step="1" value={limitePrepostos} onChange={e => setLimitePrepostos(e.target.value)} /></label>
          <fieldset className="signupSpan2" style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 16 }}>
            <legend style={{ fontWeight: 700, padding: "0 6px" }}>Funcionalidades incluídas no plano</legend>
            <p style={{ margin: "0 0 12px" }}>Marque os módulos do menu lateral incluídos.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
              {modulosDisponiveis.map(modulo => (
                <label key={modulo.id} style={{ display: "flex", gap: 9, alignItems: "center", cursor: "pointer" }}>
                  <input type="checkbox" checked={modulosSelecionados.includes(modulo.id)} onChange={e => setModulosSelecionados(atuais => e.target.checked ? [...atuais, modulo.id] : atuais.filter(id => id !== modulo.id))} />
                  {modulo.nome}
                </label>
              ))}
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 14 }}>
              <button className="secondary" type="button" onClick={() => setModulosSelecionados(modulosDisponiveis.map(m => m.id))}>Selecionar todas</button>
              <button className="secondary" type="button" onClick={() => setModulosSelecionados([])}>Limpar seleção</button>
            </div>
          </fieldset>
          <button className="primary" type="submit" disabled={salvando}>{editandoPlano ? "Salvar alterações do plano" : "Cadastrar plano"}</button>
          {editandoPlano && <button className="secondary" type="button" onClick={cancelarEdicaoPlano}>Cancelar edição</button>}
        </form>
      </section>
      <section className="panel settingsPanel">
        <div className="panelTitle"><div><p className="eyebrow">ASSINATURAS</p><h2>Contas e assinaturas</h2></div></div>
        {assinaturas.length === 0 ? <p>Nenhuma assinatura cadastrada.</p> : <div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Conta</th><th>Plano</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Ações</th></tr></thead><tbody>{assinaturas.map(a => <tr key={a.id}><td>{titularPorId.get(a.titular_user_id)?.nome ?? "Conta não localizada"}</td><td>{planoPorId.get(a.plano_id ?? "")?.nome ?? "—"}</td><td>{moeda(a.valor_mensal)}</td><td>{a.vencimento_em ? new Date(a.vencimento_em + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</td><td><select aria-label="Status da assinatura" disabled={salvando} value={a.status} onChange={e => { void alterarStatus(a.id, e.target.value); }}>{statusDisponiveis.map(s => <option key={s} value={s}>{s}</option>)}</select></td><td><div style={{display:"flex",gap:8}}><button type="button" className="secondary" disabled={salvando} onClick={() => editarAssinatura(a)}>Editar</button><button type="button" className="secondary" title="Excluir assinatura" aria-label="Excluir assinatura" disabled={salvando} onClick={() => void excluirAssinatura(a)}>🗑 Excluir</button></div></td></tr>)}</tbody></table></div>}
        <h3 id="form-assinatura">{editandoAssinatura ? "Editar assinatura" : "Registrar assinatura"}</h3>
        <form onSubmit={gravarAssinatura} className="signupGrid">
          <label className="field">Conta<select required disabled={Boolean(editandoAssinatura)} value={titular} onChange={e => setTitular(e.target.value)}><option value="">Selecione</option>{usuarios.filter(u => u.papel !== "admin").map(u => <option key={u.userId} value={u.userId}>{u.nome} — {u.nomeRepresentacao}</option>)}</select></label>
          <label className="field">Plano<select required value={planoId} onChange={e => setPlanoId(e.target.value)}><option value="">Selecione</option>{planos.filter(p => p.ativo).map(p => <option key={p.id} value={p.id}>{p.nome} ({moeda(p.preco_mensal)})</option>)}</select></label>
          <label className="field">Status<select value={status} onChange={e => setStatus(e.target.value)}>{statusDisponiveis.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
          <label className="field">Vencimento<input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} /></label>
          <label className="field signupSpan2">Observações<input value={observacoes} onChange={e => setObservacoes(e.target.value)} /></label>
          <button type="submit" className="primary" disabled={salvando}>{editandoAssinatura ? "Salvar alterações da assinatura" : "Salvar assinatura"}</button>
          {editandoAssinatura && <button type="button" className="secondary" onClick={cancelarEdicaoAssinatura}>Cancelar edição</button>}
        </form>
      </section>
    </>}
  </AppShell>;
}
