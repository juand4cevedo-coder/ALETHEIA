import { Link } from "react-router";

import { DATA_CONTROLLER } from "../../config/legal.ts";
import { legalRoute, ROUTES } from "../../config/routes.ts";
import { CONTACT_EMAIL } from "../../config/site.ts";
import type { LegalDocument } from "./types.ts";

const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

// Términos y condiciones del servicio (Ley 1480 de 2011, artículo 50). Recogen la regla de oro
// (RN-001), los planes y cuotas (RN-014, RN-015, RN-019), la cancelación (RN-016) y el cierre de casos
// (RN-020).
export const termsOfService: LegalDocument = {
  slug: "terminos",
  title: "Términos y condiciones",
  description:
    "Condiciones de uso de ALETHEIA: qué hace y qué no hace el servicio, planes, pagos, límites, cancelación y responsabilidades.",
  summary:
    "ALETHEIA guarda sus archivos sin alterarlos y documenta su integridad. No dice si una prueba es auténtica ni si un juez la admitirá: eso le corresponde a la autoridad judicial. Usted es dueño de lo que carga y responde por tener derecho a cargarlo.",
  sections: [
    {
      id: "aceptacion",
      title: "Quiénes somos y cuándo se aplican",
      body: (
        <>
          <p>
            ALETHEIA es un servicio en línea operado por {DATA_CONTROLLER.name},
            persona natural con domicilio en {DATA_CONTROLLER.city}. Estos
            términos regulan la relación entre él y quien crea una cuenta o
            contrata un plan.
          </p>
          <p>
            Al crear una cuenta, usted acepta estos términos y la{" "}
            <Link to={legalRoute("privacidad")}>
              política de tratamiento de datos
            </Link>
            . Si la crea a nombre de una firma u organización, declara que tiene
            facultad para obligarla.
          </p>
        </>
      ),
    },
    {
      id: "servicio",
      title: "Qué es ALETHEIA",
      body: (
        <>
          <p>
            Es una herramienta web para que abogados y firmas preserven
            evidencia digital y documenten su integridad. Con cada archivo que
            usted carga, ALETHEIA:
          </p>
          <ul>
            <li>guarda el original sin modificarlo;</li>
            <li>calcula su huella SHA-256;</li>
            <li>
              obtiene un sello de tiempo de una autoridad externa, conforme al
              estándar RFC 3161;
            </li>
            <li>
              registra cada acción en un historial encadenado que no se puede
              editar;
            </li>
            <li>
              y le permite exportar un paquete con los originales, sus sellos y
              un informe, que cualquier persona puede comprobar en el
              verificador público.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "limites",
      title: "Lo que ALETHEIA no hace",
      body: (
        <>
          <p>
            ALETHEIA preserva y documenta. No determina la autenticidad, la
            veracidad, la admisibilidad ni el valor probatorio de ninguna
            evidencia. Esa valoración le corresponde a la autoridad judicial.
            Además:
          </p>
          <ul>
            <li>
              No certifica pruebas. No es una entidad de certificación digital
              acreditada en Colombia, y los sellos de tiempo que obtiene no
              provienen de una de ellas.
            </li>
            <li>
              Demuestra que un archivo no ha cambiado desde que se cargó, pero
              no lo que ocurrió antes. La procedencia la declara usted y así
              queda registrada.
            </li>
            <li>
              No accede a cuentas, dispositivos ni sistemas de terceros. Solo
              guarda lo que usted carga.
            </li>
            <li>No presta asesoría jurídica.</li>
          </ul>
        </>
      ),
    },
    {
      id: "cuenta",
      title: "Su cuenta",
      body: (
        <>
          <p>
            Para usar el servicio necesita ser mayor de edad, dar datos veraces
            y mantenerlos al día. Usted cuida su contraseña y responde por lo
            que se haga con su cuenta. Si sospecha un uso indebido, avísenos de
            inmediato a {mail}.
          </p>
          <p>
            Cada organización tiene un propietario, que contrata el plan, invita
            a los miembros y les asigna un rol. Cada rol solo puede hacer lo que
            le corresponde, y ese límite lo aplica el servidor.
          </p>
        </>
      ),
    },
    {
      id: "uso-permitido",
      title: "Uso permitido",
      body: (
        <>
          <p>Al usar ALETHEIA, usted se compromete a:</p>
          <ul>
            <li>
              Cargar solo información sobre la que tenga autorización de sus
              titulares o una base legal, como la defensa de un derecho en un
              proceso judicial.
            </li>
            <li>
              No cargar contenido obtenido mediante acceso abusivo a sistemas
              informáticos o cualquier otra conducta prohibida por la Ley 1273
              de 2009.
            </li>
            <li>
              No intentar vulnerar la seguridad del servicio, acceder a datos de
              otras organizaciones ni sobrecargar el sistema.
            </li>
            <li>No usar el servicio para fines ilícitos.</li>
          </ul>
        </>
      ),
    },
    {
      id: "su-contenido",
      title: "Su contenido",
      body: (
        <p>
          Usted conserva la propiedad de todo lo que carga. Nos autoriza a
          guardarlo, procesarlo y mostrárselo solo en la medida necesaria para
          prestarle el servicio. Sobre ese contenido ALETHEIA actúa como
          encargado del tratamiento, en los términos de la{" "}
          <Link to={legalRoute("privacidad")}>
            política de tratamiento de datos
          </Link>
          .
        </p>
      ),
    },
    {
      id: "planes-y-pagos",
      title: "Planes, prueba gratuita y pagos",
      body: (
        <>
          <p>
            Los planes, sus precios y sus límites están publicados en la{" "}
            <Link to={ROUTES.pricing}>página de precios</Link>. Todos ofrecen
            las mismas funciones de preservación; cambian la capacidad y el
            número de usuarios.
          </p>
          <ul>
            <li>
              La prueba gratuita dura los días indicados en esa página y no pide
              tarjeta.
            </li>
            <li>
              Los precios están en pesos colombianos y se pagan por mes o por
              año. El pago anual equivale a diez meses.
            </li>
            <li>
              Los pagos se procesan a través de la pasarela de pagos. ALETHEIA
              nunca recibe ni guarda los datos de su tarjeta.
            </li>
            <li>
              La suscripción se renueva al final de cada periodo hasta que usted
              la cancele.
            </li>
            <li>
              Si cambiamos un precio, se lo avisamos por correo con al menos 30
              días de anticipación, y el nuevo valor solo se aplica desde la
              renovación siguiente.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "limites-del-plan",
      title: "Límites de cada plan",
      body: (
        <ul>
          <li>
            Al llegar al límite de almacenamiento, se bloquean las subidas
            nuevas. Ver, descargar y exportar lo que ya tiene sigue funcionando.
          </li>
          <li>
            Si pasa a un plan con menos capacidad de la que está usando, la
            cuenta queda en solo lectura hasta que libere espacio.
          </li>
          <li>
            Si un cobro no se puede hacer, se lo avisamos por correo. Nunca
            retenemos su evidencia por falta de pago: siempre podrá verla,
            descargarla y exportarla.
          </li>
        </ul>
      ),
    },
    {
      id: "cancelacion",
      title: "Cancelación y eliminación",
      body: (
        <>
          <p>
            El propietario puede cancelar la suscripción cuando quiera, desde su
            panel o escribiendo a {mail}. Después de cancelar no se hacen más
            cobros y el plan sigue activo hasta el final del periodo pagado. A
            partir de ahí, la cuenta queda 30 días en solo lectura para que
            pueda exportar sus casos. Pasado ese plazo, los casos se eliminan
            destruyendo sus llaves de cifrado y le enviamos una constancia de
            eliminación por correo.
          </p>
          <p>
            El propietario o un administrador también pueden cerrar y eliminar
            un caso en cualquier momento, con su respectiva constancia. Las
            condiciones de los reembolsos están en la{" "}
            <Link to={legalRoute("reembolsos")}>
              política de reembolsos y cancelación
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: "disponibilidad",
      title: "Disponibilidad del servicio",
      body: (
        <>
          <p>
            Hacemos lo razonable para que ALETHEIA esté disponible y funcione
            bien, pero no podemos garantizar que nunca se interrumpa. Puede
            haber mantenimientos o fallas de proveedores externos. Cuando el
            sello de tiempo no se pueda obtener en el momento, la evidencia
            queda guardada con su huella y el sello se solicita de nuevo
            automáticamente.
          </p>
          <p>
            Le recomendamos exportar y conservar los paquetes de los casos que
            vaya a presentar.
          </p>
        </>
      ),
    },
    {
      id: "responsabilidad",
      title: "Responsabilidad",
      body: (
        <>
          <p>
            ALETHEIA responde por prestar el servicio con la diligencia descrita
            en estos términos. No responde por las decisiones de las autoridades
            sobre las evidencias, por el uso que usted haga de los paquetes
            exportados, por el contenido cargado sin derecho ni por fallas de
            terceros que estén fuera de su control.
          </p>
          <p>
            Nada de lo anterior limita los derechos que la ley le reconoce como
            consumidor y que no se pueden renunciar.
          </p>
        </>
      ),
    },
    {
      id: "suspension",
      title: "Suspensión de una cuenta",
      body: (
        <p>
          Podemos suspender una cuenta si se incumplen estos términos, si hay un
          riesgo para la seguridad del servicio o de otros usuarios, o si lo
          ordena una autoridad competente. Cuando sea posible, le avisaremos
          antes y le daremos la oportunidad de exportar sus casos, salvo que la
          ley o la orden lo impidan.
        </p>
      ),
    },
    {
      id: "propiedad-intelectual",
      title: "Propiedad intelectual",
      body: (
        <p>
          El software, la marca, el logotipo y el diseño de ALETHEIA pertenecen
          a su operador. El uso del servicio no le transfiere ningún derecho
          sobre ellos.
        </p>
      ),
    },
    {
      id: "cambios",
      title: "Cambios en estos términos",
      body: (
        <p>
          Si cambiamos algo importante, se lo avisaremos por correo con al menos
          30 días de anticipación y publicaremos la nueva versión en esta
          página. Si no está de acuerdo, puede cancelar antes de que el cambio
          entre en vigor, sin ningún costo.
        </p>
      ),
    },
    {
      id: "ley-aplicable",
      title: "Ley aplicable y reclamos",
      body: (
        <p>
          Estos términos se rigen por las leyes de Colombia. Si tiene una
          petición, queja o reclamo, escríbanos a {mail}. Le confirmamos el
          recibo con un número de radicado, la fecha y la hora, y le respondemos
          dentro de los quince días hábiles siguientes. Usted conserva siempre
          el derecho de acudir a la Superintendencia de Industria y Comercio o a
          los jueces de la República.
        </p>
      ),
    },
  ],
};
