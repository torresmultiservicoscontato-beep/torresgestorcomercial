import type { Metadata } from "next";
import PublicLegalPage from "../components/PublicLegalPage";

export const metadata: Metadata = { title: "Termos de Uso | Torres Gestor Comercial" };
export default function TermosPage() {
  return <PublicLegalPage title="Termos de Uso">
    <p>Estes termos descrevem as condições gerais para utilização do Torres Gestor Comercial, sistema de gestão de clientes, visitas, vendas, documentos, comissões e equipes comerciais.</p>
    <h2>1. Acesso e contas</h2>
    <p>O usuário deve fornecer informações corretas, manter suas credenciais em sigilo e usar o sistema somente com as permissões concedidas. O compartilhamento indevido de acesso e o uso não autorizado de dados são proibidos.</p>
    <h2>2. Responsabilidades</h2>
    <p>Representantes e responsáveis pelas operações devem assegurar a licitude das informações de clientes e demais pessoas cadastradas, inclusive documentos anexados. O sistema é uma ferramenta de organização e não substitui documentação fiscal, contábil ou obrigações legais.</p>
    <h2>3. Disponibilidade e segurança</h2>
    <p>Podem ocorrer manutenções e indisponibilidades. Os usuários devem comunicar incidentes e evitar o envio de conteúdos ilícitos, maliciosos ou desnecessariamente sensíveis.</p>
    <h2>4. Dados e documentos</h2>
    <p>O tratamento de dados pessoais é descrito na <a href="/privacidade">Política de Privacidade</a>. O uso do sistema não transfere automaticamente a titularidade dos documentos comerciais inseridos.</p>
    <h2>5. Suspensão e encerramento</h2>
    <p>Acesso irregular ou uso contrário às regras poderá resultar em restrições, observada a legislação aplicável. Solicitações de encerramento e suporte podem ser encaminhadas pela página de suporte.</p>
    <h2>6. Alterações</h2>
    <p>As condições poderão ser atualizadas; alterações relevantes deverão ser comunicadas de modo adequado. Informações sobre planos, cobrança, jurisdição e identificação jurídica do fornecedor dependem de validação institucional antes do lançamento.</p>
  </PublicLegalPage>;
}
