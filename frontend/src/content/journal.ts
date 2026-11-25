export type JournalArticle = {
  slug: string;
  title: string;
  category: string;
  /** Cuándo se publicó, en ISO (AAAA-MM-DD). */
  date: string;
  /** Último cambio de fondo, en ISO. Se muestra si es distinto de la publicación. */
  updated?: string;
  /** Palabra grande de la imagen de la tarjeta: el tema del artículo en una o dos palabras. */
  visual: string;
  /** Línea corta para la tarjeta de la portada de blog: dice de qué trata, sin eslogan. */
  tagline: string;
  summary: string;
  /** Título para el buscador si el del artículo no cabe con la marca en 60 caracteres. */
  seoTitle?: string;
  /** Descripción para el buscador si el resumen pasa de 155 caracteres. */
  seoDescription?: string;
  /** Párrafos de texto. Un enlace interno se escribe [texto](/ruta). */
  sections: { title: string; paragraphs: string[] }[];
};

/** Quien escribe los artículos del blog. */
export const JOURNAL_AUTHOR = "Juan Diego Acevedo Calderón";

/** Lo que el lector necesita saber de quien escribe, debajo de la firma. */
export const JOURNAL_AUTHOR_NOTE =
  "Fundador de ALETHEIA y tecnólogo en Análisis y Desarrollo de Software. No es abogado: cada afirmación jurídica cita la norma y el artículo para que usted la revise en la fuente.";

