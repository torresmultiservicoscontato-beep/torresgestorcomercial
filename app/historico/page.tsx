'use client';
import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell';
import { listarAuditoria, type RegistroAuditoria } from '../lib/auditoria';

const acoes: Record<string, string> = { INSERT: 'Criou', UPDATE: 'Alterou', DELETE: 'Excluiu' };
function valor(dado: unknown) {
 if (dado === undefined || dado === null) return '—';
 return typeof dado === 'object' ? JSON.stringify(dado) : String(dado);
}
export default function Historico() {
 const [registros, setRegistros] = useState<RegistroAuditoria[]>([]);
 const [pagina, setPagina] = useState(0);
 const [acao, setAcao] = useState('');
 const [erro, setErro] = useState('');
 const [carregando, setCarregando] = useState(true);
 const [atualizacao, setAtualizacao] = useState(0);
 useEffect(() => {
  let ativo = true;
  setCarregando(true); setErro(''); setRegistros([]);
  listarAuditoria(pagina, acao).then(dados => { if (ativo) setRegistros(dados); })
   .catch(e => { if (ativo) setErro(e instanceof Error ? e.message : 'Falha ao carregar histórico.'); })
   .finally(() => { if (ativo) setCarregando(false); });
  return () => { ativo = false; };
 }, [pagina, acao, atualizacao]);
 return <AppShell><section className="panel">
  <h1>Histórico de alterações</h1>
  <p>Quem criou, alterou ou excluiu informações. Registros disponíveis a partir da ativação do histórico.</p>
  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '20px 0' }}>
   <label>Ação <select value={acao} onChange={e => { setAcao(e.target.value); setPagina(0); }}>
    <option value="">Todas</option><option value="INSERT">Criação</option><option value="UPDATE">Alteração</option><option value="DELETE">Exclusão</option>
   </select></label>
   <button className="secondary" disabled={carregando} onClick={() => setAtualizacao(n => n + 1)}>Atualizar</button>
  </div>
  {erro && <p role="alert">{erro}</p>}
  {carregando ? <p>Carregando histórico...</p> : !erro && registros.length === 0 ? <p>Nenhum registro encontrado.</p> : null}
  {registros.map(r => {
   const campos = Array.from(new Set([...Object.keys(r.dados_antes ?? {}), ...Object.keys(r.dados_depois ?? {})]))
    .filter(c => r.acao !== 'UPDATE' || JSON.stringify(r.dados_antes?.[c]) !== JSON.stringify(r.dados_depois?.[c]));
   return <article key={r.id} style={{ padding: '16px 0', borderBottom: '1px solid #dbe2ea', overflowWrap: 'anywhere' }}>
    <strong>{r.ator_nome} · {acoes[r.acao] ?? r.acao}</strong>
    <p>{r.tabela.replaceAll('_', ' ')} · {new Date(r.ocorrido_em).toLocaleString('pt-BR')} · Registro: {r.registro_id}</p>
    <details><summary>Ver alterações</summary>
     <p>Identificação do autor: {r.ator_user_id ?? 'Operação técnica sem usuário autenticado'}</p>
     <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', textAlign: 'left' }}><thead><tr><th>Campo</th><th>Antes</th><th>Depois</th></tr></thead>
      <tbody>{campos.map(c => <tr key={c}><td>{c.replaceAll('_', ' ')}</td><td>{valor(r.dados_antes?.[c])}</td><td>{valor(r.dados_depois?.[c])}</td></tr>)}</tbody>
     </table></div>
    </details>
   </article>;
  })}
  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 20 }}>
   <button className="secondary" disabled={carregando || pagina === 0} onClick={() => setPagina(p => p - 1)}>Anterior</button>
   <span>Página {pagina + 1}</span>
   <button className="secondary" disabled={carregando || registros.length < 50} onClick={() => setPagina(p => p + 1)}>Próxima</button>
  </div>
 </section></AppShell>;
}
