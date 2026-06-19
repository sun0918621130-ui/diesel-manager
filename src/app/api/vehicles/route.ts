import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 1. 获取所有车辆列表
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

// 2. 添加新车辆
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

// 3. 修改车辆信息 (车牌号/车型)
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, plateNo, type } = body

    if (!id) {
      return NextResponse.json({ error: '缺少车辆ID' }, { status: 400 })
    }

    const updatedVehicle = await prisma.vehicle.update({
      where: { id: parseInt(id) },
      data: {
        plateNo: plateNo.toUpperCase().trim(),
        type,
      },
    })
    return NextResponse.json(updatedVehicle)
  } catch (error) {
    return NextResponse.json({ error: '修改车辆信息失败' }, { status: 500 })
  }
}

// 4. 删除车辆 (同步安全清理其名下的历史加油记录，防止外键报错)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const idStr = searchParams.get('id')

    if (!idStr) {
      return NextResponse.json({ error: '缺少车辆ID' }, { status: 400 })
    }

    const id = parseInt(idStr)

    // 使用数据库事务：确保加油记录和车辆本身同时安全删除，只要有一个失败就全部回滚
    await prisma.$transaction([
      prisma.fuelRecord.deleteMany({
        where: { vehicleId: id }
      }),
      prisma.vehicle.delete({
        where: { id: id }
      })
    ])

    return NextResponse.json({ message: '车辆及历史加油记录已成功清理' })
  } catch (error) {
    return NextResponse.json({ error: '删除车辆及关联记录失败' }, { status: 500 })
  }
}
