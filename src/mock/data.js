// 模拟数据：站点 / 舱 / 簇 / PACK 四级、告警、风险分、事故、证据
import dayjs from 'dayjs'

const stationNames = [
  '常熟新材料园储能站',
  '昆山光储一体站',
  '苏州工业园储能电站',
  '南通滨海风储一体站',
  '无锡惠山工商储项目',
  '徐州矿区储能调峰站'
]

const vendors = ['宁德时代', '比亚迪储能', '阳光电源', '海博思创', '亿纬锂能', '科华数能']

const fireSystems = ['七氟丙烷+水喷淋', '全氟己酮+水喷淋', 'PACK级灭火+水喷淋', '气体+液冷协同']

function rand(min, max) { return Math.random() * (max - min) + min }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

export const stations = stationNames.map((name, i) => {
  const cabins = 4 + Math.floor(Math.random() * 4)
  const clustersPerCabin = 4
  const packsPerCluster = 16
  return {
    id: `ST${1001 + i}`,
    name,
    location: ['江苏常熟', '江苏昆山', '江苏苏州', '江苏南通', '江苏无锡', '江苏徐州'][i],
    capacityMWh: 50 + i * 20,
    powerMW: 25 + i * 10,
    onlineDate: dayjs().subtract(180 + i * 60, 'day').format('YYYY-MM-DD'),
    vendor: pick(vendors),
    fireSystem: pick(fireSystems),
    cabins,
    clusters: cabins * clustersPerCabin,
    packs: cabins * clustersPerCabin * packsPerCluster,
    soh: Math.round(rand(91, 99) * 10) / 10,
    riskScore: Math.round(rand(62, 96)),
    insuranceStatus: pick(['已承保', '已承保', '待续保', '核保中']),
    insurancePolicy: `JT-2026-${10000 + i}`,
    annualPremium: Math.round(rand(80, 320)) + '万',
    coverage: Math.round(rand(2000, 6000)) + '万',
    alarmCount30d: Math.floor(rand(2, 28)),
    severeAlarm30d: Math.floor(rand(0, 4)),
    inspectionRate: Math.round(rand(88, 100)),
    rectifyRate: Math.round(rand(85, 100))
  }
})

export function buildStationTree(stationId) {
  const st = stations.find(s => s.id === stationId) || stations[0]
  const tree = {
    id: st.id,
    label: st.name,
    type: 'station',
    info: st,
    children: []
  }
  for (let c = 1; c <= st.cabins; c++) {
    const cabin = {
      id: `${st.id}-C${c.toString().padStart(2,'0')}`,
      label: `${c}#舱`,
      type: 'cabin',
      info: {
        cabinNo: c,
        temperature: +rand(22, 28).toFixed(1),
        humidity: +rand(35, 55).toFixed(0),
        smoke: +rand(0, 0.3).toFixed(2),
        h2: +rand(0, 50).toFixed(0),
        voc: +rand(0, 100).toFixed(0),
        fireStatus: '正常',
        gasPressure: +rand(11, 13).toFixed(1)
      },
      children: []
    }
    for (let cl = 1; cl <= 4; cl++) {
      const cluster = {
        id: `${cabin.id}-CL${cl}`,
        label: `${cl}#簇`,
        type: 'cluster',
        info: {
          voltage: +rand(740, 780).toFixed(1),
          current: +rand(-180, 180).toFixed(1),
          insulation: Math.floor(rand(2000, 8000)),
          power: +rand(-120, 120).toFixed(1),
          breakerStatus: '合闸',
          dailyEnergy: +rand(40, 80).toFixed(1)
        },
        children: []
      }
      for (let p = 1; p <= 16; p++) {
        cluster.children.push({
          id: `${cluster.id}-P${p.toString().padStart(2,'0')}`,
          label: `PACK-${p.toString().padStart(2,'0')}`,
          type: 'pack',
          info: {
            voltage: +rand(46, 48).toFixed(2),
            current: +rand(-20, 20).toFixed(1),
            temperatureMax: +rand(28, 36).toFixed(1),
            temperatureMin: +rand(24, 30).toFixed(1),
            cellVoltageMax: +rand(3.32, 3.38).toFixed(3),
            cellVoltageMin: +rand(3.28, 3.34).toFixed(3),
            soc: +rand(45, 92).toFixed(0),
            soh: +rand(92, 99).toFixed(1),
            insulation: Math.floor(rand(3000, 9000)),
            faultCode: '—'
          }
        })
      }
      cabin.children.push(cluster)
    }
    tree.children.push(cabin)
  }
  return tree
}

