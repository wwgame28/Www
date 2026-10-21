# 09. Графика, звук и эффекты

## 9.1 Материалы

Материал = программа для GPU, которая решает, как выглядит поверхность. Открывается в **Material Editor** (тоже ноды).

Главная нода (Material Result) — входы:
| Вход | Что задаёт |
|---|---|
| **Base Color** | Цвет/текстура (альбедо) |
| **Metallic** | 0 — не металл, 1 — металл |
| **Roughness** | 0 — зеркало, 1 — матовое |
| **Normal** | Карта нормалей (рельеф без геометрии) |
| **Emissive Color** | Свечение (значения >1 дают свечение с Bloom) |
| **Opacity / Opacity Mask** | Прозрачность (Blend Mode = Translucent / Masked) |
| **Ambient Occlusion** | Затенение в щелях |
| **World Position Offset** | Сдвиг вершин (колыхание травы, флаги) |

Полезные ноды: `Texture Sample` (T + ЛКМ), `Constant` (1), `Constant3Vector` (3), `Multiply` (M), `Add` (A), `Lerp` (L), `Texture Coordinate` (U) для тайлинга, `Panner` (движение текстуры — вода, конвейер), `Time`, `Sine`, `Fresnel` (свечение по краям), `World Aligned Texture` (текстура без UV).

### Master Material + Material Instance — обязательный приём
1. Делаешь один `M_Master` с **параметрами**: ПКМ по Constant → Convert to Parameter (`BaseColorTint`, `RoughnessScale`, `EmissiveStrength`), Texture Sample → Convert to Parameter.
2. ПКМ по материалу → **Create Material Instance** → `MI_Rock`, `MI_Gold`… — меняешь параметры без перекомпиляции шейдеров.
3. Менять во время игры: `Create Dynamic Material Instance` → `Set Scalar/Vector Parameter Value` (вспышка при уроне, растворение при смерти).

**Material Functions** — переиспользуемые куски графа. **Material Parameter Collection** — глобальные параметры (время суток, позиция игрока для «примятой травы»).

Ландшафт: **Landscape Mode** (Shift+2) → создание ландшафта, скульпт, покраска слоями через Landscape Layer Blend.

## 9.2 Свет и Lumen

| Источник | Для чего |
|---|---|
| **Directional Light** | Солнце/луна |
| **Sky Atmosphere** + **Sky Light** + **Exponential Height Fog** + **Volumetric Cloud** | Небо, рассеянный свет, туман, облака. Window → **Env. Light Mixer** создаёт всё разом |
| **Point / Spot / Rect Light** | Лампы, фонари, окна |
| **Post Process Volume** (Infinite Extent = true) | Цветокоррекция, экспозиция, Bloom, виньетка, глубина резкости |

**Lumen** — динамическое глобальное освещение и отражения (по умолчанию в UE5). Свет «отскакивает» от поверхностей в реальном времени, запекать не нужно.
- В UE 5.8 появился **Lumen Lite** — облегчённый режим для слабого железа.
- **MegaLights** (production-ready в 5.8) — сотни теневых источников света без падения FPS.
- Для слабых ПК: Project Settings → Rendering → Dynamic Global Illumination = None, Reflection = Screen Space, и запекать свет (Static lights + Build Lighting).

**Nanite** — виртуализированная геометрия: миллионы полигонов без ручных LOD. Включается на Static Mesh (галочка Nanite при импорте или в редакторе меша). С 5.x работает и для листвы (Nanite Foliage), Landscape.

**Virtual Shadow Maps** — качественные тени, работают в паре с Nanite.

Экспозиция: в Post Process → Exposure → Min/Max EV100 одинаковые — чтобы картинка не «плавала» при переходе из темноты на свет.

## 9.3 Niagara — визуальные эффекты

ПКМ → FX → **Niagara System** → шаблон (Fountain, Burst, Hanging Particulates…) → `NS_Explosion`.

Структура: **System** → **Emitters** → модули по стадиям: Emitter Spawn / Emitter Update / Particle Spawn / Particle Update / Render.
- Spawn Rate / Spawn Burst Instantaneous — сколько частиц.
- Initialize Particle — время жизни, размер, цвет.
- Add Velocity / Gravity Force / Drag / Curl Noise Force — движение.
- Color / Scale Sprite Size by Life — изменение во времени.
- Renderers: Sprite, Mesh, Ribbon (следы), Light.
- **User Parameters** (`User.Color`) — менять из Blueprint.

