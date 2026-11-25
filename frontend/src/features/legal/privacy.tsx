import { Link } from "react-router";

import { CONSUMER_AUTHORITY, DATA_CONTROLLER } from "../../config/legal.ts";
import { legalRoute } from "../../config/routes.ts";
import { CONTACT_EMAIL, SITE_URL } from "../../config/site.ts";
import type { LegalDocument } from "./types.ts";

const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

// Política de tratamiento de datos personales. Sigue el contenido mínimo del Decreto 1377 de
// 2013 (art. 13) y los derechos y plazos de la Ley 1581 de 2012 (arts. 8, 14 y 15). ALETHEIA es
// responsable de los datos de cuenta y encargado del contenido de los casos, que pertenece al
// abogado o a la firma que lo carga (Ley 1581, art. 3, literales d y e).
export const privacyPolicy: LegalDocument = {
  slug: "privacidad",
  title: "Política de tratamiento de datos personales",
  description:
    "Qué datos personales recoge ALETHEIA, para qué los usa, con quién los comparte y cómo puede consultarlos, corregirlos o pedir que se supriman.",
  keyPoints: [
    {
      title: "Solo para prestarle el servicio",
      text: "No vendemos sus datos, no hacemos publicidad con ellos y el sitio no tiene analítica de terceros.",
    },
    {
      title: "Sus casos son suyos",
      text: "Sobre lo que carga en un caso usted decide; nosotros lo guardamos cifrado y solo lo procesamos por su cuenta.",
    },
    {
      title: "Respuesta con plazos de ley",
      text: "Consultas en diez días hábiles y reclamos en quince, escribiendo a nuestro correo.",
    },
  ],
  sections: [
    {
      id: "responsable",
      title: "Quién es el responsable",
      basis: ["Decreto 1377 de 2013, art. 13"],
      body: (
        <>
          <p>
            ALETHEIA es un servicio en línea operado por {DATA_CONTROLLER.name},
            persona natural identificada con NIT {DATA_CONTROLLER.nit} y
            domiciliada en {DATA_CONTROLLER.city}. Él es el responsable del
            tratamiento de los datos personales que describe esta política y
            atiende personalmente las consultas y los reclamos.
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
        </>
      ),
    },
    {
      id: "alcance",
      title: "A quién se aplica",
      basis: ["Ley 1581 de 2012, art. 3, literales d y e"],
      body: (
        <>
          <p>
            Se aplica a los datos de quienes visitan aletheia.sbs, crean una
            cuenta, son invitados a una organización o al portal de un caso,
            contratan un plan o nos escriben.
          </p>
          <p>
            ALETHEIA cumple dos papeles. Sobre los datos de su cuenta es
            responsable: decide para qué se usan y responde por ellos. Sobre los
            archivos y la información que usted carga en sus casos es encargado:
            los guarda y los procesa por cuenta suya y siguiendo sus
            instrucciones, como se explica en{" "}
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
              contraseña. La contraseña nunca se guarda tal cual: guardamos un
              resumen irreversible calculado con Argon2id. Si ingresa con su
              cuenta de Google, recibimos su nombre, su correo y el
              identificador de esa cuenta.
            </li>
            <li>
              <strong>Datos de su organización.</strong> Si abre la cuenta para
              una oficina o firma, su nombre, sus miembros y el rol de cada uno.
            </li>
            <li>
              <strong>Datos de seguridad.</strong> Dirección IP, navegador y
              fecha de los ingresos y de las acciones importantes, para detectar
              accesos indebidos. Si activa el segundo factor, guardamos cifrada
              la clave de su aplicación de autenticación y un resumen
              irreversible de sus códigos de recuperación.
            </li>
            <li>
              <strong>Datos de suscripción.</strong> Plan, fechas y estado de
              los pagos y, si activa la renovación automática, el identificador
              de su fuente de pago en la pasarela, los últimos cuatro dígitos de
              su celular Nequi y el registro de su autorización (versión del
              texto, fecha y dirección IP). Los datos de su tarjeta o de su
              cuenta los recibe directamente la pasarela de pagos; ALETHEIA
              nunca los ve ni los guarda.
            </li>
            <li>
              <strong>Prueba de su autorización.</strong> La fecha de los textos
              que usted aceptó y el momento en que lo hizo.
            </li>
            <li>
              <strong>Mensajes y solicitudes.</strong> Lo que nos escribe, el
              tipo de solicitud, su número de radicado y los datos que incluya
              para que le respondamos.
            </li>
            <li>
              <strong>Medición de rendimiento, solo si la acepta.</strong>{" "}
              Cuánto tarda en cargar y responder el sitio, sin su cuenta, su
              dirección IP ni ningún identificador. Se explica en la{" "}
              <Link to={legalRoute("cookies")}>política de cookies</Link>.
            </li>
          </ul>
          <p>
            No recogemos su ubicación ni seguimos su navegación, y para crear la
            cuenta no le pedimos ningún dato sensible.
          </p>
        </>
      ),
    },
    {
      id: "finalidades",
      title: "Para qué los usamos",
      basis: ["Ley 1581 de 2012, art. 12"],
      body: (
        <>
          <ul>
            <li>Crear y administrar su cuenta y la de su organización.</li>
            <li>
              Comprobar su identidad al ingresar y proteger la cuenta contra
              accesos indebidos.
            </li>
            <li>
              Prestar el servicio: guardar sus evidencias, registrar su cadena
              de custodia, archivar los casos cerrados y generar paquetes de
              exportación.
            </li>
            <li>
              Enviarle los correos propios del servicio: verificación de su
              correo, invitaciones, recuperación de contraseña, avisos de cobro,
              constancias y cambios en estos textos.
            </li>
            <li>Cobrar los planes contratados y llevar sus registros.</li>
            <li>Responder sus consultas, peticiones y reclamos.</li>
            <li>
              Cumplir obligaciones legales y atender órdenes de autoridades
              competentes.
            </li>
          </ul>
          <p>
            No vendemos, alquilamos ni cedemos sus datos, y no los usamos para
            enviarle publicidad. Si algún día quisiéramos usarlos para algo
            distinto, le pediríamos antes una nueva autorización.
          </p>
        </>
      ),
    },
    {
      id: "autorizacion",
      title: "Su autorización",
      basis: [
        "Ley 1581 de 2012, arts. 6 y 9",
        "Decreto 1377 de 2013, art. 6",
        "Ley 527 de 1999, art. 5",
      ],
      body: (
        <>
          <p>
            Al crear la cuenta, usted marca la casilla en la que autoriza el
            tratamiento descrito aquí. La casilla aparece sin marcar: nunca
            damos su autorización por supuesta. Esa aceptación es un mensaje de
            datos con plena validez y queda registrada con la fecha de estos
            textos y el momento exacto en que la dio, para que usted o la
            autoridad puedan consultarla después. Si quiere una copia de esa
            prueba, pídala a {mail}.
          </p>
          <p>
            Nunca le pediremos datos sensibles ni datos de niños, niñas o
            adolescentes para usar su cuenta. Si alguna vez una pregunta los
            tocara, responderla sería opcional y se lo diríamos de forma
            expresa.
          </p>
        </>
      ),
    },
    {
      id: "contenido-de-los-casos",
      title: "Datos que usted carga en sus casos",
      basis: ["Ley 1581 de 2012, arts. 6, 7 y 18"],
      body: (
        <>
          <p>
            Los archivos de sus casos pueden contener datos personales de sus
            clientes y de terceros, incluso datos sensibles como historias
            clínicas o datos de niños, niñas y adolescentes. Sobre esa
            información el responsable es el abogado o la organización que la
            carga, y ALETHEIA actúa como encargado. Por eso:
          </p>
          <ul>
            <li>
              Usted declara que puede tratar esos datos, sea porque tiene la
              autorización de sus titulares o porque la ley lo permite sin ella;
              por ejemplo, cuando son necesarios para el reconocimiento, el
              ejercicio o la defensa de un derecho en un proceso judicial.
            </li>
            <li>
              ALETHEIA solo los guarda, calcula su huella, obtiene su sello de
              tiempo, los archiva y los exporta para prestar el servicio. No los
              analiza ni los usa para fines propios. Una solicitud de supresión
              se ejecuta cuando haya sido validada y no exista un deber legal o
              contractual de conservar la información.
            </li>
            <li>
              Cada caso se cifra con su propia llave, y el servicio no le da a
              su administrador ninguna ruta ni permiso para abrir su contenido.
            </li>
            <li>
              Si un titular nos pide algo sobre datos que están en un caso,
              trasladamos su solicitud al abogado responsable dentro de los dos
              días hábiles siguientes y se lo informamos al titular.
            </li>
            <li>
              Cuando en un caso haya datos de niños, niñas o adolescentes, el
              abogado responsable debe asegurar el respeto de sus derechos
              prevalentes.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "personas-sin-cuenta",
      title: "Clientes del despacho y personas sin cuenta",
      basis: ["Ley 1581 de 2012, arts. 3 y 12"],
      body: (
        <>
          <p>
            Un despacho puede invitar a su cliente al portal de un caso o
            enviarle a alguien un enlace para ver una evidencia. Esas personas
            no crean una cuenta en ALETHEIA, y sobre sus datos el responsable es
            el despacho que las invitó; ALETHEIA los trata como encargado.
          </p>
          <ul>
            <li>
              Del cliente del portal guardamos su nombre y su correo, tal como
              los escribió el despacho, los mensajes y documentos que
              intercambia con él, el momento en que aceptó el aviso de
              tratamiento y la fecha de su última visita.
            </li>
            <li>
              Del enlace para ver una evidencia guardamos la etiqueta que le
              puso el despacho, cuándo se creó, cuándo vence y cuántas veces se
              descargó. Cada descarga queda en la cadena de custodia del caso, y
              en el registro de seguridad con la dirección IP y el navegador
              desde los que se hizo; esos dos datos se borran a los 90 días.
            </li>
            <li>
              El cliente puede pedir al despacho que corrija o suprima sus
              datos. Si nos escribe a nosotros, trasladamos su solicitud al
              despacho dentro de los dos días hábiles siguientes y se lo
              informamos.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "derechos",
      title: "Sus derechos",
      basis: ["Ley 1581 de 2012, art. 8"],
      body: (
        <>
          <p>Como titular de sus datos, usted tiene derecho a:</p>
          <ul>
            <li>
              Conocer, actualizar y rectificar sus datos, también cuando sean
              parciales, inexactos, incompletos o induzcan a error.
            </li>
            <li>Pedir prueba de la autorización que nos dio.</li>
            <li>Saber, si lo pide, qué uso les hemos dado.</li>
            <li>
              Revocar la autorización o pedir que se supriman sus datos. Si nos
              lo pide, lo hacemos salvo que una ley o el contrato vigente nos
              obliguen a conservarlos, y en ese caso le decimos cuál.
            </li>
            <li>Acceder gratuitamente a sus datos.</li>
            <li>
              Presentar quejas ante la{" "}
              <a href={CONSUMER_AUTHORITY.url} rel="noopener noreferrer">
                {CONSUMER_AUTHORITY.name}
              </a>{" "}
              por infracciones a la ley de protección de datos, una vez haya
              presentado su consulta o reclamo ante nosotros, como lo pide la
              ley.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "como-ejercerlos",
      title: "Cómo ejercer sus derechos",
      basis: ["Ley 1581 de 2012, arts. 14, 15 y 16"],
      body: (
        <>
          <p>
            Si tiene cuenta, entre a Pedir soporte y elija «Consulta sobre mis
            datos personales» o «Corregir, actualizar o suprimir mis datos». La
            solicitud recibe al instante su número de radicado, la fecha en que
            llegó y la fecha límite de respuesta, y puede seguirla desde esa
            misma pantalla.
          </p>
          <p>
            Si no tiene cuenta, escriba a {mail} indicando cómo podemos
            verificar su identidad. Diga qué necesita y adjunte lo que sirva
            para atenderlo. Le respondemos con el número de radicado, la fecha y
            la hora en que llegó su solicitud.
          </p>
          <h3>Consultas</h3>
          <p>
            Si quiere saber qué datos suyos tenemos, le respondemos en un máximo
            de diez días hábiles desde que recibimos la solicitud. Si no fuera
            posible, antes de que venza ese plazo le explicamos por qué y le
            damos una fecha, que nunca pasa de cinco días hábiles más.
          </p>
          <h3>Reclamos</h3>
          <p>
            Si quiere corregir, actualizar o suprimir sus datos, o cree que
            incumplimos esta política, le respondemos en un máximo de quince
            días hábiles contados desde el día siguiente al recibo. Si no fuera
            posible, le explicamos por qué y le damos una fecha, que nunca pasa
            de ocho días hábiles más. En los dos días hábiles siguientes al
            recibo, sus datos quedan marcados como «reclamo en trámite» hasta
            que lo resolvamos.
          </p>
          <p>
            Si a un reclamo le falta información, se la pedimos dentro de los
            cinco días siguientes. Si pasan dos meses sin que la envíe,
            entenderemos que desistió.
          </p>
          <p>
            Los plazos se cuentan en días hábiles de Colombia, sin sábados,
            domingos ni festivos. Antes de acudir a la {CONSUMER_AUTHORITY.name}
            , la ley le pide presentar primero su consulta o reclamo ante
            nosotros.
          </p>
        </>
      ),
    },
    {
      id: "proveedores",
      title: "Proveedores que tratan datos por nuestra cuenta",
      basis: [
        "Decreto 1377 de 2013, arts. 24 y 25",
        "Ley 1581 de 2012, art. 26",
      ],
      body: (
        <>
          <p>
            Para prestar el servicio nos apoyamos en proveedores que tratan
            datos por cuenta nuestra, solo para la tarea que les encargamos y
            bajo condiciones contractuales que los obligan a protegerlos y a
            guardar confidencialidad:
          </p>
          <ul>
            <li>
              <strong>Amazon Web Services.</strong> Aloja los servidores, la
              base de datos, los archivos cifrados y las copias de respaldo en
              la región de Ohio, Estados Unidos, y envía los correos del
              servicio.
            </li>
            <li>
              <strong>Wompi.</strong> La pasarela de pagos, en Colombia. Procesa
              los pagos y la renovación automática con Nequi, y recibe
              directamente los datos de su medio de pago.
            </li>
            <li>
              <strong>Google.</strong> Solo si usted elige ingresar con su
              cuenta de Google.
            </li>
            <li>
              <strong>Autoridades de sellado de tiempo.</strong> Reciben
              únicamente la huella de cada archivo, que no permite reconstruirlo
              ni contiene datos personales.
            </li>
          </ul>
          <p>
            Como los servidores están en Estados Unidos, sus datos se envían a
            ese país para que estos proveedores los traten en nombre de
            ALETHEIA. La ley llama a esto transmisión internacional. Estados
            Unidos figura entre los países que la {CONSUMER_AUTHORITY.name}{" "}
            reconoce con un nivel adecuado de protección, y la transmisión se
            hace con las mismas reglas y protecciones de esta política.
          </p>
        </>
      ),
    },
    {
      id: "seguridad",
      title: "Cómo protegemos los datos",
      basis: ["Ley 1581 de 2012, art. 17, literal n"],
      body: (
        <>
          <p>
            Toda la comunicación con el sitio viaja cifrada. Las contraseñas se
            guardan como resúmenes irreversibles, cada caso tiene su propia
            llave de cifrado, cada persona solo accede a lo que su rol le
            permite y las acciones importantes quedan registradas. La base de
            datos se respalda cada día y la copia se cifra antes de salir del
            servidor.
          </p>
          <p>
            Para frenar los envíos automáticos, los formularios de ingreso,
            registro y recuperación de la contraseña piden a su navegador
            resolver un cálculo corto antes de enviarse. Lo hace solo, sin
            preguntarle nada, no usa ningún servicio externo, no guarda nada en
            su navegador y no recoge datos sobre usted.
          </p>
          <p>
            Ninguna medida es infalible, así que no prometemos una seguridad
            absoluta. Lo que sí hacemos es avisar sin demora a quienes resulten
            afectados por un incidente e informarlo a la{" "}
            {CONSUMER_AUTHORITY.name}, como lo exige la ley.
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
            revocan todas las sesiones, se desvinculan los proveedores de acceso
            y la identidad directa se reemplaza por un seudónimo. La prueba de
            pagos, aceptaciones, autorías y demás registros que deban
            conservarse permanece vinculada únicamente a ese seudónimo durante
            el plazo aplicable.
          </li>
          <li>
            La dirección IP y el navegador de los registros de seguridad, 90
            días. Después se anonimizan.
          </li>
          <li>
            Los casos cerrados pasan a un archivo histórico sin perder sus
            archivos, huellas ni eventos de custodia. Se conservan diez años
            contados desde el cierre, el mismo plazo para todos los despachos.
            Si una ley o una orden de autoridad exige otro para un caso, el
            despacho nos escribe con el soporte y lo aplicamos.
          </li>
          <li>
            Las copias de respaldo siguen el ciclo técnico documentado del
            servicio y no sustituyen el archivo histórico. Una supresión
            autorizada se propaga a esas copias conforme a ese ciclo.
          </li>
          <li>
            Los registros de auditoría, aceptaciones y operaciones de
            conservación se mantienen durante el plazo necesario para demostrar
            el cumplimiento y atender reclamaciones u órdenes de autoridad.
          </li>
          <li>
            Las solicitudes de ayuda, el tiempo necesario para atenderlas. Las
            consultas y reclamos sobre datos personales, las quejas de
            consumidor y los reembolsos, tres años después de cerrados, como
            prueba de lo que respondimos.
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
      basis: ["Decreto 1377 de 2013, art. 13"],
      body: (
        <>
          <p>
            Esta política rige desde la fecha indicada al comienzo. Las bases de
            datos permanecen vigentes mientras ALETHEIA preste el servicio y,
            después, solo el tiempo que la ley exija conservar algún dato.
          </p>
          <p>
            Si hacemos un cambio sustancial, se lo avisamos por correo antes de
            aplicarlo y publicamos el texto nuevo en esta página con su fecha.
            Al ingresar después de ese cambio, le pediremos que lo lea y lo
            acepte, y si cambia la finalidad del tratamiento, le pediremos una
            nueva autorización.
          </p>
        </>
      ),
    },
  ],
};
