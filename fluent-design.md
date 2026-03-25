# StyleKit: Fluent Design Design Rules

> 微软推出的设计系统，融合了光效、深度、动效、材质和缩放五大元素，打造自然直观的跨平台体验。

## Philosophy
Fluent Design System（流利设计系统）是微软于 2017 年推出的设计语言，旨在创造跨设备的一致体验。

## Rules

### Do
- 使用亚克力（Acrylic）半透明效果 bg-white/70 backdrop-blur-xl
- 添加 Reveal 高亮边框效果（hover 时 border-white/60）
- 使用微软标志性蓝色 bg-[#0078d4]
- 保持简洁现代的布局
- 使用 Z 轴深度：hover:-translate-y-0.5 搭配阴影层级提升
- 使用 Segoe UI 字体风格
- 按钮 active:scale-[0.97] 触觉按压确认
- 所有可交互元素 focus:ring-2 focus:ring-[#0078d4] focus:ring-offset-2
- 卡片 hover:-translate-y-1 + 阴影扩张（亚克力材质浮起）
- 图标容器 hover 时蓝色填充 + group-hover:scale-105 微交互

### Don't
- 禁止过度使用亚克力效果
- 禁止使用不协调的配色
- 禁止忽略焦点状态
- 禁止使用过重的阴影（Fluent 阴影是柔和分层的）
- 禁止按钮缺少 active:scale-[0.97]（无触觉确认）
- 禁止 focus:ring 缺少 focus:ring-offset-2
- 禁止动画超过 duration-200（Fluent 是流畅利落的，不是缓慢漂移的）

### AI-Specific Rules
You are a Fluent Design System frontend development expert. All generated code must strictly follow Microsoft's Fluent Design principles.

## 绝对禁止

- 禁止过度使用亚克力效果
- 禁止使用不协调的配色
- 禁止忽略焦点状态
- 禁止使用过重的阴影（Fluent 阴影是柔和分层的）
- 禁止按钮缺少 active:scale-[0.97]（无触觉确认）
- 禁止 focus:ring 缺少 focus:ring-offset-2
- 禁止动画超过 duration-200（Fluent 是流畅利落的，不是缓慢漂移的）

## 必须遵守

- 使用亚克力（Acrylic）半透明效果 bg-white/70 backdrop-blur-xl
- 添加 Reveal 高亮边框效果（hover 时 border-white/60）
- 使用微软标志性蓝色 bg-[#0078d4]
- 保持简洁现代的布局
- 使用 Z 轴深度：hover:-translate-y-0.5 搭配阴影层级提升
- 使用 Segoe UI 字体风格
- 按钮 active:scale-[0.97] 触觉按压确认
- 所有可交互元素 focus:ring-2 focus:ring-[#0078d4] focus:ring-offset-2
- 卡片 hover:-translate-y-1 + 阴影扩张（亚克力材质浮起）
- 图标容器 hover 时蓝色填充 + group-hover:scale-105 微交互

## Animation & Interaction Rules

- Acrylic Depth Lift: Cards hover with hover:-translate-y-1 plus shadow expansion (shadow doubles). The transition is transition-all duration-200 ease-out. This simulates the card rising in Z-axis — Fluent's defining "depth" principle.
- Reveal Brightening: On hover, card background brightens (bg-white/70 → bg-white/85) and border brightens (border-white/30 → border-white/50). This mimics the Fluent Reveal lighting effect — as if a light source is tracking the cursor.
- Icon Scale: Icon containers use group class. On group-hover, they scale up with group-hover:scale-105 using transition-transform duration-200 ease-out.
- Button Float + Press: Buttons rise hover:-translate-y-0.5 and shadow intensifies. On active:scale-[0.97] active:translate-y-0 active:shadow-none — compressed back to surface. The combination creates a physical button feel.
- Press Scale Precision: Fluent uses active:scale-[0.97] (not 0.98) — slightly more aggressive press than corporate-clean, matching Windows button physics.
- Snappy Easing: duration-150 ease-out for buttons and controls. duration-200 ease-out for cards. Never exceed 200ms.

## Color Palette

- Primary Blue: #0078d4 (buttons, links, focus rings)
- Dark Blue: #106ebe (hover state)
- Deeper Blue: #005a9e (active state)
- Accent Yellow: #ffb900
- Accent Red: #e81123
- Accent Green: #00cc6a
- Text: gray-900 (headings), gray-700 (body), gray-500 (secondary)

## Self-Check

After generating code, verify:
1. All buttons have active:scale-[0.97] active:translate-y-0
2. All focusable elements have focus:ring-2 focus:ring-offset-2
3. Cards have hover:-translate-y-1 + shadow expansion
4. Cards use group class; icon containers have group-hover:scale-105
5. No duration above 200ms
6. Acrylic used selectively, not on everything

## Colors
- Primary: #0078d4
- Secondary: #106ebe
- Accent 1: #ffb900
- Accent 2: #e81123
- Accent 3: #00cc6a
- Accent 4: #3bf022

## Design Tokens
- Font (heading): font-sans font-semibold tracking-tight
- Font (body): font-sans
- Border radius: rounded-md md:rounded-lg
- Border width: border
- Border color: border-[#e1e1e1]
- Shadow (sm): shadow-[0_1.6px_3.6px_rgba(0,0,0,0.13),0_0.3px_0.9px_rgba(0,0,0,0.1)]
- Shadow (md): shadow-[0_3.2px_7.2px_rgba(0,0,0,0.13),0_0.6px_1.8px_rgba(0,0,0,0.1)]
- Shadow (lg): shadow-[0_6.4px_14.4px_rgba(0,0,0,0.13),0_1.2px_3.6px_rgba(0,0,0,0.1)]
- Shadow (hover): hover:shadow-[0_6.4px_14.4px_rgba(0,0,0,0.18),0_1.2px_3.6px_rgba(0,0,0,0.14)]
- Spacing (section): py-10 md:py-16 lg:py-24
- Spacing (container): px-4 md:px-6 lg:px-8
- Spacing (card): p-4 md:p-5
- Transition: transition-all duration-150 ease-out

## Forbidden Classes
- `rounded-none`: Fluent Design uses subtle rounding (rounded-md to rounded-lg)
- `border-black`
- `border-2`
- `border-4`: Fluent Design uses thin subtle borders (border), not heavy borders
- `shadow-[2px_2px_0px`
- `shadow-[4px_4px_0px`: Fluent Design uses soft acrylic-style shadows, not hard-edge
- `shadow-[8px_8px_0px`
- `font-black`
- `font-serif`: Fluent Design uses Segoe UI-style sans-serif (font-sans)
- `bg-black`

## Component Recipes
### Button
- ID: button
- Base classes: `font-semibold rounded-md shadow-[0_1.6px_3.6px_rgba(0,0,0,0.13),0_0.3px_0.9px_rgba(0,0,0,0.1)] transition-all duration-150 ease-out`
- Variants:
  - Primary: `bg-[#0078d4] text-white`
  - Secondary: `bg-white text-[#323130] border border-[#8a8886]`
  - Outline: `bg-transparent text-[#0078d4] border border-[#0078d4]`
- Hover: `hover:shadow-[0_3.2px_7.2px_rgba(0,0,0,0.13),0_0.6px_1.8px_rgba(0,0,0,0.1)] hover:scale-[1.01]`

### Card
- ID: card
- Base classes: `bg-white rounded-md md:rounded-lg border border-[#e1e1e1] shadow-[0_1.6px_3.6px_rgba(0,0,0,0.13),0_0.3px_0.9px_rgba(0,0,0,0.1)] transition-all duration-150 ease-out`
- Variants:
  - Default: ``
  - Acrylic: `bg-white/80 backdrop-blur-md`
  - Elevated: `shadow-[0_6.4px_14.4px_rgba(0,0,0,0.13),0_1.2px_3.6px_rgba(0,0,0,0.1)]`
- Hover: `hover:shadow-[0_6.4px_14.4px_rgba(0,0,0,0.18),0_1.2px_3.6px_rgba(0,0,0,0.14)]`

### Input
- ID: input
- Base classes: `w-full rounded-md border border-[#8a8886] bg-white font-sans text-[#323130] placeholder:text-[#a19f9d] focus:outline-none transition-all duration-150 ease-out`
- Variants:
  - Default: ``
  - Filled: `bg-[#f3f2f1] border-transparent`


---
Generated by StyleKit · https://stylekit.dev
Style: 流利设计 (Fluent Design)