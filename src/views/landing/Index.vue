<script setup>
import { useRouter } from 'vue-router'
import {
  Connection, DataLine, Lock, DataAnalysis, Refresh, Warning,
  CircleCheckFilled, ArrowRight, Cpu, Monitor, View, Operation
} from '@element-plus/icons-vue'

const router = useRouter()
const enterConsole = () => router.push('/app/dashboard')

const pains = [
  { side: '储能运营商', items: [
    '设备系统分散，BMS/消防/视频/运维多系统数据无法统一',
    '设备状态、隐患、巡检无统一档案，缺乏可追溯依据',
    '保险办理流程繁琐，承保资料人工整理耗时长',
    '事故发生后难以快速回溯，责任界定困难'
  ]},
  { side: '保险公司', items: [
    '承保阶段缺乏真实可信数据依据，量化风险评估难',
    '核保无法动态监测风险变化，定价精度不足',
    '续保缺乏历史运行数据支撑费率决策',
    '理赔数据分散、不可对齐，溯源周期长达数周'
  ]}
]

const features = [
  { icon: Connection, title: '站-舱-簇-PACK 全层级接口对接', desc: '通过 API/MQTT/OPC UA/数据库视图等标准协议非侵入对接现场系统，零硬件部署、零现场改造、零生产影响。' },
  { icon: DataLine, title: '承保设备信息统一管理', desc: '自动构建站点-舱-簇-PACK 四级设备数字档案，承保台账与初始基线评估报告自动生成，告别人工录入。' },
  { icon: Lock, title: '承保证据固化与存证体系', desc: '加密固化、时间戳、哈希校验、可选区块链存证；承保基线、关键阈值、视觉资料一站归档，司法可采信。' },
  { icon: DataAnalysis, title: '自主核保智能决策', desc: '四维风险评分模型（健康40% / 隐患30% / 运维20% / 环境10%），自动核保结论、自动费率建议、自动报告。' },
  { icon: Refresh, title: '智能续保自动策略', desc: '基于近12个月运行/告警/隐患/巡检数据自动研判风险趋势，自动推送续保提醒并生成续保方案。' },
  { icon: Warning, title: '事故全维度数据溯源', desc: '一键回溯事故前72小时多维数据、关键事件、应急处置全过程，溯源时间从7天压缩至30分钟内。' }
]

const layers = [
  { name: '用户访问层', desc: '运营商 · 核保员 · 理赔员 · 风控员', tag: 'Users' },
  { name: '业务应用层', desc: '承保 · 存证 · 核保 · 续保 · 溯源 · 风控', tag: 'Apps' },
  { name: '能力支撑层', desc: '数据治理 · 风险计算 · 证据存证 · 流程引擎', tag: 'Capabilities' },
  { name: '数据汇聚层', desc: '时序库 · 关系库 · 文件 · 存证库', tag: 'Data' },
  { name: '接口对接层', desc: 'API · MQTT · OPC UA · WebService · DB-View', tag: 'Connectors' },
  { name: '设备系统层', desc: 'BMS · 消防 · 视频 · 运维 · 环境 · 站控', tag: 'Devices' }
]

const stats = [
  { value: '4', unit: '级', label: '站-舱-簇-PACK 全层级覆盖' },
  { value: '30', unit: 'min', label: '事故溯源压缩至' },
  { value: '99.9', unit: '%', label: '平台可用性 SLA' },
  { value: '0', unit: '终端', label: '现场不部署、不改造' }
]

const principles = [
  { icon: CircleCheckFilled, t: '非侵入对接', d: '不改造、不部署、不写入、不控制' },
  { icon: CircleCheckFilled, t: '数据可信', d: '原生系统直采，固化存证防篡改' },
  { icon: CircleCheckFilled, t: '标准统一', d: '接口、模型、流程、报表全统一' },
  { icon: CircleCheckFilled, t: '安全合规', d: 'TLS+AES-256+分权审计，全合规' }
]

