import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const vehicles = await prisma.vehicle.findMany({
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(vehicles)
  } catch (error) {
    return NextResponse.json({ error: '获取车辆列表失败' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { plateNo, type } = body

    const vehicle = await prisma.vehicle.create({
      data: {
        plateNo,
        type,
      },
    })
    return NextResponse.json(vehicle)
  } catch (error) {
    return NextResponse.json({ error: '添加车辆失败' }, { status: 500 })
  }
}
