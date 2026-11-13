export type LeadProperty = {
  id: string;
  title: string;
  description: string;
  location: string;
  requirements: string;
  price: string;
};

export type LeadAction =
  | { type: 'agent' }
  | { type: 'visit_request'; text: string };

export type Lead = {
  id: string;
  name: string;
  phone: string;
  property: LeadProperty | null;
  pendingIntent: string;
  nextPendingIntent: string;
  actions: LeadAction[];
};

const OPTIONS =
  'Podés preguntarme por precio, ubicación, requisitos, descripción o coordinar una visita.';
const NO_DATA = 'No tengo ese dato, ¿querés que te contacte un agente?';

const KEYWORDS = {
  price: ['precio', 'precios', 'cuesta', 'cuestan', 'valor', 'vale', 'cuanto', 'cuanta', 'costo', 'coste'],
  location: ['ubicacion', 'ubicado', 'ubicada', 'donde', 'zona', 'direccion', 'barrio', 'ciudad', 'provincia', 'queda'],
  requirements: ['requisito', 'requisitos', 'documentacion', 'documentos', 'garantia', 'garantias', 'requiere', 'requieren'],
  description: ['descripcion', 'caracteristicas', 'caracteristica', 'ambientes', 'detalles', 'detalle', 'superficie', 'metros', 'dormitorios', 'banos'],
  visit: ['visita', 'visitar', 'ver', 'conocer', 'coordinar', 'agendar', 'recorrer'],
  agent: ['agente', 'persona', 'humano', 'humana', 'asesor', 'vendedor', 'inmobiliaria'],
  greeting: ['hola', 'buenas', 'buen', 'dia', 'tardes', 'noches'],
  affirmative: ['si', 'dale', 'ok', 'okey', 'claro', 'bueno', 'perfecto', 'confirmo'],
} as const;

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function words(value: string): Set<string> {
  return new Set(normalize(value).split(/[^a-z0-9]+/).filter(Boolean));
}

/**
 * Única fuente de verdad para las respuestas del asistente.
 * No accede a la base: recibe el lead hidratado y deja las acciones en `lead.actions`.
 * Se puede reemplazar por una IA manteniendo el mismo contrato `responder(mensaje, lead)`.
 */
export class KatyResponder {
  responder(mensaje: string, lead: Lead): string {
    const tokens = words(mensaje);
    const has = (list: readonly string[]) => list.some((word) => tokens.has(word));
    lead.nextPendingIntent = '';

    const asksAgent = has(KEYWORDS.agent);
    const asksPrice = has(KEYWORDS.price);
    const asksLocation = has(KEYWORDS.location);
    const asksRequirements = has(KEYWORDS.requirements);
    const asksDescription = has(KEYWORDS.description);
    const asksVisit = has(KEYWORDS.visit);
    const isGreeting = has(KEYWORDS.greeting);

    if (lead.pendingIntent === 'offer_agent' && has(KEYWORDS.affirmative)) {
      return this.agent(lead);
    }

    if (
      lead.pendingIntent === 'visit_date' &&
      !asksAgent &&
      !asksPrice &&
      !asksLocation &&
      !asksRequirements &&
      !asksDescription
    ) {
      return this.visitRequest(mensaje, lead);
    }

    if (asksAgent) return this.agent(lead);
    if (asksPrice) return this.price(lead);
    if (asksLocation) return this.location(lead);
    if (asksRequirements) return this.requirements(lead);
    if (asksDescription) return this.description(lead);
    if (asksVisit) return this.askVisitDate(lead);
    if (isGreeting) return `¡Hola ${lead.name || ''}! 👋 ${OPTIONS}`;

    lead.nextPendingIntent = 'offer_agent';
    return `${NO_DATA} ${OPTIONS}`;
  }

  private agent(lead: Lead): string {
    lead.actions.push({ type: 'agent' });
    return `Listo, un agente de la inmobiliaria te va a contactar a la brevedad. ${OPTIONS}`;
  }

  private price(lead: Lead): string {
    const price = lead.property?.price;
    if (!price) return `${NO_DATA} ${OPTIONS}`;
    return `El precio es ${price}. ${OPTIONS}`;
  }

  private location(lead: Lead): string {
    const location = lead.property?.location;
    if (!location) return `${NO_DATA} ${OPTIONS}`;
    return `La ubicación es ${location}. ${OPTIONS}`;
  }

  private requirements(lead: Lead): string {
    const requirements = lead.property?.requirements;
    if (!requirements) return `${NO_DATA} ${OPTIONS}`;
    return `Los requisitos son: ${requirements}. ${OPTIONS}`;
  }

  private description(lead: Lead): string {
    const description = lead.property?.description;
    if (!description) return `${NO_DATA} ${OPTIONS}`;
    return `La descripción de la propiedad es: ${description}. ${OPTIONS}`;
  }

  private askVisitDate(lead: Lead): string {
    if (!lead.property) return `${NO_DATA} ${OPTIONS}`;
    lead.nextPendingIntent = 'visit_date';
    return '¡Claro! Decime qué día y horario te quedan cómodos y dejo la solicitud registrada para que un agente te confirme a la brevedad.';
  }

  private visitRequest(mensaje: string, lead: Lead): string {
    if (!lead.property) return `${NO_DATA} ${OPTIONS}`;
    lead.actions.push({ type: 'visit_request', text: mensaje.trim() });
    return 'Listo, un agente te confirma a la brevedad.';
  }
}
