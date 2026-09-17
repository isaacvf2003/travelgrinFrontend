// app/api/travel-services/route.ts
import { prisma } from '@/app/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const items = await prisma.travelService.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: 100,
  });
  return NextResponse.json({ ok: true, items });
}

export async function POST(request: Request) {
  try {
    console.log('🔍 Iniciando creación de servicio...')
    
    
    const body = await request.json()
    console.log('📝 Datos recibidos:', body)
    
    const {
      taxonomyType,
      category,
      country,
      destinationCountry,
      whatSearching,
      whatStop,
      email,
      typeProfile,
      isOfrezco,
      isIntermediario,
      contanos,
      website
    } = body

    // Validación básica
    if (!email || !category) {
      return NextResponse.json(
        { error: 'Email and category are required' },
        { status: 400 }
      )
    }

    console.log('💾 Creando servicio en BD...')
    const service = await prisma.travelService.create({
      data: {
        taxonomyType: taxonomyType || 'oferente',
        category,
        country,
        destinationCountry: destinationCountry || '',
        whatSearching,
        whatStop,
        email,
        typeProfile,
        isOfrezco: isOfrezco || false,
        isIntermediario: isIntermediario || false,
        contanos,
        website
      },
    })

    console.log('✅ Servicio creado exitosamente:', service.id)
    return NextResponse.json(service, { status: 201 })
    
  } catch (error) {
    console.error('❌ Error detallado:', error)
    
    // Error más específico
    if (error instanceof Error) {
      return NextResponse.json(
        { 
          error: 'Error creating travel service',
          message: error.message,
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { error: 'Unknown error occurred' },
      { status: 500 }
    )
  }
  
}
