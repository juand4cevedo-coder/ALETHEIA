export type DocSection = {
  id: string;
  title: string;
  paragraphs: string[];
  steps?: string[];
  /** Comandos para copiar tal cual, uno por línea. */
  commands?: string[];
};
export type DocArticle = {
  slug: string;
  title: string;
  description: string;
  group: string;
  sections: DocSection[];
  action?: { to: string; label: string };
};

// Cada guía nombra las pantallas y los botones como aparecen en la aplicación. Si un texto de la
// interfaz cambia, la guía cambia en el mismo cambio.
export const DOCUMENTATION: DocArticle[] = [
  {
    slug: "introduccion",
    title: "Introducción",
    group: "Primeros pasos",
    description:
      "Cómo funciona ALETHEIA: casos con su equipo, evidencia con huella SHA-256 y sello de tiempo, cadena de custodia y paquete de preservación.",
    sections: [
      {
        id: "que-es",
        title: "Qué hace ALETHEIA",
        paragraphs: [
          "ALETHEIA guarda los casos de su despacho y la evidencia de cada uno. Al subir un archivo, calcula su huella SHA-256, lo guarda cifrado sin modificarlo, pide un sello de tiempo RFC 3161 a una autoridad externa y anota en la cadena de custodia quién lo subió y de dónde dijo que venía.",
          "Cuando necesite presentar el caso, exporta un paquete de preservación que cualquier persona puede comprobar sin una cuenta en ALETHEIA.",
          "Estas guías describen lo que la aplicación hace hoy. Los ejemplos no contienen expedientes reales.",
        ],
      },
      {
        id: "primeros-pasos",
        title: "Su primer caso en diez minutos",
        paragraphs: [
          "La prueba dura 14 días, no pide tarjeta e incluye cuatro usuarios.",
        ],
        steps: [
          "Cree su cuenta en Registro, con su correo o con Google.",
          "Abra el enlace de verificación que le llega al correo.",
          "En Casos, pulse Nuevo caso y escriba el nombre y, si lo tiene, el radicado.",
          "Dentro del caso, en Agregar evidencia, suba un archivo y diga de dónde viene.",
          "Revise en el caso la huella, el sello de tiempo y el primer evento de custodia.",
        ],
      },
      {
        id: "alcance",
        title: "Lo que ALETHEIA no hace",
        paragraphs: [
          "No entra a celulares ni a cuentas de terceros: guarda lo que usted sube. No demuestra lo que le pasó a un archivo antes de llegar; esa procedencia la declara usted. No consulta la Rama Judicial ni avisa de estados electrónicos.",
          "Tampoco certifica pruebas ni decide si son auténticas o admisibles. ALETHEIA no es una entidad de certificación acreditada en Colombia. La valoración de la prueba le corresponde al juez.",
        ],
      },
    ],
    action: { to: "/registro", label: "Probar 14 días gratis" },
  },
  {
    slug: "crear-un-caso",
    title: "Crear y encontrar un caso",
    group: "Espacio de trabajo",
    description:
      "Cree un caso con su radicado, su despacho judicial y su equipo, y encuéntrelo después por cualquiera de esos datos.",
    sections: [
      {
        id: "antes",
        title: "Antes de empezar",
        paragraphs: [
          "Pueden crear casos el responsable del despacho y quienes tengan el rol de abogado. Además, su correo tiene que estar verificado. Si no ve el botón Nuevo caso, pídale a quien administra el despacho que revise su rol.",
        ],
      },
      {
        id: "crear",
        title: "Cree el caso",
        paragraphs: ["Abra Casos y pulse Nuevo caso."],
        steps: [
          "Escriba un nombre corto que su equipo reconozca, por ejemplo «Laboral, Pérez contra Transportes del Valle».",
          "Si el proceso ya tiene radicado, escríbalo completo: son 23 dígitos.",
          "Elija la especialidad y escriba el despacho judicial, si ya lo conoce.",
          "Pulse Abrir el caso. Usted queda como miembro y puede agregar a su equipo desde el caso.",
        ],
      },
      {
        id: "encontrar",
        title: "Encuéntrelo después",
        paragraphs: [
          "El buscador de Casos filtra por nombre, radicado o despacho judicial. Al abrir un caso ve sus datos, su evidencia, sus tareas y su cadena de custodia.",
          "Solo ve los casos de los que es miembro. Administrar el despacho no da acceso a todos los casos.",
        ],
      },
    ],
    action: { to: "/app/casos", label: "Abrir mis casos" },
  },
  {
    slug: "subir-evidencia",
    title: "Subir evidencia a un caso",
    group: "Evidencia",
    description:
      "Suba un chat, un correo, un audio o un documento a un caso: qué pasa con el archivo, qué debe declarar y qué queda en la cadena de custodia.",
    sections: [
      {
        id: "que-subir",
        title: "Qué conviene subir",
        paragraphs: [
          "Suba el archivo original, no una captura. Un chat de WhatsApp se exporta con la opción Exportar chat; un correo se guarda completo como archivo .eml; un audio o un video debe llegar como el archivo que produjo el teléfono. El artículo [Cómo conservar un chat, un correo o un video](/blog/conservar-chat-correo-video-como-evidencia) explica por qué.",
          "Puede subir cualquier tipo de archivo, hasta el tamaño máximo que permite su plan.",
        ],
      },
      {
        id: "subir",
        title: "Súbalo",
        paragraphs: ["Abra el caso y busque la sección Agregar evidencia."],
        steps: [
          "En Tipo de archivo, elija Documento, Conversación, Correo, Audio, Imagen u Otro.",
          "En Origen declarado, escriba de dónde viene, por ejemplo «Entregado por el cliente por WhatsApp el 3 de marzo».",
          "Arrastre el archivo o selecciónelo, y espere a que termine la carga.",
        ],
      },
      {
        id: "que-pasa",
        title: "Qué pasa con el archivo",
        paragraphs: [
          "ALETHEIA calcula la huella SHA-256 del archivo y lo guarda cifrado, sin modificarlo. Enseguida pide el sello de tiempo RFC 3161 a DigiCert; si no responde, a Sectigo. Si ninguna responde en ese momento, el archivo queda guardado con su huella y el sello se vuelve a pedir solo.",
          "En la cadena de custodia queda el primer evento: quién subió el archivo, cuándo y el origen que declaró. Cada descarga y cada exportación agregan un evento nuevo, y cada evento lleva la huella del anterior, así que no se puede quitar uno sin que se note.",
          "El origen es una declaración suya y así queda anotado. ALETHEIA no puede comprobar lo que le pasó al archivo antes de que usted lo subiera.",
        ],
      },
    ],
    action: { to: "/app/casos", label: "Abrir mis casos" },
  },
  {
    slug: "exportar-un-paquete",
    title: "Exportar un paquete de preservación",
    group: "Evidencia",
    description:
      "Pida el paquete de preservación de un caso, compártalo y sepa qué trae: originales, manifiesto, custodia, sellos de tiempo e informe en PDF.",
    sections: [
      {
        id: "pedir",
        title: "Pida el paquete",
        paragraphs: [
          "En el caso, vaya a Paquete de preservación y pulse Solicitar paquete. La preparación toma unos minutos según el tamaño de la evidencia. Cuando termine, el paquete aparece en la lista Paquetes de este caso.",
          "El enlace de descarga dura 24 horas desde que el paquete queda listo. Con Copiar enlace lo puede enviar a quien lo va a recibir; compártalo solo con esa persona. Cada exportación queda en la cadena de custodia.",
        ],
      },
      {
        id: "contenido",
        title: "Qué trae el archivo ZIP",
        paragraphs: [
          "files/ tiene los archivos originales, tal como se conservaron. Cada uno lleva como nombre su identificador; el nombre original está en el manifiesto.",
          "manifest.json relaciona cada archivo con su nombre original, su huella SHA-256 y su sello. timestamps/ tiene el sello de tiempo de cada archivo, en formato .tsr.",
          "custody/events.json es la cadena de custodia completa del caso, y custody/head.tsr es el sello de tiempo de su último evento. report.pdf es un informe para quien recibe el paquete: explica qué contiene y qué alcance tiene.",
        ],
      },
      {
        id: "entregar",
        title: "Al entregarlo",
        paragraphs: [
          "Quien reciba el paquete puede comprobar cada archivo en el [comprobador público](/verificador), sin crear una cuenta, o con OpenSSL, como explica la guía [Revisar un sello de tiempo](/docs/revisar-un-sello-de-tiempo).",
          "El informe dice de forma expresa que ALETHEIA no certifica el contenido ni determina su admisibilidad o su valor probatorio.",
        ],
      },
    ],
    action: { to: "/app/casos", label: "Abrir mis casos" },
  },
  {
    slug: "verificar-un-archivo",
    title: "Comprobar un paquete de preservación",
    group: "Evidencia",
    description:
      "Compare un archivo con el manifiesto de su paquete de preservación en el navegador, sin subirlo a ninguna parte y sin crear una cuenta.",
    sections: [
      {
        id: "necesita",
        title: "Qué necesita",
        paragraphs: [
          "El archivo que quiere revisar y el manifest.json del paquete de preservación. Guarde también de dónde sacó el manifiesto: una coincidencia de huellas no dice quién lo hizo.",
        ],
      },
      {
        id: "comparar",
        title: "Haga la comparación",
        paragraphs: [
          "Todo pasa en su navegador. El comprobador no envía el archivo ni el manifiesto a ALETHEIA, y lee los archivos grandes por partes.",
        ],
        steps: [
          "Abra el comprobador público.",
          "Elija manifest.json y, si trae varios archivos, seleccione el que va a revisar.",
          "Elija el archivo y pulse Comparar huellas.",
          "Guarde el manifiesto, su origen y el resultado.",
        ],
      },
      {
        id: "resultado",
        title: "Lea el resultado",
        paragraphs: [
          "Si coincide, la huella del archivo es la misma que registró el manifiesto: el contenido no cambió. Si no coincide, el archivo o el manifiesto no son los mismos del paquete.",
          "La comparación no dice quién creó el archivo ni cuándo, ni si es auténtico o admisible. Si alguien cambia a la vez el archivo y el manifiesto, esta comparación no lo detecta; para eso está el sello de tiempo, que firma un tercero.",
        ],
      },
    ],
    action: { to: "/verificador", label: "Abrir el comprobador" },
  },
  {
    slug: "revisar-un-sello-de-tiempo",
    title: "Revisar un sello de tiempo con OpenSSL",
    group: "Evidencia",
    description:
      "Compruebe con OpenSSL que el sello de tiempo RFC 3161 de un archivo corresponde a ese archivo y que lo firmó DigiCert o Sectigo.",
    sections: [
      {
        id: "que-es",
        title: "Qué es el archivo .tsr",
        paragraphs: [
          "Es la respuesta de la autoridad de sellado según el estándar RFC 3161. Trae la huella SHA-256 que se selló, la fecha y la hora, y la firma de la autoridad con su certificado. En el paquete de preservación está en timestamps/, con el mismo identificador del archivo en files/.",
          "Esta revisión no necesita a ALETHEIA. Basta con OpenSSL, que viene instalado en macOS y en la mayoría de distribuciones de Linux, y que en Windows se puede usar con Git para Windows.",
        ],
      },
      {
        id: "leer",
        title: "Lea lo que dice el sello",
        paragraphs: [
          "Este comando muestra la fecha y la hora, la huella sellada y el algoritmo. Cambie los nombres por los de su archivo:",
        ],
        commands: ["openssl ts -reply -in sello.tsr -text"],
      },
      {
        id: "verificar",
        title: "Compruebe que corresponde al archivo",
        paragraphs: [
          "Este comando calcula la huella del archivo, la compara con la del sello y revisa la firma de la autoridad contra los certificados raíz de su sistema. Si todo está bien, responde Verification: OK.",
        ],
        commands: [
          "openssl ts -verify -data archivo -in sello.tsr -CAfile /etc/ssl/certs/ca-certificates.crt",
        ],
      },
      {
        id: "si-falla",
        title: "Si no responde OK",
        paragraphs: [
          "Si la huella no coincide, el sello corresponde a otro contenido: revise que el archivo y el sello tengan el mismo identificador en el paquete. Si falla la cadena de certificados, puede que su sistema guarde las raíces en otra ruta; en macOS, por ejemplo, está en /etc/ssl/cert.pem.",
        ],
      },
    ],
    action: { to: "/verificador", label: "Abrir el comprobador" },
  },
  {
    slug: "invitar-al-equipo",
    title: "Invitar a su equipo",
    group: "Espacio de trabajo",
    description:
      "Invite a su equipo con cuentas individuales, elija el rol de cada persona y agréguela a los casos en los que va a trabajar.",
    sections: [
      {
        id: "roles",
        title: "Rol en el despacho y miembros del caso",
        paragraphs: [
          "Son dos permisos distintos. El rol dice qué puede hacer la persona en el despacho. Ser miembro de un caso dice qué casos puede ver. Un administrador gestiona el equipo, pero no ve un caso si no es miembro de él.",
          "Abogado abre casos, asigna a su equipo y trabaja en los que le asignen. Asistente trabaja en los casos donde lo agreguen. Administrador invita y gestiona al equipo, pero no abre casos.",
        ],
      },
      {
        id: "invitar",
        title: "Envíe la invitación",
        paragraphs: [
          "Pueden invitar el responsable del despacho y los administradores.",
        ],
        steps: [
          "Abra Equipo y pulse Invitar a una persona.",
          "Escriba el correo y elija el rol.",
          "Pulse Enviar invitación. La persona recibe un enlace para aceptarla.",
          "En la lista puede reenviar o revocar una invitación pendiente.",
        ],
      },
      {
        id: "cupos",
        title: "Cupos del plan",
        paragraphs: [
          "Cada plan incluye un número de usuarios, y las invitaciones abiertas también ocupan cupo. En una firma, la persona responsable dirige el despacho y no ocupa cupo. Esencial, Profesional y Firma admiten usuarios adicionales a 19.900 pesos al mes, hasta tantos como los que incluye cada plan; el costo se ve antes de pagar. Corporativo no tiene límite de personas.",
        ],
      },
      {
        id: "revisar",
        title: "Cuando alguien cambia o se va",
        paragraphs: [
          "Si alguien cambia de responsabilidad, revise su rol y los casos de los que es miembro. Si sale del despacho, retírelo desde Equipo: pierde el acceso y sus sesiones se cierran. Lo que hizo sigue en la cadena de custodia con su nombre.",
          "Use cuentas individuales. Si varias personas comparten una contraseña, la cadena de custodia no puede decir quién hizo cada cosa.",
        ],
      },
    ],
    action: { to: "/app/miembros", label: "Abrir Equipo" },
  },
  {
    slug: "portal-del-cliente",
    title: "Compartir un caso con su cliente",
    group: "Espacio de trabajo",
    description:
      "Dele a su cliente acceso al estado de su caso, a los avisos que publique y a los documentos que quiera compartir, sin que cree una cuenta.",
    sections: [
      {
        id: "que-ve",
        title: "Qué ve el cliente",
        paragraphs: [
          "El cliente entra con un enlace que le llega al correo, sin crear cuenta. Ve el título y el estado del caso, los avisos que usted publique y los documentos que comparta con él. No ve la evidencia, la cadena de custodia ni nada más del despacho.",
          "Antes de ver el caso, el cliente acepta un aviso sobre el tratamiento de sus datos personales.",
        ],
      },
      {
        id: "invitar",
        title: "Invítelo",
        steps: [
          "Abra el caso y baje hasta Portal del cliente.",
          "En Invitar a un cliente, escriba su nombre y su correo.",
          "Envíe la invitación. En Clientes con acceso puede pulsar Quitar acceso cuando quiera.",
        ],
        paragraphs: [],
      },
      {
        id: "documentos",
        title: "Documentos y avisos",
        paragraphs: [
          "En Documentos para el cliente puede subir una copia pensada para él, de hasta 25 MB. No es evidencia: no entra a la cadena de custodia ni reemplaza el original. Va cifrada y cada descarga queda en la auditoría. El cliente recibe un correo que avisa de la novedad, sin el nombre del archivo.",
          "En Avisos para el cliente puede publicar novedades del caso, como la fecha de una audiencia. Los mensajes que le escriba el cliente llegan a Mensajes de clientes.",
        ],
      },
    ],
    action: { to: "/app/casos", label: "Abrir mis casos" },
  },
  {
    slug: "segundo-factor",
    title: "Activar la verificación en dos pasos",
    group: "Cuenta",
    description:
      "Pida un código de su teléfono además de la contraseña, guarde sus códigos de respaldo y, si es responsable del despacho, exíjala a todo el equipo.",
    sections: [
      {
        id: "activar",
        title: "Actívela",
        paragraphs: [
          "Necesita una aplicación de autenticación en su teléfono, como Google Authenticator, Microsoft Authenticator, Authy o 1Password.",
        ],
        steps: [
          "Abra Mi cuenta y busque Verificación en dos pasos.",
          "Escanee el código QR con la aplicación, o agregue la cuenta con la clave que aparece debajo.",
          "Escriba el código de 6 dígitos que muestra la aplicación y pulse Confirmar y activar.",
          "Guarde los códigos de respaldo en un lugar seguro, fuera del teléfono.",
        ],
      },
      {
        id: "respaldo",
        title: "Si pierde el teléfono",
        paragraphs: [
          "Ingrese con su contraseña y uno de los códigos de respaldo. Cada código sirve una sola vez. Cuando le queden pocos, ALETHEIA se lo avisa en Mi cuenta y puede generar unos nuevos.",
        ],
      },
      {
        id: "despacho",
        title: "Exigirla a todo el equipo",
        paragraphs: [
          "El responsable del despacho puede activar Exigir la verificación en dos pasos a todo el equipo, en Organización, Políticas del despacho. Desde ese momento, quien no la tenga activa debe activarla al ingresar para poder seguir trabajando.",
        ],
      },
    ],
    action: { to: "/app/cuenta", label: "Abrir Mi cuenta" },
  },
  {
    slug: "recuperar-el-acceso",
    title: "Cuenta y acceso",
    group: "Cuenta",
    description:
      "Recupere su contraseña, cierre las sesiones de otros dispositivos y vincule su cuenta de Google para ingresar con un solo clic.",
    sections: [
      {
        id: "recuperar",
        title: "Recupere su contraseña",
        paragraphs: [
          "En la pantalla de ingreso, pulse ¿Olvidó su contraseña?, escriba el correo de su cuenta y siga el enlace que le llega. Si no lo ve, revise la carpeta de no deseados.",
          "Por seguridad, la pantalla no confirma si ese correo tiene una cuenta.",
        ],
      },
      {
        id: "sesiones",
        title: "Cierre las sesiones que no reconoce",
        paragraphs: [
          "En Mi cuenta puede cambiar la contraseña y cerrar las sesiones de sus otros dispositivos. Si ve un acceso que no reconoce, ciérrelas todas y escríbanos. Nunca envíe contraseñas ni archivos confidenciales por correo.",
        ],
      },
      {
        id: "proveedores",
        title: "Ingresar con Google",
        paragraphs: [
          "Puede crear su cuenta o ingresar con Google. ALETHEIA recibe su nombre, su correo verificado y un identificador; nunca recibe su contraseña de Google.",
          "Si ya tiene una cuenta con contraseña, ingrese con ella y vincule Google en Mi cuenta. Por seguridad, ALETHEIA no une dos cuentas solo porque tengan el mismo correo.",
        ],
      },
    ],
    action: { to: "/recuperar", label: "Recuperar mi contraseña" },
  },
];
