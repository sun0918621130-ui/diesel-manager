'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Fuel, Truck, AlertCircle, Database } from 'lucide-react'

export default function Home() {
  const [vehicles, setVehicles] = useState<any[]>([])
  const [inventory, setInventory] = useState<any>(null)
  
  // 表单状态
  const [selectedVehicle, setSelectedVehicle] = useState('')
  const [amount, setAmount] = useState('')
  const [mileage, setMileage] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [vehiclesRes, inventoryRes] = await Promise.all([
        fetch('/api/vehicles'),
        fetch('/api/inventory')
      ])
      const vehiclesData = await vehiclesRes.json()
      const inventoryData = await inventoryRes.json()
      
      setVehicles(vehiclesData)
      setInventory(inventoryData)
    } catch (error) {
      console.error('获取数据失败', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedVehicle || !amount || !mileage) {
      setMessage({ type: 'error', text: '请填写所有必填项' })
      return
    }

    setLoading(true)
    setMessage({ type: '', text: '' })

    try {
      const res = await fetch('/api/fuel-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId: selectedVehicle,
          amount,
          mileage
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || '提交失败')
      }

      setMessage({ type: 'success', text: '加油记录登记成功！' })
      setAmount('')
      setMileage('')
      setSelectedVehicle('')
      fetchData() // 刷新库存
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      {/* 顶部标题栏 */}
      <header className="bg-blue-600 text-white p-4 shadow-md">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Fuel className="h-6 w-6" />
            <h1 className="text-xl font-bold">工厂柴油管理系统</h1>
          </div>
        </div>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-6">
        {/* 库存看板卡片 */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex items-center gap-2 text-gray-600 mb-2">
            <Database className="h-5 w-5 text-blue-500" />
            <h2 className="font-semibold">油库当前库存</h2>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-gray-900">
              {inventory ? inventory.total.toFixed(2) : '0.00'}
            </span>
            <span className="text-gray-500 font-medium">升</span>
          </div>
          {inventory?.total < 500 && (
            <div className="mt-3 flex items-center gap-1 text-red-500 text-sm bg-red-50 p-2 rounded-md">
              <AlertCircle className="h-4 w-4" />
              <span>库存不足 500 升，请及时采购！</span>
            </div>
          )}
        </div>

        {/* 加油登记表单 */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex items-center gap-2 text-gray-600 mb-5">
            <Truck className="h-5 w-5 text-blue-500" />
            <h2 className="font-semibold text-lg">车辆加油登记</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                选择车辆 <span className="text-red-500">*</span>
              </label>
              <select
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedVehicle}
                onChange={(e) => setSelectedVehicle(e.target.value)}
                disabled={loading}
              >
                <option value="">-- 请选择车辆 --</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.plateNo} ({v.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                加油量 (升) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                step="0.01"
                min="0.1"
                placeholder="例如: 50.5"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                当前仪表盘里程/工时 <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                step="0.1"
                min="0"
                placeholder="例如: 12500"
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
                disabled={loading}
              />
            </div>

            {message.text && (
              <div className={`p-3 rounded-md text-sm ${
                message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
              }`}>
                {message.text}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-12 text-lg font-medium mt-2"
              disabled={loading}
            >
              {loading ? '正在登记...' : '确认登记扣减库存'}
            </Button>
          </form>
        </div>
      </div>
    </main>
  )
}
