# 18. Физика Chaos: разрушения, транспорт, ткань, жидкости

Chaos — физический движок UE5 (заменил PhysX).

## 18.1 Основы тел
- **Simulate Physics**, Mass (кг), Linear/Angular Damping, Center of Mass, **Physical Material** (трение, упругость, Surface Type — для звуков шагов и эффектов попаданий: Project Settings → Physics → Physical Surface).
- Коллизия: простые примитивы (Box/Sphere/Capsule/Convex) — быстро; Complex as Simple — только для статики.
- **CCD** (Continuous Collision Detection) — для быстрых объектов, чтобы не пролетали сквозь стены.
- Substepping (Project Settings → Physics) — точность при низком FPS.
- **Async Physics** (отдельный тик физики) — для детерминированной физики и сети.

## 18.2 Ограничения (Constraints)
**Physics Constraint Component/Actor**: Linear/Angular Limits (Free/Limited/Locked), моторы (Angular Drive) — двери на петлях, мосты, маятники, цепи, лебёдки. **Cable Component** — визуальный трос.

## 18.3 Разрушения (Chaos Destruction)
1. Переключатель режимов (панель инструментов, Selection Mode ▾) → **Fracture** → выбери меш → **New** (создаётся Geometry Collection `GC_`).
2. Способы раскола: Uniform, Clustered, Radial, Planar, Slice, Brick, Mesh.
3. Уровни кластеров — сначала откалываются крупные куски, потом мелкие.
4. **Damage Thresholds** — какая сила разрушает.
5. **Fields** (Field System Actor): Anchor Field (закрепить основание), Master Field / Strain (разрушить в точке), Radial Falloff (взрыв), Sleep/Disable (успокоить обломки).
6. Оптимизация: Remove on Break / Remove on Sleep, Max cluster level, кэши (**Chaos Cache Manager** — запись разрушения и проигрывание как анимации, дёшево).

## 18.4 Транспорт (Chaos Vehicles)
Плагин **Chaos Vehicles**; шаблон **Vehicle** (Advanced Vehicle).
- `Wheeled Vehicle Pawn` + Skeletal Mesh с костями колёс + Physics Asset.
- `Chaos Wheeled Vehicle Movement Component`: колёса (Wheel Classes: радиус, трение, подвеска, тормоза, Affected by Steering/Engine), двигатель (Torque Curve, Max RPM), КПП, дифференциал.
- Ввод: `Set Throttle Input`, `Set Steering Input`, `Set Brake Input`, `Set Handbrake Input`.
- Animation Blueprint с нодой **Wheel Controller** для вращения колёс.
- Посадка в машину: `Possess` машины, скрыть/прикрепить персонажа, смена Mapping Context.
- Мотоциклы/танки — доработка на C++ или ассеты Fab.

## 18.5 Ткань, волосы, мягкие тела
- **Chaos Cloth**: в редакторе Skeletal Mesh → Clothing → создать Clothing Data из секции → покрасить Max Distance. Новое: **Cloth Asset / Dataflow** (production-ready в 5.8) — нодовый граф настройки ткани.
- **Groom** (плагин Hair Strands) — волосы и мех по прядям (MetaHuman).
- **Chaos Flesh** (экспериментально) — мягкие тела, мышцы.
- **Physics Asset** + **Physical Animation Component** — «активный рэгдолл» (персонаж реагирует на удары, не теряя анимации).
- **Physics Control Component** (5.3+) — управление физикой костей.

## 18.6 Жидкости и газы
**Niagara Fluids** (плагин): 2D/3D газ (огонь, дым), жидкости (FLIP), мелкая вода на поверхности (Shallow Water). Тяжело для реального времени — для катсцен и малых областей.

## 18.7 Отладка физики
`Chaos Visual Debugger` (Tools → Debug) — запись и покадровый разбор физики; `p.Chaos.DebugDraw.Enabled 1`; `show collision`; `stat physics`.

## Практика
1. Разрушаемая стена от выстрела (Field в точке попадания).
2. Подвесной мост из досок на констрейнтах.
3. Машина с посадкой/высадкой персонажа.
4. Плащ персонажа на Chaos Cloth.
5. Активный рэгдолл при попадании.

## Чек-лист
- [ ] Понимаю Physical Material, CCD, Constraints
- [ ] Сделал разрушение с Fields и оптимизацией обломков
- [ ] Настроил Chaos Vehicle
