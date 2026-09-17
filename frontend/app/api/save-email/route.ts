// app/api/travel-services/route.ts
import { prisma } from '@/app/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    console.log('🔍 Iniciando creación de servicio...')
    
    
    const body = await request.json()
    console.log('📝 Datos recibidos:', body)
    
    const {
      email
    } = body

    // Validación básica
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    console.log('💾 Creando servicio en BD...')
    const service = await prisma.emails.create({
      data: {
        email
      },
    })

    console.log('✅ Email creado exitosamente:', service.id)
    return NextResponse.json(service, { status: 201 })
    
  } catch (error) {
    console.error('❌ Error detallado:', error)
    
    // Error más específico
    if (error instanceof Error) {
      return NextResponse.json(
        { 
          error: 'Error creating email',
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
