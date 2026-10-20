"use client";
import { useEffect, useRef, useState } from 'react';
import { Star, Trash2, FolderOpen } from 'lucide-react';
import { listarFavoritos, salvarFavorito, excluirFavorito, type ContextoFavoritos } from '../lib/relatoriosFavoritos';
import type { ConfiguracaoRelatorio, FavoritoRelatorio, TipoRelatorio } from '../lib/relatoriosFavoritosModelo';
import styles from './relatorios.module.css';
type Props = {
 contexto:ContextoFavoritos; modo:'prontos'|'montar'|'favoritos'; configuracao:ConfiguracaoRelatorio;
 nome:string; setNome:(nome:string)=>void; favoritoId:string|null; setFavoritoId:(id:string|null)=>void;
 abrir:(favorito:FavoritoRelatorio)=>void; permitido:(tipo:TipoRelatorio)=>boolean;
};
const nomes:Record<TipoRelatorio,string>={visitas:'Visitas e atividade',vendas:'Vendas',financeiro:'Faturamento e comissões',despesas:'Despesas',agenda:'Agenda e retornos'};
export default function FavoritosRelatorios(p:Props) {
 const [favoritos,setFavoritos]=useState<FavoritoRelatorio[]>([]);
 const [carregando,setCarregando]=useState(true);
 const [ocupado,setOcupado]=useState(false);
 const [erro,setErro]=useState('');
 const [mensagem,setMensagem]=useState('');
 const [tentativa,setTentativa]=useState(0);
 const bloqueio=useRef(false);
 const {usuarioId,titularId,responsavelForcado}=p.contexto;
 useEffect(()=>{
  let ativo=true;setCarregando(true);setErro('');setFavoritos([]);
  void listarFavoritos({usuarioId,titularId,responsavelForcado}).then(lista=>{if(ativo)setFavoritos(lista);})
   .catch(e=>{if(ativo)setErro(e.message);}).finally(()=>{if(ativo)setCarregando(false);});
  return()=>{ativo=false;};
 },[usuarioId,titularId,responsavelForcado,tentativa]);
 useEffect(()=>{setMensagem('');},[p.modo,p.nome,p.configuracao]);
 async function salvar(copia=false) {
  if(bloqueio.current)return;bloqueio.current=true;setOcupado(true);setErro('');setMensagem('');
  try{
   const salvo=await salvarFavorito(p.contexto,p.nome,p.configuracao,copia?undefined:p.favoritoId||undefined);
   setFavoritos(lista=>[...lista.filter(f=>f.id!==salvo.id),salvo].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')));
   p.setFavoritoId(salvo.id);setMensagem('Relatório salvo nos favoritos.');
  }catch(e){setErro(e instanceof Error?e.message:'Não foi possível salvar.');}
  finally{bloqueio.current=false;setOcupado(false);}
 }
 async function remover(id:string) {
  if(bloqueio.current)return;bloqueio.current=true;setOcupado(true);setErro('');setMensagem('');
  try{await excluirFavorito(p.contexto,id);setFavoritos(lista=>lista.filter(f=>f.id!==id));if(p.favoritoId===id)p.setFavoritoId(null);setMensagem('Favorito removido.');}
  catch(e){setErro(e instanceof Error?e.message:'Não foi possível remover.');}
  finally{bloqueio.current=false;setOcupado(false);}
 }
 if(p.modo==='prontos')return null;
 return <section className={`panel ${styles.favoritos}`} aria-label={p.modo==='favoritos'?'Meus favoritos':'Salvar relatório personalizado'}>
  {p.modo==='montar'?<><div className={styles.salvarModelo}><label>Nome do relatório<input maxLength={100} placeholder="Ex.: Minhas vendas do mês" value={p.nome} onChange={e=>p.setNome(e.target.value)}/></label><button className="primary" type="button" disabled={ocupado||!p.configuracao.colunas.length} onClick={()=>void salvar()}><Star size={16}/>{ocupado?'Salvando…':p.favoritoId?'Atualizar favorito':'Salvar nos favoritos'}</button>{p.favoritoId&&<button className="secondary" type="button" disabled={ocupado} onClick={()=>void salvar(true)}>Salvar cópia</button>}</div><p className={styles.criterios}>Salva o modelo com as colunas, indicadores, período e filtros aplicados. Ao abrir, os resultados são consultados novamente.</p></>:<><h2>Favoritos</h2><p className={styles.criterios}>Seus modelos nesta operação e neste contexto, disponíveis também em outros dispositivos com sua conta.</p>{carregando?<p role="status">Carregando favoritos…</p>:!favoritos.length&&!erro?<div className={styles.estado}><Star size={28}/><h3>Nenhum favorito salvo</h3><p>Use Montar relatório, escolha os campos e salve seu primeiro modelo.</p></div>:<div className={styles.listaFavoritos}>{favoritos.map(f=><article key={f.id}><div><strong>{f.nome}</strong><p>{nomes[f.configuracao.tipo]} · {f.configuracao.colunas.length} colunas · {f.configuracao.periodo.modo==='mes-atual'?'Mês atual':f.configuracao.periodo.modo==='ultimos-30'?'Últimos 30 dias':'Período fixo'}</p>{!p.permitido(f.configuracao.tipo)&&<small>Sem acesso ao módulo deste modelo.</small>}</div><div className={styles.acoes}><button className="secondary" disabled={ocupado||!p.permitido(f.configuracao.tipo)} onClick={()=>p.abrir(f)}><FolderOpen size={16}/> Abrir</button><button className="secondary" disabled={ocupado} aria-label={`Remover favorito ${f.nome}`} onClick={()=>void remover(f.id)}><Trash2 size={16}/></button></div></article>)}</div>}</>}
  {erro&&<div role="alert" className={styles.erro}>{erro}<button type="button" className="secondary" disabled={ocupado} onClick={()=>setTentativa(v=>v+1)}>Recarregar favoritos</button></div>}
  {mensagem&&<p role="status" className={styles.sucesso}>{mensagem}</p>}
 </section>;
}
