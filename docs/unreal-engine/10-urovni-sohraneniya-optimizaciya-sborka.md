# 10. Уровни, сохранения, оптимизация, сборка

## 10.1 Смена уровней

- `Open Level (by Name)` / `Open Level (by Object Reference)` — полная загрузка нового уровня. Всё, кроме **GameInstance**, уничтожается.
- Данные между уровнями — в GameInstance или в SaveGame.
- Экран загрузки: простой вариант — виджет на весь экран перед `Open Level`; правильный — плагин/модуль загрузочного экрана (Common Loading Screen из Lyra, C++) или **Level Streaming**.

### Level Streaming
Постоянный уровень (Persistent) + подуровни (Window → **Levels**). Подгрузка без экрана загрузки:
- `Load Stream Level (by Name)` / `Unload Stream Level`
- **Level Streaming Volume** — подгрузка при входе игрока в объём.

### World Partition (открытые миры)
Шаблон уровня **Open World**: мир делится на сетку, ячейки грузятся вокруг игрока автоматически. **Data Layers** — слои контента (например, «до битвы» / «после битвы»). **HLOD** — упрощённые дальние версии.

## 10.2 Сохранения (SaveGame)

1. ПКМ → Blueprint Class → **SaveGame** → `BP_SaveGame`. Переменные: `Coins`, `UnlockedLevels` (Array), `PlayerTransform`, `Settings`, `CollectedIDs` (Set of Name).
2. Сохранение:
```
Does Save Game Exist (Slot "Slot1", User Index 0)
  → да: Load Game from Slot → Cast To BP_SaveGame → SaveRef
  → нет: Create Save Game Object (BP_SaveGame) → SaveRef
SaveRef → Set Coins (текущее значение)
Save Game to Slot (SaveRef, "Slot1", 0)       // или Async Save Game to Slot
```
3. Загрузка — на старте в GameInstance (`Event Init`) или в GameMode (BeginPlay): `Load Game from Slot` → применить значения.
4. Сохранять собранные на уровне предметы: каждому предмету — уникальный `ItemID` (Name, Instance Editable). Подобрал → `CollectedIDs.Add(ItemID)`. На BeginPlay предмет проверяет `CollectedIDs.Contains(ItemID)` → `Destroy Actor`.

Файлы сохранений лежат в `%LOCALAPPDATA%/<Project>/Saved/SaveGames/` (в упакованной игре).

**Чекпоинты:** триггер `BP_Checkpoint` сохраняет Transform; при смерти — `Set Actor Transform` в последний чекпоинт.

## 10.3 Оптимизация

