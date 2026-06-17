import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const records = await prisma.fuelRecord.findMany({
      include: {
        vehicle: true
      },
      orderBy: { date: 'desc' },
      take: 50 // 默认只取最近50条
    })
    return NextResponse.json(records)
  } catch (error) {
    return NextResponse.json({ error: '获取加油记录失败' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { vehicleId, amount, mileage } = body

    // 使用事务确保数据一致性：增加加油记录 + 扣减油库库存
    const result = await prisma.$transaction(async (tx) => {
      // 1. 创建加油记录
      const record = await tx.fuelRecord.create({
        data: {
          vehicleId: Number(vehicleId),
          amount: Number(amount),
          mileage: Number(mileage)
        }
      })

      // 2. 获取当前库存
      let inventory = await tx.inventory.findFirst()
      if (!inventory) {
        inventory = await tx.inventory.create({ data: { total: 0 } })
      }

      // 3. 检查库存是否充足
      if (inventory.total < amount) {
        throw new Error('油库库存不足')
      }

      // 4. 扣减库存
      await tx.inventory.update({
        where: { id: inventory.id },
        data: { total: inventory.total - amount }
      })

      // 5. 记录库存流水
      await tx.inventoryTransaction.create({
        data: {
          type: 'OUT',
          amount: Number(amount),
          note: `车辆加油出库 (记录ID: ${record.id})`
        }
      })

      return record
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '加油登记失败' }, { status: 500 })
  }
}
