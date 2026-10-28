import type { Metadata } from "next";
import PublicLegalPage from "../components/PublicLegalPage";

export const metadata: Metadata = { title: "Política de Privacidade | Torres Gestor Comercial" };
export default function PrivacidadePage() {
  return <PublicLegalPage title="Política de Privacidade">
    <p>Esta política explica, de forma preliminar, o tratamento de dados pessoais pelo Torres Gestor Comercial, conforme a Lei Geral de Proteção de Dados (LGPD). A identificação jurídica do controlador e os detalhes operacionais devem ser confirmados antes da publicação definitiva.</p>
    <h2>1. Dados tratados</h2>
    <p>Podem ser tratados dados cadastrais e de contato de usuários, representantes, prepostos e clientes, registros de visitas, operações comerciais, informações de localização informadas no sistema, arquivos anexados e registros de auditoria e autenticação.</p>
    <h2>2. Finalidades</h2>
    <p>Autenticação, controle de acesso, organização de carteiras, registro de visitas e vendas, gestão comercial, segurança, prevenção a fraudes, suporte e cumprimento de obrigações aplicáveis.</p>
    <h2>3. Bases legais e papéis</h2>
    <p>As bases legais dependem de cada operação, podendo incluir execução contratual, cumprimento de obrigação legal, exercício regular de direitos e legítimo interesse após avaliação apropriada. Em operações inseridas por clientes empresariais, a responsabilidade pelo tratamento deve ser definida contratualmente entre as partes.</p>
    <h2>4. Prestadores e armazenamento</h2>
    <p>O serviço utiliza infraestrutura tecnológica de terceiros, incluindo Supabase para autenticação, banco de dados e armazenamento de documentos. O compartilhamento necessário deve observar contratos, medidas de segurança e regras aplicáveis a transferências internacionais.</p>
    <h2>5. Conservação e segurança</h2>
    <p>Os prazos de retenção variam conforme finalidade, obrigação legal e necessidade de auditoria; não há prazo único confirmado nesta versão. São adotados controles de acesso por perfil e segregação de ambientes, sujeitos a validação contínua.</p>
    <h2>6. Direitos do titular</h2>
    <p>É possível solicitar confirmação de tratamento, acesso, correção, informações sobre compartilhamento e demais direitos previstos na LGPD, quando aplicáveis. As solicitações podem ser encaminhadas pelo <a href="/suporte">canal de suporte</a>; a identidade do solicitante poderá ser verificada.</p>
    <h2>7. Atualizações</h2>
    <p>Esta política será revista quando houver alterações relevantes nos processos, fornecedores ou obrigações legais. A identificação do encarregado/canal de privacidade deverá ser confirmada pelo responsável pelo serviço.</p>
  </PublicLegalPage>;
}
