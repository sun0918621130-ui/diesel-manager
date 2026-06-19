"use client"

import React, { useState, useEffect } from "react"

interface Vehicle {
  id: number
  plateNo: string
  type: string
}

interface FuelRecord {
  id: number
  vehicleId: number
  vehicle: {
    plateNo: string
    type: string
  }
  amount: number
  mileage: number
  date: string
}

interface VehicleStat {
  id: number
  plateNo: string
  type: string
  totalFuel: number
  refuelCount: number
  latestMileage: number
  mileageDiff: number
  avgConsumption: string // 计算后的油耗字符串
}

export default function Dashboard() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [records, setRecords] = useState<FuelRecord[]>([])
  const [inventory, setInventory] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  // 车辆编辑模式状态
  const [editVehicleId, setEditVehicleId] = useState<number | null>(null)

  // 表单状态
  const [refuelForm, setRefuelForm] = useState({ vehicleId: "", amount: "", mileage: "" })
  const [vehicleForm, setVehicleForm] = useState({ plateNo: "", type: "叉车" })
  const [stockForm, setStockForm] = useState({ amount: "", note: "" })

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const showMsg = (type: "success" | "error", text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  // 从后端 API 拉取最新数据
  const fetchData = async () => {
    setLoading(true)
    try {
      const [invRes, vehRes, recRes] = await Promise.all([
        fetch("/api/inventory"),
        fetch("/api/vehicles"),
        fetch("/api/fuel-records")
      ])
      
      const invData = await invRes.json()
      const vehData = await vehRes.json()
      const recData = await recRes.json()

      setInventory(invData.total || invData[0]?.total || 0)
      setVehicles(Array.isArray(vehData) ? vehData : [])
      setRecords(Array.isArray(recData) ? recData : [])
    } catch (err) {
      console.error(err)
      showMsg("error", "数据加载失败，请刷新页面重试")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // 1. 加油登记提交
  const handleRefuelSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!refuelForm.vehicleId || !refuelForm.amount || !refuelForm.mileage) {
      showMsg("error", "请填写完整的加油登记信息")
      return
    }
    const amountNum = parseFloat(refuelForm.amount)
    if (amountNum > inventory) {
      showMsg("error", `库存不足！当前总库存仅剩 ${inventory.toFixed(2)} 升`)
      return
    }

    try {
      const res = await fetch("/api/fuel-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: parseInt(refuelForm.vehicleId),
          amount: amountNum,
          mileage: parseFloat(refuelForm.mileage)
        })
      })
      if (!res.ok) throw new Error("加油登记失败")
      showMsg("success", "加油登记成功，库存已自动扣减")
      setRefuelForm({ vehicleId: "", amount: "", mileage: "" })
      fetchData()
    } catch (err) {
      showMsg("error", "登记过程中数据库写入出错，请重试")
    }
  }

  // 2. 登记/修改 车辆提交
  const handleVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vehicleForm.plateNo.trim() || !vehicleForm.type) {
      showMsg("error", "车牌号不能为空")
      return
    }

    const formattedPlateNo = vehicleForm.plateNo.toUpperCase().trim()

    try {
      if (editVehicleId !== null) {
        // 修改模式 (PUT)
        const res = await fetch("/api/vehicles", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editVehicleId,
            plateNo: formattedPlateNo,
            type: vehicleForm.type
          })
        })
        if (!res.ok) throw new Error("修改车辆信息失败")
        showMsg("success", "车辆档案更新成功")
        setEditVehicleId(null)
      } else {
        // 新增模式 (POST)
        const res = await fetch("/api/vehicles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plateNo: formattedPlateNo,
            type: vehicleForm.type
          })
        })
        if (!res.ok) {
          const errorData = await res.json()
          throw new Error(errorData.error || "新增车辆失败")
        }
        showMsg("success", "新车辆登记成功")
      }
      setVehicleForm({ plateNo: "", type: "叉车" })
      fetchData()
    } catch (err: any) {
      showMsg("error", err.message || "登记出错，车牌号可能已经存在")
    }
  }

  // 激活修改车辆模式
  const startEditVehicle = (vehicle: Vehicle) => {
    setEditVehicleId(vehicle.id)
    setVehicleForm({
      plateNo: vehicle.plateNo,
      type: vehicle.type
    })
    window.scrollTo({ top: 300, behavior: 'smooth' }) // 平滑滚动到编辑区
  }

  // 取消修改车辆模式
  const cancelEditVehicle = () => {
    setEditVehicleId(null)
    setVehicleForm({ plateNo: "", type: "叉车" })
  }

  // 3. 删除车辆登记 (带事务防外键报错安全机制)
  const handleDeleteVehicle = async (vehicle: Vehicle) => {
    const isConfirmed = window.confirm(
      `⚠️ 警告！确定要彻底删除车辆【${vehicle.plateNo}】吗？\n\n这将会一并永久清理该车辆关联的历史加油记录，且不可恢复！`
    )
    if (!isConfirmed) return

    try {
      const res = await fetch(`/api/vehicles?id=${vehicle.id}`, {
        method: "DELETE"
      })
      if (!res.ok) throw new Error("删除失败")
      
      showMsg("success", `车辆 ${vehicle.plateNo} 及其关联的历史数据已被彻底清理`)
      
      // 如果被删除的车辆当前刚好被选中在加油下拉框中，则重置它
      if (refuelForm.vehicleId === vehicle.id.toString()) {
        setRefuelForm({ ...refuelForm, vehicleId: "" })
      }
      
      // 如果正在编辑这辆车，也退出编辑状态
      if (editVehicleId === vehicle.id) {
        cancelEditVehicle()
      }

      fetchData()
    } catch (err) {
      showMsg("error", "删除失败，请刷新网页重试")
    }
  }

  // 4. 登记采购补油入库
  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stockForm.amount || parseFloat(stockForm.amount) <= 0) {
      showMsg("error", "请输入有效的入库油量")
      return
    }
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(stockForm.amount),
          type: "IN",
          note: stockForm.note || "常规补油采购"
        })
      })
      if (!res.ok) throw new Error("登记入库失败")
      showMsg("success", "柴油进货登记成功，库存已累加")
      setStockForm({ amount: "", note: "" })
      fetchData()
    } catch (err) {
      showMsg("error", "入库登记出错，请确认网络并重试")
    }
  }

  // 5. 核心：计算每台车辆的年度累计油耗与平均每百公里/每小时能耗
  const calculateVehicleStats = (): VehicleStat[] => {
    return vehicles.map(v => {
      // 筛选出该车辆名下的所有加油记录
      const vRecords = records.filter(r => r.vehicleId === v.id)
      
      // 计算累计加油量 (升)
      const totalFuel = vRecords.reduce((sum, r) => sum + r.amount, 0)
      
      // 加油次数
      const refuelCount = vRecords.length

      // 提取所有有效的里程/工时记录
      const mileages = vRecords.map(r => r.mileage).filter(val => val !== undefined && val !== null)
      
      let latestMileage = 0
      let mileageDiff = 0
      let avgConsumption = "暂无计算数据"

      if (mileages.length > 0) {
        latestMileage = Math.max(...mileages)
      }

      if (mileages.length >= 2) {
        // 里程差值 = 最大里程 - 最小里程 (代表累积跑了多少公里/工时)
        const minMileage = Math.min(...mileages)
        const maxMileage = Math.max(...mileages)
        mileageDiff = maxMileage - minMileage

        if (mileageDiff > 0) {
          if (v.type === "叉车" || v.type === "挖掘机") {
            // 工时类车辆：核算 平均每工时消耗多少升 (L/小时)
            const efficiency = totalFuel / mileageDiff
            avgConsumption = `${efficiency.toFixed(2)} 升 / 小时`
          } else {
            // 路面运输车辆：核算 典型百公里油耗 (L/100km)
            const efficiency = (totalFuel / mileageDiff) * 100
            avgConsumption = `${efficiency.toFixed(2)} 升 / 百公里`
          }
        } else {
          avgConsumption = "里程数无变化"
        }
      } else if (mileages.length === 1) {
        avgConsumption = "需要至少2次加油记录计算"
      }

      return {
        id: v.id,
        plateNo: v.plateNo,
        type: v.type,
        totalFuel,
        refuelCount,
        latestMileage,
        mileageDiff,
        avgConsumption
      }
    })
  }

  const vehicleStats = calculateVehicleStats()

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* 顶部导航栏 */}
      <header className="bg-blue-600 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8 text-blue-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <div>
              <h1 className="text-xl font-bold tracking-wide">工厂车辆柴油管理系统</h1>
              <p className="text-xs text-blue-100 mt-0.5">一体化轻量智能工作看板</p>
            </div>
          </div>
          <button 
            onClick={fetchData} 
            disabled={loading}
            className="flex items-center gap-1 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-600 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          >
            <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 15.89M9 11l3-3 3 3m-3-3v12" />
            </svg>
            {loading ? "同步中..." : "同步数据"}
          </button>
        </div>
      </header>

      {/* 主体容器 */}
      <main className="max-w-6xl mx-auto px-4 mt-6">
        {/* 系统提示 */}
        {message && (
          <div className={`p-4 rounded-lg mb-6 shadow-sm border transition-all ${
            message.type === "success" 
              ? "bg-green-50 border-green-200 text-green-700" 
              : "bg-red-50 border-red-200 text-red-700"
          }`}>
            <p className="font-semibold text-sm">{message.text}</p>
          </div>
        )}

        {/* 顶部三个核心数据卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* 库存卡片 */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">总油库当前库存</p>
              <h3 className="text-3xl font-bold mt-1 text-gray-800">
                {inventory.toFixed(2)} <span className="text-lg font-normal text-gray-500">升</span>
              </h3>
              {inventory < 500 ? (
                <span className="inline-block mt-2 px-2.5 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full animate-pulse">
                  ⚠️ 库存告急 (不足 500L)
                </span>
              ) : (
                <span className="inline-block mt-2 px-2.5 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                  ✅ 库存充沛
                </span>
              )}
            </div>
            <div className="bg-blue-50 p-4 rounded-full text-blue-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 9.172V5L8 4z" />
              </svg>
            </div>
          </div>

          {/* 车辆数卡片 */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">已登记车辆总数</p>
              <h3 className="text-3xl font-bold mt-1 text-gray-800">
                {vehicles.length} <span className="text-lg font-normal text-gray-500">辆</span>
              </h3>
              <p className="text-xs text-gray-400 mt-2">支持叉车、挖掘机、货车管理</p>
            </div>
            <div className="bg-amber-50 p-4 rounded-full text-amber-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10M13 16h4l4-4v4" />
              </svg>
            </div>
          </div>

          {/* 加油次数卡片 */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">累计加油次数</p>
              <h3 className="text-3xl font-bold mt-1 text-gray-800">
                {records.length} <span className="text-lg font-normal text-gray-500">次</span>
              </h3>
              <p className="text-xs text-gray-400 mt-2">系统底层自动建档核算</p>
            </div>
            <div className="bg-emerald-50 p-4 rounded-full text-emerald-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
          </div>
        </div>

        {/* 核心操作区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* 左侧栏 —— 加油及采购表单（占 7 格） */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* 表单 1：车辆加油登记 */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 pb-4 mb-4 border-b border-gray-100 text-gray-800">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <h2 className="font-bold text-lg">车辆加油登记（自动扣减总库）</h2>
              </div>
              <form onSubmit={handleRefuelSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">选择加水/加油车辆 <span className="text-red-500">*</span></label>
                  <select 
                    value={refuelForm.vehicleId}
                    onChange={(e) => setRefuelForm({ ...refuelForm, vehicleId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">-- 请选择车辆 --</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.plateNo} ({v.type})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">本次加油量 (升) <span className="text-red-500">*</span></label>
                    <input 
                      type="number" 
                      step="0.01"
                      placeholder="例如: 50.5"
                      value={refuelForm.amount}
                      onChange={(e) => setRefuelForm({ ...refuelForm, amount: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">当前里程/累计工时 <span className="text-red-500">*</span></label>
                    <input 
                      type="number" 
                      step="0.1"
                      placeholder="例如: 12500"
                      value={refuelForm.mileage}
                      onChange={(e) => setRefuelForm({ ...refuelForm, mileage: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5"
                >
                  确认加油并扣减总库
                </button>
              </form>
            </div>

            {/* 表单 2：油库采购进货 */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 pb-4 mb-4 border-b border-gray-100 text-gray-800">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="font-bold text-lg">油库补油登记（采购入库）</h2>
              </div>
              <form onSubmit={handleStockSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">采购进货油量 (升) <span className="text-red-500">*</span></label>
                    <input 
                      type="number" 
                      step="0.01"
                      placeholder="例如: 1000"
                      value={stockForm.amount}
                      onChange={(e) => setStockForm({ ...stockForm, amount: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">进货备注 / 经手人</label>
                    <input 
                      type="text" 
                      placeholder="例如: 中石化进货/采购部"
                      value={stockForm.note}
                      onChange={(e) => setStockForm({ ...stockForm, note: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5"
                >
                  登记并增加总库存
                </button>
              </form>
            </div>

          </div>

          {/* 右侧栏 —— 车辆登记及档案（占 5 格） */}
          <div className="lg:col-span-5 space-y-8">
            
            {/* 表单 3：新增/修改车辆 */}
            <div className={`p-6 rounded-xl shadow-sm border transition-all ${
              editVehicleId !== null ? "bg-amber-50/40 border-amber-200" : "bg-white border-gray-100"
            }`}>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100 text-gray-800">
                <div className="flex items-center gap-2">
                  <svg className={`w-5 h-5 ${editVehicleId !== null ? "text-amber-600" : "text-blue-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  <h2 className="font-bold text-lg">
                    {editVehicleId !== null ? "修改车辆档案信息" : "新增车辆档案建档"}
                  </h2>
                </div>
                {editVehicleId !== null && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded">修改模式</span>
                )}
              </div>
              <form onSubmit={handleVehicleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">车牌号 <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      placeholder="例如: 粤B12345"
                      value={vehicleForm.plateNo}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, plateNo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">车辆类别</label>
                    <select 
                      value={vehicleForm.type}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                    >
                      <option value="叉车">叉车</option>
                      <option value="挖掘机">挖掘机</option>
                      <option value="货车">货车</option>
                      <option value="其他">其他</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    type="submit"
                    className={`flex-1 text-white py-2.5 rounded-lg font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5 ${
                      editVehicleId !== null ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-600 hover:bg-blue-750"
                    }`}
                  >
                    {editVehicleId !== null ? "确认保存修改" : "登记该车辆"}
                  </button>
                  {editVehicleId !== null && (
                    <button 
                      type="button"
                      onClick={cancelEditVehicle}
                      className="px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-all"
                    >
                      取消
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* 车辆列表明细 (带修改、删除功能) */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-800 pb-3 mb-3 border-b border-gray-100">已登记车辆管理列表 ({vehicles.length})</h2>
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {vehicles.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">系统暂未录入任何车辆</p>
                ) : (
                  vehicles.map(v => (
                    <div key={v.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-gray-800 tracking-wide">{v.plateNo}</span>
                        <span className="text-xs text-gray-400">分类：{v.type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* 修改按钮 */}
                        <button
                          onClick={() => startEditVehicle(v)}
                          title="修改车辆档案"
                          className="p-1.5 bg-white border border-gray-200 hover:border-amber-400 hover:text-amber-600 text-gray-500 rounded shadow-sm transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        {/* 删除按钮 */}
                        <button
                          onClick={() => handleDeleteVehicle(v)}
                          title="报废并清除车辆加油记录"
                          className="p-1.5 bg-white border border-gray-200 hover:border-red-400 hover:text-red-600 text-gray-500 rounded shadow-sm transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>

        {/* 💥 新模块：车辆能耗年度/累计统计分析排行榜 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-8">
          <div className="flex justify-between items-center pb-4 mb-4 border-b border-gray-100">
            <div className="flex items-center gap-2 text-gray-800">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <div>
                <h2 className="font-bold text-lg">车辆累计用能与能耗核算排行榜</h2>
                <p className="text-xs text-gray-400 mt-0.5">工时类车辆展现【升/小时】，运输类车辆展现百公里油耗【升/百公里】</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded">智能核算引擎 v2.0</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
                  <th className="py-3 px-4">车牌号</th>
                  <th className="py-3 px-4">车辆类型</th>
                  <th className="py-3 px-4">累计加油总量</th>
                  <th className="py-3 px-4">加油频次</th>
                  <th className="py-3 px-4">最后登记里程/工时</th>
                  <th className="py-3 px-4 text-amber-700">平均核算能耗</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-gray-700">
                {vehicleStats.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400">暂无车辆数据，请先录入车辆档案</td>
                  </tr>
                ) : (
                  vehicleStats.map(stat => (
                    <tr key={stat.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-gray-800">{stat.plateNo}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 bg-gray-100 border border-gray-200 text-gray-600 text-xs rounded">
                          {stat.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-gray-900">{stat.totalFuel.toFixed(2)} 升</td>
                      <td className="py-3.5 px-4 text-gray-500">{stat.refuelCount} 次</td>
                      <td className="py-3.5 px-4 text-gray-600">{stat.latestMileage}</td>
                      <td className="py-3.5 px-4 font-bold text-amber-700">
                        {stat.avgConsumption}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 底部明细 —— 最近加油记录流水 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-8">
          <div className="flex justify-between items-center pb-4 mb-4 border-b border-gray-100">
            <div className="flex items-center gap-2 text-gray-800">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h2 className="font-bold text-lg">最近加油记录交易流水</h2>
            </div>
            <span className="text-xs text-gray-400">系统实时记录</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
                  <th className="py-3 px-4">加油完成时间</th>
                  <th className="py-3 px-4">加油车牌</th>
                  <th className="py-3 px-4">车型</th>
                  <th className="py-3 px-4">加油量</th>
                  <th className="py-3 px-4">本次仪表盘里程/工时</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-gray-700">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-gray-400 font-medium">暂无加油记录数据，请在上方进行加油登记</td>
                  </tr>
                ) : (
                  records.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3.5 px-4 text-gray-500">
                        {new Date(r.date).toLocaleString("zh-CN", { hour12: false })}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-gray-800 tracking-wide">{r.vehicle?.plateNo || "已删除车辆"}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 bg-gray-100 border border-gray-200 text-gray-600 text-xs rounded">
                          {r.vehicle?.type || "未知"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-blue-600">-{r.amount.toFixed(2)} 升</td>
                      <td className="py-3.5 px-4 font-semibold text-gray-600">{r.mileage}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