### Как измерять (сначала измерь — потом чини)
| Команда консоли (` или ~) | Что показывает |
|---|---|
| `stat fps` / `stat unit` | FPS; время Game (логика), Draw (CPU рендер), GPU. Самое большое = узкое место |
| `stat game` | Время Tick, Blueprints |
| `stat scenerendering` | Draw calls |
| `stat gpu` | Что ест GPU |
| `profilegpu` | Снимок кадра GPU |
| **Unreal Insights** | Полноценный профайлер (Tools → Unreal Insights, запуск игры с `-trace=default`) |
| `t.MaxFPS 60` | Ограничить FPS |
| Viewport → View Mode → **Shader Complexity**, **Light Complexity**, **Nanite Visualization** | Дорогие места |

### Blueprint-оптимизация
- **Tick — главный враг.** Отключай Tick у всего, где он не нужен (Class Defaults → Start with Tick Enabled = false). Используй **таймеры** и **события**.
- Нужен Tick — уменьши частоту: **Tick Interval** = 0.1.
- Не вызывай `Get All Actors of Class` в Tick; кэшируй ссылки.
- Не используй **Binding** в UMG для часто меняющихся данных — диспетчеры.
- Cast — дешёвый, но каждая жёсткая ссылка на класс тянет его ассеты в память. Для «всего подряд» — интерфейсы и **Soft Object/Class References** (`Async Load Asset`).
- **Object Pooling**: вместо Spawn/Destroy сотен пуль — массив скрытых, переиспользуемых.
- Тяжёлая математика в цикле на тысячи элементов — повод перенести этот кусок в C++ (позже).

### Рендер-оптимизация
- Nanite для статичной геометрии; LOD для скелетных мешей.
- **Instanced Static Mesh / Hierarchical ISM** (или Foliage) — тысячи одинаковых объектов одним вызовом.
- Меньше динамических теней: у мелких источников Cast Shadows = false; Attenuation Radius поменьше.
- **Cull Distance Volume** — мелкие объекты не рисуются вдали.
- Прозрачные материалы и частицы — дорогие при перекрытии (overdraw).
- Текстуры: размеры степени двойки, не больше нужного; Texture Group и Mip Gen Settings.
- **Scalability**: дай игроку меню качества (гл. 06).
- **TSR** (Temporal Super Resolution) — апскейлинг по умолчанию; Screen Percentage 66–75 даёт большой прирост.

Цель: стабильные 60 FPS на целевом ПК. Тестируй **в упакованной сборке**, не только в редакторе (редактор медленнее).

## 10.4 Сборка (упаковка) игры

1. **Project Settings → Maps & Modes**: Game Default Map = главное меню.
2. **Project Settings → Packaging**:
   - Build Configuration = **Shipping** (для релиза; Development — для тестов, в ней работает консоль).
   - **List of maps to include in a packaged build** — добавь все уровни (иначе `Open Level` в сборке не найдёт карту).
   - Use Pak File / Use Io Store = true.
   - Additional Asset Directories to Cook — если грузишь ассеты по имени.
3. **Project Settings → Description**: название, компания, иконка (Windows → Game Icon — .ico 256×256), Splash.
4. Панель инструментов → **Platforms → Windows → Package Project** → выбрать папку (без кириллицы).
5. Результат: `Windows/<Project>.exe` + папка с данными. Для раздачи — заархивировать всю папку `Windows`.
6. Если сборка упала — открой **Output Log**, ищи первую строку с `Error`. Частые причины — в гл. 12.

**Требования для запуска у игрока**: Windows 10/11 64-bit, DirectX 12 GPU; в сборку включи установщик пререквизитов (Packaging → Include Prerequisites installer = true).

**Project Launcher** (Tools → Project Launcher) — гибкие профили сборки, DLC, патчи.

## 10.5 Контроль версий

Проект Unreal большой и бинарный — используй:
- **Git + Git LFS** (GitHub/GitLab): `.gitattributes` с `*.uasset`, `*.umap`, `*.fbx`, `*.wav`, `*.png` → LFS. В `.gitignore`: `Binaries/`, `Intermediate/`, `Saved/`, `DerivedDataCache/`, `.vs/`.
- Или **Perforce (Helix Core)** — стандарт индустрии, бесплатно до 5 пользователей; или **Diversion**/**Anchorpoint** — проще для новичков.
- В редакторе: Revision Control (внизу справа) → подключение; **One File Per Actor** (World Partition) снижает конфликты.
- Blueprint-файлы нельзя смёрджить вручную — договаривайтесь, кто какой ассет правит (Check Out/Lock в Perforce или Git LFS locks).

Минимальный `.gitignore`:
```
Binaries/
DerivedDataCache/
Intermediate/
Saved/
.vs/
*.sln
```

## Практика

1. Главное меню → уровень 1 → уровень 2, данные (монеты) переносятся через GameInstance.
2. `BP_SaveGame`: монеты, открытые уровни, собранные предметы, настройки; кнопка «Продолжить» в меню.
3. Чекпоинты.
4. Замерь `stat unit` до и после: отключи лишние Tick, замени спавн пуль на пул.
5. Собери **Development**-сборку, запусти, проверь, что всё работает; затем **Shipping**.
6. Залей проект в Git с LFS.

## Чек-лист

- [ ] Данные переживают смену уровня и перезапуск игры
- [ ] Знаю `stat unit` и где узкое место
- [ ] Получил рабочий .exe
- [ ] Проект под контролем версий
