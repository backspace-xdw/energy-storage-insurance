# 储能保险承保运营数据管理与分析平台

> 基于建议书《储能电站消防数据应用分析平台建议书v2.docx》构建的前端原型。
> UI 风格参考 [aisafer.com](https://www.aisafer.com/)：深色顶栏 + 白底主体 + 蓝/青强调色。

## 技术栈

- Vue 3 + Vite 5
- Element Plus 2.8（中文 locale）
- ECharts 5.5（雷达 / 趋势 / 热力 / 仪表 / 饼图）
- Vue Router 4（hash 模式）
- Pinia 2
- Sass（变量主题）

## 启动

```bash
cd /home/shenzheng/XDW/energy-storage-insurance
npm install
npm run dev      # http://localhost:5180
npm run build    # 产物 dist/
```

## 路由结构

| 路径 | 模块 | 说明 |
|------|------|------|
| `/` | Landing | 企业风官网（hero + 痛点 + 六大能力 + 六层架构 + 站-舱-簇-PACK 对接 + 实施计划 + 价值 + CTA） |
| `/app/dashboard` | 平台总览 | 8 KPI · 风险分布 · 告警趋势 · 站点排行 · 实时告警 |
| `/app/devices` | 承保设备管理 | 站点列表 + 站-舱-簇-PACK 四级树 + 详情面板 |
| `/app/evidence` | 承保证据固化 | 哈希 / 区块高度 / 时间戳 / 校验 / 抽屉详情（含证据 JSON 预览） |
| `/app/underwriting` | 自主核保 | 四维评分雷达 · 评分明细 · 12 月趋势 · 行业对比 · 自动决策 |
| `/app/renewal` | 智能续保 | 到期列表 · 风险趋势 · 告警热力 · 自动策略 |
| `/app/incident` | 事故溯源 | 事故列表 · 时间线 · 温度/绝缘曲线对齐 · 根因分析 |
| `/app/risk` | 风险监测 | 实时风险指数 · 站点×时段热力 · 六维雷达 · 告警明细 |
| `/app/system` | 系统管理 | 用户 / 角色权限 / 接口对接状态 / 审计日志 / 平台设置 |

## 设计要点

- **配色** — 顶栏 `#10152e`，主蓝 `#015eea`，强调青 `#06b6d4`，警示 `#ef4444 / #f59e0b`，健康 `#22d3a0`
- **字体** — PingFang SC，数字用 montserrat-medium
- **卡片** — 圆角 10px，`0 4px 24px rgba(16,21,46,.06)` 阴影；hover 上抬+阴影加深
- **栅格** — Landing 1240px 容器；Console 24/28px 边距，KPI 4 列 / 主区 3 列
- **图表** — 统一 `#015eea/#06b6d4/#6366f1/#22d3a0/#f59e0b/#ef4444` 系列色，渐变填充

## 目录结构

```
src/
├── components/        # PageHeader · KpiCard · ChartCard
├── layouts/           # ConsoleLayout（左侧导航+顶部 header）
├── mock/data.js       # 站点/告警/证据/核保/续保/事故 mock 数据
├── router/            # vue-router 路由
├── styles/            # variables.scss · index.scss（全局主题）
└── views/
    ├── landing/       # 企业宣传站
    ├── dashboard/     # 总览
    ├── devices/       # 承保设备四级管理
    ├── evidence/      # 承保证据存证
    ├── underwriting/  # 自主核保
    ├── renewal/       # 智能续保
    ├── incident/      # 事故溯源
    ├── risk/          # 风险监测
    └── system/        # 系统管理
```

## 业务建模对照

| 建议书章节 | 实现位置 |
|-----------|---------|
| 7.1 承保设备信息统一管理 | `views/devices` |
| 7.2 承保证据固化与存证体系 | `views/evidence` |
| 7.3 自主核保 / 智能续保决策 | `views/underwriting` · `views/renewal` |
| 7.4 事故全维度数据溯源 | `views/incident` |
| 6 站-舱-簇-PACK 全层级接口对接 | Landing 接口对接区 + `views/system/接口对接` Tab |
| 8 数据治理与安全保障体系 | `views/system/平台设置` Tab |
| 9 系统接口详细设计 | `views/system/接口对接` Tab |

## 下一步建议

- 接入真实后端 API（建议 NestJS 或 Fastify）
- 时序库 InfluxDB v2 接入实时电芯/温度数据
- 区块链存证：对接联盟链（Hyperledger Fabric / 长安链）
- 大屏版（独立路由 `/screen`）面向运营监控中心

---
项目地址：`/home/shenzheng/XDW/energy-storage-insurance`
