import { Link } from "react-router";

import { legalRoute } from "../../config/routes.ts";
import type { LegalDocument } from "./types.ts";

// Política de cookies. Describe exactamente lo que guarda el sitio: las dos cookies de sesión
// de ADR-007 y ADR-028 (backend/app/api/cookies.py) y la decisión sobre cookies que el panel de
// HU-004 guarda en el navegador (features/consent/cookieConsent.ts). Si cambia un nombre o una
// duración allá, se cambia aquí.
export const cookiePolicy: LegalDocument = {
  slug: "cookies",
  title: "Política de cookies",
  description:
    "Qué cookies usa ALETHEIA, para qué sirve cada una, cuánto dura y cómo borrarla, y qué mide el sitio si usted acepta la medición de rendimiento. No hay publicidad ni seguimiento.",
  keyPoints: [
    {
      title: "Solo dos cookies",
      text: "Las dos sirven para mantener su sesión de forma segura y solo existen cuando usted ingresa.",
    },
    {
      title: "Nadie lo sigue",
      text: "No hay cookies de publicidad ni de redes sociales, y ningún tercero carga recursos en el sitio. La medición de rendimiento es opcional y anónima.",
    },
    {
      title: "Usted decide",
      text: "La medición de rendimiento queda apagada hasta que la acepte, y puede cambiar de opinión cuando quiera.",
    },
  ],
  sections: [
    {
      id: "que-son",
      title: "Qué son las cookies",
      body: (
        <p>
          Una cookie es un archivo pequeño que un sitio web guarda en su
          navegador para reconocerlo en las visitas siguientes. Algunas son
          necesarias para que el sitio funcione; otras sirven para medir visitas
          o mostrar publicidad. ALETHEIA solo usa las primeras.
        </p>
      ),
    },
    {
      id: "cookies-que-usamos",
      title: "Cookies que usamos",
      body: (
        <>
          <p>
            Las dos son propias de aletheia.sbs y solo se crean cuando usted
            inicia sesión:
          </p>
          <table>
            <caption>Cookies de ALETHEIA</caption>
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Para qué sirve</th>
                <th scope="col">Duración</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>__Host-aletheia_access</code>
                </td>
                <td>
                  Demuestra que usted ya ingresó, para no pedirle la contraseña
                  en cada página.
                </td>
                <td>10 minutos; se renueva sola mientras usa el servicio.</td>
              </tr>
              <tr>
                <td>
                  <code>__Secure-aletheia_refresh</code>
                </td>
                <td>
                  Mantiene la sesión abierta. Cambia cada vez que se usa, y si
                  alguien intenta reutilizar una anterior, todas sus sesiones se
                  cierran.
                </td>
                <td>Hasta 14 días desde que ingresó.</td>
              </tr>
            </tbody>
          </table>
          <p>
            Ninguna de las dos se puede leer desde el código de una página, solo
            viajan por conexiones cifradas y el navegador no las envía cuando la
            petición viene de otro sitio. Al cerrar sesión se borran.
          </p>
        </>
      ),
    },
    {
      id: "preferencias",
      title: "Lo que se guarda en su navegador",
      body: (
        <p>
          Su decisión sobre las cookies se guarda en el almacenamiento local de
          su navegador con el nombre <code>aletheia:cookies</code>, junto con la
          fecha en que la tomó, para no preguntársela en cada visita. Ese dato
          no es una cookie y nunca se envía a nuestros servidores.
        </p>
      ),
    },
    {
      id: "lo-que-no-usamos",
      title: "Lo que no usamos",
      body: (
        <>
          <ul>
            <li>
              Herramientas de estadísticas de visitas ni de comportamiento: la
              medición de rendimiento de abajo no cuenta personas ni recorridos.
            </li>
            <li>Cookies de publicidad o de redes sociales.</li>
            <li>
              Recursos de terceros que puedan seguirlo: las fuentes y las
              imágenes del sitio se sirven desde aletheia.sbs.
            </li>
          </ul>
          <p>
            Si elige ingresar con Google, por unos segundos estará en una página
            de Google, donde se aplican las cookies y la política de privacidad
            de esa empresa.
          </p>
        </>
      ),
    },
    {
      id: "medicion-de-rendimiento",
      title: "Medición de rendimiento (opcional)",
      body: (
        <>
          <p>
            Si usted acepta la categoría «Analítica» del panel de cookies,
            medimos qué tan rápido carga y responde el sitio en su navegador:
            cuánto tarda en aparecer el contenido principal, cuánto se mueve la
            página mientras carga y cuánto demora en responder a un toque. Al
            salir de la página, el navegador envía a ALETHEIA una sola petición
            con esas medidas.
          </p>
          <ul>
            <li>
              <strong>Qué se guarda:</strong> el nombre de la métrica, su valor,
              el grupo de la página (inicio, precios, ingreso, documentación,
              textos legales, espacio de trabajo u otra, nunca la dirección
              completa), si la pantalla es de móvil o de escritorio, el tipo de
              conexión que informa el navegador y la versión del sitio.
            </li>
            <li>
              <strong>Qué no se guarda:</strong> su cuenta, su correo, su
              sesión, su dirección IP, su navegador ni ningún identificador. No
              usa cookies ni almacenamiento en su navegador, y no se puede saber
              qué medidas vienen de la misma visita.
            </li>
            <li>
              <strong>Para qué:</strong> saber si el sitio es lento para alguien
              y corregirlo. No se vende ni se entrega a terceros, y ningún
              tercero la recibe.
            </li>
            <li>
              <strong>Cuánto dura:</strong> 90 días; después se borra sola.
            </li>
          </ul>
          <p>
            Como protección contra abusos, la petición cuenta contra un límite
            por dirección de red. Ese límite guarda solo un resumen irreversible
            de la dirección, durante 15 minutos, igual que el de los intentos de
            ingreso. Si deja la categoría apagada, no se envía nada y el sitio
            funciona igual.
          </p>
        </>
      ),
    },
    {
      id: "consentimiento",
      title: "Su consentimiento",
      body: (
        <p>
          Las cookies de sesión no necesitan su consentimiento, porque sin ellas
          no sería posible ingresar de forma segura. La medición de rendimiento
          sí: queda apagada hasta que usted la acepte, y podrá cambiar su
          decisión cuando quiera con el botón Configurar cookies, al pie de
          cualquier página. Si cambiamos lo que se mide, le volveremos a
          preguntar. Lo que se mida se tratará según la{" "}
          <Link to={legalRoute("privacidad")}>
            política de tratamiento de datos
          </Link>
          .
        </p>
      ),
    },
    {
      id: "como-borrarlas",
      title: "Cómo borrarlas o bloquearlas",
      body: (
        <p>
          Puede borrar las cookies o bloquearlas desde la configuración de
          privacidad de su navegador. Si bloquea las cookies de sesión, podrá
          seguir viendo las páginas públicas, pero no podrá ingresar a su
          cuenta.
        </p>
      ),
    },
    {
      id: "cambios",
      title: "Cambios en esta política",
      body: (
        <p>
          Si cambiamos las cookies o las mediciones que usamos, actualizaremos
          esta página. Si el cambio incluye algo que no sea indispensable, le
          pediremos su consentimiento antes de activarlo.
        </p>
      ),
    },
  ],
};