export const alarms = Array.from({ length: 18 }, (_, i) => {
  const st = pick(stations)
  return {
    id: 'AL' + (20000 + i),
    time: dayjs().subtract(i * 23, 'minute').format('YYYY-MM-DD HH:mm:ss'),
    stationId: st.id,
    stationName: st.name,
    location: `${pick(['1','2','3','4'])}#舱 / ${pick(['1','2','3','4'])}#簇 / PACK-${pick(['03','07','11','14'])}`,
    type: pick(['过温预警', '压差告警', '绝缘下降', '烟雾预警', 'SOC偏差', '消防故障', '通信中断']),
    level: pick(['严重', '重要', '一般', '一般', '提示']),
    status: pick(['未恢复', '已恢复', '已恢复', '处置中']),
    duration: Math.floor(rand(2, 90)) + ' min'
  }
})

export const evidences = Array.from({ length: 24 }, (_, i) => {
  const st = pick(stations)
  return {
    id: 'EV' + (30000 + i),
    stationName: st.name,
    type: pick(['承保设备基线', '关键阈值基线', '环境基线', '消防设施基线', '视觉图像基线']),
    createTime: dayjs().subtract(i * 3, 'day').format('YYYY-MM-DD HH:mm:ss'),
    hash: 'sha256:' + Math.random().toString(16).slice(2, 14) + Math.random().toString(16).slice(2, 14),
    chainHeight: 1827400 + i * 12,
    timestamp: dayjs().subtract(i * 3, 'day').format('YYYY-MM-DDTHH:mm:ssZ'),
    status: pick(['已上链', '已上链', '已上链', '已上链', '已固化']),
    fileSize: Math.floor(rand(15, 280)) + ' KB',
    operator: pick(['核保员A', '风控员C', '系统自动'])
  }
})

export const insuranceCases = stations.map(s => {
  const score = s.riskScore
  let level, rate, premium
  if (score >= 90) { level = '低风险'; rate = '0.85%'; premium = '标准费率' }
  else if (score >= 75) { level = '中低风险'; rate = '0.95%'; premium = '小幅优惠' }
  else if (score >= 60) { level = '中风险'; rate = '1.15%'; premium = '费率上浮' }
  else { level = '高风险'; rate = '—'; premium = '不予承保' }
  return {
    stationId: s.id,
    stationName: s.name,
    score,
    level,
    rate,
    premium,
    breakdown: {
      health: Math.round(rand(30, 40)),
      alarm: Math.round(rand(20, 30)),
      ops: Math.round(rand(13, 20)),
      env: Math.round(rand(7, 10))
    },
    suggestion: level === '高风险' ? '建议拒保 / 转专项评估' : (level === '中风险' ? '附加运维改造条件后承保' : '正常承保')
  }
})

export const renewals = stations.slice(0, 5).map((s, i) => {
  const trend = pick(['下降', '稳定', '稳定', '上升'])
  return {
    stationId: s.id,
    stationName: s.name,
    policy: s.insurancePolicy,
    expireDate: dayjs().add(20 - i * 4, 'day').format('YYYY-MM-DD'),
    daysToExpire: 20 - i * 4,
    lastYearScore: s.riskScore - Math.round(rand(-4, 4)),
    currentScore: s.riskScore,
    trend,
    suggestion: trend === '下降' ? '建议续保 / 费率下调 5%' : trend === '上升' ? '建议提价 8% 或限制条件' : '维持费率续保',
    runHours: Math.floor(rand(7800, 8400)),
    cycleCount: Math.floor(rand(280, 360))
  }
})

export const incidents = [
  { id: 'INC-2026-007', stationName: '常熟新材料园储能站', location: '2#舱 / 3#簇 / PACK-07', type: '电芯热失控预警', time: '2026-03-12 14:23:18', severity: '高', duration: '47 min', status: '已结案', loss: '0（成功阻断）', root: 'PACK-07 电芯一致性差 + 温度梯度异常' },
  { id: 'INC-2026-005', stationName: '昆山光储一体站', location: '1#舱 / 2#簇', type: '绝缘下降', time: '2026-02-28 09:11:02', severity: '中', duration: '1.5 h', status: '已结案', loss: '设备级', root: '簇内高压连接器受潮' },
  { id: 'INC-2026-003', stationName: '苏州工业园储能电站', location: '3#舱', type: '消防误动作', time: '2026-01-19 22:44:30', severity: '低', duration: '15 min', status: '已结案', loss: '0', root: '探测器灵敏度参数偏低' }
]

export const dashboardKpis = {
  insuredStations: stations.length,
  insuredCapacity: stations.reduce((a, b) => a + b.capacityMWh, 0),
  activeAlarms: alarms.filter(a => a.status !== '已恢复').length,
  evidenceCount: evidences.length,
  highRiskStations: stations.filter(s => s.riskScore < 75).length,
  upcomingRenewals: renewals.filter(r => r.daysToExpire <= 30).length,
  insuredAmount: '3.62 亿',
  premiumYTD: '1428 万'
}
