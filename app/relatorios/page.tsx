"use client";
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Download, Printer, RefreshCw, AlertCircle } from 'lucide-react';
import AppShell from '../components/AppShell';
import { carregarRelatorio, type DadosRelatorio } from '../lib/relatorios';
import { gerarCsv, resumoComercial, resumoFinanceiro } from '../lib/relatoriosModelo';
import { hojeDespesa, resumirDespesas } from '../lib/despesasModelo';
import styles from './relatorios.module.css';
import FavoritosRelatorios from './FavoritosRelatorios';
import { selecionarCampos, periodoFavorito, type ConfiguracaoRelatorio, type FavoritoRelatorio } from '../lib/relatoriosFavoritosModelo';

type Aba = 'visitas' | 'vendas' | 'financeiro' | 'despesas' | 'agenda';
const nomes: Record<Aba, string> = { visitas: 'Visitas e atividade', vendas: 'Vendas', financeiro: 'Faturamento e comissões', despesas: 'Despesas', agenda: 'Agenda e retornos' };
const moeda = (n: number) => (n / 100).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
const decimal = (n: number) => n.toLocaleString('pt-BR',{maximumFractionDigits:2});
const dataBr = (s: string | null) => s ? s.split('-').reverse().join('/') : '—';
function mesAtual() { const h=hojeDespesa(); const [a,m]=h.split('-').map(Number); return {inicio:h.slice(0,7)+'-01',fim:h.slice(0,7)+'-'+new Date(a,m,0).getDate()}; }
export default function RelatoriosPage() {
  const [modo,setModo]=useState<'prontos'|'montar'|'favoritos'>('prontos');
  const [nomeModelo,setNomeModelo]=useState('');
  const [favoritoId,setFavoritoId]=useState<string|null>(null);
  const [colunasEscolhidas,setColunasEscolhidas]=useState<string[]|null>(null);
  const [indicadoresEscolhidos,setIndicadoresEscolhidos]=useState<string[]|null>(null);
  const [modoPeriodo,setModoPeriodo]=useState<ConfiguracaoRelatorio['periodo']['modo']>('fixo');
  const [periodoModelo,setPeriodoModelo]=useState('');
  const [periodo,setPeriodo]=useState(mesAtual);
  const [aplicado,setAplicado]=useState(mesAtual);
  const [dados,setDados]=useState<DadosRelatorio|null>(null);
  const [carregando,setCarregando]=useState(true);
  const [erro,setErro]=useState('');
  const [aba,setAba]=useState<Aba>('visitas');
  const [responsavel,setResponsavel]=useState('');
  const [busca,setBusca]=useState('');
  const [canal,setCanal]=useState('');
  const [representada,setRepresentada]=useState('');
  const [rota,setRota]=useState('');
  const [semVenda,setSemVenda]=useState(false);
  const [pagina,setPagina]=useState(1);
  const [atualizacao,setAtualizacao]=useState(0);
  const [geradoEm,setGeradoEm]=useState('');
  const sequencia=useRef(0);
  useEffect(()=>{
    const numero=++sequencia.current;
    setCarregando(true);setErro('');setDados(null);
    void carregarRelatorio(aplicado.inicio,aplicado.fim).then(d=>{
      if(numero!==sequencia.current)return;
      setDados(d);setGeradoEm(new Date().toLocaleString('pt-BR'));
      setAba(a=>a==='financeiro'||d.permissoes[a]?a:'financeiro');
    }).catch(e=>{if(numero===sequencia.current)setErro(e instanceof Error?e.message:'Não foi possível gerar o relatório.');})
      .finally(()=>{if(numero===sequencia.current)setCarregando(false);});
    return ()=>{sequencia.current++;};
  },[aplicado,atualizacao]);
  useEffect(()=>{setPagina(1);},[aba,responsavel,busca,canal,representada,rota,semVenda,dados]);
  const nomesResponsaveis=useMemo(()=>{
    const mapa=new Map(dados?.responsaveis.map(r=>[r.user_id,r.nome])??[]);
    dados?.financeiro.forEach(p=>mapa.set(p.responsavel_user_id,p.responsavel_nome));
    dados?.despesas.forEach(d=>mapa.set(d.responsavel_user_id,d.responsavel_nome));
    dados?.visitas.forEach(v=>{const id=v.responsavel_user_id||v.user_id;if(!mapa.has(id))mapa.set(id,'Responsável não disponível');});
    return mapa;
  },[dados]);
  const nomesClientes=useMemo(()=>{
    const mapa=new Map(dados?.clientes.map(c=>[c.id,c.nome])??[]);
    dados?.visitas.forEach(v=>mapa.set(v.cliente_id,v.cliente_nome));
    dados?.vendas.forEach(v=>mapa.set(v.cliente_id,v.cliente_nome));
    dados?.despesas.forEach(d=>{if(d.cliente_id)mapa.set(d.cliente_id,d.cliente_nome);});
    return mapa;
  },[dados]);
  const relatorioBase=useMemo(()=>{
    const termo=busca.trim().toLocaleLowerCase('pt-BR');
    const bate=(id:string,texto:string)=> (!responsavel||id===responsavel)&&(!termo||texto.toLocaleLowerCase('pt-BR').includes(termo));
    const visitasBase=(dados?.visitas??[]).filter(v=>bate(v.responsavel_user_id||v.user_id,v.cliente_nome));
    const visitasPorId=new Map((dados?.visitas??[]).map(v=>[v.id,v]));
    const origem=(id:string|null)=>{const v=id?visitasPorId.get(id):undefined;return v?.origem_venda||'Não informada';};
    const vendas=(dados?.vendas??[]).filter(v=>bate(v.responsavel_user_id,v.cliente_nome)&&(aba!=='vendas'||!canal||origem(v.visita_id)===canal));
    const compradores=new Set(vendas.filter(v=>v.situacao!=='Cancelado').map(v=>v.cliente_id));
    const visitas=visitasBase.filter(v=>(!canal||v.tipo_contato===canal)&&(!semVenda||!compradores.has(v.cliente_id)));
    const financeiro=(dados?.financeiro??[]).filter(p=>bate(p.responsavel_user_id,p.cliente_nome)&&(!representada||p.representada_id===representada));
    const despesas=(dados?.despesas??[]).filter(d=>bate(d.responsavel_user_id,`${d.cliente_nome} ${d.descricao} ${d.fornecedor}`)&&(!rota||(rota==='sem-rota'?!d.rota_id:d.rota_id===rota)));
    const agenda=(dados?.agenda??[]).filter(e=>bate(e.responsavel_user_id,`${e.titulo} ${e.cliente_id?nomesClientes.get(e.cliente_id)||'':''}`));
    const comercial=resumoComercial(visitas,vendas);
    const financeiroResumo=resumoFinanceiro(financeiro,!!dados?.preposto);
    const despesaResumo=resumirDespesas(despesas);
    const resp=(id:string)=>nomesResponsaveis.get(id)||'Responsável não disponível';
    let indicadores: [string,string][]=[]; let colunas:string[]=[]; let linhas:(string|number)[][]=[];
    let nota='';
    if(aba==='visitas') {
      indicadores=[['Contatos registrados',String(comercial.visitas)],['Clientes visitados',String(comercial.visitados)],['Quilometragem registrada',decimal(comercial.km)+' km'],['Tempo em atendimento',decimal(comercial.minutos)+' min']];
      if(dados?.permissoes.vendas) indicadores.push(['Clientes visitados com venda',comercial.positivacao===null?'—':decimal(comercial.positivacao)+'%'],['Clientes sem venda no período',String(comercial.semFechamento.length)]);
      colunas=['Data','Cliente','Responsável','Contato','Resultado','Entrada','Saída','Minutos','Km','Próxima ação','Retorno indicado'];
      linhas=visitas.sort((a,b)=>b.data.localeCompare(a.data)).map(v=>[dataBr(v.data),v.cliente_nome,resp(v.responsavel_user_id||v.user_id),v.tipo_contato||'Não informado',v.resultado,v.hora_entrada?.slice(0,5)||'—',v.hora_saida?.slice(0,5)||'—',v.duracao_minutos??'—',v.km_trecho===null?'—':decimal(Number(v.km_trecho)),v.proxima_acao||'—',dataBr(v.proxima_data)]);
      nota=`Contatos incluem visitas presenciais, telefone e WhatsApp. Quilometragem informada em ${comercial.kmInformados} de ${visitas.length} registros. Tempo soma os atendimentos, não a jornada. A positivação considera clientes visitados com venda ativa não cancelada no período. Retornos indicados são o histórico da visita; consulte a aba Agenda para a situação atual.`;
    } else if(aba==='vendas') {
      indicadores=[['Vendas registradas',moeda(comercial.total)],['Pedidos válidos',String(comercial.pedidos)],['Clientes compradores',String(comercial.compradores)],['Ticket médio',moeda(comercial.ticket)],['Maior pedido',moeda(comercial.maior)]];
      colunas=['Data','Cliente','Responsável','Origem da venda','Situação','Valor (R$)'];
      linhas=vendas.sort((a,b)=>b.data.localeCompare(a.data)).map(v=>[dataBr(v.data),v.cliente_nome,resp(v.responsavel_user_id),origem(v.visita_id),v.situacao,Number(v.valor).toFixed(2).replace('.',',')]);
      nota='Período pela data da venda. Canceladas aparecem no histórico e ficam fora dos indicadores. Cada venda é contada uma única vez. Origem vem do registro da visita vinculada, quando disponível; não é presumida pelo tipo de contato.';
    } else if(aba==='financeiro') {
      indicadores=[['Faturado dos pedidos',moeda(financeiroResumo.faturado)],['Liquidado dos pedidos',moeda(financeiroResumo.liquidado)],['Comissão prevista',moeda(financeiroResumo.prevista)],['Comissão liberada',moeda(financeiroResumo.liberada)],['Comissão recebida',moeda(financeiroResumo.recebida)]];
      if(!dados?.preposto)indicadores.push(['Comissão paga a prepostos',moeda(financeiroResumo.repasse)]);
      colunas=['Data da venda','Cliente','Responsável','Representada','Pedido','Situação','Faturado em','Faturado (R$)','Liquidado (R$)','Comissão prevista (R$)','Liberada (R$)','Recebida (R$)'];
      const valor=(v:number|null)=>v===null?'—':Number(v).toFixed(2).replace('.',',');
      linhas=financeiro.sort((a,b)=>b.data_venda.localeCompare(a.data_venda)).map(p=>[dataBr(p.data_venda),p.cliente_nome,p.responsavel_nome,p.representada_nome,p.numero_pedido||'—',p.status_pedido,dataBr(p.faturado_em),valor(p.valor_faturado),valor(p.valor_liquidado),valor(dados?.preposto?p.comissao_preposto_total:p.comissao_representante_total),valor(dados?.preposto?p.comissao_preposto_liberada:p.comissao_representante_liberada),valor(dados?.preposto?p.comissao_preposto_paga:p.comissao_representante_recebida)]);
      nota=`Período pela data da venda. Valores acumulados atuais dos pedidos selecionados, inclusive pagamentos posteriores ao período; este quadro não é um fluxo de caixa por data de recebimento. Ordens canceladas ficam fora dos indicadores. Comissões ${dados?.preposto?'do próprio preposto':'do representante; repasses aos prepostos aparecem separadamente'}.`;
    } else if(aba==='despesas') {
      indicadores=[['Total lançado',moeda(despesaResumo.total)],['Pago',moeda(despesaResumo.pago)],['Pendente',moeda(despesaResumo.pendente)],['Vencido',moeda(despesaResumo.vencido)]];
      colunas=['Data','Descrição','Responsável','Grupo','Categoria','Cliente','Rota','Situação','Vencimento','Pago em','Valor (R$)'];
      linhas=despesas.sort((a,b)=>b.data.localeCompare(a.data)).map(d=>[dataBr(d.data),d.descricao,resp(d.responsavel_user_id),d.grupo,d.categoria,d.cliente_nome||'Sem vínculo',d.rota_nome||'Sem vínculo',d.status,dataBr(d.vencimento),dataBr(d.pago_em),(Number(d.valor_centavos)/100).toFixed(2).replace('.',',')]);
      nota='Período pela data da despesa. Canceladas ficam fora dos totais. Vencidas fazem parte das pendentes. Cliente e rota são vínculos opcionais.';
    } else {
      indicadores=[['Compromissos',String(agenda.length)],['Pendentes',String(agenda.filter(e=>e.status==='Pendente').length)],['Concluídos',String(agenda.filter(e=>e.status==='Concluído').length)],['Retornos pendentes',String(agenda.filter(e=>e.tipo==='Retorno'&&e.status==='Pendente').length)]];
      colunas=['Data','Hora','Compromisso','Cliente','Responsável','Tipo','Situação'];
      linhas=agenda.sort((a,b)=>a.data.localeCompare(b.data)||(a.hora||'').localeCompare(b.hora||'')).map(e=>[dataBr(e.data),e.hora?.slice(0,5)||'—',e.titulo,e.cliente_id?nomesClientes.get(e.cliente_id)||'Cliente não disponível':'Sem cliente',resp(e.responsavel_user_id),e.tipo,e.status]);
      nota='Período pela data agendada. Inclui compromissos já gravados na agenda. Sugestões de visita por frequência ainda não confirmadas não são compromissos registrados.';
    }
    return {indicadores,colunas,linhas,nota};
  },[dados,aba,responsavel,busca,canal,representada,rota,semVenda,nomesResponsaveis,nomesClientes]);
  const personalizado=modo!=='prontos';
  const relatorio=useMemo(()=>personalizado?selecionarCampos(relatorioBase,colunasEscolhidas,indicadoresEscolhidos):relatorioBase,[relatorioBase,personalizado,colunasEscolhidas,indicadoresEscolhidos]);
  const tituloRelatorio=personalizado&&nomeModelo.trim()?nomeModelo.trim():nomes[aba];
  const configuracao=useMemo<ConfiguracaoRelatorio>(()=>({versao:1,tipo:aba,colunas:relatorio.colunas,indicadores:relatorio.indicadores.map(([nome])=>nome),periodo:{modo:modoPeriodo,...aplicado},filtros:{responsavel: dados?.responsavelForcado?'':responsavel,busca,canal,representada,rota,semVenda}}),[aba,relatorio,modoPeriodo,aplicado,responsavel,busca,canal,representada,rota,semVenda,dados?.responsavelForcado]);
  function mudarModo(m:'prontos'|'montar'|'favoritos') {
    setModo(m);
    if(m==='prontos'){setColunasEscolhidas(null);setIndicadoresEscolhidos(null);setNomeModelo('');setFavoritoId(null);setModoPeriodo('fixo');setPeriodoModelo('');}
  }
  function abrirFavorito(f:FavoritoRelatorio) {
    const c=f.configuracao;
    if(!dados||(c.tipo!=='financeiro'&&!dados.permissoes[c.tipo]))return;
    setAba(c.tipo);setNomeModelo(f.nome);setFavoritoId(f.id);setColunasEscolhidas(c.colunas);setIndicadoresEscolhidos(c.indicadores);
    setModoPeriodo(c.periodo.modo);setModo('montar');setResponsavel(dados.responsavelForcado?'':c.filtros.responsavel);setBusca(c.filtros.busca);setCanal(c.filtros.canal);setRepresentada(c.filtros.representada);setRota(c.filtros.rota);setSemVenda(c.filtros.semVenda&&dados.permissoes.vendas);
    const novo=periodoFavorito(c.periodo,hojeDespesa());setPeriodo(novo);setAplicado(novo);setPeriodoModelo(`Modelo aberto: ${f.nome}. Resultados atualizados para o período selecionado.`);
  }
  const paginas=Math.max(1,Math.ceil(relatorio.linhas.length/25));
  const paginaAtual=Math.min(pagina,paginas);
  const opcoesRepresentadas=Array.from(new Map(dados?.financeiro.map(p=>[p.representada_id,p.representada_nome])??[]));
  const opcoesRotas=Array.from(new Map(dados?.despesas.filter(d=>d.rota_id).map(d=>[d.rota_id!,d.rota_nome])??[]));
  function trocarAba(a:Aba) { setColunasEscolhidas(null);setIndicadoresEscolhidos(null);setFavoritoId(null);setNomeModelo('');setPeriodoModelo('');setAba(a);setCanal('');setRepresentada('');setRota('');setSemVenda(false); }
  function aplicar(e:FormEvent) { e.preventDefault();if(periodo.inicio!==aplicado.inicio||periodo.fim!==aplicado.fim)setModoPeriodo('fixo');setAplicado({...periodo}); }
  function exportar() {
    if(!dados||carregando||erro||!relatorio.colunas.length)return;
    const csv=gerarCsv([['Torres Gestor Comercial',tituloRelatorio],['Operação',dados.operacao],['Período',dataBr(aplicado.inicio)+' a '+dataBr(aplicado.fim)],['Responsável',nomesResponsaveis.get(responsavel||dados.responsavelForcado||'')||'Todos no contexto'],['Busca',busca],['Canal',canal],['Representada',opcoesRepresentadas.find(([id])=>id===representada)?.[1]||'Todas'],['Rota',opcoesRotas.find(([id])=>id===rota)?.[1]||(rota==='sem-rota'?'Sem vínculo':'Todas')],['Somente clientes sem venda',semVenda?'Sim':'Não'],['Gerado em',geradoEm],['Critérios',relatorio.nota],[],...relatorio.indicadores,[],relatorio.colunas,...relatorio.linhas]);
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
    const a=document.createElement('a');a.href=url;a.download=`relatorio-${aba}-${aplicado.inicio}-${aplicado.fim}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <AppShell><div className={styles.page}>
    <header className={`pageHeader ${styles.header}`}><div><p className="eyebrow">VISÃO DA OPERAÇÃO</p><h1>Relatórios</h1><p>Consulte resultados, acompanhe os gastos e prepare seu fechamento.</p></div><BarChart3 size={32}/></header>
    <nav className={styles.modos} aria-label="Opções de relatórios">{([['prontos','Relatórios prontos'],['montar','Montar relatório'],['favoritos','Favoritos']] as const).map(([id,nome])=><button key={id} type="button" aria-pressed={modo===id} onClick={()=>mudarModo(id)}>{nome}</button>)}</nav>
    {modo!=='favoritos'&&<>
    <section className={`panel ${styles.filtros}`} aria-label="Filtros do relatório">
      <form onSubmit={aplicar} className={styles.periodo}>
        <label>De<input required type="date" value={periodo.inicio} onChange={e=>setPeriodo({...periodo,inicio:e.target.value})}/></label>
        <label>Até<input required type="date" value={periodo.fim} onChange={e=>setPeriodo({...periodo,fim:e.target.value})}/></label>
        <button className="primary" disabled={carregando} type="submit"><RefreshCw size={16}/> Gerar relatório</button>
        <button className="secondary" type="button" disabled={carregando} onClick={()=>{const p=mesAtual();setPeriodo(p);setAplicado(p);setResponsavel('');setBusca('');setCanal('');setRepresentada('');setRota('');setSemVenda(false);}}>Limpar filtros</button>
      </form>
      <div className={styles.filtrosExtras}>
        <label>Responsável<select value={responsavel} onChange={e=>setResponsavel(e.target.value)} disabled={!!dados?.responsavelForcado||carregando}><option value="">{dados?.responsavelForcado?'Responsável do contexto atual':'Todos os responsáveis'}</option>{Array.from(nomesResponsaveis,([id,nome])=><option key={id} value={id}>{nome}</option>)}</select></label>
        <label>Cliente ou descrição<input type="search" placeholder="Digite para filtrar" value={busca} onChange={e=>setBusca(e.target.value)}/></label>
        {(aba==='visitas'||aba==='vendas')&&<label>{aba==='visitas'?'Tipo de contato':'Origem da venda'}<select value={canal} onChange={e=>setCanal(e.target.value)}><option value="">Todos</option>{['Presencial','WhatsApp','Telefone','Outro','Não informada'].map(c=><option key={c}>{c}</option>)}</select></label>}
        {aba==='financeiro'&&<label>Representada<select value={representada} onChange={e=>setRepresentada(e.target.value)}><option value="">Todas</option>{opcoesRepresentadas.map(([id,nome])=><option key={id} value={id}>{nome}</option>)}</select></label>}
        {aba==='despesas'&&<label>Rota<select value={rota} onChange={e=>setRota(e.target.value)}><option value="">Todas</option><option value="sem-rota">Sem vínculo</option>{opcoesRotas.map(([id,nome])=><option key={id} value={id}>{nome}</option>)}</select></label>}
        {aba==='visitas'&&dados?.permissoes.vendas&&<label className={styles.check}><input type="checkbox" checked={semVenda} onChange={e=>setSemVenda(e.target.checked)}/> Somente clientes sem venda no período</label>}
      </div>
    </section>
    <nav className={styles.abas} aria-label="Tipos de relatório">{(Object.keys(nomes) as Aba[]).filter(a=>!dados||a==='financeiro'||dados.permissoes[a]).map(a=><button key={a} type="button" aria-pressed={aba===a} onClick={()=>trocarAba(a)}>{nomes[a]}</button>)}</nav>
    {modo==='montar'&&dados&&!carregando&&!erro&&<section className={`panel ${styles.montador}`} aria-label="Montar relatório">
      <h2>Montar relatório</h2><p className={styles.criterios}>Escolha o tipo de relatório acima, ajuste os filtros e marque o que deseja exibir. A prévia, o CSV e a impressão acompanham sua seleção.</p>
      <label>Período ao abrir o favorito<select value={modoPeriodo} onChange={e=>{const valor=e.target.value as ConfiguracaoRelatorio['periodo']['modo'];setModoPeriodo(valor);if(valor!=='fixo'){const p=periodoFavorito({modo:valor,...aplicado},hojeDespesa());setPeriodo(p);setAplicado(p);}}}><option value="fixo">Manter as datas selecionadas</option><option value="mes-atual">Mês atual</option><option value="ultimos-30">Últimos 30 dias</option></select></label>
      <fieldset><legend>Colunas do relatório</legend><div className={styles.opcoesCampos}>{relatorioBase.colunas.map(c=><label key={c}><input type="checkbox" checked={relatorio.colunas.includes(c)} disabled={relatorio.colunas.length===1&&relatorio.colunas.includes(c)} onChange={e=>setColunasEscolhidas(e.target.checked?[...relatorio.colunas,c]:relatorio.colunas.filter(x=>x!==c))}/>{c}</label>)}</div></fieldset>
      <fieldset><legend>Indicadores do resumo</legend><div className={styles.opcoesCampos}>{relatorioBase.indicadores.map(([c])=><label key={c}><input type="checkbox" checked={relatorio.indicadores.some(([nome])=>nome===c)} onChange={e=>setIndicadoresEscolhidos(e.target.checked?[...relatorio.indicadores.map(([nome])=>nome),c]:relatorio.indicadores.map(([nome])=>nome).filter(x=>x!==c))}/>{c}</label>)}</div></fieldset>
      <button className="secondary" type="button" onClick={()=>{setColunasEscolhidas(null);setIndicadoresEscolhidos(null);}}>Selecionar todos os campos</button>
    </section>}
    </>}
    {dados&&!carregando&&!erro&&<FavoritosRelatorios contexto={dados} modo={modo} configuracao={configuracao} nome={nomeModelo} setNome={setNomeModelo} favoritoId={favoritoId} setFavoritoId={setFavoritoId} abrir={abrirFavorito} permitido={tipo=>tipo==='financeiro'||dados.permissoes[tipo]}/>}
    {periodoModelo&&modo==='montar'&&<p role="status" className={styles.criterios}>{periodoModelo}</p>}
    {carregando?<div className={styles.estado} role="status">Gerando relatório…</div>:erro?<div className={styles.erro} role="alert"><AlertCircle size={20}/><div>{erro}<p>Os totais não foram exibidos para evitar um relatório incompleto.</p><button className="secondary" onClick={()=>setAtualizacao(v=>v+1)}>Tentar novamente</button></div></div>:dados&&modo!=='favoritos'&&<>
      <div className={styles.titulo}><div><h2>{tituloRelatorio}</h2><p>{dados.operacao} · {dataBr(aplicado.inicio)} a {dataBr(aplicado.fim)}</p><small>Gerado em {geradoEm} · {relatorio.linhas.length} registros</small></div><div className={styles.acoes}><button type="button" className="secondary" disabled={!relatorio.colunas.length} onClick={exportar}><Download size={16}/> Exportar CSV</button><button type="button" className="secondary" disabled={!relatorio.colunas.length} onClick={()=>window.print()}><Printer size={16}/> Imprimir / PDF</button></div></div>
      <p className={styles.criterios}>Responsável: {nomesResponsaveis.get(responsavel)|| (dados.responsavelForcado?nomesResponsaveis.get(dados.responsavelForcado)||'Contexto atual':'Todos')}{busca?` · Busca: ${busca}`:''}{canal?` · Canal: ${canal}`:''}{representada?` · Representada: ${opcoesRepresentadas.find(([id])=>id===representada)?.[1]}`:''}{rota?` · Rota: ${opcoesRotas.find(([id])=>id===rota)?.[1]||'Sem vínculo'}`:''}{semVenda?' · Somente clientes sem venda':''}</p>
      <div className={styles.indicadores}>{relatorio.indicadores.map(([label,valor])=><article key={label}><span>{label}</span><strong>{valor}</strong></article>)}</div>
      <p className={styles.nota}>{relatorio.nota}</p>
      <section className={styles.resultado} aria-label="Dados do relatório">
        {!relatorio.linhas.length?<div className={styles.estado}><BarChart3 size={30}/><h3>Nenhum registro neste filtro</h3><p>Ajuste o período ou os filtros para consultar outros resultados.</p></div>:<>
          <div className={styles.tabela}><table><caption>{tituloRelatorio} — {relatorio.linhas.length} registros</caption><thead><tr>{relatorio.colunas.map(c=><th key={c} scope="col">{c}</th>)}</tr></thead><tbody>{relatorio.linhas.map((linha,i)=><tr key={i} className={i<(paginaAtual-1)*25||i>=paginaAtual*25?styles.foraPagina:undefined}>{linha.map((valor,j)=><td key={j}>{valor}</td>)}</tr>)}</tbody></table></div>
          <div className={styles.paginacao}><button className="secondary" disabled={paginaAtual===1} onClick={()=>setPagina(paginaAtual-1)}>Anterior</button><span>Página {paginaAtual} de {paginas}</span><button className="secondary" disabled={paginaAtual===paginas} onClick={()=>setPagina(paginaAtual+1)}>Próxima</button></div>
        </>}
      </section>
      <p className={styles.rodape}>Torres Gestor Comercial · A exportação e a impressão incluem todos os registros filtrados, além da página exibida.</p>
    </>}
  </div></AppShell>;
}
