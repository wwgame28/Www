# 20. Рендеринг вглубь

Продолжение главы 09: как устроена картинка и как её контролировать.

## 20.1 Конвейер кадра (упрощённо)
1. **Game thread** — логика (Tick, Blueprints) → 2. **Render thread** — подготовка (видимость, отсечение, сбор draw calls) → 3. **RHI thread** → 4. **GPU**: Depth Prepass → Nanite rasterization → Base Pass (G-Buffer) → Shadows (VSM) → Lumen (GI, reflections) → Lighting → Translucency → Post Process (Bloom, Tonemapper, TSR) → UI.

`stat unit`: `Game`, `Draw` (render thread), `RHIT`, `GPU`. Узкое место — наибольшее значение.

## 20.2 Deferred vs Forward
- **Deferred** (по умолчанию) — много источников света дёшево; дорогая прозрачность и MSAA недоступен.
- **Forward Shading** (Project Settings → Rendering) — для VR и стилизованной графики: MSAA, быстрее на простых сценах.
- **Mobile Renderer** — отдельный путь для мобильных (гл. 21).

## 20.3 Ключевые технологии UE5

| Технология | Что делает | Настройки и подводные камни |
|---|---|---|
| **Nanite** | Виртуальная геометрия, автоматический LOD | Не для прозрачных материалов и некоторых деформаций; WPO на Nanite дороже; `r.Nanite.Visualize` |
| **Lumen** | Динамическое GI и отражения | Software (Distance Fields) или Hardware Ray Tracing (лучше, нужна RTX/RX 6000+). Меши — без тонких стенок (< 10 см протекает свет). **Lumen Lite** (5.8) — дешёвый режим |
| **Virtual Shadow Maps** | Тени высокого разрешения | Кэширование: не двигай всё подряд (Invalidation); `r.Shadow.Virtual.Visualize` |
| **MegaLights** (production-ready 5.8) | Много теневых источников (сотни) с постоянной стоимостью | Включается в проекте/Post Process; шум в отдельных случаях — сглаживание денойзером |
| **TSR** | Апскейл + сглаживание | Screen Percentage; альтернативы — DLSS (плагин NVIDIA), FSR (AMD), XeSS (Intel) |
| **Substrate** | Новая система материалов (слои: металл + лак + пыль, плёнки, ткань) вместо фиксированных Shading Models | Production-ready с 5.7; включается в Project Settings → Rendering → Substrate. Дороже, но физичнее |
| **Path Tracer** | Офлайн-качество (эталон) | Для рендеров и сравнения освещения, не для игры |
| **Heterogeneous Volumes / Volumetric Fog** | Облака, дым, туман с освещением | Дорого — регулируй разрешение |

## 20.4 Материалы — продвинуто
- **Shader complexity / instruction count** — смотри статистику в Material Editor.
- **Static Switch Parameter** — ветки, которые создают отдельные шейдеры (много свитчей = взрыв перестановок, долгая компиляция).
- **Material Layers** — слои материалов как ассеты.
- **Custom node** (HLSL) — код шейдера.
- **Runtime Virtual Texture (RVT)** — смешивание мешей с ландшафтом, дешёвые дороги/декали на ландшафте.
- **Decals** (Deferred Decal) — следы, грязь, кровь, надписи.
- **Post Process Materials** — контуры, ночное видение, «тепловизор», стилизация (cel-shading).
- **Stylized rendering**: свои Shading Models через Substrate/Post Process, тун-шейдинг, контуры через Custom Depth/Stencil.

## 20.5 Освещение — продвинуто
- **Mobility**: Static (запекается, дёшево), Stationary (запечённый отскок + динамические тени), Movable (полностью динамический — с Lumen так по умолчанию).
- **GPU Lightmass** — быстрое запекание (плагин), если не используешь Lumen.
- **Light Functions**, **IES Profiles** (реалистичные светильники), **Light Channels**, **Contact Shadows**.
- **Exposure** — ручная (Manual) для предсказуемости; **Physical lighting units** (люксы, канделы) — реалистичные значения: солнце ~100 000 lux, лампа ~800 lm.
- **Sky**: Sky Atmosphere + Volumetric Clouds + Sky Light (Real Time Capture).
- **Color Grading** в Post Process, **LUT**, ACES тонмаппер; работай в калиброванном sRGB.

## 20.6 Компиляция шейдеров и «статтер»
- **PSO Precaching** (включено по умолчанию в UE 5.x) + **Bundled PSO Cache** — устраняют подёргивания при первом появлении эффектов/материалов в DX12.
- Проверка: тест сборки на «чистой» машине, первые минуты игры; `r.PSOPrecache.Validation`.
- Сокращай число перестановок шейдеров: меньше Static Switch, используй Material Instances.
- **Derived Data Cache (DDC)**: локальный и общий (Shared DDC / Zen Server / Cloud DDC) — ускоряет открытие проекта в команде.

## 20.7 Scalability и пресеты
- `Scalability.ini` — группы `sg.ViewDistanceQuality`, `sg.ShadowQuality`, `sg.GlobalIlluminationQuality`, `sg.ReflectionQuality`, `sg.PostProcessQuality`, `sg.TextureQuality`, `sg.EffectsQuality`, `sg.FoliageQuality`, `sg.ShadingQuality` (0–4).
- **Device Profiles** — настройки под конкретные устройства/консоли.
- Конфиги: `DefaultEngine.ini` (`[/Script/Engine.RendererSettings]`), консольные переменные `r.*` и их установка через `ConsoleVariables.ini`.

## 20.8 Инструменты анализа GPU
`profilegpu`, `stat gpu`, **Unreal Insights** (GPU-трек), **RenderDoc** (плагин RenderDoc — захват кадра), **PIX** (Windows), NVIDIA Nsight. Визуализации вьюпорта: Lumen Scene, Nanite Overdraw, Shader Complexity, Quad Overdraw, Lightmap Density, Virtual Shadow Map.

## Практика
1. Сравни сцену: Lumen SW vs HW RT vs без GI; замерь `stat gpu`.
2. Сцена с 200 источниками на MegaLights.
3. Материал Substrate: металл с лаком и пылью.
4. Пост-процесс стилизация: контуры + тун.
5. RenderDoc-захват кадра и найди самый дорогой проход.

## Чек-лист
- [ ] Понимаю конвейер кадра и `stat unit`
- [ ] Знаю ограничения Nanite/Lumen/VSM и как их диагностировать
- [ ] Умею настроить Scalability и бороться с шейдерным статтером
