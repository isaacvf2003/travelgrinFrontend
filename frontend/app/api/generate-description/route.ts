// app/api/generate-description/route.js

function cleanText(value) {
  return (value || '').toString().trim();
}

function truncateDescription(description, max = 500) {
  const clean = cleanText(description).replace(/\s+/g, ' ');

  if (clean.length <= max) {
    return clean;
  }

  const cutPoint = clean.lastIndexOf('.', max - 3);
  if (cutPoint > 250) {
    return clean.substring(0, cutPoint + 1);
  }

  return `${clean.substring(0, max - 3)}...`;
}

function buildDescription({ typeProfile, selectedCategory, actingAs, userMessage, currentDescription }) {
  const profile = cleanText(typeProfile) || 'oferente';
  const category = cleanText(selectedCategory) || 'servicios para viajeros con propósito';
  const role = cleanText(actingAs) || 'de forma directa';
  const baseText = cleanText(userMessage);
  const existing = cleanText(currentDescription);

  const opening = `Somos ${profile} y actuamos ${role} en ${category}.`;
  const body = existing
    ? `${existing} ${baseText}`
    : baseText;
  const closing = 'Brindamos información clara y acompañamiento responsable para generar confianza en viajeros internacionales.';

  return truncateDescription(`${opening} ${body} ${closing}`);
}

export async function POST(request) {
  try {
    const {
      typeProfile,
      selectedCategory,
      actingAs,
      userMessage,
      currentDescription,
    } = await request.json();

    if (!userMessage) {
      return Response.json(
        { error: 'Se requiere información sobre el servicio' },
        { status: 400 }
      );
    }

    const description = buildDescription({
      typeProfile,
      selectedCategory,
      actingAs,
      userMessage,
      currentDescription,
    });

    return Response.json({
      description,
      characterCount: description.length,
      generatedWith: 'local-template',
    });
  } catch (error) {
    console.error('Error al generar descripción:', error);

    return Response.json(
      { error: 'Error al generar la descripción. Intenta nuevamente.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json(
    { error: 'Método no permitido. Usa POST.' },
    { status: 405 }
  );
}
