import type { ChangeEventHandler, Ref } from "react";

import { Checkbox } from "../../components/ui/Checkbox.tsx";
import { legalRoute } from "../../config/routes.ts";

type Props = {
  checked: boolean;
  error?: string;
  ref?: Ref<HTMLInputElement>;
  onChange: ChangeEventHandler<HTMLInputElement>;
};

// Aceptación expresa de los textos legales al crear una cuenta, en el registro (UI-006) y al
// aceptar una invitación (UI-011). La casilla nace sin marcar: la autorización nunca se
// presume (Ley 1581 de 2012, art. 9; RN-029).
export function LegalConsent({ checked, error, ref, onChange }: Props) {
  return (
    <Checkbox
      ref={ref}
      name="acepta"
      required
      checked={checked}
      error={error}
      onChange={onChange}
    >
      Acepto los{" "}
      <NewTabLink to={legalRoute("terminos")}>
        términos y condiciones
      </NewTabLink>{" "}
      y autorizo el tratamiento de mis datos según la{" "}
      <NewTabLink to={legalRoute("privacidad")}>
        política de privacidad
      </NewTabLink>
      . Mi contraseña se guarda como un resumen irreversible que nadie en
      ALETHEIA puede leer.
    </Checkbox>
  );
}

// Las políticas se abren en otra pestaña para no perder lo escrito en el formulario.
function NewTabLink({ to, children }: { to: string; children: string }) {
  return (
    <a href={to} target="_blank" rel="noopener">
      {children}
      <span className="visually-hidden"> (se abre en otra pestaña)</span>
    </a>
  );
}
