export type JournalArticle = {
  slug: string;
  title: string;
  category: string;
  /** Cuándo se publicó, en ISO (AAAA-MM-DD). */
  date: string;
  /** Línea corta para la tarjeta de la portada de blog: específica del artículo, no un relleno. */
  tagline: string;
  summary: string;
  /** Párrafos de texto. Un enlace interno se escribe [texto](/ruta). */
  sections: { title: string; paragraphs: string[] }[];
};

/** Quien escribe los artículos del blog. */
export const JOURNAL_AUTHOR = "Juan Diego Acevedo Calderón";

export const JOURNAL: JournalArticle[] = [
  {
    slug: "conservar-chat-correo-video-como-evidencia",
    category: "Práctica",
    date: "2026-11-24",
    tagline: "El original, no el pantallazo.",
    title:
      "Cómo conservar un chat, un correo o un video como evidencia digital en Colombia",
    summary:
      "Una guía para abogados: qué dice la ley sobre los mensajes de datos, por qué el archivo original pesa más que un pantallazo y cómo dejar constancia de su integridad desde el primer día.",
    sections: [
      {
        title: "El cliente llega con el celular en la mano",
        paragraphs: [
          "Casi todos los casos traen hoy una conversación de WhatsApp, un correo con un adjunto o un video grabado con el teléfono. El cliente suele enviarlos como pantallazos o reenviados por el mismo chat, y en ese recorrido se pierde información que después puede hacer falta: la fecha en que se creó el archivo, los datos de quien lo envió, la conversación completa.",
          "Esta guía resume qué dice la ley colombiana sobre estos archivos y propone una rutina para conservarlos desde el día en que llegan al despacho. No reemplaza el criterio del abogado en cada caso ni anticipa cómo los valorará un juez.",
        ],
      },
      {
        title: "Lo que dice la ley sobre los mensajes de datos",
        paragraphs: [
          "La Ley 527 de 1999 llama mensaje de datos a la información generada, enviada, recibida o archivada por medios electrónicos. Un chat, un correo y un video caben en esa definición. Su artículo 10 dice que los mensajes de datos son admisibles como medio de prueba y que no se les puede negar eficacia por el solo hecho de ser mensajes de datos, ni por no haberse presentado en su forma original.",
          "El artículo 11 fija cómo se valoran: con las reglas de la sana crítica y teniendo en cuenta, entre otros factores, la confiabilidad de la forma en que el mensaje se generó, se archivó o se comunicó, la confiabilidad de la forma en que se conservó la integridad de la información y la forma en que se identifica a quien lo originó. Para la ley, entonces, cuenta lo que dice el mensaje y cuenta cómo se guardó.",
          "El Código General del Proceso trata los documentos en sus artículos 243 a 247. El 243 incluye los mensajes de datos entre las clases de documentos, el 244 se ocupa de su autenticidad, el 245 de cómo se aportan al proceso y el 246 del valor de las copias. El 247 es el que más interesa aquí: se valoran como mensajes de datos los documentos aportados en el mismo formato en que se generaron, enviaron o recibieron, o en otro que los reproduzca con exactitud. La simple impresión en papel se valora con las reglas generales de los documentos.",
          "Por último, la Ley 2213 de 2022 dejó de forma permanente el uso de las tecnologías de la información y las comunicaciones en las actuaciones judiciales. Demandas, memoriales y anexos circulan hoy como archivos, así que presentar la prueba en formato digital es lo normal y no la excepción.",
        ],
      },
      {
        title: "Original frente a pantallazo",
        paragraphs: [
          "Un pantallazo es una imagen nueva, creada en el momento de la captura. Muestra lo que había en la pantalla, pero no trae los datos del mensaje original y se edita con facilidad. Por eso conviene leer con cuidado el artículo 247: lo que se valora como mensaje de datos es el archivo en su formato, o en uno que lo reproduzca con exactitud.",
          "En la práctica, pida al cliente el archivo original; la imagen sola no basta. En WhatsApp, la opción Exportar chat produce un archivo de texto con la conversación y, si se elige, sus adjuntos. En el correo, la mayoría de programas permite guardar el mensaje completo como archivo .eml, que conserva los encabezados con el remitente, los destinatarios y las fechas. Un video o un audio debe llegar como el archivo que produjo el teléfono, sin pasar por una aplicación que lo comprima o lo recorte.",
          "Anote también quién le entregó cada archivo, cuándo y por qué medio. Parece un detalle, pero esa nota responde de entrada la primera pregunta que se hará sobre la prueba: de dónde salió.",
        ],
      },
      {
        title: "Huella y sello: la constancia de que el archivo no cambió",
        paragraphs: [
          "Con el archivo en la mano, el paso siguiente es poder mostrar más adelante que sigue siendo el mismo. Para eso sirve la huella SHA-256, un código de 64 caracteres que se calcula a partir del contenido. Si cambia un solo byte, la huella cambia. Puede calcularla en el [comprobador de archivos](/verificador) sin enviar el archivo a ninguna parte.",
          "La huella dice que dos contenidos coinciden, pero no dice desde cuándo existe ese contenido. Ahí entra el sello de tiempo: una autoridad externa firma la huella junto con la fecha y la hora, según el estándar RFC 3161. Con la huella y el sello, cualquier persona puede comprobar que ese contenido ya existía en ese momento y que no ha cambiado desde entonces.",
          "Falta la cadena de custodia: quién recibió el archivo, quién lo descargó, cuándo se exportó. Si esa historia vive repartida entre correos y memorias USB, reconstruirla meses después es difícil, y a veces imposible.",
        ],
      },
      {
        title: "Qué hace ALETHEIA y qué no",
        paragraphs: [
          "ALETHEIA hace esa rutina por usted. Al subir un archivo a un caso, calcula su huella SHA-256, lo guarda cifrado sin modificarlo, pide su sello de tiempo RFC 3161 y anota en la cadena de custodia quién lo subió y de dónde declaró que venía. Cada descarga y cada exportación quedan en la misma cadena, y cada evento lleva la huella del anterior.",
          "Cuando tenga que presentar el caso, exporta un paquete de preservación con los originales, el manifiesto de huellas, los eventos de custodia, los sellos y un informe en PDF. Quien lo reciba puede comprobarlo por su cuenta, como explica la guía [Verificar un archivo con su manifiesto](/docs/verificar-un-archivo).",
          "Hay cosas que ALETHEIA no hace. No entra a celulares ni a cuentas de terceros: solo guarda lo que usted sube. No puede demostrar lo que le pasó al archivo antes de llegar; la procedencia la declara usted y así queda anotada. Tampoco certifica pruebas ni decide si son auténticas o admisibles: esa valoración es del juez, con los criterios del artículo 11 de la Ley 527 y del Código General del Proceso.",
          "Si quiere probar esta rutina con un caso real, la prueba dura 14 días y no pide tarjeta de crédito. Lo que trae cada plan está en la página de [planes y precios](/precios).",
        ],
      },
    ],
  },
  {
    slug: "aletheia-y-el-estampado-cronologico",
    category: "Integridad",
    date: "2026-11-24",
    tagline: "Dos sellos, dos respaldos.",
    title:
      "ALETHEIA y el estampado cronológico de una entidad de certificación",
    summary:
      "Qué hace el sello de tiempo de ALETHEIA, qué hace el estampado cronológico de una entidad de certificación acreditada y cómo pensar en los dos al preparar un caso.",
    sections: [
      {
        title: "Dos herramientas con nombres parecidos",
        paragraphs: [
          "Cuando un abogado lee que ALETHEIA pone un sello de tiempo a cada archivo, la pregunta suele llegar enseguida: ¿es lo mismo que el estampado cronológico de una entidad de certificación? La respuesta corta es que no, y conviene saber para qué sirve cada una.",
          "Las dos parten de la misma técnica. Toman la huella de un archivo y la firman junto con una fecha y una hora. Lo que cambia es quién firma y qué lugar le da la ley colombiana a esa firma. Este artículo explica primero el estampado de una entidad de certificación, después el sello de ALETHEIA, y termina con una forma práctica de usar los dos en el mismo caso.",
        ],
      },
      {
        title: "El estampado cronológico de una entidad de certificación",
        paragraphs: [
          "La Ley 527 de 1999 regula las entidades de certificación y, en su artículo 30, incluye el estampado cronológico entre las actividades que pueden prestar. En Colombia, estas entidades se acreditan ante el Organismo Nacional de Acreditación de Colombia (ONAC), que evalúa si cumplen los requisitos para ofrecer esos servicios.",
          "Por eso el estampado de una entidad acreditada tiene un respaldo institucional definido: un tercero acreditado responde por la fecha y la hora que firmó, dentro del marco que fija la ley de comercio electrónico. Para muchos asuntos es la opción indicada, y quien lo necesite debe contratarlo con una de esas entidades.",
        ],
      },
      {
        title: "El sello de tiempo de ALETHEIA",
        paragraphs: [
          "ALETHEIA pide un sello de tiempo para cada archivo que usted sube a un caso. Lo pide a autoridades de sellado de acceso público que siguen el estándar RFC 3161: hoy DigiCert, con Sectigo como respaldo si la primera no responde. La respuesta es un archivo .tsr que firma la huella SHA-256 del archivo junto con la fecha y la hora.",
          "Ese sello se guarda con la evidencia y viaja en el paquete de preservación del caso. Cualquier persona puede revisarlo con herramientas comunes, como OpenSSL, sin depender de ALETHEIA. Si en el momento de la carga el sello no se puede obtener, el archivo queda guardado con su huella y el sello se vuelve a pedir solo.",
          "También hay que decir lo que ALETHEIA no es: no es una entidad de certificación acreditada en Colombia, y los sellos que obtiene no provienen de una de ellas. Así lo dicen sus términos del servicio. El informe de cada paquete agrega que ALETHEIA no certifica el contenido ni determina su admisibilidad o su valor probatorio.",
        ],
      },
      {
        title: "Lo que cada uno permite afirmar",
        paragraphs: [
          "En lo técnico, los dos dicen algo parecido: que un contenido con esa huella existía en esa fecha y que no ha cambiado desde entonces. Ninguno de los dos dice quién creó el archivo, si lo que cuenta es cierto o si se obtuvo de forma lícita.",
          "Donde se separan es en el respaldo. El estampado de una entidad acreditada tiene un reconocimiento propio en la Ley 527. El sello de ALETHEIA es la firma técnica de una autoridad de sellado, que se suma a los demás elementos del caso: la huella, la cadena de custodia, la declaración de procedencia. El juez valora el conjunto con las reglas de la sana crítica, como pide el artículo 11 de esa misma ley, y nadie puede prometer de antemano cuánto pesará.",
        ],
      },
      {
        title: "Qué revisar en un sello, venga de donde venga",
        paragraphs: [
          "Un sello de tiempo RFC 3161 trae tres datos que vale la pena mirar: la huella que se selló, el algoritmo con que se calculó y la fecha y la hora que firmó la autoridad. También trae el certificado de esa autoridad, que permite comprobar quién firmó.",
          "La primera revisión es sencilla: la huella del sello tiene que ser igual a la huella del archivo que usted tiene. Si no coinciden, el sello corresponde a otro contenido. La segunda es comprobar que la firma de la autoridad es válida y que su certificado estaba vigente en la fecha del sello. Las dos se pueden hacer con OpenSSL o con otras herramientas que leen el formato.",
          "Por último, guarde el sello junto al archivo. Un sello sin el archivo no dice nada útil, y un archivo sin su sello pierde la fecha. En el paquete de ALETHEIA los dos van juntos, con el manifiesto que los relaciona.",
        ],
      },
      {
        title: "Cómo usarlos juntos",
        paragraphs: [
          "Las dos herramientas no se excluyen. ALETHEIA está pensada para el trabajo de todos los días: cada archivo del caso queda con su huella y su sello desde que llega, sin un trámite aparte, y su historia queda en la cadena de custodia. Si una pieza concreta necesita además el estampado de una entidad acreditada, puede llevar ese mismo archivo a la entidad. La huella SHA-256 depende solo del contenido, así que, si la entidad también usa SHA-256, la huella que obtenga coincidirá con la que muestra ALETHEIA.",
          "Una forma de decidir es pensar en lo que tendrá que explicar en el proceso. Si basta con mostrar que el archivo no cambió desde que lo recibió y quién lo tuvo, el paquete de preservación reúne esa información en un solo lugar y cualquier persona lo puede revisar en el [verificador público](/verificador). Si el caso exige el respaldo de una entidad acreditada, ese estampado se pide aparte, a la entidad.",
          "Los pasos para comprobar un paquete están en la [documentación](/docs/verificar-un-archivo). El sello de tiempo viene en todos los planes, junto con la cadena de custodia y el paquete de preservación; los precios están en [planes y precios](/precios).",
        ],
      },
    ],
  },
  {
    slug: "un-caso-con-contexto",
    category: "Práctica",
    date: "2026-10-05",
    tagline: "Radicado, despacho y equipo.",
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
          "Pertenecer a una organización no equivale a participar en todos sus casos. Los miembros de cada caso determinan quién puede consultarlo. Revise esa participación cuando una persona cambia de responsabilidad o termina su intervención; la guía [Invitar a su equipo](/docs/invitar-al-equipo) explica cómo.",
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
    date: "2026-10-22",
    tagline: "Coincide, no certifica.",
    title: "Qué dice una huella digital y qué no dice",
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
          "El [comprobador de Aletheia](/verificador) calcula la huella en el navegador y permite compararla con una referencia. El archivo no se envía al servidor y puede ser de cualquier tamaño: se lee por partes, en un hilo aparte, sin bloquear la página.",
        ],
      },
      {
        title: "No confundir integridad con autoría",
        paragraphs: [
          "Una coincidencia aporta información sobre el contenido comparado. No identifica al autor, no demuestra la fecha de creación y no acredita que su obtención haya sido lícita. Esas preguntas necesitan otros elementos y una valoración del contexto.",
          "Conserve el origen de la referencia, el momento de la comprobación y la explicación de lo que hizo. La tecnología resulta más útil cuando se puede describir con precisión qué permite concluir. Si necesita que la huella quede acompañada de un sello de tiempo y de su cadena de custodia, eso es lo que hace un caso en ALETHEIA; los [planes y precios](/precios) muestran qué incluye cada uno.",
        ],
      },
    ],
  },
  {
    slug: "permisos-con-intencion",
    category: "Seguridad",
    date: "2026-11-10",
    tagline: "El acceso se revisa.",
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
          "Use una contraseña que no repita en otros servicios y active el segundo factor. Desde su cuenta puede cambiar la contraseña y cerrar las sesiones de sus dispositivos. Ante un acceso que no reconoce, cierre las sesiones y contacte a soporte sin enviar contraseñas ni archivos confidenciales por correo. La página de [seguridad](/seguridad) describe los demás controles.",
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
    text: "Desde Equipo, las personas con permisos de administración pueden invitar a un correo y asignar un rol. La persona recibe un enlace para aceptar la invitación. Antes de reenviar o revocar una invitación, revise su estado en la lista.",
    related: "/app/miembros",
  },
  {
    slug: "verificar-un-archivo",
    title: "Comparar la huella de un archivo",
    text: "Abra el comprobador, seleccione un archivo de cualquier tamaño e introduzca una referencia SHA-256 de 64 caracteres. La operación ocurre en su navegador. Una coincidencia compara contenido; no verifica autoría, licitud ni valor probatorio.",
    related: "/#verificador",
  },
  {
    slug: "recuperar-el-acceso",
    title: "Recuperar el acceso",
    text: "En la pantalla de ingreso, elija recuperar su contraseña. Escriba el correo de su cuenta y siga el enlace recibido. Por seguridad, la respuesta en pantalla no confirma si ese correo está registrado. Revise también la carpeta de correo no deseado.",
    related: "/recuperar",
  },
] as const;
