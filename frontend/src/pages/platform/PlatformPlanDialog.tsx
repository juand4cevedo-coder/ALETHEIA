import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";

import type { PlatformPlan } from "../../api/generated";
import { updatePlanMutation } from "../../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Checkbox } from "../../components/ui/Checkbox.tsx";
import { Dialog } from "../../components/ui/Dialog.tsx";
import { Field } from "../../components/ui/Field.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import { SystemError } from "../../components/ui/SystemError.tsx";
import { apiProblem } from "../../features/auth/apiProblem.ts";

type Props = { plan: PlatformPlan | null; onClose: () => void };

function toNumber(value: string): number | null | "invalid" {
  const clean = value.trim().replace(/[.\s]/g, "");
  if (clean === "") return null;
  return /^\d{1,12}$/.test(clean) ? Number(clean) : "invalid";
}

// Editar un plan del catálogo: precios, usuarios incluidos, adicionales y su tope, y si aparece
// en la página de precios.
// Lo que se guarda rige para los pagos nuevos y para el cupo de los despachos desde la siguiente
// petición; lo ya cobrado no cambia. Cada cambio queda en la auditoría de la plataforma.
export function PlatformPlanDialog({ plan, onClose }: Props) {
  const queryClient = useQueryClient();
  const [monthly, setMonthly] = useState(String(plan?.monthly_price_cop ?? ""));
  const [annual, setAnnual] = useState(String(plan?.annual_price_cop ?? ""));
  const [users, setUsers] = useState(String(plan?.included_users ?? ""));
  const [extra, setExtra] = useState(String(plan?.extra_user_price_cop ?? ""));
  const [maxExtra, setMaxExtra] = useState(String(plan?.max_extra_users ?? ""));
  const [isPublic, setIsPublic] = useState(plan?.is_public ?? false);
  const [error, setError] = useState<string>();

  const save = useMutation({
    ...updatePlanMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      onClose();
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!plan || save.isPending) return;
    const m = toNumber(monthly);
    const a = toNumber(annual);
    const u = toNumber(users);
    const x = toNumber(extra);
    const t = toNumber(maxExtra);
    if (
      m === "invalid" ||
      a === "invalid" ||
      u === "invalid" ||
      x === "invalid" ||
      t === "invalid"
    ) {
      setError("Escriba solo números, sin letras ni símbolos.");
      return;
    }
    if (u === null || u < 1) {
      setError("Los usuarios incluidos son al menos uno.");
      return;
    }
    setError(undefined);
    save.mutate({
      path: { code: plan.code },
      body: {
        monthly_price_cop: m,
        annual_price_cop: a,
        included_users: u,
        extra_user_price_cop: x,
        clear_extra_user_price:
          x === null && plan.extra_user_price_cop !== null,
        max_extra_users: t,
        clear_max_extra_users: t === null && plan.max_extra_users !== null,
        is_public: isPublic,
      },
    });
  }

  const problem = save.isError ? apiProblem(save.error) : null;

  return (
    <Dialog
      open={plan !== null}
      onClose={() => !save.isPending && onClose()}
      busy={save.isPending}
      title={`Editar el plan ${plan?.name ?? ""}`}
      actions={
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={save.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="editar-plan"
            size="sm"
            busy={save.isPending}
          >
            {save.isPending ? "Guardando el plan" : "Guardar el plan"}
          </Button>
        </>
      }
    >
      <p>
        Los precios se escriben en pesos colombianos, sin puntos. Lo que guarde
        rige para los pagos nuevos; lo ya cobrado no cambia.
      </p>
      <form id="editar-plan" noValidate onSubmit={submit}>
        <Field
          label="Precio mensual"
          name="precio-mensual"
          inputMode="numeric"
          value={monthly}
          onChange={(event) => setMonthly(event.target.value)}
        />
        <Field
          label="Precio anual"
          name="precio-anual"
          inputMode="numeric"
          help="El anual no puede costar más que doce meses."
          value={annual}
          onChange={(event) => setAnnual(event.target.value)}
        />
        <Field
          label="Usuarios incluidos"
          name="usuarios-incluidos"
          inputMode="numeric"
          required
          value={users}
          onChange={(event) => setUsers(event.target.value)}
        />
        <Field
          label="Precio de cada usuario adicional"
          name="precio-adicional"
          inputMode="numeric"
          help="Vacío si el plan no admite usuarios adicionales."
          value={extra}
          onChange={(event) => setExtra(event.target.value)}
        />
        <Field
          label="Máximo de usuarios adicionales"
          name="tope-adicionales"
          inputMode="numeric"
          help="Vacío para no poner tope. Solo aplica si el plan admite adicionales."
          value={maxExtra}
          onChange={(event) => setMaxExtra(event.target.value)}
        />
        <Checkbox
          checked={isPublic}
          onChange={(event) => setIsPublic(event.target.checked)}
        >
          Aparece en la página de precios
        </Checkbox>
      </form>
      {(error || problem) && (
        <Notice tone="error">
          {error ? (
            <p role="alert">{error}</p>
          ) : problem && problem.status === 422 ? (
            <p role="alert">{problem.detail ?? "El cambio no es válido."}</p>
          ) : (
            <SystemError requestId={problem?.requestId} />
          )}
        </Notice>
      )}
    </Dialog>
  );
}
