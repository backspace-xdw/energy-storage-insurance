<script setup>
defineProps({
  label: String,
  value: [String, Number],
  unit: String,
  delta: String,
  trend: { type: String, default: 'up' }, // up | down | flat
  icon: [Object, Function],
  color: { type: String, default: 'blue' }
})
</script>

<template>
  <div class="kpi" :class="`kpi-${color}`">
    <div class="kpi-icon" v-if="icon">
      <el-icon><component :is="icon" /></el-icon>
    </div>
    <div class="kpi-body">
      <div class="kpi-label">{{ label }}</div>
      <div class="kpi-value">
        <span class="num">{{ value }}</span>
        <span class="unit" v-if="unit">{{ unit }}</span>
      </div>
      <div class="kpi-delta" v-if="delta" :class="trend">
        <el-icon v-if="trend==='up'"><CaretTop /></el-icon>
        <el-icon v-else-if="trend==='down'"><CaretBottom /></el-icon>
        {{ delta }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.kpi {
  display: flex; gap: 16px; align-items: center;
  background: $bg-card;
  border: 1px solid $border-soft;
  border-radius: $radius;
  padding: 20px 22px;
  transition: transform 0.2s, box-shadow 0.2s;
  position: relative; overflow: hidden;
  &::before {
    content: '';
    position: absolute; right: -30px; top: -30px;
    width: 120px; height: 120px; border-radius: 50%;
    background: rgba(1, 94, 234, 0.06);
  }
  &:hover { transform: translateY(-3px); box-shadow: $shadow-card-hover; }
}
.kpi-icon {
  width: 48px; height: 48px; border-radius: 12px;
  background: $grad-cyan; color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; flex-shrink: 0;
  position: relative; z-index: 1;
}
.kpi-blue .kpi-icon { background: linear-gradient(135deg, #015eea, #1e2188); }
.kpi-cyan .kpi-icon { background: linear-gradient(135deg, #06b6d4, #015eea); }
.kpi-green .kpi-icon { background: linear-gradient(135deg, #22d3a0, #06b6d4); }
.kpi-orange .kpi-icon { background: linear-gradient(135deg, #f59e0b, #ef4444); }
.kpi-violet .kpi-icon { background: linear-gradient(135deg, #6366f1, #8b5cf6); }

.kpi-body { flex: 1; min-width: 0; }
.kpi-label { font-size: 13px; color: $text-muted; }
.kpi-value { display: flex; align-items: baseline; gap: 4px; margin-top: 4px; }
.kpi-value .num { font-size: 28px; font-weight: 600; color: $text-primary; font-family: $font-num;
  font-variant-numeric: tabular-nums lining-nums; letter-spacing: 0.5px; }
.kpi-value .unit { font-size: 13px; color: $text-muted; }
.kpi-delta {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; margin-top: 6px;
  &.up { color: #22d3a0; }
  &.down { color: #ef4444; }
  &.flat { color: $text-muted; }
}
</style>
