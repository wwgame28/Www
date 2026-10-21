# 17. Открытые миры, ландшафт и процедурная генерация (PCG)

## 17.1 Landscape

**Landscape Mode** (Shift+2):
- **Manage → New**: размер по рекомендуемым значениям (например, 2017×2017 при Section Size 63×63, 2×2 sections — см. таблицу «Landscape Technical Guide»). Размер компонентов влияет на производительность.
- **Sculpt**: Sculpt, Smooth, Flatten, Ramp, Erosion, Hydro Erosion, Noise, Retopologize. **Edit Layers** — неразрушающие слои скульпта.
- **Import** карты высот (16-bit PNG/RAW) из World Machine, Gaea, World Creator.
- **Paint**: материал ландшафта с `Landscape Layer Blend` (трава, земля, камень, снег) → Layer Info → кисти. Авто-материал: смешивание по уклону (`World Aligned Blend`) и высоте.
- **Landscape Grass Type** — автоматическая трава по слою.
- **Nanite Landscape** — включается в настройках ландшафта, даёт детализацию и стабильную производительность.
- **Mesh Terrain** (экспериментально в 5.8) — новая система рельефа на основе мешей (пещеры, нависания, что невозможно в карте высот). Следи за статусом в релиз-нотах.

## 17.2 Вода

Плагин **Water**: Water Body Ocean / Lake / River / Custom, Water Zone, волны (Gerstner), плавучесть (**Buoyancy Component**), подводный пост-процесс. Реки рисуются сплайном и сами режут ландшафт.

## 17.3 World Partition

- Включён в шаблоне **Open World** (или Tools → Convert Level).
- Мир делится на сетку **Runtime Grid**; ячейки грузятся по **Loading Range** вокруг **World Partition Streaming Source** (игрок по умолчанию).
- **One File Per Actor (OFPA)** — каждый актор отдельный файл → команда работает без конфликтов.
- **Data Layers** — включаемые слои (сезоны, сюжетные состояния). Runtime Data Layers переключаются из Blueprint.
- **Level Instances / Packed Level Actors** — переиспользуемые «префабы» из групп акторов.
- **HLOD** — объединённые упрощённые версии дальних ячеек: Build → Build HLODs.
- **Large World Coordinates** (double precision) — миры до 88 млн км без дрожания.
- Окно **World Partition** (Window) — карта, загрузка областей в редакторе.

## 17.4 Foliage

**Foliage Mode** (Shift+3): кисть растительности, плотность, масштаб, выравнивание по нормали, Cull Distance. Используй **Nanite Foliage** и/или LOD + Impostors. **Procedural Foliage Spawner** — старый способ; сейчас лучше PCG.

## 17.5 PCG Framework (Procedural Content Generation)

Включи плагин **Procedural Content Generation Framework** (и **PCG Geometry Script Interop**, **PCG Biome Core** по желанию).

Ключевые понятия:
- **PCG Graph** — граф нод, обрабатывающий **точки** (point data) и **пространственные данные** (ландшафт, сплайны, объёмы, меши).
- **PCG Component** на акторе / **PCG Volume** — где запускать граф.
- Типовая цепочка: `Get Landscape Data` → `Surface Sampler` (точки по поверхности) → `Density Filter` / фильтр по уклону/слою → `Transform Points` (рандом поворота/масштаба) → `Self Pruning` / `Difference` (исключить дороги и дома) → `Static Mesh Spawner`.
- **Сплайны**: `Spline Sampler` — заборы, дороги, деревья вдоль реки.
- **Attributes / Metadata** — у точек свои атрибуты (тип биома, высота), фильтрация по ним.
- **Subgraphs**, параметры графа (Graph Parameters) — переиспользование.
- **Runtime Generation** — генерация во время игры вокруг игрока (бесконечные миры, рогалики).
- **PCG Biome** — набор для правил биомов.
- **Shape Grammar** и сборка зданий по правилам, **Grammar**-ноды (5.5+).
- Отладка: кнопка Debug на ноде показывает точки во вьюпорте, **Inspect** — таблица атрибутов.

Пример «лес»: ландшафт → сэмплинг 1 точка на 4 м² → фильтр уклона < 30° → не ближе 5 м к сплайну дороги → 70 % деревья (3 вида), 30 % кусты → рандом масштаба 0.8–1.3 → спавн.

## 17.6 Моделирование внутри UE

**Modeling Mode** (Shift+5): примитивы, PolyEdit, булевы операции, UV, запекание, Remesh, Simplify. Для блокинга уровней и правок без Blender.
**Geometry Script** (плагин) — процедурные меши из Blueprint (генерация лестниц, стен, разрушений, своих инструментов).
**Cube Grid** — быстрое построение уровней кубиками.

## 17.7 Процедурные уровни для рогаликов

- Комнаты как **Level Instances** + `Load Level Instance` в точки соединения.
- Или Data Table «комната → выходы» и алгоритм в Blueprint/C++ (random walk, BSP).
- Или PCG Runtime + Grammar.
- Обязательно: NavMesh **Dynamic** для ИИ на сгенерированных уровнях.

## Практика
1. Ландшафт 2×2 км с авто-материалом (трава/камень по уклону, снег по высоте).
2. Река с плавающими бочками (Buoyancy).
3. PCG-лес с дорогой-сплайном, где деревья не растут на дороге.
4. Открытый мир с World Partition, Data Layer «ночь/день», HLOD.
5. Генератор подземелья из 10 комнат.

## Чек-лист
- [ ] Умею ландшафт, слои, траву, воду
- [ ] Понимаю World Partition, Data Layers, HLOD, OFPA
- [ ] Собрал PCG-граф с фильтрами и сплайнами
