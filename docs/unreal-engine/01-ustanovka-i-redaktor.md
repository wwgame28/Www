# 01. Установка и редактор

## 1.1 Требования к компьютеру

| | Минимум (будет тормозить) | Комфортно |
|---|---|---|
| ОС | Windows 10/11 64-bit | Windows 11 64-bit |
| Процессор | 4 ядра, 2.5 ГГц | 8+ ядер |
| ОЗУ | 16 ГБ | 32–64 ГБ |
| Видеокарта | DirectX 12, 4 ГБ видеопамяти | RTX 3060 / RX 6700 и выше, 8+ ГБ |
| Диск | SSD, 100 ГБ свободно | NVMe SSD, 250+ ГБ |

macOS и Linux тоже поддерживаются, но учебные материалы и большинство ассетов рассчитаны на Windows. Если ПК слабый — в редакторе включи **Engine Scalability Settings → Medium/Low** (кнопка «Settings» на панели инструментов вьюпорта) и отключи Lumen в настройках проекта (см. гл. 09).

## 1.2 Установка

1. Скачай **Epic Games Launcher** с unrealengine.com и войди (аккаунт Epic бесплатный).
2. Вкладка **Unreal Engine → Library → «+»** рядом с Engine Versions → выбери последнюю версию (5.8) → Install.
3. В опциях установки (стрелка рядом с Launch → Options) можно снять лишние целевые платформы (Android, iOS, Linux), чтобы сэкономить место. **Starter Content** и **Templates and Feature Packs** оставь.
4. Для Blueprint-проектов Visual Studio **не обязательна**. Она понадобится, если захочешь добавить C++ или если сборка попросит компилятор. Тогда ставь Visual Studio 2022 Community с нагрузками «Game development with C++» и «.NET desktop development».

Лицензия: движок бесплатен; Epic берёт 5 % роялти с валовой выручки продукта **сверх первого 1 млн $** (для игр, вышедших одновременно в Epic Games Store, ставка ниже). Учиться и выпускать бесплатные игры можно без отчислений. Актуальные условия — на unrealengine.com/license.

## 1.3 Первый проект

Launch → **Games** → шаблон **Third Person** → справа:
- **Blueprint** (не C++)
- Target Platform: **Desktop**
- Quality Preset: **Maximum** (на слабом ПК — Scalable)
- **Starter Content**: включить
- Имя проекта латиницей без пробелов, путь без кириллицы: `D:\UnrealProjects\MyFirstGame`

> ⚠️ Кириллица и пробелы в пути — частая причина странных ошибок при сборке.

С UE 5.6 у шаблонов есть **варианты** (Variants): например, Third Person → Combat / Platforming / Side Scroller. Это готовые наборы механик — потом очень полезно открыть и разобрать их Blueprints.

## 1.4 Интерфейс редактора

```
┌───────────────────── Главное меню / панель инструментов (Play ▶, Platforms, Settings) ────┐
│ ┌─────────────────────────────── Вьюпорт (сцена) ─────────────────┐ ┌── Outliner ──────┐ │
│ │                                                                  │ │ список акторов   │ │
│ │                                                                  │ ├── Details ───────┤ │
│ │                                                                  │ │ свойства         │ │
│ └──────────────────────────────────────────────────────────────────┘ │ выбранного       │ │
│ ┌── Content Drawer (Ctrl+Space) / Content Browser ─────────────────┐ │                  │ │
│ │ все ассеты проекта: модели, материалы, Blueprints, звуки          │ │                  │ │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

| Панель | Для чего |
|---|---|
| **Viewport** | 3D-сцена уровня |
| **Outliner** | Все акторы на уровне (дерево). Двойной клик — камера летит к объекту |
| **Details** | Свойства выбранного актора/компонента |
| **Content Browser / Drawer** | Файлы проекта. Папка `Content` = корень |
| **Place Actors** (кнопка «+» на панели) | Добавить свет, примитивы, объёмы, камеры |
| **Output Log** (Window → Output Log) | Логи и ошибки — смотри сюда, когда что-то не работает |

## 1.5 Навигация и горячие клавиши

| Действие | Клавиши |
|---|---|
| Летать по сцене | Зажать **ПКМ** + **WASD**, Q/E — вниз/вверх, колесо при зажатой ПКМ — скорость |
| Вращать вокруг объекта | **Alt + ЛКМ** |
| Сфокусироваться на объекте | **F** |
| Перемещение / Поворот / Масштаб | **W / E / R** |
| Мировые/локальные оси | **Ctrl + `** |
| Дублировать | **Alt + тянуть** гизмо, или **Ctrl+D** |
| Поставить на пол | **End** |
| Запуск игры | **Alt+P** (в редакторе), **Esc** — стоп |
| Simulate (без управления персонажем) | **Alt+S** |
| Отпустить мышь в игре | **Shift+F1** |
| Игровой вид во вьюпорте | **G** |
| Открыть ассет по имени | **Ctrl+P** |
| Сохранить всё | **Ctrl+Shift+S** |

