import Link from "next/link";
import type { ReactNode } from "react";

export default function PublicLegalPage({ title, children }: { title: string; children: ReactNode }) {
  return <main style={{maxWidth:820, margin:"48px auto",padding:"0 24px",lineHeight:1.7}}>
    <header><Link href="/login">← Torres Gestor Comercial</Link><h1>{title}</h1>
    <p>Versão preliminar para revisão jurídica e institucional antes da publicação em produção.</p></header>
    <article>{children}</article>
    <footer style={{marginTop:42,paddingTop:20,borderTop:"1px solid #ccc",display:"flex",gap:18,flexWrap:"wrap"}}>
    <Link href="/termos">Termos de Uso</Link><Link href="/privacidade">Política de Privacidade</Link><Link href="/suporte">Suporte</Link>
    </footer>
  </main>;
}
