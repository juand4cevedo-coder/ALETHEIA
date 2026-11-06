import { Link } from "react-router";

import { CONSUMER_AUTHORITY } from "../../config/legal.ts";
import { legalRoute } from "../../config/routes.ts";
import { CONTACT_EMAIL } from "../../config/site.ts";
import type { LegalDocument } from "./types.ts";

const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

// Política de reembolsos y cancelación. El retracto de la Ley 1480 de 2011 (art. 47) no cubre
// los servicios que empezaron a prestarse con el acuerdo del consumidor, y una suscripción se
// activa al pagar; aun así ALETHEIA ofrece la devolución completa en los mismos cinco días
// hábiles y la paga en el plazo de quince días calendario que fijó la Ley 2439 de 2024. La
// reversión del pago sigue el art. 51 y la cancelación, RN-016.
export const refundPolicy: LegalDocument = {
  slug: "reembolsos",
  title: "Política de reembolsos y cancelación",
  description:
    "Cómo cancelar un plan de ALETHEIA, cuándo devolvemos el dinero, cómo funciona el retracto, la reversión del pago y en qué plazos se hace la devolución.",
  keyPoints: [
    {
      title: "Cancela cuando quiera",
      text: "No se le vuelve a cobrar y conserva el plan hasta el final del periodo pagado.",
    },
    {
      title: "Cinco días hábiles para arrepentirse",
      text: "Si pide la devolución dentro de ese plazo después de un pago, le devolvemos todo.",
    },
    {
      title: "Devolución en quince días",
      text: "El dinero vuelve a su medio de pago en un máximo de quince días calendario.",
    },
  ],
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
      title: "Retracto: cinco días hábiles para arrepentirse",
      basis: ["Ley 1480 de 2011, art. 47"],
      body: (
        <>
          <p>
            La ley excluye del derecho de retracto los servicios que empiezan a
            prestarse con el acuerdo del consumidor, y su plan se activa apenas
            usted paga. Aun así, en ALETHEIA puede arrepentirse dentro de los
            cinco días hábiles siguientes a la contratación de un plan o a cada
            cobro de renovación, sin dar explicaciones. Basta con escribirnos a{" "}
            {mail} desde el correo de la cuenta.
          </p>
          <p>
            Le devolvemos el valor completo de ese pago, sin descuentos ni
            retenciones. El plan termina y la cuenta pasa a solo lectura como en
            una cancelación.
          </p>
        </>
      ),
    },
    {
      id: "cobros-por-error",
      title: "Cobros duplicados o por error",
      body: (
        <p>
          Si se le cobró dos veces o un valor distinto del que aceptó, le
          devolvemos la diferencia completa, sin importar cuántos días hayan
          pasado desde el cobro.
        </p>
      ),
    },
    {
      id: "plazo-de-devolucion",
      title: "Cómo y cuándo recibe el dinero",
      basis: ["Ley 1480 de 2011, art. 47, inciso final"],
      body: (
        <p>
          La devolución se hace en un máximo de quince días calendario, contados
          desde que usted la pidió y nos dio los datos completos para hacerla.
          El dinero vuelve al mismo medio de pago que usó o, si lo prefiere, a
          otro que acordemos con usted. Su banco o la entidad emisora de la
          tarjeta también están obligados a respetar ese plazo.
        </p>
      ),
    },
    {
      id: "reversion-del-pago",
      title: "Reversión del pago",
      basis: ["Ley 1480 de 2011, art. 51"],
      body: (
        <>
          <p>
            Si pagó con tarjeta u otro medio electrónico y el cobro fue producto
            de un fraude, usted no lo solicitó o el servicio no se le prestó,
            puede pedir que se reverse el pago. Para eso, dentro de los cinco
            días hábiles siguientes a la fecha en que conoció la situación, debe
            presentarnos la queja a {mail} y avisar a la entidad que emitió su
            medio de pago, que en conjunto con los demás participantes del pago
            reversará la transacción.
          </p>
          <p>
            Si el pago se hizo con débito automático que usted autorizó antes,
            también puede pedir a su banco que lo reverse por cualquier motivo.
          </p>
        </>
      ),
    },
    {
      id: "sin-reembolso",
      title: "Cuándo no hay reembolso",
      body: (
        <p>
          Fuera de los casos anteriores, el tiempo que no use de un periodo ya
          pagado no se devuelve de forma proporcional. A cambio, el plan sigue
          activo hasta el final de ese periodo y sus evidencias nunca quedan
          retenidas: siempre podrá descargarlas y exportarlas.
        </p>
      ),
    },
    {
      id: "como-solicitarlo",
      title: "Cómo pedir una devolución",
      basis: ["Ley 1480 de 2011, art. 50, literal g"],
      body: (
        <>
          <p>
            Escriba a {mail} desde el correo de la cuenta, con el asunto
            Reembolso, e indique la fecha y el valor del pago. Le confirmamos el
            recibo con un número de radicado, la fecha y la hora, y con ese
            número puede preguntar por el estado de su solicitud.
          </p>
          <p>
            Si no está conforme con la respuesta, puede acudir a la{" "}
            <a href={CONSUMER_AUTHORITY.url} rel="noopener noreferrer">
              {CONSUMER_AUTHORITY.name}
            </a>
            . Las demás condiciones del servicio están en los{" "}
            <Link to={legalRoute("terminos")}>términos y condiciones</Link>.
          </p>
        </>
      ),
    },
  ],
};
