export type JournalArticle = {
  slug: string;
  title: string;
  category: string;
  summary: string;
  sections: { title: string; paragraphs: string[] }[];
};

export const JOURNAL: JournalArticle[] = [
  {
    slug: "un-caso-con-contexto",
    category: "Práctica",
    title: "Un caso necesita algo más que un nombre",
    summary:
      "Radicado, despacho y responsables. Los datos que ayudan a retomar un asunto sin reconstruirlo desde cero.",
    sections: [
      {
        title: "Empezar por lo que permite reconocerlo",
        paragraphs: [
          "Un título sirve para encontrar un caso. El contexto sirve para entenderlo. Cuando varias personas trabajan en el mismo asunto, una referencia clara evita confundir expedientes y hace más fácil continuar el trabajo de otra persona.",
          "En Aletheia puede registrar el nombre del caso, su radicado, especialidad y despacho. Conviene usar una convención breve y consistente: tipo de asunto y una referencia que su equipo reconozca. No hace falta llenar el título de datos personales que ya están en los documentos.",
        ],
      },
      {
        title: "El equipo también forma parte del contexto",
        paragraphs: [
          "Pertenecer a una organización no equivale a participar en todos sus casos. Los miembros de cada caso determinan quién puede consultarlo. Revise esa participación cuando una persona cambia de responsabilidad o termina su intervención.",
          "Una buena revisión empieza por tres preguntas: ¿está bien identificado el asunto?, ¿pertenecen al caso las personas que deben trabajar en él?, ¿la información permite retomarlo sin pedir una explicación por otro canal?",
        ],
      },
      {
        title: "Un hábito que se puede sostener",
        paragraphs: [
          "La organización funciona cuando es fácil mantenerla. Acuerde con su equipo cómo nombrar los casos, quién revisa sus datos y en qué momento se actualizan. Una estructura sencilla y compartida suele resultar más útil que una clasificación muy detallada que nadie alcanza a mantener.",
        ],
      },
    ],
  },
  {
    slug: "que-dice-una-huella-sha256",
    category: "Integridad",
    title: "Qué dice una huella digital. Y qué no.",
    summary:
      "Una coincidencia ayuda a comparar contenido. No cuenta por sí sola quién creó el archivo ni cómo se obtuvo.",
    sections: [
      {
        title: "Comparar el contenido",
        paragraphs: [
          "SHA-256 calcula una huella de 64 caracteres hexadecimales a partir del contenido de un archivo. Es determinista: el mismo contenido produce el mismo resultado. Cambiar un solo byte normalmente produce una huella completamente distinta.",
          "El nombre del archivo no participa en ese cálculo. Dos archivos con nombres diferentes pueden tener la misma huella. Un documento que parece idéntico a simple vista puede tener otra huella si cambian sus metadatos o su estructura interna.",
        ],
      },
      {
        title: "La referencia importa",
        paragraphs: [
          "Para comparar necesita una huella de referencia obtenida de una fuente confiable. Si un tercero puede reemplazar tanto el archivo como la huella que se usa para comprobarlo, la comparación no permite advertir esa sustitución.",
          "El comprobador de Aletheia calcula la huella en el navegador y permite compararla con una referencia. El archivo no se envía al servidor. El límite de 32 MB acota la memoria necesaria para esta operación local.",
        ],
      },
      {
        title: "No confundir integridad con autoría",
        paragraphs: [
          "Una coincidencia aporta información sobre el contenido comparado. No identifica al autor, no demuestra la fecha de creación y no acredita que su obtención haya sido lícita. Esas preguntas necesitan otros elementos y una valoración del contexto.",
          "Conserve el origen de la referencia, el momento de la comprobación y la explicación de lo que hizo. La tecnología resulta más útil cuando se puede describir con precisión qué permite concluir.",
        ],
      },
    ],
  },
  {
    slug: "permisos-con-intencion",
    category: "Seguridad",
    title: "Dar acceso también es una decisión",
    summary:
      "Cómo separar las responsabilidades de una organización del acceso a un caso concreto.",
    sections: [
      {
        title: "Dos niveles diferentes",
        paragraphs: [
          "Una organización reúne a las personas que trabajan juntas. Un caso reúne a quienes intervienen en un asunto específico. Son ámbitos distintos, y sus permisos también lo son.",
          "Administrar la organización no da acceso automático a todos sus casos. Para consultar un caso, la persona debe formar parte de él. Esta separación reduce la exposición innecesaria de información entre asuntos.",
        ],
      },
      {
        title: "Invitar con cuidado",
        paragraphs: [
          "Antes de enviar una invitación, compruebe el correo y el rol que necesita la persona. Use una cuenta individual; compartir contraseñas impide distinguir quién está trabajando y dificulta revocar un acceso cuando deja de ser necesario.",
          "Si cambia una responsabilidad, revise tanto el rol de la organización como la participación en los casos. Retirar un permiso es parte del cierre de una tarea, no un trámite que convenga dejar indefinidamente para después.",
        ],
      },
      {
        title: "Cuidar la sesión",
        paragraphs: [
          "Use una contraseña que no repita en otros servicios. Desde su cuenta puede cambiarla y cerrar las sesiones de sus dispositivos. Ante un acceso que no reconoce, cierre las sesiones y contacte a soporte sin enviar contraseñas ni archivos confidenciales por correo.",
        ],
      },
    ],
  },
];

export const HELP = [
  {
    slug: "crear-un-caso",
    title: "Crear y encontrar un caso",
    text: "Ingrese a su espacio de trabajo y abra Casos. Si su rol permite crear casos y su correo está verificado, verá Nuevo caso. Complete el nombre y los datos que tenga disponibles. Al guardar, el caso queda asociado a su organización y a sus miembros.",
    related: "/app/casos",
  },
  {
    slug: "invitar-al-equipo",
    title: "Invitar a su equipo",
    text: "Desde Miembros, las personas con permisos de administración pueden invitar a un correo y asignar un rol. La persona recibe un enlace para aceptar la invitación. Antes de reenviar o revocar una invitación, revise su estado en la lista.",
    related: "/app/miembros",
  },
  {
    slug: "verificar-un-archivo",
    title: "Comparar la huella de un archivo",
    text: "Abra el comprobador, seleccione un archivo de hasta 32 MB e introduzca una referencia SHA-256 de 64 caracteres. La operación ocurre en su navegador. Una coincidencia compara contenido; no verifica autoría, licitud ni valor probatorio.",
    related: "/#verificador",
  },
  {
    slug: "recuperar-el-acceso",
    title: "Recuperar el acceso",
    text: "En la pantalla de ingreso, elija recuperar su contraseña. Escriba el correo de su cuenta y siga el enlace recibido. Por seguridad, la respuesta en pantalla no confirma si ese correo está registrado. Revise también la carpeta de correo no deseado.",
    related: "/recuperar",
  },
] as const;
