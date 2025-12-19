import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { 
  createInstance, 
  getInstanceQRCode, 
  getInstanceStatus, 
  getInstanceInfo,
  listInstances,
  deleteInstance,
  setWebhook,
} from '@/lib/evolution'
import { isEvolutionConfigured } from '@/lib/env'
import { recordMetric } from '@/lib/metrics'

// Listar instâncias
export async function GET() {
  try {
    // Buscar do banco de dados
    const dbInstances = await prisma.whatsAppInstance.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            messages: true,
            authorizedNumbers: true,
          },
        },
      },
    })

    // Se Evolution estiver configurada, sincronizar status de TODAS as instâncias
    if (isEvolutionConfigured()) {
      const evolutionInstances = await listInstances()
      
      // Atualizar status de cada instância verificando diretamente na Evolution
      for (const dbInstance of dbInstances) {
        try {
          // Evolution retorna "name" e não "instanceName"
          const evolutionInstance = evolutionInstances.find(
            (e) => (e.name || e.instanceName) === dbInstance.instanceName
          )
          
          if (evolutionInstance) {
            const status = await getInstanceStatus(dbInstance.instanceName)
            const isConnected = status?.state === 'open'
            
            // Se está conectado, buscar informações do dispositivo
            let updateData: { status: string; phoneNumber?: string; qrCode?: string | null } = {
              status: isConnected ? 'connected' : 'disconnected',
            }
            
            if (isConnected) {
              const info = await getInstanceInfo(dbInstance.instanceName)
              if (info?.phoneNumber || info?.owner) {
                updateData.phoneNumber = info.phoneNumber || info.owner
              }
              // Limpar QR Code quando conectado
              updateData.qrCode = null
            }
            
            await prisma.whatsAppInstance.update({
              where: { id: dbInstance.id },
              data: updateData,
            })
          }
        } catch (instanceError) {
          console.error(`[Instances] Erro ao verificar ${dbInstance.instanceName}:`, instanceError)
        }
      }
    }

    // Buscar novamente com status atualizado
    const instances = await prisma.whatsAppInstance.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            messages: true,
            authorizedNumbers: true,
          },
        },
      },
    })

    return NextResponse.json({ instances })
  } catch (error) {
    console.error('[Instances] Erro ao listar:', error)
    return NextResponse.json({ error: 'Erro ao listar instâncias' }, { status: 500 })
  }
}

// Criar nova instância
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { instanceName } = body

    if (!instanceName) {
      return NextResponse.json(
        { error: 'Nome da instância é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar se já existe
    const existing = await prisma.whatsAppInstance.findUnique({
      where: { instanceName },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Já existe uma instância com este nome' },
        { status: 400 }
      )
    }

    let qrCode = null

    // Criar no Evolution se configurado
    if (isEvolutionConfigured()) {
      await createInstance(instanceName)
      
      // Configurar webhook
      const webhookUrl = `${process.env.NEXTAUTH_URL}/api/webhook/evolution`
      await setWebhook(instanceName, webhookUrl)
      
      // Obter QR Code
      const qrResponse = await getInstanceQRCode(instanceName)
      qrCode = qrResponse?.base64 || null
    }

    // Salvar no banco
    const instance = await prisma.whatsAppInstance.create({
      data: {
        instanceName,
        status: 'disconnected',
        qrCode,
      },
    })

    await recordMetric('api_request', 1, { action: 'create_instance' })

    return NextResponse.json({ instance })
  } catch (error) {
    console.error('[Instances] Erro ao criar:', error)
    await recordMetric('error', 1, { action: 'create_instance', error: String(error) })
    return NextResponse.json({ error: 'Erro ao criar instância' }, { status: 500 })
  }
}

// Deletar instância
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id },
    })

    if (!instance) {
      return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })
    }

    // Deletar no Evolution se configurado
    if (isEvolutionConfigured()) {
      await deleteInstance(instance.instanceName)
    }

    // Deletar do banco
    await prisma.whatsAppInstance.delete({
      where: { id },
    })

    await recordMetric('api_request', 1, { action: 'delete_instance' })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Instances] Erro ao deletar:', error)
    return NextResponse.json({ error: 'Erro ao deletar instância' }, { status: 500 })
  }
}
