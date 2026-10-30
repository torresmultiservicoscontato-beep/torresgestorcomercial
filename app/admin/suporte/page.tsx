"use client";
import {useCallback,useEffect,useState} from "react";
import AppShell from "../../components/AppShell";
import {carregarPerfilAtual} from "../../lib/perfil";
import {supabase} from "../../lib/supabase";
type Chamado={id:string;usuario_id:string;assunto:string;categoria:string;descricao:string;etiqueta:string;status:string;resposta_admin:string;criado_em:string;atualizado_em:string};
type Edicao={assunto:string;descricao:string;categoria:string;etiqueta:string;status:string;resposta_admin:string};
const estados=[{id:"aberto",label:"Entrada"},{id:"em_atendimento",label:"Em atendimento"},{id:"aguardando_usuario",label:"Aguardando usuário"},{id:"resolvido",label:"Resolvido"},{id:"fechado",label:"Fechado"}];
const etiquetas=["baixa","normal","alta","urgente"];
const cores:Record<string,string>={baixa:"#64748b",normal:"#2563eb",alta:"#ea580c",urgente:"#dc2626"};
const form=(c:Chamado):Edicao=>({assunto:c.assunto,descricao:c.descricao,categoria:c.categoria,etiqueta:c.etiqueta,status:c.status,resposta_admin:c.resposta_admin});
export default function AdminSuporte(){
 const [chamados,setChamados]=useState<Chamado[]>([]);
 const [selecionado,setSelecionado]=useState<string>("aberto");
 const [edicaoId,setEdicaoId]=useState<string|null>(null);
 const [edicoes,setEdicoes]=useState<Record<string,Edicao>>({});
 const [erro,setErro]=useState(""),[mensagem,setMensagem]=useState("");
 const [carregando,setCarregando]=useState(true),[salvando,setSalvando]=useState<string|null>(null),[autorizado,setAutorizado]=useState(false);
 const carregar=useCallback(async()=>{if(!supabase)throw Error("Banco indisponível");const {data,error}=await supabase.from("chamados_suporte").select("id,usuario_id,assunto,categoria,descricao,etiqueta,status,resposta_admin,criado_em,atualizado_em").order("criado_em",{ascending:false});if(error)throw Error(error.message);setChamados(data??[]);},[]);
 useEffect(()=>{void(async()=>{try{const perfil=await carregarPerfilAtual();if(perfil?.papel!=="admin")throw Error("Acesso restrito ao Administrador Geral.");setAutorizado(true);await carregar();}catch(e){setErro(e instanceof Error?e.message:"Erro ao carregar suporte.");}finally{setCarregando(false);}})();},[carregar]);
 function mudar(id:string,c:Chamado,alteracoes:Partial<Edicao>){setEdicoes(v=>({...v,[id]:{...(v[id]??form(c)),...alteracoes}}));}
 async function salvar(c:Chamado,campos?:Partial<Edicao>){if(!supabase||salvando)return;setSalvando(c.id);setErro("");setMensagem("");try{const atual={...(edicoes[c.id]??form(c)),...campos};const {error}=await supabase.from("chamados_suporte").update({...atual,atualizado_em:new Date().toISOString()}).eq("id",c.id);if(error)throw Error(error.message);setEdicoes(v=>{const n={...v};delete n[c.id];return n;});setEdicaoId(null);await carregar();if(atual.status!==c.status)setSelecionado(atual.status);setMensagem("Chamado atualizado. A alteração já está disponível para o solicitante.");}catch(e){setErro(e instanceof Error?e.message:"Erro ao atualizar.");}finally{setSalvando(null);}}
 async function excluir(c:Chamado){if(!supabase||salvando)return;if(!window.confirm('Excluir definitivamente o chamado "'+c.assunto+'"? Ele também desaparecerá do painel do solicitante.'))return;setSalvando(c.id);setErro("");setMensagem("");try{const {error}=await supabase.from("chamados_suporte").delete().eq("id",c.id);if(error)throw Error(error.message);await carregar();setMensagem("Chamado excluído dos dois painéis.");}catch(e){setErro(e instanceof Error?e.message:"Erro ao excluir.");}finally{setSalvando(null);}}
 const fila=chamados.filter(c=>c.status===selecionado).sort((a,b)=>new Date(a.criado_em).getTime()-new Date(b.criado_em).getTime());
 return <AppShell><header className="pageHeader"><div><p className="eyebrow">ADMINISTRAÇÃO</p><h1>Kanban de suporte</h1><p>Selecione uma coluna para ver os chamados na fila por data e horário. Mude o status, edite ou exclua quando necessário.</p></div></header>
 {erro&&<div role="alert" className="loginAlert error">{erro}</div>}{mensagem&&<div role="status" className="panel settingsPanel">{mensagem}</div>}
 {carregando?<p>Carregando...</p>:autorizado&&<>
 <section className="panel settingsPanel"><h2>Etapas do atendimento</h2><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:12}}>
 {estados.map(e=>{const grupo=chamados.filter(c=>c.status===e.id);return <button key={e.id} type="button" onClick={()=>{setSelecionado(e.id);setEdicaoId(null);}} style={{textAlign:"left",padding:14,borderRadius:12,border:selecionado===e.id?"2px solid #2563eb":"1px solid #cbd5e1",background:selecionado===e.id?"#eff6ff":"transparent",color:"inherit",cursor:"pointer"}}>
 <strong>{e.label}</strong><p style={{fontSize:22,fontWeight:800,margin:"8px 0"}}>{grupo.length}</p>
 <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{etiquetas.filter(t=>grupo.some(c=>c.etiqueta===t)).map(t=><span key={t} style={{fontSize:11,color:"#fff",background:cores[t],borderRadius:12,padding:"3px 7px"}}>{t}: {grupo.filter(c=>c.etiqueta===t).length}</span>)}</div></button>})}</div></section>
 <section className="panel settingsPanel"><h2>Fila — {estados.find(e=>e.id===selecionado)?.label} ({fila.length})</h2><p>Ordem de abertura: dos chamados mais antigos para os mais recentes.</p>
 {fila.length===0?<p>Não há chamados nesta etapa.</p>:<div style={{display:"grid",gap:10}}>{fila.map(c=>{const d=edicoes[c.id]??form(c),aberto=edicaoId===c.id;return <article key={c.id} style={{border:"1px solid #cbd5e1",borderRadius:10,padding:14}}>
 <div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap",alignItems:"center"}}><div><strong>{c.assunto}</strong><span style={{marginLeft:10,background:cores[c.etiqueta]??"#64748b",color:"#fff",padding:"3px 8px",borderRadius:12,fontSize:12}}>{c.etiqueta}</span></div><small>{new Date(c.criado_em).toLocaleString("pt-BR")}</small></div>
 <p>Categoria: {c.categoria} • Protocolo: {c.id.slice(0,8).toUpperCase()}</p><p style={{whiteSpace:"pre-wrap"}}>{c.descricao}</p>
 {!aberto&&c.resposta_admin&&<p><b>Resposta:</b> {c.resposta_admin}</p>}
 <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
 <label>Status <select disabled={Boolean(salvando)} value={c.status} onChange={e=>void salvar(c,{status:e.target.value})}>{estados.map(e=><option key={e.id} value={e.id}>{e.label}</option>)}</select></label>
 <button type="button" className="secondary" disabled={Boolean(salvando)} onClick={()=>{setEdicaoId(aberto?null:c.id);if(!aberto)mudar(c.id,c,{});}}>{aberto?"Fechar edição":"Editar / Responder"}</button>
 <button type="button" className="secondary" disabled={Boolean(salvando)} onClick={()=>void excluir(c)}>🗑 Excluir</button></div>
 {aberto&&<div className="signupGrid" style={{marginTop:12}}>
 <label className="field">Assunto<input value={d.assunto} onChange={e=>mudar(c.id,c,{assunto:e.target.value})}/></label>
 <label className="field">Etiqueta<select value={d.etiqueta} onChange={e=>mudar(c.id,c,{etiqueta:e.target.value})}>{etiquetas.map(t=><option key={t} value={t}>{t}</option>)}</select></label>
 <label className="field">Categoria<select value={d.categoria} onChange={e=>mudar(c.id,c,{categoria:e.target.value})}>{["duvida","problema","financeiro","acesso","sugestao","privacidade"].map(t=><option key={t} value={t}>{t}</option>)}</select></label>
 <label className="field">Novo status<select value={d.status} onChange={e=>mudar(c.id,c,{status:e.target.value})}>{estados.map(e=><option key={e.id} value={e.id}>{e.label}</option>)}</select></label>
 <label className="field signupSpan2">Descrição<textarea rows={3} value={d.descricao} onChange={e=>mudar(c.id,c,{descricao:e.target.value})}/></label>
 <label className="field signupSpan2">Resposta ao solicitante<textarea rows={4} value={d.resposta_admin} onChange={e=>mudar(c.id,c,{resposta_admin:e.target.value})}/></label>
 <button className="primary" type="button" disabled={Boolean(salvando)||d.assunto.trim().length<5||d.descricao.trim().length<10} onClick={()=>void salvar(c)}>{salvando===c.id?"Salvando...":"Salvar alterações e resposta"}</button></div>}</article>})}</div>}</section></>}</AppShell>;
}