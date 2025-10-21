export interface LegalFeeScale {
  condicion: string;
  montoUf?: number;
  porcentaje?: number;
  porcentajeSobre?: string;
  minimoUf?: number;
  notas?: string;
}

export interface LegalFeeItem {
  id: string;
  nombre: string;
  descripcion?: string;
  montoUf?: number;
  porcentaje?: number;
  porcentajeSobre?: string;
  minimoUf?: number;
  notas?: string;
  escalas?: LegalFeeScale[];
}

export interface LegalFeeCategory {
  codigo: string;
  titulo: string;
  items: LegalFeeItem[];
}

export const LEGAL_FEE_CATEGORIES: LegalFeeCategory[] = [
  {
    codigo: 'consulta',
    titulo: 'Honorarios Profesionales - Consulta',
    items: [
      {
        id: 'consulta_atencion_personal',
        nombre: 'Consulta profesional (atención personal)',
        montoUf: 1,
        notas:
          'Se descuenta del honorario final si el cliente contrata el servicio asociado.',
      },
      {
        id: 'consulta_informe_escrito',
        nombre: 'Consulta con estudio documental e informe escrito',
        montoUf: 2,
        notas:
          'Incluye revisión de antecedentes y envío de informe. Se descuenta del honorario final si se contrata el servicio.',
      },
    ],
  },
  {
    codigo: 'constitucional',
    titulo: 'Materias Constitucionales',
    items: [
      {
        id: 'recurso_proteccion',
        nombre: 'Recurso de protección',
        montoUf: 30,
        notas: '40 UF si se tramita apelación.',
      },
      {
        id: 'recurso_proteccion_isapre',
        nombre: 'Recurso de protección por alza de plan de ISAPRE',
        descripcion: 'Cobro de costas de la causa.',
        notas: 'Se facturan las costas procesales obtenidas.',
      },
      {
        id: 'recurso_amparo',
        nombre: 'Recurso de amparo',
        montoUf: 15,
        notas: '20 UF si se tramita apelación.',
      },
    ],
  },
  {
    codigo: 'civil',
    titulo: 'Materias Civiles',
    items: [
      {
        id: 'medidas_prejudiciales',
        nombre: 'Medidas prejudiciales',
        escalas: [
          {
            condicion:
              'Si con la medida se resuelve el conflicto que motivaba el juicio posterior',
            montoUf: 15,
          },
          {
            condicion: 'En caso contrario',
            montoUf: 5,
          },
        ],
      },
      {
        id: 'juicio_ordinario_mayor_cuantia',
        nombre: 'Juicio ordinario de mayor cuantía',
        montoUf: 30,
        porcentaje: 10,
        porcentajeSobre: 'lo obtenido con la demanda o lo ahorrado por la defensa',
        notas:
          'Si hay reconvención: 50 UF + 10% de la demanda principal + 10% de lo obtenido o ahorrado por la reconvención.',
      },
      {
        id: 'juicio_ordinario_menor_cuantia',
        nombre: 'Juicio ordinario de menor cuantía',
        montoUf: 20,
        porcentaje: 10,
        porcentajeSobre: 'lo obtenido con la demanda o lo ahorrado por la defensa',
        notas:
          'Con reconvención: 30 UF + 10% de la demanda principal + 10% de la reconvención.',
      },
      {
        id: 'juicio_ordinario_minima_cuantia',
        nombre: 'Juicio ordinario de mínima cuantía',
        montoUf: 10,
        porcentaje: 10,
        porcentajeSobre: 'lo obtenido con la demanda o lo ahorrado por la defensa',
      },
      {
        id: 'preparacion_via_ejecutiva',
        nombre: 'Preparación de la vía ejecutiva',
        montoUf: 10,
      },
      {
        id: 'juicio_ejecutivo',
        nombre: 'Juicio ejecutivo (principal o incidental)',
        montoUf: 20,
        porcentaje: 10,
        porcentajeSobre: 'lo obtenido con la demanda o lo ahorrado por la defensa',
      },
      {
        id: 'tercerias_ejecutivo',
        nombre: 'Tercerías en juicio ejecutivo',
        escalas: [
          { condicion: 'De dominio o de posesión', montoUf: 10 },
          {
            condicion: 'De prelación o pago',
            porcentaje: 10,
            porcentajeSobre: 'lo obtenido',
            minimoUf: 10,
          },
        ],
      },
      {
        id: 'juicio_sumario',
        nombre: 'Juicio sumario',
        montoUf: 20,
        porcentaje: 10,
        porcentajeSobre: 'lo obtenido o lo ahorrado',
      },
      {
        id: 'juicio_arrendamiento',
        nombre: 'Juicio especial de arrendamiento',
        escalas: [
          { condicion: 'Deuda hasta 50 UF', montoUf: 10 },
          { condicion: 'Deuda entre 51 y 100 UF', montoUf: 15 },
          { condicion: 'Deuda superior a 100 UF', montoUf: 20 },
        ],
      },
      {
        id: 'juicio_posesorio',
        nombre: 'Juicio posesorio',
        montoUf: 20,
      },
      {
        id: 'juicio_interdiccion',
        nombre: 'Juicio de interdicción',
        montoUf: 20,
      },
      {
        id: 'juicio_cuentas',
        nombre: 'Juicio sobre cuentas',
        escalas: [
          { condicion: 'Sin observaciones', montoUf: 10 },
          { condicion: 'Con observaciones', montoUf: 25 },
        ],
      },
      {
        id: 'transaccion_previa',
        nombre: 'Transacción antes del juicio',
        porcentaje: 25,
        porcentajeSobre: 'del honorario que correspondería al juicio que se evita',
      },
      {
        id: 'pago_consignacion',
        nombre: 'Pago por consignación',
        montoUf: 10,
        notas: 'En la calificación de suficiencia se aplican los honorarios del juicio ordinario.',
      },
      {
        id: 'retencion_accion_especial',
        nombre: 'Declaración judicial del derecho de retención',
        montoUf: 10,
      },
      {
        id: 'insinuacion_donaciones',
        nombre: 'Insinuación de donaciones',
        montoUf: 20,
      },
      {
        id: 'cambio_nombre',
        nombre: 'Cambio de nombre',
        montoUf: 20,
      },
      {
        id: 'rectificacion_partida_civil',
        nombre: 'Rectificación de partida de estado civil',
        montoUf: 20,
      },
      {
        id: 'estudio_titulo_bienes_raices',
        nombre: 'Examen o formación de título de bienes raíces',
        porcentaje: 2,
        porcentajeSobre: 'valor del inmueble',
        minimoUf: 5,
        notas:
          'No incluye la redacción de contratos derivados, que se cobran adicionalmente.',
      },
      {
        id: 'redaccion_contratos',
        nombre: 'Redacción de contratos, convenios o estatutos',
        porcentaje: 2,
        porcentajeSobre: 'valor del negocio',
        minimoUf: 5,
        notas:
          'Sin cuantía: 8 UF. Modificaciones: 50% del honorario original con mínimo de 4 UF.',
      },
      {
        id: 'redaccion_testamento',
        nombre: 'Redacción de testamento',
        escalas: [
          { condicion: 'Bienes hasta 1.000 UF', montoUf: 20 },
          {
            condicion: 'Bienes superiores a 1.000 UF',
            porcentaje: 5,
            porcentajeSobre: 'del valor de la masa',
          },
        ],
      },
      {
        id: 'muerte_presunta',
        nombre: 'Declaración de muerte presunta',
        montoUf: 20,
      },
      {
        id: 'herencia_yacente',
        nombre: 'Declaración de herencia yacente',
        montoUf: 20,
        notas: 'Incluye nombramiento de curador.',
      },
      {
        id: 'apertura_testamento',
        nombre: 'Apertura o publicación de testamento',
        montoUf: 20,
      },
      {
        id: 'posesion_efectiva_judicial',
        nombre: 'Posesión efectiva judicial',
        montoUf: 20,
      },
      {
        id: 'albaceazgo',
        nombre: 'Albaceazgo',
        escalas: [
          {
            condicion: 'Con tenencia de bienes',
            porcentaje: 10,
            porcentajeSobre: 'bienes de la herencia',
            minimoUf: 20,
          },
          {
            condicion: 'Sin tenencia de bienes',
            porcentaje: 5,
            porcentajeSobre: 'bienes de la herencia',
            minimoUf: 15,
          },
        ],
      },
      {
        id: 'gestiones_judiciales_varias',
        nombre: 'Otras gestiones judiciales',
        escalas: [
          { condicion: 'Nombramiento de guardadores y discernimiento', montoUf: 15 },
          { condicion: 'Notificación de actos jurídicos a terceros', montoUf: 5 },
          { condicion: 'Notificación de protestos', montoUf: 5 },
          { condicion: 'Inscripción por negativa del conservador', montoUf: 10 },
          { condicion: 'Inventario solemne', montoUf: 5 },
        ],
      },
      {
        id: 'expropiacion_utilidad_publica',
        nombre: 'Expropiación de causa de utilidad pública',
        escalas: [
          { condicion: 'Hasta 1.000 UF', porcentaje: 10, porcentajeSobre: 'valor ordenado pagar' },
          { condicion: 'Sobre 1.000 UF', porcentaje: 5, porcentajeSobre: 'valor ordenado pagar' },
        ],
        minimoUf: 15,
        notas:
          'No incluye la suma ofrecida voluntariamente por el expropiante. El mínimo es 15 UF.',
      },
      {
        id: 'materias_aguas',
        nombre: 'Materias de aguas',
        escalas: [
          { condicion: 'Regularización art. 1° transitorio', montoUf: 30 },
          { condicion: 'Regularización art. 2° transitorio', montoUf: 40 },
          {
            condicion: 'Otras formas administrativas de regularización',
            montoUf: 30,
          },
          {
            condicion: 'Constitución o reforma de organizaciones de usuarios',
            montoUf: 30,
          },
          { condicion: 'Juicios sumarios', montoUf: 20 },
          { condicion: 'Acciones de amparo de aguas', montoUf: 20 },
        ],
      },
      {
        id: 'arbitrajes',
        nombre: 'Arbitrajes',
        escalas: [
          {
            condicion: 'Masa hasta 5.000 UF',
            porcentaje: 10,
            porcentajeSobre: 'valor de la masa',
            minimoUf: 30,
          },
          {
            condicion: 'Masa entre 5.000 y 15.000 UF',
            porcentaje: 6,
            porcentajeSobre: 'valor de la masa',
          },
          {
            condicion: 'Masa entre 15.000 y 30.000 UF',
            porcentaje: 4,
            porcentajeSobre: 'valor de la masa',
          },
          {
            condicion: 'Exceso sobre 30.000 UF',
            porcentaje: 2,
            porcentajeSobre: 'valor de la masa excedente',
          },
        ],
        notas:
          'Si el árbitro es administrador común, aumenta en 25%. Si incluye partición de sociedad conyugal y herencia, se incrementa en 15%. Escritura pública o liquidación por separación de bienes: 50% del honorario indicado.',
      },
    ],
  },
  {
    codigo: 'mineria',
    titulo: 'Materias de Minería',
    items: [
      {
        id: 'propiedad_minera_carbon',
        nombre: 'Constitución de propiedad minera en yacimientos carboníferos',
        montoUf: 50,
      },
      {
        id: 'autorizacion_catar_cavar',
        nombre: 'Autorización judicial para catar y cavar',
        montoUf: 40,
      },
      {
        id: 'constitucion_propiedad_minera',
        nombre: 'Constitución de propiedad minera',
        montoUf: 50,
      },
      {
        id: 'permiso_exclusivo_explotar',
        nombre: 'Autorización judicial de permiso exclusivo para explotar',
        montoUf: 50,
      },
      {
        id: 'oposicion_mensura',
        nombre: 'Juicio de oposición o nulidad de mensura',
        notas: 'Entre 50 y 150 UF según complejidad.',
      },
      {
        id: 'administracion_minera',
        nombre: 'Juicios sobre administración del minero o servidumbres mineras',
        notas: 'Entre 50 y 150 UF según complejidad.',
      },
      {
        id: 'internacion_pertenencias',
        nombre: 'Sobre internación de pertenencias',
        escalas: [
          {
            condicion: 'Si es susceptible de apreciación pecuniaria',
            montoUf: 30,
            porcentaje: 1,
            porcentajeSobre: 'valor de la pertenencia',
          },
          { condicion: 'Casos sin apreciación pecuniaria', montoUf: 30 },
        ],
      },
    ],
  },
  {
    codigo: 'comercial',
    titulo: 'Materias Comerciales',
    items: [
      {
        id: 'sociedad_personas',
        nombre: 'Constitución de sociedad de personas',
        porcentaje: 10,
        porcentajeSobre: 'capital suscrito',
        minimoUf: 15,
      },
      {
        id: 'sociedad_capital',
        nombre: 'Constitución de sociedad de capital',
        porcentaje: 10,
        porcentajeSobre: 'capital suscrito',
        minimoUf: 30,
      },
      {
        id: 'constitucion_eirl',
        nombre: 'Constitución de EIRL',
        porcentaje: 10,
        porcentajeSobre: 'capital suscrito',
        minimoUf: 15,
      },
      {
        id: 'modificacion_sociedad',
        nombre: 'Modificación de sociedades o EIRL',
        notas: '2/3 del honorario mínimo fijado para la constitución correspondiente.',
      },
      {
        id: 'quiebras',
        nombre: 'Quiebras',
        notas:
          'Defensa del fallido: 50% del honorario del juicio ordinario. Defensa de acreedores: 10% de lo que perciban. Impugnaciones: 10% de la cantidad discutida. Alzamiento o discusión de la quiebra: 75% del juicio ordinario. Rehabilitación del fallido: 20 UF. Convenio judicial preventivo o extrajudicial: 10% del pasivo con mínimo de 20 UF.',
      },
      {
        id: 'registro_marcas',
        nombre: 'Registro de marcas',
        montoUf: 15,
        notas: 'Con oposición: 30 UF.',
      },
    ],
  },
  {
    codigo: 'laboral',
    titulo: 'Materias Laborales',
    items: [
      {
        id: 'juicio_laboral_ordinario',
        nombre: 'Juicio laboral ordinario (cobro prestaciones)',
        notas:
          'Trabajador: 10 UF + 10% de lo obtenido. Empleador: 20 UF + 20% de lo ahorrado.',
      },
      {
        id: 'juicio_laboral_monitorio',
        nombre: 'Juicio monitorio laboral',
        notas: 'Trabajador: 15 UF. Empleador: 25 UF.',
      },
      {
        id: 'juicio_laboral_ejecutivo',
        nombre: 'Juicio ejecutivo laboral',
        notas:
          'Trabajador: 10 UF + 10% de lo obtenido. Empleador: 20 UF + 20% de lo ahorrado.',
      },
      {
        id: 'desafuero',
        nombre: 'Juicios de desafuero',
        notas: 'Trabajador: 15 UF. Empleador: 20 UF.',
      },
      {
        id: 'amparo_laboral',
        nombre: 'Amparo laboral',
        notas: 'Trabajador: 15 UF. Empleador: 25 UF.',
      },
      {
        id: 'avenimiento_extrajudicial',
        nombre: 'Avenimiento extrajudicial',
        notas:
          'Trabajador: 5 UF + 10% de lo obtenido. Empleador: 10 UF + 20% de lo ahorrado.',
      },
      {
        id: 'indemnizacion_accidente',
        nombre: 'Indemnización por accidente del trabajo',
        notas:
          'Trabajador: 10 UF + 10% de lo obtenido. Empleador: 20 UF + 20% de lo ahorrado.',
      },
      {
        id: 'indemnizacion_enfermedad',
        nombre: 'Indemnización por enfermedad profesional',
        notas:
          'Trabajador: 10 UF + 10% de lo obtenido. Empleador: 20 UF + 20% de lo ahorrado.',
      },
      {
        id: 'constitucion_sindicato',
        nombre: 'Constitución de sindicatos',
        montoUf: 30,
      },
      {
        id: 'constitucion_federaciones',
        nombre: 'Constitución de federaciones o confederaciones',
        montoUf: 50,
      },
      {
        id: 'defensa_sindicato',
        nombre: 'Defensa de sindicato (disolución)',
        montoUf: 30,
      },
      {
        id: 'defensa_dirigente',
        nombre: 'Defensa de dirigente sindical',
        montoUf: 15,
      },
      {
        id: 'negociacion_colectiva',
        nombre: 'Negociación colectiva',
        notas:
          'Representando a trabajadores: 15 UF + 0,5 UF por trabajador. Representando al empleador: 25 UF + 1 UF por trabajador.',
      },
      {
        id: 'reclamos_empresa',
        nombre: 'Reclamos por prácticas de la empresa',
        montoUf: 15,
      },
      {
        id: 'reclamos_sindicato',
        nombre: 'Reclamos contra sindicato',
        montoUf: 15,
      },
      {
        id: 'reclamo_multas',
        nombre: 'Reclamo de multas',
        montoUf: 15,
      },
      {
        id: 'reclamo_resoluciones',
        nombre: 'Reclamo de otras resoluciones administrativas',
        montoUf: 10,
      },
      {
        id: 'cobranza_previsional',
        nombre: 'Cobranza previsional',
        montoUf: 15,
      },
    ],
  },
  {
    codigo: 'familia',
    titulo: 'Materias de Familia',
    items: [
      {
        id: 'cuidado_personal',
        nombre: 'Causas de cuidado personal',
        montoUf: 20,
      },
      {
        id: 'patria_potestad',
        nombre: 'Ejercicio, suspensión o pérdida de patria potestad',
        montoUf: 15,
      },
      {
        id: 'alimentos',
        nombre: 'Causas de alimentos',
        montoUf: 15,
        porcentaje: 50,
        porcentajeSobre: 'de la pensión demandada',
      },
      {
        id: 'disensos',
        nombre: 'Disensos para contraer matrimonio',
        montoUf: 20,
      },
      {
        id: 'guardas',
        nombre: 'Guardas',
        montoUf: 15,
      },
      {
        id: 'medidas_proteccion',
        nombre: 'Medidas de protección',
        montoUf: 15,
      },
      {
        id: 'filiacion',
        nombre: 'Acciones de filiación',
        montoUf: 20,
      },
      {
        id: 'salida_menor',
        nombre: 'Autorización de salida del país para menores',
        montoUf: 20,
      },
      {
        id: 'procedimiento_prev_adopcion',
        nombre: 'Procedimientos previos a la adopción',
        montoUf: 15,
      },
      {
        id: 'adopcion',
        nombre: 'Procedimiento de adopción',
        montoUf: 20,
      },
      {
        id: 'regimen_matrimonial',
        nombre: 'Asuntos patrimoniales entre cónyuges',
        escalas: [
          { condicion: 'Bienes hasta 1.000 UF', porcentaje: 5, porcentajeSobre: 'valor de los bienes' },
          { condicion: 'Bienes sobre 1.000 UF', porcentaje: 2, porcentajeSobre: 'valor de los bienes' },
        ],
      },
      {
        id: 'bienes_familiares',
        nombre: 'Declaración o desafectación de bienes familiares',
        notas:
          '5% sobre bienes hasta 1.000 UF; 2% sobre el exceso. Se aplica también a usufructo, uso o habitación.',
      },
      {
        id: 'separacion_judicial',
        nombre: 'Separación judicial',
        montoUf: 15,
      },
      {
        id: 'nulidad_matrimonio',
        nombre: 'Nulidad de matrimonio',
        montoUf: 20,
      },
      {
        id: 'divorcio_culpa',
        nombre: 'Divorcio por culpa',
        montoUf: 30,
      },
      {
        id: 'divorcio_cese_convivencia',
        nombre: 'Divorcio por cese efectivo de la convivencia',
        escalas: [
          { condicion: 'Demandado unilateralmente', montoUf: 20 },
          { condicion: 'Solicitado de común acuerdo', montoUf: 8, notas: 'Por cada cónyuge representado' },
        ],
      },
      {
        id: 'interdiccion',
        nombre: 'Declaración de interdicción',
        montoUf: 20,
      },
      {
        id: 'violencia_intrafamiliar',
        nombre: 'Violencia intrafamiliar',
        montoUf: 15,
      },
      {
        id: 'compensacion_economica',
        nombre: 'Compensación económica en divorcio',
        porcentaje: 10,
        porcentajeSobre: 'de lo obtenido o lo ahorrado',
        minimoUf: 15,
      },
      {
        id: 'policia_local',
        nombre: 'Materias de policía local (querellas infraccionales)',
        montoUf: 15,
      },
      {
        id: 'policia_local_indemnizacion',
        nombre: 'Materias de policía local (indemnización de perjuicios)',
        montoUf: 10,
        porcentaje: 10,
        porcentajeSobre: 'de lo obtenido o ahorrado',
      },
      {
        id: 'consumidor',
        nombre: 'Demandas ley del consumidor',
        notas: 'Clientes: 10 UF + 10% de lo obtenido. Empresas: 20 UF.',
      },
    ],
  },
  {
    codigo: 'penal',
    titulo: 'Materias Penales',
    items: [
      {
        id: 'defensa_ordinario',
        nombre: 'Defensa en procedimiento ordinario',
        escalas: [
          { condicion: 'Termina con salida alternativa', montoUf: 15 },
          { condicion: 'Termina en juicio abreviado', montoUf: 100 },
          { condicion: 'Termina en juicio oral', montoUf: 150 },
        ],
      },
      {
        id: 'defensa_simplificado',
        nombre: 'Defensa en procedimiento simplificado',
        escalas: [
          { condicion: 'Acepta responsabilidad o salida alternativa', montoUf: 15 },
          { condicion: 'Juicio simplificado efectivo', montoUf: 30 },
        ],
      },
      {
        id: 'querella_ordinario',
        nombre: 'Querella en procedimiento ordinario',
        montoUf: 30,
      },
      {
        id: 'querella_simplificado',
        nombre: 'Querella en procedimiento simplificado',
        montoUf: 15,
      },
      {
        id: 'demanda_civil_penal',
        nombre: 'Demanda civil en sede penal',
        porcentaje: 10,
        porcentajeSobre: 'de lo obtenido',
        minimoUf: 15,
      },
    ],
  },
  {
    codigo: 'recursos',
    titulo: 'Recursos',
    items: [
      {
        id: 'apelacion_casacion',
        nombre: 'Apelación o casación',
        porcentaje: 50,
        porcentajeSobre: 'del arancel de primera instancia',
      },
      {
        id: 'nulidad_penal',
        nombre: 'Recurso de nulidad penal',
        montoUf: 50,
      },
      {
        id: 'nulidad_laboral',
        nombre: 'Recurso de nulidad laboral',
        notas: 'Trabajador: 15 UF. Empleador: 25 UF.',
      },
      {
        id: 'unificacion_jurisprudencia',
        nombre: 'Recurso de unificación de jurisprudencia (laboral)',
        montoUf: 20,
      },
      {
        id: 'inaplicabilidad',
        nombre: 'Recurso de inaplicabilidad',
        montoUf: 30,
      },
      {
        id: 'revision',
        nombre: 'Recurso de revisión',
        montoUf: 50,
      },
    ],
  },
];

export function findLegalFeeItemById(id?: string | null): LegalFeeItem | undefined {
  if (!id) return undefined;
  const normalized = id.trim().toLowerCase();
  const slug = normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  for (const category of LEGAL_FEE_CATEGORIES) {
    const match = category.items.find((item) => {
      if (item.id === normalized || item.id === slug) return true;
      const nameSlug = item.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      return nameSlug === slug;
    });
    if (match) return match;
  }
  return undefined;
}
