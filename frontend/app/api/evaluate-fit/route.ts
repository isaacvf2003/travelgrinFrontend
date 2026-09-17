// app/api/evaluate-fit/route.js

const VALID_CATEGORIES = [
  'Gestiones migratorias y visas',
  'Educación y centros de estudio',
  'Empleos temporales',
  'Centros médicos, salud y bienestar',
  'Emprende y negocios',
  'Voluntariados y centros de ayuda',
  'Deporte y entrenamiento',
];

function includesRiskyClaims(text) {
  if (!text) return false;

  const riskyPatterns = [
    /garantiz/i,
    /100%/i,
    /sin\s+r[ie]esgo/i,
    /resultado\s+asegurado/i,
    /documentos\s+fals/i,
    /ilegal/i,
    /fraude/i,
  ];

  return riskyPatterns.some((pattern) => pattern.test(text));
}

function evaluateQualification({ selectedCategory, contanos, website, destinationCountry, country }) {
  const text = `${selectedCategory || ''} ${contanos || ''}`.trim();
  const hasDescription = !!contanos && contanos.trim().length >= 50;
  const hasWebsite = !!website;
  const hasTravelContext = !!destinationCountry || !!country;
  const hasValidCategory = !!selectedCategory && VALID_CATEGORIES.includes(selectedCategory);
  const hasRiskyClaims = includesRiskyClaims(text);

  if (hasRiskyClaims) {
    return {
      qualifies: 'NO',
      message:
        'Por ahora no califica porque detectamos promesas o señales que no se alinean con Travelgrin. Si ajustas tu propuesta con información clara y sin garantías, puedes volver a intentarlo.',
      fitScore: 3,
    };
  }

  if (!hasValidCategory && selectedCategory) {
    return {
      qualifies: 'NO',
      message:
        'Tu categoría actual no coincide con las categorías activas de Travelgrin. Si la ajustas a una categoría válida, podrás continuar sin problema.',
      fitScore: 4,
    };
  }

  if (hasDescription && (hasValidCategory || !selectedCategory) && hasTravelContext) {
    return {
      qualifies: 'YES',
      message:
        'Tu perfil parece alineado con Travelgrin. Puedes continuar con tu registro y nuestro equipo hará una revisión final.',
      fitScore: 8,
    };
  }

  return {
    qualifies: 'YES',
    message:
      'Puedes continuar con tu registro. Para mejorar tu evaluación, agrega más detalle de tu servicio, su enfoque internacional y cómo ayudas a viajeros con propósito.',
    fitScore: 6,
  };
}

export async function POST(request) {
  try {
    const {
      typeProfile,
      selectedCategory,
      isOfrezco,
      destinationCountry,
      contanos,
      website,
      country,
    } = await request.json();

    const result = evaluateQualification({
      selectedCategory,
      contanos,
      website,
      destinationCountry,
      country,
    });

    const recommendations = [];

    if (!contanos || contanos.length < 50) {
      recommendations.push('Completa tu descripción con más detalles sobre tu servicio');
    }

    if (!website) {
      recommendations.push('Agrega tu sitio web para generar más confianza');
    }

    if (!selectedCategory) {
      recommendations.push('Define claramente en qué categoría encaja tu servicio');
    }

    return Response.json({
      evaluation: result.message,
      qualifies: result.qualifies === 'YES',
      fitScore: result.fitScore,
      recommendations: recommendations.slice(0, 3),
      profileAnalysis: {
        typeProfile,
        selectedCategory,
        hasWebsite: !!website,
        hasDescription: !!contanos,
        offersDirectly: isOfrezco,
      },
    });
  } catch (error) {
    console.error('Error en evaluate-fit:', error);

    return Response.json(
      { error: 'Error al evaluar tu perfil. Intenta nuevamente.' },
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
