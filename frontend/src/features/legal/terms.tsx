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
            <li>
              No vigila los términos de ningún proceso. Los plazos, tareas,
              recordatorios y avisos de ALETHEIA son una ayuda de organización y
              pueden fallar o llegar tarde: no sustituyen la revisión de los
              términos procesales, y cumplirlos es responsabilidad de quien
              lleva el caso.
            </li>
            <li>
              No decide por usted qué compartir con sus clientes ni con su
              equipo. Lo que carga, a quién se lo comparte y con qué permisos lo
              decide el despacho.
            </li>
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
            Cada organización tiene una persona responsable del despacho, que
            contrata el plan, invita a los miembros y les asigna un rol. Cada
            rol solo puede hacer lo que le corresponde, y ese límite lo aplica
            el servidor.
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
              La persona responsable del despacho elige el plan y la
              periodicidad, mensual o anual.
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
              está obligado a expedir factura electrónica de venta. En su lugar,
              con cada pago recibe un comprobante de pago numerado de ALETHEIA,
              por correo y para descargar en PDF desde Plan y facturación.
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
              En los planes que admiten usuarios adicionales, el valor de cada
              periodo es el precio del plan más cada persona por encima de las
              incluidas, al precio publicado. Cuentan los miembros del despacho
              y las invitaciones abiertas al momento de pagar. En el pago anual,
              cada usuario adicional también vale diez meses. Las personas que
              se agreguen durante el periodo se cobran desde la renovación
              siguiente, y el resumen antes de pagar muestra el desglose.
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
        <>
          <p>
            No hay permanencia mínima: el contrato dura el periodo pagado, un
            mes o un año. Por omisión el plan no se renueva solo: siete días
            antes de que venza le avisamos por correo y usted decide si paga el
            periodo siguiente. Si no lo paga, al terminar el periodo la cuenta
            pasa a solo lectura y sus evidencias siguen disponibles.
          </p>
          <p>
            El plan solo se renueva automáticamente si la persona responsable
            del despacho activa la renovación automática, que es opcional y se
            explica en la sección siguiente. La fecha de vencimiento y el valor
            del plan están siempre a la vista en Plan y facturación.
          </p>
        </>
      ),
    },
    {
      id: "renovacion-automatica",
      title: "Renovación automática (opcional)",
      basis: ["Ley 1480 de 2011, art. 50, literal b"],
      body: (
        <>
          <ul>
            <li>
              <strong>Quién la activa y cómo.</strong> Solo la persona
              responsable del despacho, desde Plan y facturación. Escribe su
              celular Nequi, marca la autorización, acepta los contratos de la
              pasarela de pagos y aprueba la vinculación en la aplicación de
              Nequi. Sin esos pasos no se cobra nada.
            </li>
            <li>
              <strong>Qué autoriza.</strong> «Autorizo a ALETHEIA a cobrar, al
              vencer cada periodo, el valor del plan de mi despacho a mi Nequi,
              hasta que yo lo cancele. Me avisará por correo siete días antes de
              cada cobro, y puedo cancelar cuando quiera desde Plan y
              facturación.» Guardamos la versión de ese texto, la fecha y la
              dirección IP desde la que se aceptó.
            </li>
            <li>
              <strong>Cuándo y cuánto cobra.</strong> Un día antes de que venza
              el periodo, por el valor y la periodicidad del plan vigentes, con
              los usuarios adicionales que tenga el despacho ese día. Si
              cambiamos un precio, se lo avisamos con al menos 30 días de
              anticipación y el valor nuevo solo se aplica desde la renovación
              siguiente.
            </li>
            <li>
              <strong>Aviso previo.</strong> Siete días antes le escribimos con
              el valor, la fecha aproximada del cobro, los últimos cuatro
              dígitos de su Nequi y el enlace para cancelar.
            </li>
            <li>
              <strong>Cómo cancelarla.</strong> Cuando quiera, desde Plan y
              facturación o escribiendo a {mail}. La cancelación es inmediata:
              no se cobra nada después, y el periodo ya pagado sigue activo.
              Cerrar la cuenta del despacho también la cancela.
            </li>
            <li>
              <strong>Si el cobro no entra.</strong> Lo reintentamos a los tres
              y a los seis días del primer intento. Si tampoco entra, se lo
              avisamos por correo y el plan sigue su curso: al vencer, la cuenta
              queda en solo lectura. Nunca retenemos su evidencia.
            </li>
            <li>
              <strong>Lo que le corresponde a usted.</strong> Mantener saldo y
              la cuenta de Nequi activa. ALETHEIA no responde porque Nequi, su
              banco o la pasarela rechacen un cobro por saldo insuficiente,
              límites, bloqueos o fallas de sus sistemas.
            </li>
            <li>
              <strong>Sus datos de pago.</strong> ALETHEIA nunca ve ni guarda su
              número completo: solo el identificador de la fuente de pago en la
              pasarela y los últimos cuatro dígitos del celular.
            </li>
            <li>
              <strong>Cobros que usted no autorizó.</strong> Si se le cobra
              después de cancelar, o un valor distinto del que aceptó, se lo
              devolvemos completo. La política de reembolsos explica cómo
              pedirlo.
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
      title: "Cancelación, archivo y conservación",
      body: (
        <>
          <p>
            La persona responsable del despacho puede cancelar la suscripción
            cuando quiera, desde su panel o escribiendo a {mail}. Después de
            cancelar no se hacen más cobros y el plan sigue activo hasta el
            final del periodo pagado. A partir de ahí, la cuenta queda en solo
            lectura para consultar y exportar la información conservada.
          </p>
          <p>
            Cerrar un caso lo mueve al archivo histórico: no borra archivos,
            llaves, eventos ni registros de custodia. ALETHEIA lo conserva diez
            años desde el cierre, el mismo plazo para todos los despachos; si
            una ley o una orden de autoridad exige otro para un caso, el
            despacho nos escribe con el soporte y lo aplicamos. Las solicitudes
            de supresión se evalúan antes de ejecutarse y no proceden mientras
            exista un deber legal o contractual de conservar. Eliminar un caso
            cerrado es una decisión distinta y definitiva: la persona autorizada
            lo pide, ALETHEIA le explica lo que se perderá, exige una
            confirmación expresa y, al ejecutarla, borra sus archivos, sus
            llaves y su contenido. Una vez eliminado no se puede recuperar, ni
            siquiera por soporte, y la obligación de conservar lo que la ley o
            un cliente exijan es del despacho. Queda constancia de quién lo
            eliminó y cuándo.
          </p>
          <p>
            Cuándo procede una devolución de dinero lo explica la{" "}
            <Link to={legalRoute("reembolsos")}>
              política de reembolsos y cancelación
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: "garantia",
      title: "Garantía del servicio",
      basis: ["Ley 1480 de 2011, arts. 7 y 11"],
      body: (
        <>
          <p>
            ALETHEIA le garantiza que el servicio hace lo que describen estos
            términos y la página de precios. Si una función contratada no sirve
            como se describe por una causa que nos corresponde, puede pedirnos
            que la corrijamos o, si no es posible, que le devolvamos lo pagado
            por el tiempo en que no funcionó.
          </p>
          <p>
            Para reclamar la garantía escríbanos desde Pedir soporte, eligiendo
            «Petición, queja o reclamo», o a {mail}. Le respondemos dentro de
            los quince días hábiles siguientes. Esta garantía no se pierde por
            cancelar el plan ni se renuncia por ninguna otra cláusula.
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
      id: "portal-del-cliente",
      title: "Portal del cliente",
      basis: ["Ley 1581 de 2012"],
      body: (
        <>
          <p>
            El portal permite que un despacho comparta con su cliente avisos,
            mensajes y documentos de un caso. Es una herramienta de
            comunicación: el despacho es quien decide a qué cliente invita, qué
            publica y qué documentos recibe.
          </p>
          <ul>
            <li>
              El despacho responde por tener la autorización de su cliente para
              tratar y compartir sus datos por este medio, y por lo que publica.
              ALETHEIA no revisa esos contenidos.
            </li>
            <li>
              El cliente entra con un enlace personal y vigente por tiempo
              limitado, y antes de ver nada acepta un aviso sobre el tratamiento
              de sus datos. El despacho puede revocar el acceso o renovar el
              enlace cuando quiera.
            </li>
            <li>
              Lo que el cliente ve es solo lo que el despacho publicó: nunca el
              resto del expediente, la cadena de custodia ni a otras personas
              del despacho.
            </li>
            <li>
              Quien recibe un enlace es responsable de no compartirlo. Si
              sospecha que lo conoció un tercero, debe avisar al despacho para
              que lo revoque.
            </li>
          </ul>
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
      id: "comunicaciones",
      title: "Cómo nos comunicamos",
      basis: ["Ley 527 de 1999, arts. 14 y 20"],
      body: (
        <ul>
          <li>
            Le escribimos al correo de su cuenta. Los avisos del servicio, los
            de cobro y los cambios en estos textos llegan por ese medio y tienen
            la misma validez que una comunicación en papel.
          </li>
          <li>
            Nunca lo llamamos ni le escribimos por otros canales para cobrarle,
            y no le enviamos publicidad.
          </li>
          <li>
            Mantenga su correo al día: si cambia, actualícelo en Mi cuenta. Lo
            que enviemos al correo registrado se entiende recibido cuando entra
            a su bandeja.
          </li>
        </ul>
      ),
    },
    {
      id: "fuerza-mayor",
      title: "Fuerza mayor",
      body: (
        <p>
          Ninguna de las partes responde por un incumplimiento causado por un
          hecho imprevisible e irresistible fuera de su control, como un
          desastre natural, una orden de autoridad o una falla general de
          internet o de los proveedores de nube. Mientras dure, haremos lo
          razonable para mantener disponibles sus evidencias y le informaremos
          cómo avanza.
        </p>
      ),
    },
    {
      id: "cesion",
      title: "Cesión del contrato",
      body: (
        <p>
          Si el servicio pasa a otra persona o empresa, se lo avisaremos por
          correo con al menos 30 días de anticipación, junto con quién responde
          por sus datos desde entonces. Si no está de acuerdo, puede cancelar y
          exportar su información antes de que la cesión ocurra, sin costo.
          Usted no puede ceder su cuenta sin nuestro acuerdo.
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
            Desde su cuenta, entre a Pedir soporte y elija el tipo de solicitud.
            Recibe al instante un número de radicado con la fecha en que llegó y
            la fecha límite de respuesta, y puede seguirla en esa misma
            pantalla. Si no tiene cuenta o no puede ingresar, escríbanos a{" "}
            {mail} y le confirmamos el recibo con su radicado. Le respondemos
            dentro de los quince días hábiles siguientes.
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
