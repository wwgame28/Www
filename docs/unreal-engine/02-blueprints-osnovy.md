# 02. Основы Blueprints

Blueprint — это программа из **нод** (блоков), соединённых **проводами**. Белые провода (**exec**) задают порядок выполнения, цветные — передают данные.

## 2.1 Виды Blueprints

| Тип | Для чего | Как создать |
|---|---|---|
| **Blueprint Class** | Свой актор/персонаж/компонент с логикой | Content Browser → ПКМ → Blueprint Class → выбрать родителя (Actor, Pawn, Character…) |
| **Level Blueprint** | Логика одного конкретного уровня (катсцена на старте, открыть дверь по триггеру этого уровня) | Панель инструментов → иконка Blueprints → Open Level Blueprint. **Используй редко**: логику нельзя переиспользовать |
| **Blueprint Interface** | Набор «функций-сообщений», которые могут реализовать разные классы | ПКМ → Blueprint → Blueprint Interface |
| **Blueprint Function Library** | Общие функции, доступные из любого Blueprint | ПКМ → Blueprint → Blueprint Function Library |
| **Blueprint Macro Library** | Общие макросы | ПКМ → Blueprint → Blueprint Macro Library |
| **Widget Blueprint** | UI (гл. 06) | ПКМ → User Interface → Widget Blueprint |
| **Animation Blueprint** | Логика анимаций (гл. 07) | ПКМ → Animation → Animation Blueprint |

## 2.2 Редактор Blueprint Class

- **Components** (слева сверху) — дерево компонентов. Корневой компонент (`DefaultSceneRoot`) определяет положение актора.
- **My Blueprint** (слева снизу) — графы, функции, макросы, переменные, диспетчеры.
- **Viewport** — визуальный вид актора.
- **Construction Script** — выполняется **в редакторе** при каждом изменении/перемещении актора и при спавне. Для процедурной расстановки, настройки внешнего вида.
- **Event Graph** — логика во время игры.
- **Details** — свойства выбранной ноды/переменной/компонента.
- **Compile** (F7) и **Save** — после каждого изменения. Зелёная галочка = всё ок.

## 2.3 События (с чего начинается выполнение)

| Событие | Когда срабатывает |
|---|---|
| `Event BeginPlay` | Актор появился в игре (старт уровня или спавн) |
| `Event Tick` | **Каждый кадр**. Выход `Delta Seconds` — время кадра. Используй минимально (см. гл. 10) |
| `Event ActorBeginOverlap` / `EndOverlap` | Что-то вошло/вышло из коллизии актора |
| `On Component Begin Overlap (Box)` | То же, но для конкретного компонента (выдели компонент → внизу Details зелёные «+») |
| `Event Hit` | Физическое столкновение (нужен Simulation Generates Hit Events) |
| `Event AnyDamage` | Актору нанесли урон через `Apply Damage` |
| `Event Destroyed` | Актор уничтожается |
| Custom Event | Своё событие: ПКМ → Add Custom Event. Можно вызывать из других мест, по таймеру, по сети |
| Input-события | Нажатия клавиш через Enhanced Input (гл. 04) |

## 2.4 Переменные

Создание: My Blueprint → Variables → «+». Тип выбирается в Details.

| Тип | Цвет провода | Пример |
|---|---|---|
| Boolean | красный | `bIsDead`, `bHasKey` |
| Integer | бирюзовый | `Coins`, `Ammo` |
| Float | зелёный | `Health`, `Speed` |
| Name / String / Text | сиреневый / розовый / розовый | Text — для UI (переводится), String — для логики, Name — для идентификаторов |
| Vector | жёлтый | позиция, направление |
| Rotator | фиолетово-синий | поворот (Pitch, Yaw, Roll) |
| Transform | оранжевый | позиция + поворот + масштаб |
| Object Reference | синий | ссылка на конкретный актор/виджет: `PlayerRef`, `DoorRef` |
| Class Reference | фиолетовый | ссылка на **тип** (для Spawn Actor) |
| Enum / Struct | — | свои типы (2.9) |

