import { Link } from "react-router";

import { DATA_CONTROLLER } from "../../config/legal.ts";
import { legalRoute } from "../../config/routes.ts";
import { CONTACT_EMAIL, SITE_URL } from "../../config/site.ts";
import type { LegalDocument } from "./types.ts";

const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

// Política de tratamiento de datos personales (Ley 1581 de 2012 y Decreto 1074 de 2015,
// capítulo 25). ALETHEIA es responsable de los datos de cuenta y encargado del contenido de los
// casos, que pertenece al abogado o a la firma que lo carga.
export const privacyPolicy: LegalDocument = {
  slug: "privacidad",
  title: "Política de tratamiento de datos personales",
  description:
    "Qué datos personales recoge ALETHEIA, para qué los usa, cómo los protege y cómo puede consultarlos, corregirlos o pedir que se eliminen.",
  summary:
    "Usamos sus datos para prestarle el servicio y para nada más. No los vendemos ni hacemos publicidad con ellos. El contenido de sus casos se guarda cifrado y el servicio no le da a su administrador ninguna forma de abrirlo. Puede consultar, corregir o pedir que borremos sus datos escribiendo a nuestro correo.",
  sections: [
    {
      id: "responsable",
      title: "Quién es el responsable",
      body: (
        <>
          <p>
            ALETHEIA es un servicio en línea operado por {DATA_CONTROLLER.name},
            persona natural con domicilio en {DATA_CONTROLLER.city}, quien actúa
            como responsable del tratamiento de los datos personales descritos
            en esta política.
          </p>
          <ul>
            <li>Dirección: {DATA_CONTROLLER.address}.</li>
            <li>Correo electrónico: {mail}.</li>
            <li>
              Teléfono:{" "}
              <a href={DATA_CONTROLLER.phoneHref}>{DATA_CONTROLLER.phone}</a>.
            </li>
            <li>
              Sitio web: <a href={SITE_URL}>aletheia.sbs</a>.
            </li>
          </ul>
          <p>
            Esta política se expide en cumplimiento de la Ley 1581 de 2012 y del
            Decreto 1074 de 2015, que reglamentan el derecho de toda persona a
            conocer, actualizar y rectificar la información que se tenga sobre
            ella.
          </p>
        </>
      ),
    },
    {
      id: "alcance",
      title: "A quién se aplica",
      body: (
        <>
          <p>
            Se aplica a los datos de las personas que visitan aletheia.sbs, que
            crean una cuenta o son invitadas a una organización, que contratan
            un plan o que nos escriben.
          </p>
          <p>
            ALETHEIA cumple dos papeles distintos. Sobre los datos de su cuenta
            es responsable: decide para qué se usan y responde por ellos. Sobre
            los archivos y la información que usted carga en sus casos es
            encargado: los guarda y los procesa por cuenta suya, siguiendo sus
            instrucciones, como se explica en el apartado{" "}
            <a href="#contenido-de-los-casos">
              Datos que usted carga en sus casos
            </a>
            .
          </p>
        </>
      ),
    },
    {
      id: "datos",
      title: "Qué datos recogemos",
      body: (
        <>
          <ul>
            <li>
              <strong>Datos de cuenta.</strong> Nombre, correo electrónico y
              contraseña. La contraseña nunca se guarda: guardamos un resumen
              irreversible calculado con Argon2id. Si ingresa con Google,
              recibimos su nombre, su correo y el identificador de su cuenta de
              Google.
            </li>
            <li>
              <strong>Datos de su organización.</strong> Nombre de la firma u
              organización, sus miembros y el rol de cada uno.
            </li>
            <li>
              <strong>Datos de seguridad.</strong> Dirección IP, navegador y
              fecha de los ingresos y de las acciones importantes, para detectar
              accesos indebidos.
            </li>
            <li>
              <strong>Datos de suscripción.</strong> Plan, fechas y estado de
              los pagos. Los datos de su tarjeta los recibe directamente la
              pasarela de pagos; ALETHEIA nunca los ve ni los guarda.
            </li>
            <li>
              <strong>Autorizaciones.</strong> La versión de estos textos que
              usted aceptó y la fecha en que lo hizo, para poder demostrarlo.
            </li>
            <li>
              <strong>Mensajes.</strong> Lo que nos escribe por correo y los
              datos que incluya para que le respondamos.
            </li>
          </ul>
          <p>
            No recogemos su ubicación, su foto de perfil ni estadísticas de
            navegación, y el sitio no tiene herramientas de analítica ni de
            publicidad.
          </p>
        </>
      ),
    },
    {
      id: "finalidades",
      title: "Para qué los usamos",
      body: (
        <>
          <ul>
            <li>Crear y administrar su cuenta y la de su organización.</li>
            <li>
              Verificar su identidad al ingresar y proteger la cuenta contra
              accesos indebidos.
            </li>
            <li>
              Prestar el servicio: guardar sus evidencias, registrar su cadena
              de custodia, generar paquetes de exportación y constancias de
              eliminación.
            </li>
            <li>
              Enviarle los correos propios del servicio, como la verificación de
              su correo, invitaciones, recuperación de contraseña, avisos de
              cobro, constancias y cambios en estos textos.
            </li>
            <li>Cobrar los planes contratados y llevar sus registros.</li>
            <li>Responder sus consultas, solicitudes y reclamos.</li>
            <li>
              Cumplir obligaciones legales y atender requerimientos de
              autoridades competentes.
            </li>
          </ul>
          <p>
            No vendemos, alquilamos ni cedemos sus datos, y no los usamos para
            enviarle publicidad.
          </p>
        </>
      ),
    },
    {
      id: "contenido-de-los-casos",
      title: "Datos que usted carga en sus casos",
      body: (
        <>
          <p>
            Los archivos de sus casos pueden contener datos personales de sus
            clientes y de terceros, incluso datos sensibles como historias
            clínicas o datos de niños, niñas y adolescentes. Sobre esa
            información el responsable es el abogado o la organización que la
            carga, y ALETHEIA actúa como encargado. En consecuencia:
          </p>
          <ul>
            <li>
              Usted declara contar con la autorización de los titulares o con
              una excepción legal para tratar esos datos, por ejemplo, que sean
              necesarios para el reconocimiento, ejercicio o defensa de un
              derecho en un proceso judicial (Ley 1581 de 2012, artículo 6).
            </li>
            <li>
              ALETHEIA solo los guarda, calcula su huella, obtiene su sello de
              tiempo, los exporta y los elimina cuando usted lo ordena. No los
              analiza, no los usa para fines propios y no los comparte.
            </li>
            <li>
              Cada caso se cifra con su propia llave, y el servicio no ofrece a
              su administrador ninguna ruta ni permiso para abrir su contenido.
            </li>
            <li>
              Si un titular nos pide algo sobre datos que están en un caso,
              trasladamos su solicitud al abogado responsable dentro de los dos
              días hábiles siguientes y se lo informamos al titular.
            </li>
            <li>
              Si ocurre un incidente de seguridad que afecte esa información, se
              lo avisamos a la organización afectada sin demora injustificada y
              lo reportamos a la Superintendencia de Industria y Comercio como
              lo exige la ley.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "datos-sensibles",
      title: "Datos sensibles y de menores de edad",
      body: (
        <>
          <p>
            Para crear y usar su cuenta no le pedimos datos sensibles. Si en
            algún momento le preguntáramos por uno, usted no estaría obligado a
            responder.
          </p>
          <p>
            Cuando en un caso haya datos de niños, niñas o adolescentes, se
            aplican las mismas protecciones técnicas que al resto del contenido,
            y el abogado responsable debe asegurar el respeto de sus derechos
            prevalentes, como lo ordena el artículo 7 de la Ley 1581 de 2012.
          </p>
        </>
      ),
    },
    {
      id: "derechos",
      title: "Sus derechos",
      body: (
        <>
          <p>
            Como titular de sus datos, el artículo 8 de la Ley 1581 de 2012 le
            reconoce el derecho a:
          </p>
          <ul>
            <li>
              Conocer, actualizar y rectificar sus datos, también cuando sean
              parciales, inexactos o incompletos.
            </li>
            <li>Pedir prueba de la autorización que nos dio.</li>
            <li>Saber, si lo solicita, qué uso les hemos dado.</li>
            <li>
              Revocar la autorización y pedir que se supriman sus datos, siempre
              que no exista un deber legal o contractual de conservarlos.
            </li>
            <li>Acceder gratuitamente a sus datos.</li>
            <li>
              Presentar quejas ante la Superintendencia de Industria y Comercio,
              después de haber hecho su consulta o reclamo ante nosotros.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "como-ejercerlos",
      title: "Cómo ejercer sus derechos",
      body: (
        <>
          <p>
            Escriba a {mail} desde el correo de su cuenta o, si no tiene una,
            indicando cómo podemos verificar su identidad. Diga qué necesita y
            adjunte lo que sirva para atender la solicitud.{" "}
            {DATA_CONTROLLER.name} atiende personalmente las consultas y
            reclamos sobre datos personales, y cada solicitud recibe un número
            de radicado con la fecha y hora en que llegó.
          </p>
          <h3>Consultas</h3>
          <p>
            Si quiere saber qué datos suyos tenemos, le respondemos dentro de
            los diez días hábiles siguientes a la solicitud. Si no fuera
            posible, le explicamos el motivo antes de que venza ese plazo y le
            respondemos a más tardar cinco días hábiles después.
          </p>
          <h3>Reclamos</h3>
          <p>
            Si quiere corregir, actualizar o suprimir sus datos, o cree que
            incumplimos esta política, le respondemos dentro de los quince días
            hábiles siguientes. Si no fuera posible, le explicamos el motivo y
            le respondemos a más tardar ocho días hábiles después. Mientras el
            reclamo se resuelve, sus datos quedan marcados como reclamo en
            trámite.
          </p>
          <p>
            Si a la solicitud le falta información, se la pedimos dentro de los
            cinco días siguientes. Si pasan dos meses sin que la envíe,
            entenderemos que desistió del reclamo.
          </p>
        </>
      ),
    },
    {
      id: "proveedores",
      title: "Proveedores y transferencia internacional",
      body: (
        <>
          <p>
            Para prestar el servicio nos apoyamos en proveedores que tratan
            datos por cuenta nuestra y solo para la tarea que les encargamos:
          </p>
          <ul>
            <li>
              <strong>Amazon Web Services.</strong> Aloja los servidores, la
              base de datos, los archivos cifrados y las copias de respaldo en
              la región de Ohio, en Estados Unidos.
            </li>
            <li>
              <strong>Google.</strong> Solo si usted elige ingresar con su
              cuenta de Google.
            </li>
            <li>
              <strong>DigiCert y Sectigo.</strong> Emiten los sellos de tiempo.
              Reciben únicamente la huella del archivo, nunca el archivo ni
              datos personales.
            </li>
            <li>
              <strong>Pasarela de pagos.</strong> Procesa los pagos y recibe
              directamente los datos de su medio de pago.
            </li>
            <li>
              <strong>Proveedor de correo electrónico.</strong> Envía los
              correos del servicio y recibe solo el destinatario y el texto del
              mensaje, nunca el contenido de sus casos.
            </li>
          </ul>
          <p>
            Como los datos se alojan en Estados Unidos, al aceptar esta política
            usted autoriza de manera expresa que se transfieran y se guarden en
            ese país, con las mismas protecciones descritas aquí.
          </p>
        </>
      ),
    },
    {
      id: "seguridad",
      title: "Cómo protegemos los datos",
      body: (
        <>
          <p>
            Toda la comunicación con el sitio viaja cifrada. Las contraseñas se
            guardan como resúmenes irreversibles, cada caso tiene su propia
            llave de cifrado, cada persona solo accede a lo que su rol le
            permite y las acciones importantes quedan registradas. La base de
            datos se copia cada día y la copia se cifra antes de salir del
            servidor.
          </p>
          <p>
            Ninguna medida es infalible. Por eso no prometemos una seguridad
            absoluta, pero sí avisarle si un incidente afecta sus datos.
          </p>
        </>
      ),
    },
    {
      id: "conservacion",
      title: "Cuánto tiempo los conservamos",
      body: (
        <ul>
          <li>
            Los datos de cuenta, mientras la cuenta exista. Al cerrarla se
            eliminan, salvo lo que la ley contable o tributaria obligue a
            conservar.
          </li>
          <li>
            La dirección IP y el navegador de los registros de seguridad, 90
            días. Después se anonimizan.
          </li>
          <li>
            El contenido de los casos, hasta que usted los elimine o hasta 30
            días después de terminar su suscripción.
          </li>
          <li>
            Las copias de respaldo, siete días. Pasado ese plazo, lo eliminado
            ya no se puede recuperar en ninguna parte.
          </li>
          <li>
            Las constancias de eliminación se conservan de forma permanente. No
            contienen archivos, solo conteos, huellas y fechas.
          </li>
          <li>
            Los mensajes que nos envía, el tiempo necesario para atenderlos.
          </li>
        </ul>
      ),
    },
    {
      id: "cookies",
      title: "Cookies",
      body: (
        <p>
          El sitio solo usa las cookies indispensables para mantener su sesión
          de forma segura. Los detalles están en la{" "}
          <Link to={legalRoute("cookies")}>política de cookies</Link>.
        </p>
      ),
    },
    {
      id: "vigencia",
      title: "Vigencia y cambios",
      body: (
        <>
          <p>
            Esta política rige desde la fecha indicada al comienzo, y las bases
            de datos permanecen vigentes mientras ALETHEIA preste el servicio.
          </p>
          <p>
            Si hacemos un cambio importante, se lo avisaremos por correo antes
            de aplicarlo y publicaremos la nueva versión en esta página. Si el
            cambio afecta la finalidad del tratamiento, le pediremos de nuevo su
            autorización.
          </p>
        </>
      ),
    },
  ],
};
