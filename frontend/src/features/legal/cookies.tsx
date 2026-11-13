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
    "Qué cookies usa ALETHEIA, para qué sirve cada una, cuánto dura y cómo borrarla. El sitio no usa cookies de analítica ni de publicidad.",
  keyPoints: [
    {
      title: "Solo dos cookies",
      text: "Las dos sirven para mantener su sesión de forma segura y solo existen cuando usted ingresa.",
    },
    {
      title: "Nadie lo sigue",
      text: "No hay cookies de analítica, de publicidad ni de redes sociales, y ningún tercero carga recursos en el sitio.",
    },
    {
      title: "Usted decide",
      text: "Si algún día agregamos cookies opcionales, quedarán apagadas hasta que las acepte.",
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
            <li>Cookies de analítica o de estadísticas de visitas.</li>
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
      id: "consentimiento",
      title: "Su consentimiento",
      body: (
        <p>
          Las cookies de sesión no necesitan su consentimiento, porque sin ellas
          no sería posible ingresar de forma segura. Si en el futuro agregamos
          cookies que no sean indispensables, quedarán apagadas hasta que usted
          las acepte, y podrá cambiar su decisión cuando quiera con el botón
          Configurar cookies, al pie de cualquier página. Lo que esas cookies
          revelen sobre usted se tratará según la{" "}
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
          Si cambiamos las cookies que usamos, actualizaremos esta página con la
          fecha nueva. Si el cambio incluye cookies que no sean indispensables,
          le pediremos su consentimiento antes de activarlas.
        </p>
      ),
    },
  ],
};
