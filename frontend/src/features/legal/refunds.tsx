import { Link } from "react-router";

import { legalRoute } from "../../config/routes.ts";
import { CONTACT_EMAIL } from "../../config/site.ts";
import type { LegalDocument } from "./types.ts";

const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

// Política de reembolsos y cancelación. Aplica el retracto y la reversión del pago de la
// Ley 1480 de 2011 (artículos 47 y 51), con los plazos de devolución que fijó la Ley 2439 de 2024
// para el comercio electrónico, y la cancelación de RN-016.
export const refundPolicy: LegalDocument = {
  slug: "reembolsos",
  title: "Política de reembolsos y cancelación",
  description:
    "Cómo cancelar un plan de ALETHEIA, cuándo procede un reembolso, el derecho de retracto, la reversión del pago y los plazos de devolución.",
  summary:
    "Puede cancelar cuando quiera y no se le volverá a cobrar. Si se arrepiente dentro de los cinco días hábiles siguientes a un pago, le devolvemos todo el dinero, y lo mismo hacemos si le cobramos por error.",
  sections: [
    {
      id: "prueba-gratuita",
      title: "Prueba gratuita",
      body: (
        <p>
          La prueba gratuita no pide tarjeta y no genera ningún cobro. Si al
          terminar no elige un plan, la cuenta queda 30 días en solo lectura
          para que pueda exportar lo que guardó, igual que en una cancelación.
        </p>
      ),
    },
    {
      id: "como-cancelar",
      title: "Cómo cancelar",
      body: (
        <>
          <p>
            El propietario de la organización puede cancelar la suscripción en
            cualquier momento desde su panel, o escribiendo a {mail} desde el
            correo de su cuenta. Al cancelar:
          </p>
          <ul>
            <li>no se hace ningún cobro más;</li>
            <li>el plan sigue activo hasta el final del periodo ya pagado;</li>
            <li>
              después, la cuenta queda 30 días en solo lectura para exportar sus
              casos;
            </li>
            <li>
              y al terminar ese plazo los casos se eliminan y le enviamos una
              constancia de eliminación por correo.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "retracto",
      title: "Derecho de retracto",
      body: (
        <>
          <p>
            Puede retractarse dentro de los cinco días hábiles siguientes a la
            contratación de un plan pagado o a cada cobro de renovación, sin dar
            explicaciones. Basta con escribirnos a {mail}.
          </p>
          <p>
            Le devolvemos el valor completo de ese pago, sin descuentos ni
            retenciones, dentro de los quince días calendario siguientes a su
            solicitud, por el mismo medio de pago o por el que usted prefiera.
            El plan termina y la cuenta pasa a solo lectura como en una
            cancelación.
          </p>
        </>
      ),
    },
    {
      id: "reversion-del-pago",
      title: "Reversión del pago",
      body: (
        <p>
          Si pagó con tarjeta u otro medio electrónico y el cobro fue producto
          de un fraude, no lo solicitó o el servicio no se le prestó, puede
          pedir la reversión del pago, como lo prevé el artículo 51 de la Ley
          1480 de 2011. Tiene cinco días hábiles desde que conoció la situación
          para presentar la queja ante nosotros y avisar a la entidad emisora de
          su medio de pago.
        </p>
      ),
    },
    {
      id: "cobros-por-error",
      title: "Cobros duplicados o por error",
      body: (
        <p>
          Si se le cobró dos veces o un valor distinto del que aceptó, le
          devolvemos la diferencia completa dentro de los quince días calendario
          siguientes a la verificación del error.
        </p>
      ),
    },
    {
      id: "sin-reembolso",
      title: "Cuándo no hay reembolso",
      body: (
        <p>
          Fuera de los casos anteriores, el tiempo que no use de un periodo ya
          pagado no se reembolsa de forma proporcional. A cambio, el plan sigue
          activo hasta el final de ese periodo y sus evidencias nunca quedan
          retenidas: siempre podrá descargarlas y exportarlas.
        </p>
      ),
    },
    {
      id: "como-solicitarlo",
      title: "Cómo pedir un reembolso",
      body: (
        <>
          <p>
            Escriba a {mail} desde el correo de la cuenta, con el asunto
            Reembolso, e indique la fecha y el valor del pago. Le confirmamos el
            recibo con un número de radicado, la fecha y la hora, y le
            respondemos dentro de los quince días hábiles siguientes.
          </p>
          <p>
            Si no está conforme con la respuesta, puede acudir a la
            Superintendencia de Industria y Comercio. Las demás condiciones del
            servicio están en los{" "}
            <Link to={legalRoute("terminos")}>términos y condiciones</Link>.
          </p>
        </>
      ),
    },
  ],
};
