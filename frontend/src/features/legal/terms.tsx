import { Link } from "react-router";

import { CONSUMER_AUTHORITY, DATA_CONTROLLER } from "../../config/legal.ts";
import { legalRoute, ROUTES } from "../../config/routes.ts";
import { CONTACT_EMAIL } from "../../config/site.ts";
import type { LegalDocument } from "./types.ts";

const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

// Términos y condiciones del servicio. Cumplen la información que la Ley 1480 de 2011 (art. 50,
// con los cambios de la Ley 2439 de 2024) exige a quien vende por medios electrónicos, y recogen
// la regla de oro (RN-001), los planes y cuotas (RN-014, RN-015, RN-019), la cancelación
// (RN-016) y el cierre de casos (RN-020). La situación tributaria es la del RUT del operador.
export const termsOfService: LegalDocument = {
  slug: "terminos",
  title: "Términos y condiciones",
  description:
    "Condiciones de uso de ALETHEIA: qué hace y qué no hace el servicio, cómo se contrata, precios e impuestos, límites, cancelación y responsabilidades.",
  keyPoints: [
    {
      title: "Preserva, no certifica",
      text: "ALETHEIA documenta la integridad de sus archivos. Si una prueba es auténtica o admisible lo decide la autoridad judicial.",
    },
    {
      title: "Sin permanencia",
      text: "Los planes se renuevan cada mes o cada año y puede cancelarlos cuando quiera, sin multas.",
    },
    {
      title: "Su evidencia nunca queda retenida",
      text: "Aunque un pago falle o cancele, siempre puede ver, descargar y exportar lo que guardó.",
    },
  ],
  sections: [
    {
      id: "aceptacion",
      title: "Quiénes somos y cuándo se aplican",
      basis: ["Ley 1480 de 2011, art. 50, literal a"],
      body: (
        <>
          <p>
            ALETHEIA es un servicio en línea operado por {DATA_CONTROLLER.name},
            persona natural identificada con NIT {DATA_CONTROLLER.nit}, con
            domicilio en {DATA_CONTROLLER.city}. Recibe notificaciones
            judiciales en {DATA_CONTROLLER.address}, en el correo {mail} y en el
            teléfono{" "}
            <a href={DATA_CONTROLLER.phoneHref}>{DATA_CONTROLLER.phone}</a>.
          </p>
          <p>
            Estos términos regulan la relación entre él y quien crea una cuenta
            o contrata un plan. Al crear la cuenta, usted los acepta junto con
            la{" "}
            <Link to={legalRoute("privacidad")}>
              política de tratamiento de datos
            </Link>
            . Si la abre para una oficina o firma, declara que puede obligarla.
          </p>
        </>
      ),
    },
    {
      id: "servicio",
      title: "Qué es ALETHEIA",
      basis: ["Ley 1480 de 2011, art. 50, literal b"],
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
              pide un sello de tiempo a una autoridad externa, conforme al
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
            evidencia: esa valoración le corresponde a la autoridad judicial.
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
      basis: ["Ley 1273 de 2009"],
      body: (
        <>
          <p>Al usar ALETHEIA, usted se compromete a:</p>
          <ul>
            <li>
              Cargar solo información que tenga derecho a tratar, por
              autorización de sus titulares o porque la ley lo permite, como
              cuando es necesaria para defender un derecho en un proceso
              judicial.
            </li>
            <li>
              No cargar contenido obtenido mediante acceso abusivo a sistemas
              informáticos, interceptación de datos u otra conducta que la ley
              penal castigue.
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
      id: "contratacion",
      title: "Cómo se contrata un plan",
      basis: [
        "Ley 1480 de 2011, art. 50, literales c y d",
        "Ley 527 de 1999, art. 14",
      ],
      body: (
        <>
          <p>
            Los planes, sus precios y sus límites están publicados en la{" "}
            <Link to={ROUTES.pricing}>página de precios</Link>. Todos tienen las
            mismas funciones de preservación; cambian la capacidad y el número
            de usuarios.
          </p>
          <ol>
            <li>
              El propietario elige el plan y la periodicidad, mensual o anual.
            </li>
            <li>
              Antes de pagar ve un resumen con el plan, el periodo, el valor
              total y la fecha de la próxima renovación, y puede corregirlo o
              desistir.
            </li>
            <li>
              Paga en la pasarela de pagos, que recibe directamente los datos de
              su tarjeta u otro medio electrónico. ALETHEIA nunca los ve.
            </li>
            <li>
              A más tardar al día siguiente le enviamos por correo el
              comprobante, con el valor exacto y la forma de pago. El plan se
              activa en cuanto la pasarela confirma el pago.
            </li>
          </ol>
          <p>
            Su aceptación expresa en ese proceso perfecciona el contrato, y
            guardamos la prueba de la contratación y del pago por el tiempo que
            exige la ley.
          </p>
        </>
      ),
    },
    {
      id: "precios-e-impuestos",
      title: "Precios, impuestos y comprobantes",
      basis: [
        "Estatuto Tributario, art. 437, parágrafo 3",
        "Decreto 1625 de 2016, art. 1.6.1.4.3",
      ],
      body: (
        <>
          <ul>
            <li>
              Los precios están en pesos colombianos y son el valor final que
              usted paga: no se suma ningún impuesto ni cargo adicional.
            </li>
            <li>
              El operador está inscrito en el RUT como persona natural no
              responsable de IVA, así que no cobra IVA. Por la misma razón no
              está obligado a expedir factura electrónica de venta; con cada
              pago recibe el comprobante por correo.
            </li>
            <li>
              Si su firma es responsable de IVA y necesita soportar la compra,
              pida a {mail} la copia del RUT del operador y se la enviamos.
            </li>
            <li>
              El pago anual equivale a diez meses. La prueba gratuita dura los
              días indicados en la página de precios y no pide tarjeta.
            </li>
            <li>
              Si cambiamos un precio, se lo avisamos por correo con al menos 30
              días de anticipación, y el valor nuevo solo se aplica desde la
              renovación siguiente.
            </li>
          </ul>
          <p>
            Si la situación tributaria del operador cambia, actualizaremos esta
            sección y la página de precios antes de cobrar cualquier impuesto.
          </p>
        </>
      ),
    },
    {
      id: "duracion",
      title: "Duración y renovación",
      basis: ["Ley 1480 de 2011, art. 50, literal b"],
      body: (
        <p>
          No hay permanencia mínima: el contrato dura el periodo pagado, un mes
          o un año, y se renueva automáticamente por un periodo igual hasta que
          usted lo cancele. La fecha de la próxima renovación y su valor están
          siempre a la vista en el resumen de su suscripción.
        </p>
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
            un caso en cualquier momento, con su constancia. Cuándo procede una
            devolución de dinero lo explica la{" "}
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
            bien, pero no podemos garantizar que nunca se interrumpa: puede
            haber mantenimientos o fallas de proveedores externos. Si el sello
            de tiempo no se puede obtener en el momento, la evidencia queda
            guardada con su huella y el sello se vuelve a pedir solo.
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
      basis: ["Ley 1480 de 2011, art. 50, literal f"],
      body: (
        <>
          <p>
            ALETHEIA responde por prestar el servicio con la diligencia descrita
            en estos términos y por la seguridad de los pagos hechos por los
            medios que dispone. No responde por las decisiones de las
            autoridades sobre las evidencias, por el uso que usted haga de los
            paquetes exportados, por el contenido cargado sin derecho ni por
            fallas de terceros que estén fuera de su control.
          </p>
          <p>
            Nada de esto limita los derechos que la ley le reconoce como
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
          a su operador. Usar el servicio no le transfiere ningún derecho sobre
          ellos.
        </p>
      ),
    },
    {
      id: "cambios",
      title: "Cambios en estos términos",
      body: (
        <p>
          Si cambiamos algo que afecte sus derechos u obligaciones, se lo
          avisamos por correo con al menos 30 días de anticipación, publicamos
          el texto nuevo en esta página con su fecha y le pedimos aceptarlo al
          ingresar. Si no está de acuerdo, puede cancelar antes de que el cambio
          rija, sin ningún costo.
        </p>
      ),
    },
    {
      id: "peticiones-y-reclamos",
      title: "Peticiones, quejas y reclamos",
      basis: ["Ley 1480 de 2011, art. 50, literal g y parágrafo"],
      body: (
        <>
          <p>
            Escríbanos a {mail}. Le confirmamos el recibo con un número de
            radicado, la fecha y la hora, y con ese número puede preguntar por
            el estado de su solicitud cuando quiera. Le respondemos dentro de
            los quince días hábiles siguientes.
          </p>
          <p>
            Estos términos se rigen por las leyes de Colombia. Usted conserva
            siempre el derecho de acudir a la{" "}
            <a href={CONSUMER_AUTHORITY.url} rel="noopener noreferrer">
              {CONSUMER_AUTHORITY.name}
            </a>
            , autoridad de protección al consumidor, o a los jueces de la
            República.
          </p>
        </>
      ),
    },
  ],
};