## 1.6 Ключевые понятия

- **Level (уровень / карта)** — файл `.umap`, сцена.
- **Actor** — всё, что можно поставить на уровень (свет, меш, персонаж, триггер).
- **Component** — «деталь» внутри актора: Static Mesh, Point Light, Box Collision, Audio, Camera. Актор = контейнер компонентов + логика.
- **Asset** — файл `.uasset` в Content Browser: меш, текстура, материал, звук, Blueprint.
- **Blueprint Class** — свой тип актора с компонентами и логикой (визуальный скрипт). Перетащил на уровень — получил **экземпляр** (instance).
- **World Partition** — в больших открытых мирах уровень автоматически делится на ячейки и подгружается вокруг игрока (включено в шаблонах Open World).

## 1.7 Порядок в проекте с первого дня

```
Content/
  _Game/                 ← всё твоё лежит здесь (подчёркивание поднимает папку наверх)
    Blueprints/
      Characters/  Pickups/  Gameplay/  Core/ (GameMode, GameInstance, SaveGame)
    UI/
    Maps/
    Materials/  Meshes/  Textures/
    Audio/  VFX/
    Input/               ← Input Actions и Mapping Contexts
    AI/
```

Префиксы имён (стандарт индустрии):

| Префикс | Тип | Пример |
|---|---|---|
| `BP_` | Blueprint Class | `BP_Coin`, `BP_Door` |
| `BPI_` | Blueprint Interface | `BPI_Interactable` |
| `WBP_` | Widget Blueprint | `WBP_HUD` |
| `ABP_` | Animation Blueprint | `ABP_Hero` |
| `BS_` | Blend Space | `BS_Locomotion` |
| `AM_` | Anim Montage | `AM_Attack` |
| `BT_` / `BB_` | Behavior Tree / Blackboard | `BT_Enemy` |
| `M_` / `MI_` | Material / Material Instance | `M_Master`, `MI_Gold` |
| `T_` | Texture | `T_Rock_D` (D — diffuse, N — normal) |
| `SM_` / `SK_` | Static / Skeletal Mesh | `SM_Crate`, `SK_Hero` |
| `NS_` | Niagara System | `NS_Explosion` |
| `IA_` / `IMC_` | Input Action / Mapping Context | `IA_Jump`, `IMC_Default` |
| `E_` / `S_` | Enum / Struct | `E_WeaponType`, `S_ItemData` |
| `DT_` | Data Table | `DT_Items` |

Перемещай и переименовывай ассеты **только внутри редактора**, не в проводнике Windows — иначе сломаются ссылки. После переноса: правый клик по папке → **Fix Up Redirectors**.

## Практика

1. Создай проект Third Person (Blueprint, Starter Content).
2. Полетай по уровню, запусти игру (Alt+P), побегай.
3. Создай уровень: File → New Level → **Basic**. Сохрани в `_Game/Maps/L_Sandbox`.
4. Расставь 10 объектов из Starter Content (Content/StarterContent/Props), поменяй им материалы перетаскиванием материала на объект.
5. Добавь Point Light и Spot Light, поменяй цвет и яркость (Intensity).
6. Project Settings → Maps & Modes → **Editor Startup Map** и **Game Default Map** = `L_Sandbox`.

## Чек-лист

- [ ] Свободно летаю по сцене и фокусируюсь на объектах
- [ ] Знаю, чем Actor отличается от Component и Asset
- [ ] Умею двигать/вращать/масштабировать с привязкой (иконки сетки справа во вьюпорте)
- [ ] Знаю, где Output Log
- [ ] В проекте есть папка `_Game` со структурой выше
