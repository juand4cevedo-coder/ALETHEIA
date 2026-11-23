import { useQueryClient } from "@tanstack/react-query";

import type { Me } from "../../api/generated";
import { readMeQueryKey } from "../../api/generated/@tanstack/react-query.gen.ts";
import logoUrl from "../../assets/simbolo.svg";
import { Button } from "../../components/ui/Button.tsx";
import { SalirIcon } from "../../components/ui/icons.tsx";
import { WORDMARK, pageTitle } from "../../config/site.ts";
import { useSignOut } from "../session/useSignOut.ts";
import { TwoFactorCard } from "./TwoFactorCard.tsx";
import styles from "./TwoFactorRequired.module.css";

// Pantalla que reemplaza al espacio de trabajo cuando el despacho exige la verificación en dos
// pasos y esta persona todavía no la tiene. La API tampoco responde el resto hasta que la active.
export function TwoFactorRequired({ me }: { me: Me }) {
  const queryClient = useQueryClient();
  const session = useSignOut();
  return (
    <div className={styles.screen}>
      <title>{pageTitle("Active la verificación en dos pasos")}</title>
      <meta name="robots" content="noindex" />
      <header className={styles.brand}>
        <img src={logoUrl} alt="" width={28} height={28} />
        <span>{WORDMARK}</span>
      </header>
      <main className={styles.main}>
        <h1>Active la verificación en dos pasos</h1>
        <p>
          {me.organization?.name ?? "Su despacho"} exige un segundo paso al
          ingresar. Actívelo ahora, en un par de minutos, y podrá seguir con su
          trabajo.
        </p>
        <TwoFactorCard
          onCodesSaved={() =>
            void queryClient.invalidateQueries({ queryKey: readMeQueryKey() })
          }
        />
        <Button variant="secondary" size="sm" onClick={session.signOut}>
          <SalirIcon size={16} aria-hidden="true" /> Cerrar sesión
        </Button>
      </main>
    </div>
  );
}
