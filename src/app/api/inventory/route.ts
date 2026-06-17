import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    let inventory = await prisma.inventory.findFirst()
    if (!inventory) {
      inventory = await prisma.inventory.create({ data: { total: 0 } })
    }
    return NextResponse.json(inventory)
  } catch (error) {
    return NextResponse.json({ error: '获取库存失败' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { amount, note } = body

    const result = await prisma.$transaction(async (tx) => {
      let inventory = await tx.inventory.findFirst()
      if (!inventory) {
        inventory = await tx.inventory.create({ data: { total: 0 } })
      }

      // 增加库存
      const updatedInventory = await tx.inventory.update({
        where: { id: inventory.id },
        data: { total: inventory.total + Number(amount) }
      })

      // 记录入库流水
      await tx.inventoryTransaction.create({
        data: {
          type: 'IN',
          amount: Number(amount),
          note: note || '采购入库'
        }
      })

      return updatedInventory
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: '入库操作失败' }, { status: 500 })
  }
}
