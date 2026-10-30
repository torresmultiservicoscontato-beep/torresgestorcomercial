"use client";
import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { carregarAcessoAtual } from "../lib/acesso";
import { supabase } from "../lib/supabase";
type Plano={id:string;nome:string;descricao:string;preco_mensal:number;ativo:boolean;modulos_incluidos:string[];limite_representantes:number;limite_prepostos:number};
type Assinatura={plano_id:string|null;status:string;vencimento_em:string|null};
type Pedido={id:string;plano_solicitado_id:string;status:string;criado_em:string};
export default function MeuPlanoPage(){
const [planos,setPlanos]=useState<Plano[]>([]);const [assinatura,setAssinatura]=useState<Assinatura|null>(null);const [pedidos,setPedidos]=useState<Pedido[]>([]);const [titular,setTitular]=useState("");const [erro,setErro]=useState("");const [aviso,setAviso]=useState("");const [salvando,setSalvando]=useState(false);const [carregando,setCarregando]=useState(true);
async function carregar(){
if(!supabase)throw Error("Supabase indisponível");
const acesso=await carregarAcessoAtual();if(!acesso)throw Error("Conta sem perfil comercial");
setTitular(acesso.titularUserId);
const [p,a,s]=await Promise.all([supabase.from("planos_assinatura").select("id,nome,descricao,preco_mensal,ativo,modulos_incluidos,limite_representantes,limite_prepostos").eq("ativo",true),supabase.from("assinaturas_contas").select("plano_id,status,vencimento_em").eq("titular_user_id",acesso.titularUserId).maybeSingle(),supabase.from("solicitacoes_troca_plano").select("id,plano_solicitado_id,status,criado_em").eq("titular_user_id",acesso.titularUserId).order("criado_em",{ascending:false})]);
if(p.error)throw Error(p.error.message);if(a.error)throw Error(a.error.message);if(s.error)throw Error(s.error.message);
setPlanos(p.data??[]);setAssinatura(a.data);setPedidos(s.data??[]);
}
useEffect(()=>{void carregar().catch(e=>setErro(e.message)).finally(()=>setCarregando(false));},[]);
async function solicitar(id:string){if(!supabase||salvando)return;setSalvando(true);setErro("");setAviso("");try{
const {error}=await supabase.from("solicitacoes_troca_plano").insert({titular_user_id:titular,plano_atual_id:assinatura?.plano_id??null,plano_solicitado_id:id});if(error)throw Error(error.code === "23505" ? "Você já possui uma solicitação pendente. Aguarde a análise do administrador." : error.message);await carregar();setAviso("Solicitação enviada com sucesso ao Administrador Geral. Aguarde a análise.");
}catch(e){setErro(e instanceof Error?e.message:"Não foi possível solicitar");}finally{setSalvando(false);}}
const atual=planos.find(p=>p.id===assinatura?.plano_id);const pendente=pedidos.some(p=>p.status==="pendente");
const rotulos:Record<string,string>={inicio:"Início",clientes:"Clientes",representadas:"Representadas",produtos:"Produtos",rotas:"Rotas",visitas:"Visitas",vendas:"Vendas",comissoes:"Comissões",despesas:"Despesas",agenda:"Agenda",relatorios:"Relatórios",equipe:"Equipe",configuracoes:"Configurações",historico:"Histórico"};
return <AppShell><header className="pageHeader"><div><p className="eyebrow">MINHA CONTA</p><h1>Meu plano</h1><p>Confira suas funcionalidades e solicite uma alteração ao administrador.</p></div></header>
{erro&&<div role="alert" className="loginAlert error">{erro}</div>}{aviso&&<div role="status" className="panel settingsPanel" style={{border:"1px solid #16a34a",color:"#166534",fontWeight:700}}>{aviso}</div>}
{carregando?<section className="panel">Carregando...</section>:<><section className="panel settingsPanel"><h2>{atual?.nome??"Sem plano atribuído"}</h2><p>Situação: {assinatura?.status??"Sem assinatura"}</p><p>Mensalidade: {atual?atual.preco_mensal.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}):"—"}</p><h3>Funcionalidades incluídas</h3>{atual?<ul>{atual.modulos_incluidos.map(m=><li key={m}>{rotulos[m]??m}</li>)}</ul>:<p>Nenhum módulo contratado até a aprovação de um plano.</p>}<p>Limites: {atual?.limite_representantes??0} representantes e {atual?.limite_prepostos??0} prepostos.</p></section>
<section className="panel settingsPanel"><h2>Solicitar mudança de plano</h2>{pendente&&<p role="status">Há uma solicitação aguardando análise do administrador.</p>}<div style={{display:"grid",gap:14}}>{planos.filter(p=>p.id!==assinatura?.plano_id).map(p=><article key={p.id} style={{border:"1px solid #cbd5e1",borderRadius:10,padding:14}}><h3>{p.nome}</h3><p>{p.descricao}</p><p>{p.preco_mensal.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}/mês</p><p>{p.limite_representantes} representantes • {p.limite_prepostos} prepostos</p><p>{p.modulos_incluidos.map(m=>rotulos[m]??m).join(", ")}</p><button type="button" className="primary" disabled={pendente||salvando||!titular} onClick={()=>void solicitar(p.id)}>{pendente?"Aguardando aprovação":salvando?"Enviando solicitação...":"Solicitar este plano"}</button></article>)}</div></section>
<section className="panel settingsPanel"><h2>Minhas solicitações</h2>{pedidos.length===0?<p>Nenhuma solicitação.</p>:<ul>{pedidos.map(p=><li key={p.id}>{planos.find(x=>x.id===p.plano_solicitado_id)?.nome??"Plano indisponível"} — {p.status}</li>)}</ul>}</section></>}</AppShell>;
}
