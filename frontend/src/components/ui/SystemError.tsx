import { CONTACT_EMAIL } from "../../config/site.ts";
import { SYSTEM_ERROR_LEAD } from "../../content/messages.ts";

/** MSG-019: la operación falló por una causa del sistema. Da el correo de soporte y, si la API
 * lo entregó, el código de la solicitud para encontrarla en los registros. */
export function SystemError({ requestId }: { requestId?: string }) {
  return (
    <p>
      {SYSTEM_ERROR_LEAD}{" "}
      <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      {requestId ? (
        <>
          {" "}
          con el código <code>{requestId}</code>.
        </>
      ) : (
        "."
      )}
    </p>
  );
}
