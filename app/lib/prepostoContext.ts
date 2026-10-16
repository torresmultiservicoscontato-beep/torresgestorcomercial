export type PrepostoAdministrado = {
  titularUserId: string;
  userId: string;
  nome: string;
  email: string;
};

const CHAVE_CONTEXTO_PREPOSTO = "torres_preposto_administrado";

export function obterPrepostoAdministrado(): PrepostoAdministrado | null {
  if (typeof window === "undefined") return null;

  const salvo = window.sessionStorage.getItem(CHAVE_CONTEXTO_PREPOSTO);
  if (!salvo) return null;

  try {
    const parsed = JSON.parse(salvo) as Partial<PrepostoAdministrado>;
    if (!parsed.titularUserId || !parsed.userId) return null;

    return {
      titularUserId: parsed.titularUserId,
      userId: parsed.userId,
      nome: parsed.nome ?? "Preposto",
      email: parsed.email ?? "",
    };
  } catch {
    window.sessionStorage.removeItem(CHAVE_CONTEXTO_PREPOSTO);
    return null;
  }
}

export function definirPrepostoAdministrado(preposto: PrepostoAdministrado) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(CHAVE_CONTEXTO_PREPOSTO, JSON.stringify(preposto));
}

export function limparPrepostoAdministrado() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(CHAVE_CONTEXTO_PREPOSTO);
}