const milestones = [
  { week: '1-3 周', name: '需求调研与方案设计' },
  { week: '4-7 周', name: '接口开发与联调' },
  { week: '8-13 周', name: '平台功能开发' },
  { week: '14-16 周', name: '系统综合测试' },
  { week: '17-18 周', name: '上线部署与初始化' },
  { week: '19-20 周', name: '试运行与验收' }
]
</script>

<template>
  <div class="landing">
    <!-- Nav -->
    <nav class="nav">
      <div class="container nav-inner">
        <div class="logo">
          <div class="logo-mark">储</div>
          <div class="logo-text">
            <div class="logo-title">储能保险数据平台</div>
            <div class="logo-sub">Energy Storage Insurance Data Platform</div>
          </div>
        </div>
        <div class="nav-links">
          <a href="#features">核心能力</a>
          <a href="#architecture">平台架构</a>
          <a href="#interface">接口对接</a>
          <a href="#plan">实施计划</a>
          <a href="#value">应用价值</a>
        </div>
        <div class="nav-actions">
          <button class="btn-ghost" @click="enterConsole">进入平台</button>
        </div>
      </div>
    </nav>

    <!-- Hero -->
    <section class="hero">
      <div class="hero-bg">
        <div class="grid-pattern" />
        <div class="orb orb-1" />
        <div class="orb orb-2" />
      </div>
      <div class="container hero-inner">
        <div class="hero-tag">— 储能 · 保险 · 数据 · 风控 ——</div>
        <h1 class="hero-title">
          储能保险承保运营<br />
          <span class="gradient-text">数据管理与分析平台</span>
        </h1>
        <p class="hero-sub">
          站-舱-簇-PACK 四级全层级非侵入接口对接，构建承保有依据、核保有数据、续保有策略、风控有手段、理赔有证据的<br />
          新型储能保险数字化基础设施。
        </p>
        <div class="hero-actions">
          <button class="btn-primary" @click="enterConsole">
            进入平台体验 <el-icon><ArrowRight /></el-icon>
          </button>
          <button class="btn-ghost">下载产品白皮书</button>
        </div>
        <div class="hero-stats">
          <div class="stat" v-for="(s, i) in stats" :key="i">
            <div class="stat-value">
              <span class="num">{{ s.value }}</span>
              <span class="unit">{{ s.unit }}</span>
            </div>
            <div class="stat-label">{{ s.label }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 痛点 -->
    <section class="section section-pain">
      <div class="container">
        <div class="sec-head">
          <div class="sec-tag">02 行业痛点</div>
          <h2 class="sec-title">数据孤岛、风控被动、理赔争议大</h2>
          <p class="sec-sub">储能业务高速增长，保险风控体系亟待数字化重构</p>
        </div>
        <div class="pain-grid">
          <div class="pain-card" v-for="(p, i) in pains" :key="i">
            <div class="pain-head">
              <div class="pain-badge">{{ p.side }}</div>
              <div class="pain-num">0{{ i + 1 }}</div>
            </div>
            <ul class="pain-list">
              <li v-for="(it, idx) in p.items" :key="idx">
                <span class="dot" />
                {{ it }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- 核心能力 -->
    <section class="section section-features" id="features">
      <div class="container">
        <div class="sec-head">
          <div class="sec-tag">03 核心能力</div>
          <h2 class="sec-title">六大核心功能模块</h2>
          <p class="sec-sub">覆盖承保 → 核保 → 续保 → 风控 → 理赔全流程</p>
        </div>
        <div class="feat-grid">
          <div class="feat-card" v-for="(f, i) in features" :key="i">
            <div class="feat-icon">
              <el-icon><component :is="f.icon" /></el-icon>
            </div>
            <div class="feat-no">0{{ i + 1 }}</div>
            <h3>{{ f.title }}</h3>
            <p>{{ f.desc }}</p>
            <div class="feat-link">
              了解详情 <el-icon><ArrowRight /></el-icon>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 平台架构 -->
    <section class="section section-arch" id="architecture">
      <div class="container">
        <div class="sec-head light">
          <div class="sec-tag">04 平台架构</div>
          <h2 class="sec-title">六层一体化技术架构</h2>
          <p class="sec-sub">业务驱动 · 接口为基 · 数据为核 · 安全为底</p>
        </div>
        <div class="arch-stack">
          <div
            class="arch-layer"
            v-for="(l, i) in layers"
            :key="i"
            :style="{ animationDelay: `${i * 60}ms` }"
          >
            <div class="arch-tag">{{ l.tag }}</div>
            <div class="arch-body">
              <div class="arch-name">{{ l.name }}</div>
              <div class="arch-desc">{{ l.desc }}</div>
            </div>
            <div class="arch-no">L{{ 6 - i }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 接口对接 -->
    <section class="section section-iface" id="interface">
      <div class="container iface-inner">
        <div class="iface-left">
          <div class="sec-tag">05 接口对接</div>
          <h2 class="sec-title">站-舱-簇-PACK 全层级<br />标准化接口对接</h2>
          <p class="iface-desc">
            平台不部署任何采集终端、不进行现场数据采集，所有数据均通过标准化只读接口对接现场系统。
            支持 HTTP/HTTPS、WebService、Open API、MQTT、OPC UA、数据库视图、厂家私有协议适配。
          </p>
          <div class="iface-points">
            <div class="iface-point" v-for="(p, i) in principles" :key="i">
              <el-icon class="ok"><component :is="p.icon" /></el-icon>
              <div>
                <div class="pt">{{ p.t }}</div>
                <div class="pd">{{ p.d }}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="iface-right">
          <div class="iface-level" v-for="(lv, i) in [
            { name: '站级', sub: '站控 / 运维 / 视频 / 综合安防', icon: Monitor, color: '#015eea' },
            { name: '舱级', sub: '舱控 / 消防 / 环境监测', icon: View, color: '#06b6d4' },
            { name: '簇级', sub: '簇控制器 / BMS 簇 / 保护单元', icon: Operation, color: '#6366f1' },
            { name: 'PACK级', sub: 'BMS · 电芯 · 电压 · 温度 · 绝缘', icon: Cpu, color: '#22d3a0' }
          ]" :key="i">
            <div class="iface-circle" :style="{ background: lv.color }">
              <el-icon><component :is="lv.icon" /></el-icon>
            </div>
            <div class="iface-meta">
              <div class="iface-name">{{ lv.name }}</div>
              <div class="iface-sub">{{ lv.sub }}</div>
            </div>
            <div class="iface-line" v-if="i < 3" />
          </div>
        </div>
      </div>
    </section>

    <!-- 实施计划 -->
    <section class="section section-plan" id="plan">
      <div class="container">
        <div class="sec-head">
          <div class="sec-tag">06 实施计划</div>
          <h2 class="sec-title">20 周完成全流程交付</h2>
          <p class="sec-sub">需求 → 接口 → 开发 → 测试 → 上线 → 验收</p>
        </div>
        <div class="timeline">
          <div class="tl-item" v-for="(m, i) in milestones" :key="i">
            <div class="tl-dot"><span>{{ i + 1 }}</span></div>
            <div class="tl-card">
              <div class="tl-week">{{ m.week }}</div>
              <div class="tl-name">{{ m.name }}</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 价值 -->
    <section class="section section-value" id="value">
      <div class="container">
        <div class="sec-head light">
          <div class="sec-tag">07 应用价值</div>
          <h2 class="sec-title">为储能保险生态创造可量化价值</h2>
        </div>
        <div class="val-grid">
          <div class="val-card">
            <div class="val-head">对储能运营商</div>
            <div class="val-body">
              <div class="val-row"><span>设备数据统一管理</span><b>↑ 100%</b></div>
              <div class="val-row"><span>保险办理周期</span><b>↓ 60%</b></div>
              <div class="val-row"><span>事故响应时间</span><b>↓ 80%</b></div>
              <div class="val-row"><span>安全合规水平</span><b>↑ 显著</b></div>
            </div>
          </div>
          <div class="val-card highlight">
            <div class="val-head">对保险公司</div>
            <div class="val-body">
              <div class="val-row"><span>承保数据有依据</span><b>✓</b></div>
              <div class="val-row"><span>核保智能化</span><b>↑ 数据驱动</b></div>
              <div class="val-row"><span>理赔溯源周期</span><b>7天 → 30min</b></div>
              <div class="val-row"><span>赔付争议</span><b>↓ 大幅</b></div>
            </div>
          </div>
          <div class="val-card">
            <div class="val-head">对行业生态</div>
            <div class="val-body">
              <div class="val-row"><span>储能保险标准化</span><b>↑</b></div>
              <div class="val-row"><span>承保规模化</span><b>↑</b></div>
              <div class="val-row"><span>双碳目标支撑</span><b>✓</b></div>
              <div class="val-row"><span>可复制推广</span><b>✓</b></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="cta">
      <div class="container cta-inner">
        <div>
          <h2>立即开启储能保险数字化转型</h2>
          <p>非侵入、零改造、快速上线，20 周内完成端到端交付</p>
        </div>
        <button class="btn-primary" @click="enterConsole">
          进入平台体验 <el-icon><ArrowRight /></el-icon>
        </button>
      </div>
    </section>

    <footer class="footer">
      <div class="container footer-inner">
        <div class="footer-brand">
          <div class="logo">
            <div class="logo-mark">储</div>
            <div class="logo-text">
              <div class="logo-title">储能保险数据平台</div>
              <div class="logo-sub">Energy Storage Insurance Data Platform</div>
            </div>
          </div>
          <p class="foot-desc">非侵入对接，构建储能保险全流程数字化能力。</p>
        </div>
        <div class="footer-cols">
          <div>
            <h4>产品</h4>
            <a>承保设备管理</a>
            <a>承保证据固化</a>
            <a>自主核保</a>
            <a>智能续保</a>
            <a>事故溯源</a>
          </div>
          <div>
            <h4>解决方案</h4>
            <a>储能运营商</a>
            <a>保险公司</a>
            <a>再保险公司</a>
            <a>第三方风评</a>
          </div>
          <div>
            <h4>关于</h4>
            <a>公司简介</a>
            <a>技术白皮书</a>
            <a>联系我们</a>
          </div>
        </div>
      </div>
      <div class="footer-bar container">
        © 2026 储能保险承保运营数据管理与分析平台 · All Rights Reserved
      </div>
    </footer>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.landing {
  font-family: $font-cn;
  color: $text-primary;
}

/* === NAV === */
.nav {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 100;
  background: rgba(16, 21, 46, 0.92);
  backdrop-filter: saturate(180%) blur(12px);
  -webkit-backdrop-filter: saturate(180%) blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.nav-inner {
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #fff;
}
.logo { display: flex; align-items: center; gap: 12px; cursor: pointer; }
.logo-mark {
  width: 38px; height: 38px; border-radius: 8px;
  background: $grad-cyan; display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 19px; color: #fff;
}
.logo-title { font-size: 15px; font-weight: 600; }
.logo-sub { font-size: 11px; color: $text-on-dark-soft; letter-spacing: 0.4px; }
.nav-links { display: flex; gap: 32px; }
.nav-links a {
  color: $text-on-dark-soft; font-size: 14px;
  transition: color 0.15s;
  &:hover { color: #fff; }
}
.nav-actions .btn-ghost { padding: 8px 20px; font-size: 14px; }

/* === HERO === */
.hero {
  position: relative;
  padding: 168px 0 120px;
  background: $grad-hero;
  color: #fff;
  overflow: hidden;
}
.hero-bg {
  position: absolute; inset: 0;
  pointer-events: none;
}
.grid-pattern {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(ellipse at center, rgba(0,0,0,1) 35%, transparent 75%);
  -webkit-mask-image: radial-gradient(ellipse at center, rgba(0,0,0,1) 35%, transparent 75%);
}
.orb {
  position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.5;
}
.orb-1 { width: 480px; height: 480px; background: #06b6d4; top: -120px; right: -80px; }
.orb-2 { width: 380px; height: 380px; background: #6366f1; bottom: -120px; left: -60px; }
.hero-inner { position: relative; z-index: 2; text-align: center; }
.hero-tag {
  display: inline-block;
  padding: 6px 18px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 20px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.78);
  letter-spacing: 2px;
  margin-bottom: 28px;
}
.hero-title {
  font-size: 56px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: 1px;
  margin: 0 0 28px;
}
.hero-sub {
  font-size: 17px;
  color: rgba(255, 255, 255, 0.78);
  line-height: 1.8;
  margin: 0 auto 44px;
  max-width: 880px;
}
.hero-actions { display: flex; gap: 16px; justify-content: center; margin-bottom: 80px; }
.hero-stats {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px;
  max-width: 920px; margin: 0 auto;
  padding-top: 56px; border-top: 1px solid rgba(255, 255, 255, 0.1);
}
.stat-value { font-family: $font-num;
  font-variant-numeric: tabular-nums lining-nums; }
.stat-value .num { font-size: 44px; font-weight: 500; color: #fff; }
.stat-value .unit { font-size: 16px; color: $brand-cyan; margin-left: 6px; }
.stat-label { font-size: 13px; color: rgba(255, 255, 255, 0.6); margin-top: 6px; }

/* === Section head === */
.sec-head { text-align: center; margin-bottom: 56px; }
.sec-tag {
  display: inline-block;
  font-size: 12px;
  letter-spacing: 4px;
  color: $brand-blue;
  font-weight: 600;
  margin-bottom: 12px;
}
.sec-head.light .sec-tag { color: $brand-cyan; }
.sec-title { font-size: 36px; font-weight: 600; margin: 0 0 14px; letter-spacing: 1px; }
.sec-head.light .sec-title { color: #fff; }
.sec-sub { font-size: 15px; color: $text-muted; margin: 0; }
.sec-head.light .sec-sub { color: rgba(255, 255, 255, 0.7); }

/* === PAIN === */
.section-pain { background: $bg-card; }
.pain-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
.pain-card {
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 36px;
  border: 1px solid $border-soft;
  position: relative;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
  &:hover { transform: translateY(-4px); box-shadow: $shadow-card-hover; }
  &::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0;
    height: 3px;
    background: $grad-cyan;
  }
}
.pain-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.pain-badge {
  font-size: 14px; font-weight: 600;
  color: $brand-blue;
  background: rgba(1, 94, 234, 0.08);
  padding: 6px 14px; border-radius: 20px;
}
.pain-num {
  font-family: $font-num;
  font-weight: 300;
  font-size: 56px; line-height: 1; color: rgba(1, 94, 234, 0.08);
  font-weight: 200;
}
.pain-list { list-style: none; padding: 0; margin: 0; }
.pain-list li {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 12px 0;
  font-size: 15px; color: $text-secondary; line-height: 1.6;
  border-bottom: 1px dashed $border-soft;
  &:last-child { border-bottom: none; }
}
.pain-list .dot {
  width: 6px; height: 6px; border-radius: 50%; background: $brand-cyan; margin-top: 9px; flex-shrink: 0;
}

/* === FEATURES === */
.section-features { background: $bg-page; }
.feat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
.feat-card {
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 36px 32px;
  border: 1px solid $border-soft;
  position: relative;
  transition: transform 0.25s, box-shadow 0.25s, border-color 0.25s;
  cursor: pointer;
  &:hover {
    transform: translateY(-6px);
    box-shadow: 0 14px 36px rgba(16, 21, 46, 0.12);
    border-color: rgba(1, 94, 234, 0.18);
    .feat-icon { background: $grad-cyan; color: #fff; transform: scale(1.05); }
    .feat-link { color: $brand-blue; gap: 10px; }
  }
}
.feat-icon {
  width: 56px; height: 56px; border-radius: 14px;
  background: rgba(1, 94, 234, 0.08);
  color: $brand-blue;
  display: flex; align-items: center; justify-content: center;
  font-size: 26px;
  margin-bottom: 22px;
  transition: background 0.25s, transform 0.25s, color 0.25s;
}
.feat-no {
  position: absolute; top: 28px; right: 32px;
  font-family: $font-num;
  font-weight: 300;
  font-size: 36px; color: rgba(1, 94, 234, 0.08); font-weight: 200;
}
.feat-card h3 { font-size: 18px; font-weight: 600; margin: 0 0 12px; line-height: 1.4; }
.feat-card p { font-size: 14px; color: $text-muted; line-height: 1.75; margin: 0 0 22px; }
.feat-link {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 13px; color: $text-muted;
  transition: color 0.2s, gap 0.2s;
}

/* === ARCH === */
.section-arch { background: $nav-bg; position: relative; overflow: hidden; }
.section-arch::before {
  content: ''; position: absolute; inset: 0;
  background:
    radial-gradient(circle at 80% 20%, rgba(6, 182, 212, 0.18) 0%, transparent 50%),
    radial-gradient(circle at 10% 80%, rgba(99, 102, 241, 0.18) 0%, transparent 50%);
}
.arch-stack {
  position: relative;
  max-width: 880px; margin: 0 auto;
  display: flex; flex-direction: column; gap: 12px;
}
.arch-layer {
  display: flex; align-items: center; gap: 20px;
  padding: 24px 28px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: $radius;
  color: #fff;
  backdrop-filter: blur(6px);
  transition: transform 0.2s, background 0.2s;
  animation: archIn 0.6s ease both;
  &:hover { transform: translateX(8px); background: rgba(255, 255, 255, 0.08); }
}
.arch-tag {
  font-family: $font-num;
  font-variant-numeric: tabular-nums lining-nums;
  font-size: 12px; letter-spacing: 1px;
  background: $grad-cyan; padding: 4px 10px; border-radius: 4px;
  flex-shrink: 0;
}
.arch-body { flex: 1; }
.arch-name { font-size: 16px; font-weight: 600; }
.arch-desc { font-size: 13px; color: rgba(255, 255, 255, 0.65); margin-top: 4px; }
.arch-no {
  font-family: $font-num;
  font-weight: 300;
  font-size: 28px; color: rgba(255, 255, 255, 0.25); font-weight: 200;
}
@keyframes archIn {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}

/* === IFACE === */
.section-iface { background: $bg-card; }
.iface-inner { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center; }
.iface-left .sec-tag { color: $brand-blue; }
.iface-left .sec-title { font-size: 34px; margin: 12px 0 24px; }
.iface-desc { font-size: 15px; color: $text-secondary; line-height: 1.85; margin-bottom: 28px; }
.iface-points { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.iface-point { display: flex; gap: 12px; }
.iface-point .ok { color: #22d3a0; font-size: 20px; margin-top: 2px; }
.iface-point .pt { font-size: 15px; font-weight: 600; }
.iface-point .pd { font-size: 13px; color: $text-muted; margin-top: 4px; }

.iface-right { position: relative; padding-left: 40px; }
.iface-level {
  position: relative;
  display: flex; align-items: center; gap: 18px;
  padding: 18px 20px;
  margin-bottom: 18px;
  background: $bg-card;
  border: 1px solid $border-soft;
  border-radius: $radius;
  box-shadow: $shadow-card;
  transition: transform 0.2s, box-shadow 0.2s;
  &:hover { transform: translateX(6px); box-shadow: $shadow-card-hover; }
}
.iface-circle {
  width: 48px; height: 48px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 22px; flex-shrink: 0;
}
.iface-name { font-size: 16px; font-weight: 600; }
.iface-sub { font-size: 13px; color: $text-muted; margin-top: 2px; }
.iface-line {
  position: absolute;
  left: 43px;
  top: 100%;
  width: 1px; height: 18px;
  background: linear-gradient(180deg, rgba(1, 94, 234, 0.5), transparent);
}

/* === PLAN === */
.section-plan { background: $bg-page; }
.timeline {
  position: relative;
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 16px;
  &::before {
    content: '';
    position: absolute; top: 22px; left: 8%; right: 8%; height: 2px;
    background: linear-gradient(90deg, $brand-blue, $brand-cyan);
  }
}
.tl-item { display: flex; flex-direction: column; align-items: center; position: relative; }
.tl-dot {
  width: 44px; height: 44px; border-radius: 50%;
  background: #fff;
  border: 2px solid $brand-blue;
  color: $brand-blue;
  display: flex; align-items: center; justify-content: center;
  font-weight: 600;
  margin-bottom: 16px;
  position: relative; z-index: 2;
  transition: all 0.2s;
}
.tl-item:hover .tl-dot {
  background: $grad-cyan; color: #fff; border-color: transparent;
  box-shadow: 0 6px 18px rgba(1, 94, 234, 0.3);
}
.tl-card {
  text-align: center;
  padding: 14px 12px;
  background: #fff;
  border: 1px solid $border-soft;
  border-radius: $radius;
  width: 100%;
}
.tl-week { font-size: 13px; color: $brand-blue; font-weight: 600; }
.tl-name { font-size: 13px; color: $text-secondary; margin-top: 6px; }

/* === VALUE === */
.section-value { background: $nav-bg; position: relative; overflow: hidden; }
.section-value::before {
  content: ''; position: absolute; inset: 0;
  background: radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.12), transparent 60%);
}
.val-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; position: relative; }
.val-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: $radius-lg;
  padding: 32px;
  color: #fff;
  backdrop-filter: blur(6px);
  &.highlight {
    background: $grad-cyan;
    transform: scale(1.04);
    box-shadow: 0 16px 48px rgba(1, 94, 234, 0.4);
  }
}
.val-head { font-size: 18px; font-weight: 600; margin-bottom: 22px; padding-bottom: 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.12); }
.val-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; font-size: 14px; color: rgba(255, 255, 255, 0.85); }
.val-row b { color: #fff; font-weight: 600; }

/* === CTA === */
.cta { background: $grad-hero; padding: 80px 0; color: #fff; }
.cta-inner { display: flex; align-items: center; justify-content: space-between; }
.cta h2 { font-size: 32px; font-weight: 600; margin: 0 0 8px; }
.cta p { font-size: 15px; color: rgba(255, 255, 255, 0.7); margin: 0; }

/* === FOOTER === */
.footer { background: #0a0f24; color: rgba(255, 255, 255, 0.7); padding-top: 64px; }
.footer-inner { display: grid; grid-template-columns: 1fr 2fr; gap: 64px; padding-bottom: 48px; }
.foot-desc { font-size: 13px; color: rgba(255, 255, 255, 0.5); margin-top: 18px; max-width: 320px; line-height: 1.7; }
.footer-cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; }
.footer-cols h4 { color: #fff; font-size: 14px; margin: 0 0 16px; font-weight: 600; }
.footer-cols a {
  display: block; font-size: 13px; padding: 6px 0;
  color: rgba(255, 255, 255, 0.55);
  cursor: pointer;
  &:hover { color: #fff; }
}
.footer-bar {
  padding: 24px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 12px; color: rgba(255, 255, 255, 0.4);
  text-align: center;
}

@media (max-width: 1024px) {
  .hero-title { font-size: 38px; }
  .feat-grid, .pain-grid, .val-grid { grid-template-columns: 1fr; }
  .iface-inner { grid-template-columns: 1fr; gap: 32px; }
  .timeline { grid-template-columns: repeat(2, 1fr); &::before { display: none; } }
  .hero-stats { grid-template-columns: repeat(2, 1fr); }
  .footer-inner { grid-template-columns: 1fr; gap: 32px; }
}
</style>
