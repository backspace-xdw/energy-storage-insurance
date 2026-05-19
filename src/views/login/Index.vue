<script setup>
import { reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { User, Lock, ArrowRight, OfficeBuilding, View, Hide } from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const form = reactive({
  username: 'uwriter',
  password: 'Esi@2026',
  role: '保险核保员',
  remember: true
})

const loading = ref(false)
const showPwd = ref(false)

const roles = ['保险核保员', '风控专员', '理赔员', '储能运营商', '系统管理员']

async function submit() {
  if (!form.username || !form.password) {
    ElMessage.warning('请填写账号和密码')
    return
  }
  loading.value = true
  try {
    await new Promise(r => setTimeout(r, 350)) // mock latency
    auth.login(form)
    ElMessage.success(`欢迎回来，${auth.user.name}`)
    const redirect = route.query.redirect || '/app/dashboard'
    router.push(redirect)
  } catch (e) {
    ElMessage.error(e.message || '登录失败')
  } finally {
    loading.value = false
  }
}

function fillDemo() {
  form.username = 'uwriter'
  form.password = 'Esi@2026'
}
</script>

<template>
  <div class="login-page">
    <!-- 左侧品牌区 -->
    <aside class="brand-side">
      <div class="bg-decor">
        <div class="grid-pattern" />
        <div class="orb orb-1" />
        <div class="orb orb-2" />
      </div>
      <div class="brand-inner">
        <div class="logo">
          <div class="logo-mark">储</div>
          <div class="logo-text">
            <div class="logo-title">储能保险数据平台</div>
            <div class="logo-sub">Energy Storage Insurance Data Platform</div>
          </div>
        </div>

        <div class="hero">
          <div class="hero-tag">— 储能 · 保险 · 数据 · 风控 —</div>
          <h1 class="hero-title">
            储能保险承保运营<br />
            <span class="gradient-text">数据管理与分析平台</span>
          </h1>
          <p class="hero-sub">
            站-舱-簇-PACK 四级全层级非侵入接口对接<br />
            承保有依据 · 核保有数据 · 续保有策略 · 风控有手段 · 理赔有证据
          </p>
        </div>

        <div class="features">
          <div class="feat">
            <div class="fk">4</div>
            <div class="fl">级<br />全层级覆盖</div>
          </div>
          <div class="divider" />
          <div class="feat">
            <div class="fk">30<span>min</span></div>
            <div class="fl">事故溯源<br />压缩至</div>
          </div>
          <div class="divider" />
          <div class="feat">
            <div class="fk">99.9<span>%</span></div>
            <div class="fl">平台<br />可用性 SLA</div>
          </div>
        </div>

        <div class="brand-footer">
          © 2026 储能保险承保运营数据管理与分析平台
        </div>
      </div>
    </aside>

    <!-- 右侧登录区 -->
    <main class="form-side">
      <div class="form-wrap">
        <div class="form-head">
          <h2>账号登录</h2>
          <p>欢迎使用储能保险数据平台</p>
        </div>

        <el-form class="form" size="large" @submit.prevent="submit">
          <el-form-item>
            <el-input
              v-model="form.username"
              placeholder="请输入账号"
              :prefix-icon="User"
              clearable
            />
          </el-form-item>
          <el-form-item>
            <el-input
              v-model="form.password"
              :type="showPwd ? 'text' : 'password'"
              placeholder="请输入密码"
              :prefix-icon="Lock"
              @keyup.enter="submit"
            >
              <template #suffix>
                <el-icon class="eye" @click="showPwd = !showPwd">
                  <component :is="showPwd ? View : Hide" />
                </el-icon>
              </template>
            </el-input>
          </el-form-item>
          <el-form-item>
            <el-select v-model="form.role" :prefix-icon="OfficeBuilding" style="width:100%">
              <el-option v-for="r in roles" :key="r" :label="r" :value="r" />
            </el-select>
          </el-form-item>

          <div class="form-aux">
            <el-checkbox v-model="form.remember">7 天内自动登录</el-checkbox>
            <a class="forgot">忘记密码？</a>
          </div>

          <button
            class="login-btn"
            :class="{ loading }"
            :disabled="loading"
            @click="submit"
            type="button"
          >
            <span v-if="!loading">登 录</span>
            <span v-else>登 录 中…</span>
            <el-icon v-if="!loading"><ArrowRight /></el-icon>
          </button>

          <div class="demo">
            <span class="dl">演示账号</span>
            <code @click="fillDemo">uwriter / Esi@2026</code>
            <span class="dl">·</span>
            <span class="dt">支持 admin / uwriter / risk / claim / operator</span>
          </div>
        </el-form>

        <div class="form-foot">
          建议使用 Chrome 100+ / Edge 100+ 浏览器访问 · 网络安全等保三级
        </div>
      </div>
    </main>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.login-page {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  min-height: 100vh;
  background: $bg-page;
}

/* === 左侧 === */
.brand-side {
  position: relative;
  background: $grad-hero;
  color: #fff;
  overflow: hidden;
  display: flex;
}
.bg-decor { position: absolute; inset: 0; pointer-events: none; }
.grid-pattern {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(ellipse at center, rgba(0,0,0,1) 35%, transparent 75%);
  -webkit-mask-image: radial-gradient(ellipse at center, rgba(0,0,0,1) 35%, transparent 75%);
}
.orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.5; }
.orb-1 { width: 420px; height: 420px; background: #06b6d4; top: -120px; right: -100px; }
.orb-2 { width: 380px; height: 380px; background: #6366f1; bottom: -120px; left: -120px; }

.brand-inner {
  position: relative; z-index: 2;
  flex: 1;
  padding: 56px 64px;
  display: flex;
  flex-direction: column;
}

.logo { display: flex; align-items: center; gap: 14px; }
.logo-mark {
  width: 44px; height: 44px; border-radius: 10px;
  background: $grad-cyan;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 22px; color: #fff;
}
.logo-title { font-size: 17px; font-weight: 600; letter-spacing: 0.5px; }
.logo-sub { font-size: 11px; color: rgba(255,255,255,0.6); letter-spacing: 0.4px; margin-top: 2px; }

.hero { margin-top: auto; padding: 60px 0 50px; }
.hero-tag {
  display: inline-block;
  padding: 6px 16px;
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 20px;
  font-size: 12px;
  color: rgba(255,255,255,0.78);
  letter-spacing: 1.5px;
  margin-bottom: 28px;
}
.hero-title { font-size: 42px; font-weight: 600; line-height: 1.25; margin: 0 0 24px; letter-spacing: 0.5px; }
.gradient-text {
  background: $grad-cyan;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.hero-sub { font-size: 15px; color: rgba(255,255,255,0.72); line-height: 1.8; margin: 0; }

.features {
  display: flex; align-items: center; gap: 32px;
  padding: 24px 0;
  border-top: 1px solid rgba(255,255,255,0.1);
}
.feat { display: flex; align-items: baseline; gap: 12px; }
.fk { font-family: $font-num;
  font-variant-numeric: tabular-nums lining-nums; font-size: 34px; font-weight: 500; color: #fff; }
.fk span { font-size: 14px; color: $brand-cyan; margin-left: 4px; }
.fl { font-size: 12px; color: rgba(255,255,255,0.6); line-height: 1.5; }
.divider { width: 1px; height: 32px; background: rgba(255,255,255,0.12); }

.brand-footer {
  margin-top: auto;
  font-size: 12px;
  color: rgba(255,255,255,0.35);
  padding-top: 24px;
}

/* === 右侧 === */
.form-side {
  display: flex;
  align-items: center;
  justify-content: center;
  background: $bg-card;
}
.form-wrap { width: 420px; padding: 40px 0; }

.form-head h2 { font-size: 28px; font-weight: 600; margin: 0; letter-spacing: 0.5px; }
.form-head p { color: $text-muted; margin: 10px 0 36px; font-size: 14px; }

.form :deep(.el-input__wrapper) {
  padding: 4px 12px;
  border-radius: 10px;
  box-shadow: 0 0 0 1px $border-soft inset;
  background: $bg-soft;
  transition: all 0.2s;
  &.is-focus {
    box-shadow: 0 0 0 1px $brand-blue inset, 0 0 0 4px rgba(1,94,234,0.08);
    background: #fff;
  }
}
.form :deep(.el-input__inner) { height: 44px; font-size: 15px; }
.form :deep(.el-form-item) { margin-bottom: 18px; }

.eye { cursor: pointer; color: $text-muted; &:hover { color: $brand-blue; } }

.form-aux {
  display: flex; justify-content: space-between; align-items: center;
  margin: 4px 0 20px;
}
.forgot {
  font-size: 13px; color: $brand-blue; cursor: pointer;
  &:hover { text-decoration: underline; }
}

.login-btn {
  width: 100%;
  height: 48px;
  border: none;
  border-radius: 10px;
  background: $grad-cyan;
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
  &:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(1,94,234,0.32); }
  &:active { transform: translateY(0); }
  &:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }
}

.demo {
  margin-top: 18px;
  padding: 14px 16px;
  background: $bg-soft;
  border-radius: 10px;
  font-size: 12px;
  color: $text-muted;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  line-height: 1.6;
  code {
    background: #fff;
    border: 1px solid $border-soft;
    padding: 2px 8px;
    border-radius: 4px;
    color: $brand-blue;
    cursor: pointer;
    font-family: monospace;
    &:hover { border-color: $brand-blue; }
  }
  .dl { color: $text-muted; }
  .dt { color: $text-muted; }
}

.form-foot {
  margin-top: 40px;
  text-align: center;
  font-size: 12px;
  color: $text-muted;
}

@media (max-width: 960px) {
  .login-page { grid-template-columns: 1fr; }
  .brand-side { display: none; }
}
</style>