В Blueprint: `Spawn System at Location` (взрыв), `Spawn System Attached` (след от меча), компонент **Niagara Particle System**. Параметры — `Set Niagara Variable (LinearColor)`.

## 9.4 Звук

| Ассет | Для чего |
|---|---|
| **Sound Wave** | Импортированный WAV (используй WAV 16-bit/48 kHz) |
| **Sound Cue** | Простая логика: рандом из нескольких, питч ±, громкость |
| **MetaSound Source** (`MS_`) | Современная процедурная система звука UE5 — рандом, слои, синтез, параметры из Blueprint. Рекомендуется для новых проектов |
| **Sound Attenuation** | Затухание с расстоянием, пространственность (3D) |
| **Sound Class / Sound Mix** | Группы громкости (Music, SFX, Voice) и их микс |
| **Sound Concurrency** | Ограничение одновременных звуков (не 50 выстрелов разом) |

Ноды: `Play Sound 2D` (UI, музыка), `Play Sound at Location` (3D), `Spawn Sound Attached` (двигатель машины), компонент **Audio** (`Play`, `Stop`, `Fade In/Out`, `Set Float Parameter` для MetaSound).

Музыка: Audio-компонент в GameMode/уровне, смена трека — `Fade Out` старого + `Fade In` нового. Для динамической музыки (бой/спокойствие) — MetaSound с параметром «Intensity».

Отладка звука: **Audio Insights** (production-ready в 5.8).

## 9.5 Sequencer — катсцены

Кнопка **Cinematics → Add Level Sequence** → `LS_Intro`.
- Добавь акторов (Track → Actor To Sequencer), ключи Transform, **Camera Cut Track** с Cine Camera Actor, аудио, события (Event Track вызывает функции Blueprint).
- Запуск: `Create Level Sequence Player` → `Play`; событие `On Finished` → вернуть управление.
- На время катсцены: `Disable Input` / `Set Cinematic Mode`.
- Рендер видео (трейлер) — **Movie Render Queue / Movie Render Graph**.

## 9.6 Камерные эффекты

- **Camera Shake** (ПКМ → Blueprint Class → Camera Shake Base, Pattern = Perlin Noise) → `Start Camera Shake` при взрыве/ударе.
- Хит-стоп: `Set Global Time Dilation (0.05)` → Delay 0.05 (в реальном времени) → 1.0.
- Замедление времени: `Set Global Time Dilation (0.3)`.
- Вспышка экрана при уроне: Post Process Material или Image в HUD с анимацией прозрачности.

## 9.7 Импорт своих моделей

- Формат **FBX** или **glTF/GLB** (UE 5 поддерживает **Interchange**-импорт, USD).
- Масштаб: 1 юнит = 1 см. В Blender — Unit Scale 0.01 или Apply Scale «FBX Units Scale».
- Ось: Z — вверх, X — вперёд.
- Точка опоры (pivot) — у основания предмета.
- Коллизия: в Blender меши `UCX_ИмяМеша` импортируются как коллизия; или сгенерируй в UE.
- Скелетные меши — вместе со скелетом; анимации — отдельно с выбором существующего скелета.
- Бесплатный путь моделей: **Fab** (Quixel Megascans бесплатны для Unreal), **Blender** + Sketchfab (CC-лицензии), Kenney.nl, Poly Haven.

## Практика

1. `M_Master` с параметрами + 5 инстансов.
2. Материал воды с Panner и материал «растворения» при смерти врага (Dynamic Material Instance + Opacity Mask + шум).
3. Освещение: день и ночь через смену поворота Directional Light (Timeline); фонари включаются ночью.
4. `NS_CoinPickup` (вспышка при подборе), `NS_Hit`, `NS_Explosion`.
5. MetaSound шагов с рандомом, Anim Notify `Play Sound` в анимации бега.
6. Катсцена-облёт уровня на старте, с пропуском по любой кнопке.

## Чек-лист

- [ ] Делаю все материалы через Master + Instance
- [ ] Понимаю Lumen / Nanite / VSM и как их выключить для слабых ПК
- [ ] Сделал 3 эффекта Niagara и вызываю их из Blueprint
- [ ] Звуки 3D с затуханием, громкость по Sound Class
- [ ] Умею собрать катсцену в Sequencer