Важные флажки переменной в Details:
- **Instance Editable** (иконка глаза) — можно менять значение у каждого экземпляра на уровне.
- **Expose on Spawn** — значение передаётся в ноду `Spawn Actor from Class`.
- **Category** — группировка в Details.
- **Tooltip** — подсказка.
- Значение по умолчанию задаётся после **Compile**.

Get/Set: перетащи переменную в граф с **Ctrl** — Get, с **Alt** — Set.

## 2.5 Управление потоком (Flow Control)

| Нода | Что делает |
|---|---|
| **Branch** (зажми B + ЛКМ) | if/else по Boolean |
| **Sequence** (S + ЛКМ) | Выполняет выходы Then 0, Then 1… по очереди — для порядка в графе |
| **For Loop** / **For Each Loop** | Цикл по числам / по массиву |
| **While Loop** | Цикл пока условие истинно. Осторожно: бесконечный цикл = зависание |
| **Do Once** | Пропускает только первый раз (до Reset) |
| **Do N** | Пропускает N раз |
| **Flip Flop** | Чередует A/B — включить/выключить свет |
| **Gate** | Открываемые/закрываемые «ворота» для потока |
| **Switch on Int / Enum / String** | Выбор ветки по значению |
| **Delay** (D + ЛКМ) | Пауза. Работает только в Event Graph, не в функциях |
| **Retriggerable Delay** | Delay, который перезапускается при новом входе |
| **Set Timer by Event / by Function Name** | Вызвать событие через N секунд, можно с повтором (Looping). Возвращает **Timer Handle** — им таймер останавливают (`Clear and Invalidate Timer by Handle`) |
| **Timeline** | Плавная анимация значений по кривой (двери, лифты, мигание) |

## 2.6 Функции, макросы, события — что когда

| | Функция | Макрос | Custom Event |
|---|---|---|---|
| Возвращает значения | ✅ | ✅ (несколько exec-выходов) | ❌ |
| Delay / Timeline внутри | ❌ | ✅ | ✅ |
| Локальные переменные | ✅ | ✅ | ❌ |
| Можно вызвать из другого Blueprint | ✅ | ❌ (только библиотеки макросов) | ✅ |
| Можно привязать к таймеру/диспетчеру | ❌ (только по имени) | ❌ | ✅ |
| **Pure** (без exec-проводов) | ✅ галочка Pure | — | — |

Правило: **повторяющийся кусок графа → функция**. Нужна задержка → Custom Event. Выделить ноды → ПКМ → **Collapse to Function**.

Функции-геттеры, которые ничего не меняют, отмечай **Pure** и **Const**. Помни: Pure-функция вычисляется заново **на каждое подключение** её выхода.

## 2.7 Математика и полезные ноды

- `+ - * /` — набери символ в поиске. Для векторов то же.
- `Clamp (Float)` — ограничить значение (здоровье 0..100).
- `Lerp` — интерполяция между A и B по Alpha 0..1.
- `FInterp To` / `VInterp To` / `RInterp To` — плавное приближение к цели каждый кадр (с Delta Time).
- `Random Float in Range`, `Random Integer in Range`, `Random Bool`.
- `Get Actor Location` / `Set Actor Location`, `Get Actor Rotation`, `Add Actor World Offset`, `Add Actor Local Rotation`.
- `Get Forward Vector` — «вперёд» актора; `* 1000` → точка в 10 метрах впереди (1 юнит = 1 см).
- `Find Look at Rotation` — поворот «смотреть на».
- `Get Distance To` — расстояние между акторами.
- `Print String` — вывод текста на экран и в лог. Главный инструмент отладки.
- `Format Text` — «Монет: {Coins}».
- `Is Valid` — проверка, что ссылка не пустая (обязательно перед использованием ссылок, которые могут исчезнуть).

## 2.8 Массивы, Map и Set

