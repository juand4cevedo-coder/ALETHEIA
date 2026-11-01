import type { LegalDocument } from "./types.ts";

// Política de cookies. Hoy el sitio solo usa las cookies de sesión de ADR-007 (HttpOnly, Secure
// y SameSite=Strict); no hay analítica ni publicidad. Lo no esencial espera consentimiento
// (RN-029), que se gestiona en el panel de cookies (HU-004).
export const cookiePolicy: LegalDocument = {
  slug: "cookies",
  title: "Política de cookies",
  description:
    "Qué cookies usa ALETHEIA, para qué sirven, cuánto duran y cómo borrarlas. El sitio no usa cookies de analítica ni de publicidad.",
  summary:
    "ALETHEIA solo usa las cookies indispensables para que usted inicie sesión de forma segura. No usamos cookies de analítica ni de publicidad, y ningún tercero sigue su navegación en este sitio.",
  sections: [
    {
      id: "que-son",
      title: "Qué son las cookies",
      body: (
        <p>
          Una cookie es un archivo pequeño que un sitio web guarda en su
          navegador para reconocerlo en las visitas siguientes. Algunas son
          necesarias para que el sitio funcione; otras sirven para medir visitas
          o mostrar publicidad.
        </p>
      ),
    },
    {
      id: "cookies-que-usamos",
      title: "Cookies que usamos",
      body: (
        <>
          <p>
            Solo usamos cookies propias de aletheia.sbs, y solo cuando usted
            inicia sesión:
          </p>
          <ul>
            <li>
              <strong>Cookie de sesión.</strong> Demuestra que usted ya ingresó,
              para no pedirle la contraseña en cada página. Dura 10 minutos y se
              renueva sola mientras usa el servicio.
            </li>
            <li>
              <strong>Cookie de renovación.</strong> Mantiene su sesión abierta
              hasta 14 días. Cambia cada vez que se usa, y si alguien intenta
              reutilizar una anterior, todas sus sesiones se cierran.
            </li>
          </ul>
          <p>
            Ninguna de las dos se puede leer desde el código de una página, solo
            viajan por conexiones cifradas y el navegador no las envía a otros
            sitios. Al cerrar sesión se borran.
          </p>
        </>
      ),
    },
    {
      id: "preferencias",
      title: "Preferencias guardadas en su navegador",
      body: (
        <p>
          Su decisión sobre las cookies se guarda en su propio navegador para no
          preguntársela en cada visita. Ese dato no se envía a nuestros
          servidores.
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
          Las cookies de sesión no requieren su consentimiento porque sin ellas
          no sería posible ingresar de forma segura. Si en el futuro agregamos
          cookies que no sean indispensables, permanecerán desactivadas hasta
          que usted las acepte, y podrá cambiar su decisión en cualquier momento
          con el botón Configurar cookies, al pie de cualquier página.
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
          Si cambiamos las cookies que usamos, actualizaremos esta página con
          una nueva versión y fecha. Si el cambio incluye cookies que no sean
          indispensables, le pediremos su consentimiento antes de activarlas.
        </p>
      ),
    },
  ],
};
