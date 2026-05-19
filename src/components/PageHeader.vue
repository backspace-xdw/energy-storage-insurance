<script setup>
defineProps({
  title: String,
  desc: String,
  tag: String
})
</script>

<template>
  <div class="page-header">
    <div class="ph-text">
      <div class="ph-tag" v-if="tag">{{ tag }}</div>
      <h2 class="ph-title">{{ title }}</h2>
      <p class="ph-desc" v-if="desc">{{ desc }}</p>
    </div>
    <div class="ph-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid $border-soft;
}
.ph-tag {
  display: inline-block;
  font-size: 11px;
  letter-spacing: 2px;
  color: $brand-blue;
  font-weight: 600;
  margin-bottom: 6px;
}
.ph-title { font-size: 22px; font-weight: 600; margin: 0; }
.ph-desc { font-size: 13px; color: $text-muted; margin: 6px 0 0; }
.ph-actions { display: flex; gap: 12px; }
</style>
