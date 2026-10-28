import type { Metadata } from "next";
import PublicLegalPage from "../components/PublicLegalPage";

export const metadata: Metadata = { title: "Suporte | Torres Gestor Comercial" };
const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();

export default function SuportePage() {
  return <PublicLegalPage title="Central de suporte">
    <p>Precisa de ajuda com acesso, cadastro, visitas, vendas, anexos ou funcionamento do sistema? Descreva o ocorrido, a página e a data aproximada. Nunca envie senhas, tokens ou documentos pessoais em mensagens não protegidas.</p>
    {supportEmail
      ? <p><strong>Atendimento por e-mail:</strong> <a href={`mailto:${supportEmail}?subject=Suporte%20Torres%20Gestor%20Comercial`}>{supportEmail}</a></p>
      : <p><strong>Canal de atendimento:</strong> ainda não configurado. O endereço de suporte será disponibilizado após confirmação institucional.</p>}
    <h2>Solicitações de privacidade</h2>
    <p>Para solicitações relativas a dados pessoais, informe que se trata de uma solicitação de privacidade. Não inclua documentos de identificação na primeira mensagem; nossa equipe poderá indicar um meio seguro de verificação.</p>
    <h2>Registro de ocorrências</h2>
    <p>Informe qual funcionalidade foi utilizada, o comportamento esperado e a mensagem de erro, se houver. Os horários e prazos de atendimento serão publicados após definição do serviço de suporte.</p>
  </PublicLegalPage>;
}
