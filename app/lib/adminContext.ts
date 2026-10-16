export type RepresentanteAdministrado = {
  userId: string;
  nome: string;
  nomeRepresentacao: string;
  email: string;
};

const CHAVE_CONTEXTO_ADMIN = "torres_admin_representante";

export function obterRepresentanteAdministrado(): RepresentanteAdministrado | null {
  if (typeof window === "undefined") return null;

  const salvo = window.sessionStorage.getItem(CHAVE_CONTEXTO_ADMIN);
  if (!salvo) return null;

  try {
    const parsed = JSON.parse(salvo) as Partial<RepresentanteAdministrado>;
    if (!parsed.userId) return null;

    return {
      userId: parsed.userId,
      nome: parsed.nome ?? "Representante",
      nomeRepresentacao: parsed.nomeRepresentacao ?? "Representação",
      email: parsed.email ?? "",
    };
  } catch {
    window.sessionStorage.removeItem(CHAVE_CONTEXTO_ADMIN);
    return null;
  }
}

export function definirRepresentanteAdministrado(representante: RepresentanteAdministrado) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(CHAVE_CONTEXTO_ADMIN, JSON.stringify(representante));
}

export function limparRepresentanteAdministrado() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(CHAVE_CONTEXTO_ADMIN);
}
