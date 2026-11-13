export type DocSection = {
  id: string;
  title: string;
  paragraphs: string[];
  steps?: string[];
};
export type DocArticle = {
  slug: string;
  title: string;
  description: string;
  group: string;
  sections: DocSection[];
  action?: { to: string; label: string };
};

export const DOCUMENTATION: DocArticle[] = [
  {
    slug: "introduccion",
    title: "Introducción",
    group: "Primeros pasos",
    description:
      "Un espacio para organizar sus casos, trabajar con su equipo y conservar el contexto de cada asunto.",
    sections: [
      {
        id: "que-es",
        title: "Conozca Aletheia",
        paragraphs: [
          "Aletheia reúne casos, personas y permisos en un espacio de trabajo. Cada caso conserva sus datos de identificación y los registros de actividad que genera el servicio.",
          "Esta documentación describe las funciones disponibles. Los ejemplos son ilustrativos y no contienen expedientes reales.",
        ],
      },
      {
        id: "primeros-pasos",
        title: "Su primer recorrido",
        paragraphs: [
          "Empiece con su cuenta y complete la verificación de correo antes de crear un caso.",
        ],
        steps: [
          "Cree una cuenta individual o una cuenta para su oficina o firma.",
          "Abra el enlace de verificación que recibe por correo.",
          "Ingrese y abra la sección Casos de su espacio de trabajo.",
          "Cree un caso con un nombre que pueda reconocer y los datos disponibles.",
        ],
      },
      {
        id: "alcance",
        title: "Qué puede comprobar",
        paragraphs: [
          "El comprobador público calcula la huella SHA-256 de un archivo en su navegador. Permite compararla con una referencia que usted aporte, sin enviar el archivo al servidor.",
          "La coincidencia de huellas no determina autoría, fecha de creación, licitud de la obtención ni valor probatorio.",
        ],
      },
    ],
    action: { to: "/registro", label: "Crear una cuenta" },
  },
  {
    slug: "crear-un-caso",
    title: "Crear y encontrar un caso",
    group: "Espacio de trabajo",
    description:
      "Identifique cada asunto y retómelo con el contexto que necesita.",
    sections: [
      {
        id: "antes",
        title: "Antes de empezar",
        paragraphs: [
          "Su correo debe estar verificado. La opción de crear casos depende de su rol y de las condiciones de su plan. Si no aparece, consulte a quien administra su organización.",
        ],
      },
      {
        id: "crear",
        title: "Cree el caso",
        paragraphs: [
          "Desde el espacio de trabajo, abra Casos y seleccione Nuevo caso.",
        ],
        steps: [
          "Escriba un nombre breve y reconocible para el asunto.",
          "Complete el radicado, la especialidad y el despacho cuando disponga de ellos.",
          "Revise los datos antes de guardar. La apertura quedará asociada a su organización.",
        ],
      },
      {
        id: "encontrar",
        title: "Encuéntrelo después",
        paragraphs: [
          "Use el buscador de Casos para filtrar por título, radicado o despacho. Al abrir un caso puede consultar su detalle y los registros de actividad disponibles.",
          "Solo puede consultar los casos en los que participa. Administrar una organización no da acceso automático a todos sus asuntos.",
        ],
      },
    ],
    action: { to: "/app/casos", label: "Abrir mis casos" },
  },
  {
    slug: "invitar-al-equipo",
    title: "Invitar a su equipo",
    group: "Espacio de trabajo",
    description:
      "Reúna a las personas de su organización con cuentas individuales y responsabilidades claras.",
    sections: [
      {
        id: "roles",
        title: "Organización y casos",
        paragraphs: [
          "El rol de la organización y la participación en un caso son permisos diferentes. Un rol administrativo permite gestionar el equipo, pero no abre por sí solo todos los casos.",
        ],
      },
      {
        id: "invitar",
        title: "Envíe una invitación",
        paragraphs: [
          "Las personas con permisos de administración pueden gestionar las invitaciones desde Miembros.",
        ],
        steps: [
          "Abra Miembros y seleccione la opción de invitar.",
          "Revise el correo de destino y el rol que necesita esa persona.",
          "Envíe la invitación. La persona recibirá un enlace para aceptarla.",
          "Consulte el estado en la lista antes de reenviar o revocar el acceso.",
        ],
      },
      {
        id: "revisar",
        title: "Revise los accesos",
        paragraphs: [
          "Cuando alguien cambia de responsabilidad, revise tanto su rol en la organización como su participación en los casos. Use cuentas individuales: compartir una contraseña impide distinguir quién realizó una acción.",
        ],
      },
    ],
    action: { to: "/app/miembros", label: "Abrir miembros" },
  },
  {
    slug: "verificar-un-archivo",
    title: "Comparar una huella SHA-256",
    group: "Integridad",
    description:
      "Compruebe si un archivo coincide con una huella de referencia, directamente en su navegador.",
    sections: [
      {
        id: "necesita",
        title: "Qué necesita",
        paragraphs: [
          "Un archivo de hasta 32 MB y una huella SHA-256 de referencia: una secuencia de 64 caracteres hexadecimales. La referencia debe venir de una fuente que pueda identificar y conservar.",
        ],
      },
      {
        id: "comparar",
        title: "Realice la comparación",
        paragraphs: [
          "La operación es local. El comprobador no sube su archivo a Aletheia.",
        ],
        steps: [
          "Abra el comprobador de la página de inicio.",
          "Seleccione el archivo que quiere revisar.",
          "Introduzca la huella SHA-256 de referencia.",
          "Consulte el resultado y conserve el origen de la referencia con su registro de revisión.",
        ],
      },
      {
        id: "resultado",
        title: "Interprete el resultado",
        paragraphs: [
          "Una coincidencia indica que la huella calculada coincide con la referencia introducida. Una diferencia significa que no coinciden: revise el archivo y la referencia usados.",
          "Una huella no verifica quién creó el archivo ni cuándo. Si alguien sustituye a la vez el archivo y la referencia, esta comparación no permite advertir esa sustitución.",
        ],
      },
    ],
    action: { to: "/#verificador", label: "Abrir el comprobador" },
  },
  {
    slug: "recuperar-el-acceso",
    title: "Cuenta y acceso",
    group: "Cuenta",
    description: "Recupere su contraseña y cuide las sesiones de su cuenta.",
    sections: [
      {
        id: "recuperar",
        title: "Recupere su contraseña",
        paragraphs: [
          "En la pantalla de ingreso, seleccione la opción de recuperar su contraseña. Escriba el correo de su cuenta y siga el enlace que recibe. Revise también la carpeta de correo no deseado.",
          "Por seguridad, el mensaje de respuesta no confirma si un correo está registrado.",
        ],
      },
      {
        id: "sesiones",
        title: "Controle sus sesiones",
        paragraphs: [
          "Desde su cuenta puede cambiar la contraseña y cerrar las sesiones de sus dispositivos. Si detecta un acceso que no reconoce, cierre las sesiones y contacte con soporte sin enviar claves ni archivos confidenciales.",
        ],
      },
      {
        id: "proveedores",
        title: "Google y Microsoft",
        paragraphs: [
          "El acceso con Google y Microsoft todavía no está disponible. Mientras se completa su activación, puede crear una cuenta e ingresar con su correo y contraseña.",
        ],
      },
    ],
    action: { to: "/recuperar", label: "Recuperar mi contraseña" },
  },
];