export const JOURNAL: JournalArticle[] = [
  {
    slug: "conservar-chat-correo-video-como-evidencia",
    category: "Práctica",
    date: "2026-11-24",
    visual: "Original",
    tagline:
      "Ley 527, Código General del Proceso y una rutina para el despacho.",
    title:
      "Cómo conservar un chat, un correo o un video como evidencia digital en Colombia",
    seoTitle: "Conservar chats, correos y videos como evidencia",
    seoDescription:
      "Qué dice la ley colombiana sobre los mensajes de datos y cómo conservar un chat, un correo o un video para presentarlo como evidencia digital.",
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
          "Cuando tenga que presentar el caso, exporta un paquete de preservación con los originales, el manifiesto de huellas, los eventos de custodia, los sellos y un informe en PDF. Quien lo reciba puede comprobarlo por su cuenta, como explica la guía [Comprobar un paquete de preservación](/docs/verificar-un-archivo).",
          "Hay cosas que ALETHEIA no hace. No entra a celulares ni a cuentas de terceros: solo guarda lo que usted sube. No puede demostrar lo que le pasó al archivo antes de llegar; la procedencia la declara usted y así queda anotada. Tampoco certifica pruebas ni decide si son auténticas o admisibles: esa valoración es del juez, con los criterios del artículo 11 de la Ley 527 y del Código General del Proceso.",
          "Si quiere probar esta rutina con un caso real, la prueba dura 14 días y no pide tarjeta de crédito. Lo que trae cada plan está en la página de [planes y precios](/precios).",
        ],
      },
    ],
  },
  {
    slug: "carpeta-compartida-frente-a-un-caso-con-custodia",
    category: "Comparación",
    date: "2026-11-25",
    visual: "Custodia",
    tagline:
      "WhatsApp, correo y carpeta en la nube frente a un caso con custodia.",
    title:
      "Carpeta compartida, WhatsApp y correo frente a un caso con cadena de custodia",
    seoTitle: "Carpeta compartida frente a un caso con custodia",
    seoDescription:
      "Qué se pierde cuando la evidencia de un caso vive en WhatsApp, el correo y una carpeta compartida, y qué cambia al guardarla con huella, sello y custodia.",
    summary:
      "La mayoría de despachos guarda la evidencia donde llega. Esta comparación muestra qué queda registrado en cada lugar y qué hay que reconstruir cuando el caso llega a audiencia.",
    sections: [
      {
        title: "Cómo se guarda hoy la evidencia",
        paragraphs: [
          "En un despacho típico, la evidencia de un caso vive en tres lugares a la vez. Los audios y los pantallazos siguen en el chat de WhatsApp donde los mandó el cliente. Los documentos llegaron por correo y alguien los descargó. Lo que se alcanzó a organizar está en una carpeta de Google Drive, OneDrive o Dropbox con el nombre del cliente.",
          "Ese arreglo funciona mientras el caso es pequeño y lo atiende una sola persona. Los problemas aparecen cuando entra un segundo abogado, cuando pasan meses entre la recepción del archivo y la audiencia, o cuando la otra parte pregunta de dónde salió una prueba y si alguien la tocó.",
        ],
      },
      {
        title: "Lo que registra cada herramienta",
        paragraphs: [
          "WhatsApp guarda la conversación en el teléfono y en la copia de seguridad que el usuario haya configurado. Si alguien borra un mensaje, cambia de teléfono o no exporta el chat a tiempo, esa información se puede perder. Además, lo que se reenvía o se descarga desde la aplicación puede llegar comprimido.",
          "El correo conserva el mensaje con sus encabezados, que dicen quién lo envió, a quién y cuándo. El problema es que el adjunto, una vez descargado, se convierte en un archivo suelto: nada lo vincula con el mensaje del que salió.",
          "Una carpeta compartida guarda versiones y, en algunos servicios, un registro de actividad. Ese registro está pensado para recuperar archivos, no para una audiencia: no calcula una huella del contenido, no pide un sello de tiempo a un tercero y se puede perder si alguien mueve la carpeta o cancela la cuenta.",
        ],
      },
      {
        title: "Lo que hay que reconstruir después",
        paragraphs: [
          "Cuando el caso llega a la etapa probatoria, alguien tiene que responder preguntas sobre cada archivo: quién lo entregó, en qué fecha, si es el original, quién lo ha tenido y si cambió. Con la evidencia repartida, esas respuestas salen de la memoria de las personas y de buscar en el chat y en el correo.",
          "El artículo 11 de la Ley 527 de 1999 dice que, para valorar un mensaje de datos, se tiene en cuenta la confiabilidad de la forma en que se conservó la integridad de la información. Una historia reconstruida de memoria es más difícil de sostener que una que quedó anotada el día en que pasó.",
        ],
      },
      {
        title: "Lo que cambia con un caso en ALETHEIA",
        paragraphs: [
          "En ALETHEIA, cada archivo se sube a un caso. En ese momento se calcula su huella SHA-256, se guarda cifrado sin modificarlo, se pide un sello de tiempo RFC 3161 a una autoridad externa y se anota quién lo subió y de dónde declaró que venía. Cada descarga y cada exportación quedan en la misma cadena de custodia.",
          "El acceso también cambia. En una carpeta compartida, quien tiene el enlace ve todo. En ALETHEIA, solo los miembros del caso lo ven, y ser administrador del despacho no da acceso por sí solo a todos los casos. El cliente puede consultar lo que usted decida compartir desde el portal del cliente, sin entrar a la carpeta del despacho.",
          "Al final, el caso se exporta en un paquete de preservación con los originales, el manifiesto de huellas, los eventos de custodia, los sellos y un informe en PDF. Quien lo reciba puede comprobarlo sin una cuenta en ALETHEIA, con el [comprobador público](/verificador) o con herramientas como OpenSSL.",
        ],
      },
      {
        title: "Cuándo basta con la carpeta",
        paragraphs: [
          "No todos los archivos de un caso son evidencia. Las minutas, los borradores de memoriales y la correspondencia administrativa pueden seguir en la carpeta de siempre. Lo que conviene llevar a un caso con custodia es lo que quizá tenga que probar: los chats, los correos, los audios, los videos, las fotos y los documentos que entregó el cliente o que obtuvo de un tercero.",
          "Puede probarlo con un caso real durante 14 días, sin tarjeta. Los [planes y precios](/precios) dicen qué incluye cada plan; todos traen el sello de tiempo, la cadena de custodia y el paquete de preservación.",
        ],
      },
    ],
  },
  {
    slug: "vigilancia-de-procesos-y-evidencia-digital",
    category: "Comparación",
    date: "2026-11-25",
    visual: "Procesos",
    tagline:
      "Consultar la Rama Judicial y preservar la prueba son tareas distintas.",
    title:
      "Vigilancia de procesos y preservación de evidencia: dos herramientas distintas",
    seoTitle: "Vigilancia de procesos y evidencia digital",
    seoDescription:
      "Qué hace un software de vigilancia de procesos, qué hace ALETHEIA con la evidencia digital y por qué un despacho puede necesitar los dos.",
    summary:
      "Muchos abogados ya pagan una herramienta que consulta la Rama Judicial. ALETHEIA no la reemplaza: se ocupa de la evidencia del caso. Aquí está la diferencia.",
    sections: [
      {
        title: "Lo que hace un software de vigilancia",
        paragraphs: [
          "En Colombia hay varias herramientas que consultan cada día los sistemas de la Rama Judicial y avisan cuando un proceso tiene una actuación nueva o aparece en un estado electrónico. Sirven para no perder un término: el abogado registra sus procesos y recibe un correo o una notificación cuando algo cambia.",
          "Su materia prima es la información pública del proceso: el radicado de 23 dígitos, las partes, el juzgado y las actuaciones. No guardan la evidencia del cliente ni la preparan para presentarla.",
        ],
      },
      {
        title: "Lo que hace ALETHEIA",
        paragraphs: [
          "ALETHEIA no consulta la Rama Judicial ni avisa de estados electrónicos. Se ocupa de lo que el abogado tiene que aportar: los chats, los correos, los audios, los videos y los documentos que sostienen el caso.",
          "Cada archivo queda con su huella SHA-256, un sello de tiempo RFC 3161 firmado por una autoridad externa y una cadena de custodia con cada descarga y exportación. El caso tiene además sus miembros, sus tareas y plazos, y un portal para compartir documentos con el cliente. Al final se exporta un paquete de preservación que cualquiera puede comprobar.",
        ],
      },
      {
        title: "Dónde se cruzan",
        paragraphs: [
          "Las dos herramientas hablan del mismo proceso. En ALETHEIA, cada caso puede llevar el radicado, el despacho judicial y la especialidad, así que la evidencia queda asociada al mismo número que usa su herramienta de vigilancia. Los plazos que le avise esa herramienta se pueden anotar como tareas del caso, con responsable y fecha, y llevarlos a su calendario.",
          "Lo que no conviene es usar una para lo que hace la otra. Un sistema de vigilancia no guarda una cadena de custodia de los archivos, y ALETHEIA no le va a avisar que salió un auto.",
        ],
      },
      {
        title: "Cómo decidir",
        paragraphs: [
          "Si su problema es enterarse a tiempo de lo que pasa en sus procesos, necesita una herramienta de vigilancia. Si su problema es llegar a la audiencia con la evidencia ordenada, íntegra y con su historia, necesita algo como ALETHEIA. La mayoría de despachos que litigan tienen los dos problemas.",
          "La prueba de ALETHEIA dura 14 días y no pide tarjeta. Puede usarla junto con la herramienta que ya tiene y comparar. Los precios están en [planes y precios](/precios).",
        ],
      },
    ],
  },
  {
    slug: "aletheia-y-el-estampado-cronologico",
    category: "Comparación",
    date: "2026-11-24",
    visual: "RFC 3161",
    tagline: "Sello RFC 3161 frente a estampado de una entidad acreditada.",
    title:
      "ALETHEIA y el estampado cronológico de una entidad de certificación",
    seoTitle: "Sello de tiempo frente a estampado cronológico",
    seoDescription:
      "Qué hace el sello de tiempo de ALETHEIA, qué hace el estampado de una entidad acreditada ante ONAC y cuándo conviene usar cada uno.",
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
          "La primera revisión es sencilla: la huella del sello tiene que ser igual a la huella del archivo que usted tiene. Si no coinciden, el sello corresponde a otro contenido. La segunda es comprobar que la firma de la autoridad es válida y que su certificado estaba vigente en la fecha del sello. Las dos se pueden hacer con OpenSSL; la guía [Revisar un sello de tiempo](/docs/revisar-un-sello-de-tiempo) trae los comandos.",
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
    slug: "que-dice-una-huella-sha256",
    category: "Integridad",
    date: "2026-10-22",
    updated: "2026-11-25",
    visual: "SHA-256",
    tagline: "Qué prueba una coincidencia de huellas y cómo calcularla.",
    title: "Qué dice una huella digital y qué no dice",
    summary:
      "Qué es una huella SHA-256, cómo calcularla en su computador sin instalar nada y qué puede concluir, y qué no, cuando dos huellas coinciden.",
    sections: [
      {
        title: "Comparar el contenido",
        paragraphs: [
          "SHA-256 calcula una huella de 64 caracteres hexadecimales a partir del contenido de un archivo. Es determinista: el mismo contenido produce el mismo resultado. Cambiar un solo byte produce, en la práctica, una huella completamente distinta.",
          "El nombre del archivo no participa en ese cálculo. Dos archivos con nombres diferentes pueden tener la misma huella. Un documento que parece idéntico a simple vista puede tener otra huella si cambian sus metadatos o su estructura interna. Por ejemplo, abrir un PDF y volver a guardarlo, aunque no se cambie ni una letra, suele producir un archivo distinto y una huella distinta.",
        ],
      },
      {
        title: "Cómo calcularla en su computador",
        paragraphs: [
          "No necesita instalar nada. En Windows, abra la terminal (PowerShell) en la carpeta del archivo y escriba Get-FileHash seguido del nombre del archivo; por defecto usa SHA-256. También sirve el comando certutil -hashfile, con el nombre del archivo y la palabra SHA256 al final.",
          "En macOS, abra la Terminal y escriba shasum -a 256 seguido del nombre del archivo. En Linux, el comando es sha256sum. Los tres muestran la misma huella para el mismo archivo, porque el algoritmo es el mismo.",
          "Si prefiere no usar la terminal, el [comprobador de ALETHEIA](/verificador) hace el mismo cálculo en el navegador. El archivo no se envía al servidor y puede ser de cualquier tamaño: se lee por partes, en un hilo aparte, sin bloquear la página.",
        ],
      },
      {
        title: "La referencia importa",
        paragraphs: [
          "Para comparar necesita una huella de referencia obtenida de una fuente confiable. Si un tercero puede reemplazar tanto el archivo como la huella que se usa para comprobarlo, la comparación no permite advertir esa sustitución.",
          "Por eso la huella sirve más cuando se registra temprano y en un lugar que nadie puede editar después. Un sello de tiempo RFC 3161 resuelve esa parte: una autoridad externa firma la huella con la fecha y la hora, y ese sello se puede revisar sin depender de quien lo pidió.",
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
    updated: "2026-11-25",
    visual: "Acceso",
    tagline:
      "Roles del despacho, miembros de cada caso y el portal del cliente.",
    title: "Dar acceso también es una decisión",
    summary:
      "Cómo separar las responsabilidades del despacho del acceso a cada caso, qué ve cada rol y qué revisar cuando alguien entra o sale del equipo.",
    sections: [
      {
        title: "Dos niveles diferentes",
        paragraphs: [
          "Un despacho reúne a las personas que trabajan juntas. Un caso reúne a quienes intervienen en un asunto específico. Son ámbitos distintos, y sus permisos también lo son.",
          "Administrar el despacho no da acceso automático a todos sus casos. Para consultar un caso, la persona debe formar parte de él. Esta separación reduce la exposición de información entre asuntos y ayuda a cumplir el deber de guardar el secreto profesional que el artículo 28 de la Ley 1123 de 2007 pone en cabeza del abogado.",
        ],
      },
      {
        title: "Qué hace cada rol en ALETHEIA",
        paragraphs: [
          "El responsable del despacho es quien creó la cuenta. Administra los datos del despacho, el plan y los pagos, y puede pasar esa responsabilidad a otra persona.",
          "El administrador lleva la parte administrativa: invita a las personas y cambia sus roles, pero no abre casos. El abogado abre casos, asigna a su equipo y trabaja en los que le asignen. El asistente trabaja en los casos donde lo agreguen, sin poder invitar a nadie al despacho.",
          "El cliente no es un rol del despacho. Para tenerlo al tanto está el [portal del cliente](/docs/portal-del-cliente) de cada caso: entra con un enlace, sin cuenta, y ve el estado del caso, los avisos que usted publique y los documentos que comparta con él. No ve la evidencia ni nada más del despacho.",
        ],
      },
      {
        title: "Invitar con cuidado",
        paragraphs: [
          "Antes de enviar una invitación, compruebe el correo y el rol que necesita la persona. Use una cuenta individual; compartir contraseñas impide distinguir quién está trabajando y dificulta revocar un acceso cuando deja de ser necesario. En ALETHEIA, además, cada descarga queda en la cadena de custodia a nombre de quien la hizo, y esa anotación pierde sentido si varias personas usan la misma cuenta.",
          "Si cambia una responsabilidad, revise tanto el rol en el despacho como la participación en los casos. Retirar un permiso es parte del cierre de una tarea.",
        ],
      },
      {
        title: "Cuando alguien sale del equipo",
        paragraphs: [
          "Retire a la persona del despacho desde Equipo. Al hacerlo, pierde el acceso a todos los casos y sus sesiones se cierran. Lo que subió y lo que descargó sigue en la cadena de custodia con su nombre, porque esa historia no se borra.",
          "Revise también las invitaciones pendientes: una invitación abierta ocupa un cupo del plan y permite entrar a quien la reciba hasta que venza. Si ya no se necesita, revóquela.",
        ],
      },
      {
        title: "Cuidar la sesión",
        paragraphs: [
          "Use una contraseña que no repita en otros servicios y active el segundo factor; la guía [Activar el segundo factor](/docs/segundo-factor) explica cómo. Desde su cuenta puede cambiar la contraseña y cerrar las sesiones de sus dispositivos. Ante un acceso que no reconoce, cierre las sesiones y contacte a soporte sin enviar contraseñas ni archivos confidenciales por correo. La página de [seguridad](/seguridad) describe los demás controles.",
        ],
      },
    ],
  },
  {
    slug: "un-caso-con-contexto",
    category: "Práctica",
    date: "2026-10-05",
    updated: "2026-11-25",
    visual: "Contexto",
    tagline:
      "Qué anotar al abrir un caso para retomarlo sin preguntar a nadie.",
    title: "Un caso necesita algo más que un nombre",
    summary:
      "Radicado, despacho judicial, responsables y plazos: los datos que conviene anotar al abrir un caso para que cualquiera del equipo lo pueda retomar.",
    sections: [
      {
        title: "Empezar por lo que permite reconocerlo",
        paragraphs: [
          "Un título sirve para encontrar un caso. El contexto sirve para entenderlo. Cuando varias personas trabajan en el mismo asunto, una referencia clara evita confundir expedientes y hace más fácil continuar el trabajo de otra persona.",
          "En ALETHEIA puede registrar el nombre del caso, su radicado, la especialidad y el despacho judicial. Conviene usar una convención breve y consistente para el nombre, por ejemplo el tipo de asunto seguido de las partes: «Laboral, Pérez contra Transportes del Valle». No hace falta llenar el título de datos personales que ya están en los documentos.",
        ],
      },
      {
        title: "El radicado completo",
        paragraphs: [
          "En la Rama Judicial, cada proceso se identifica con un código único de 23 dígitos. Anótelo completo y sin espacios desde que lo tenga, porque es el dato que permite cruzar el caso con los estados electrónicos, con su herramienta de vigilancia de procesos y con los memoriales que radique.",
          "Si el asunto todavía no llega a un juzgado, deje el radicado en blanco y anote en el caso en qué etapa está: consulta inicial, conciliación o reclamación previa. Cuando haya reparto, complete el dato.",
        ],
      },
      {
        title: "El equipo también forma parte del contexto",
        paragraphs: [
          "Pertenecer a un despacho no equivale a participar en todos sus casos. Los miembros de cada caso determinan quién puede consultarlo. Revise esa participación cuando una persona cambia de responsabilidad o termina su intervención; la guía [Invitar a su equipo](/docs/invitar-al-equipo) explica cómo.",
          "Una buena revisión empieza por tres preguntas: ¿está bien identificado el asunto?, ¿pertenecen al caso las personas que deben trabajar en él?, ¿la información permite retomarlo sin pedir una explicación por otro canal?",
        ],
      },
      {
        title: "Plazos con responsable",
        paragraphs: [
          "Un término que vive en la cabeza de una sola persona es un riesgo para el despacho. En cada caso de ALETHEIA puede crear tareas con fecha y responsable, y llevar los plazos a su calendario. Así, si alguien se enferma o sale de vacaciones, el resto del equipo ve qué vence y quién lo tenía.",
          "Si repite las mismas tareas en casos parecidos, guárdelas como plantilla. Una demanda laboral, por ejemplo, suele seguir los mismos pasos, y la plantilla evita olvidar uno.",
        ],
      },
      {
        title: "Un hábito que se puede sostener",
        paragraphs: [
          "Acuerde con su equipo cómo nombrar los casos, quién revisa sus datos y en qué momento se actualizan. Una estructura sencilla y compartida suele resultar más útil que una clasificación muy detallada que nadie alcanza a mantener. Diez minutos al abrir el caso ahorran horas de reconstrucción cuando hay que preparar una audiencia.",
        ],
      },
    ],
  },
];

export const HELP = [
  {
    slug: "crear-un-caso",
    title: "Crear y encontrar un caso",
    text: "Abra Casos y pulse Nuevo caso. Escriba el nombre y, si los tiene, el radicado, la especialidad y el despacho judicial. Para crear casos, su rol debe ser abogado o responsable del despacho y su correo tiene que estar verificado.",
    related: "/app/casos",
  },
  {
    slug: "invitar-al-equipo",
    title: "Invitar a su equipo",
    text: "Abra Equipo, pulse Invitar a una persona, escriba su correo y elija el rol. La persona recibe un enlace para aceptar. En la misma lista puede reenviar o revocar las invitaciones pendientes.",
    related: "/app/miembros",
  },
  {
    slug: "verificar-un-archivo",
    title: "Comparar la huella de un archivo",
    text: "Abra el comprobador, elija un archivo de cualquier tamaño y pegue la huella SHA-256 de referencia, de 64 caracteres. El cálculo se hace en su navegador. Una coincidencia dice que el contenido es el mismo; no dice quién lo creó ni si es admisible.",
    related: "/verificador",
  },
  {
    slug: "recuperar-el-acceso",
    title: "Recuperar el acceso",
    text: "En la pantalla de ingreso, pulse ¿Olvidó su contraseña?, escriba el correo de su cuenta y siga el enlace que le llega. Por seguridad, la pantalla no confirma si ese correo está registrado. Si no ve el correo, revise la carpeta de no deseados.",
    related: "/recuperar",
  },
] as const;