Любую переменную можно сделать контейнером — иконка рядом с типом:
- **Array** — упорядоченный список: `Add`, `Remove`, `Get (copy)`, `Length`, `Contains`, `Find`, `For Each Loop`, `Random Array Item`, `Shuffle`.
- **Set** — уникальные элементы без порядка (`Contains` очень быстрый).
- **Map** — словарь ключ → значение: `Add`, `Find`, `Contains`, `Keys`, `Values`. Пример: `Map<Name, Integer>` — инвентарь «Яблоко → 3».

## 2.9 Свои типы: Enum, Struct, Data Table

- **Enumeration** (`E_EnemyState`: Idle, Patrol, Chase, Attack, Dead) — вместо кучи Boolean.
- **Structure** (`S_ItemData`: Name, Icon, Price, MaxStack, Mesh) — пачка полей. Ноды `Make S_ItemData` / `Break S_ItemData`.
- **Data Table** (`DT_Items`, строки по структуре) — таблица данных: все предметы/враги/уровни в одном месте, можно импортировать из CSV. Нода `Get Data Table Row`.
- **Primary Data Asset** — альтернатива Data Table: каждый предмет отдельным ассетом.

Правило хорошего дизайна: **цифры баланса (урон, здоровье, цены) — в данных, а не внутри графов**.

## 2.10 Наследование

Любой Blueprint можно сделать родителем: ПКМ по `BP_Pickup` → **Create Child Blueprint Class** → `BP_Pickup_Coin`, `BP_Pickup_Health`.
- Ребёнок получает все компоненты, переменные и функции.
- Функцию родителя можно **переопределить** (My Blueprint → Functions → Override). Чтобы вызвать оригинал — ПКМ по ноде события → **Add Call to Parent Function**.
- Так делают всё семейство: базовый враг → зомби, лучник, босс.

## 2.11 Организация графа

- **Comment** — выдели ноды и нажми **C**.
- **Reroute**-узлы — двойной клик по проводу.
- **Q** — выровнять ноды по прямой.
- Держи граф слева направо, без «лапши».
- Один Event Graph — до ~50 нод; больше — выноси в функции.

## Практика (в `L_Sandbox`)

1. **Вращающийся куб**: `BP_Rotator` (Actor) с Static Mesh. Переменная `RotationSpeed` (Float, Instance Editable). Event Tick → `Add Actor Local Rotation` (Yaw = Speed × Delta Seconds). Поставь 3 экземпляра с разной скоростью.
2. **Лампа-переключатель**: `BP_Lamp` с Point Light и Box Collision. On Component Begin Overlap → Flip Flop → `Set Visibility` света.
3. **Дверь на Timeline**: `BP_Door` (рама + створка). Overlap → Timeline (0→1 за 1 сек) → `Lerp (Rotator)` → `Set Relative Rotation` створки. End Overlap → Reverse.
4. **Счётчик**: 5 монет `BP_Coin`; при overlap → `Print String` «Подобрано: N» → `Destroy Actor`. Счётчик пока храни в персонаже (Cast To BP_ThirdPersonCharacter → увеличить переменную `Coins`).
5. **Спавнер**: `BP_Spawner` каждые 2 сек (`Set Timer by Event`, Looping) создаёт `BP_Coin` в случайной точке (`Random Point in Bounding Box`) — не больше 10.
6. **Данные**: Enum `E_Rarity`, Struct `S_ItemData`, Data Table из 5 предметов. Выведи на BeginPlay все строки через `Get Data Table Row Names` + For Each.

## Чек-лист

- [ ] Понимаю разницу между exec-проводом и проводом данных
- [ ] Знаю, когда функция, когда Custom Event, когда макрос
- [ ] Использую Timer вместо Tick для периодических действий
- [ ] Умею наследовать Blueprint и переопределять функции
- [ ] Создал Enum, Struct и Data Table
- [ ] Граф читается: комментарии, функции, без «лапши»
