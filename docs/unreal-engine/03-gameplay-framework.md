# 03. Gameplay Framework — кто за что отвечает

Unreal даёт готовый «скелет» игры из классов. Если положить логику в правильный класс — игра растёт без боли. Если всё свалить в персонажа или Level Blueprint — через месяц всё развалится.

## 3.1 Карта классов

```
GameInstance ── живёт всё время работы игры (между уровнями)
   │
   └── World (текущий уровень)
         ├── GameMode ───── правила этого уровня (только на сервере)
         │      └── GameState ── общее состояние матча (счёт, таймер) — видят все
         │
         ├── PlayerController ── «воля» игрока: ввод, UI, камера
         │      ├── PlayerState ── данные игрока (очки, имя), видят все
         │      ├── HUD / Widgets
         │      └── possesses ──► Pawn / Character ── «тело» в мире
         │
         └── AIController ── «мозг» NPC ──possesses──► Pawn / Character врага
```

| Класс | Отвечает за | Пример логики |
|---|---|---|
| **GameInstance** | Данные между уровнями, настройки, загрузка сохранения | Выбранный герой, громкость, текущий слот сохранения |
| **GameMode** | Правила: какие классы использовать, условия победы/поражения, респаун | «Собрал 20 кристаллов — победа», «игрок умер — рестарт через 3 сек» |
| **GameState** | Состояние матча, общее для всех | Оставшееся время, собрано всего |
| **PlayerController** | Ввод, переключение UI/игра, пауза, управление камерой | Открыть меню паузы по Esc, показать курсор |
| **PlayerState** | Данные конкретного игрока (переживают смерть пешки) | Очки, убийства |
| **Pawn** | Любое управляемое тело | Машина, камера-наблюдатель, турель |
| **Character** | Pawn с капсулой, скелетным мешем и **Character Movement** (ходьба, прыжки, плавание, полёт) | Герой, гуманоидные враги |
| **HUD** | Старый способ рисования UI. Сейчас UI делают виджетами (UMG) | — |
| **AIController** | Мозг NPC: Behavior Tree, восприятие | Патруль, погоня |

## 3.2 Настройка своего GameMode

1. Создай `BP_GameMode` (родитель **Game Mode Base**), `BP_PlayerController` (Player Controller), `BP_GameInstance` (Game Instance).
2. Открой `BP_GameMode` → Details → Classes:
   - Default Pawn Class → твой персонаж
   - Player Controller Class → `BP_PlayerController`
3. **Project Settings → Maps & Modes**:
   - Default GameMode → `BP_GameMode`
   - Game Instance Class → `BP_GameInstance`
4. Для отдельного уровня можно переопределить: Window → **World Settings** → GameMode Override.

**Game Mode Base** vs **Game Mode**: второй добавляет логику «матча» (MatchState, ожидание игроков). Для одиночной игры хватает **Game Mode Base**.

## 3.3 Как получить ссылки друг на друга

| Нужно | Нода |
|---|---|
| Персонаж игрока | `Get Player Character (0)` → `Cast To BP_Hero` |
| Контроллер игрока | `Get Player Controller (0)` |
| GameMode | `Get Game Mode` → `Cast To BP_GameMode` (только на сервере/в одиночке) |
| GameInstance | `Get Game Instance` → `Cast To BP_GameInstance` |
| Все акторы класса | `Get All Actors Of Class` — **медленно**, только на BeginPlay, не в Tick |
| Владелец компонента | `Get Owner` |
| Контроллер пешки | `Get Controller` |
| Пешка контроллера | `Get Controlled Pawn` |

**Cast To** — проверка «этот объект действительно BP_Hero?». Если да — получаешь доступ к его переменным. Если нет — срабатывает `Cast Failed`.
Совет: делай Cast **один раз на BeginPlay** и сохраняй результат в переменную (`HeroRef`), а не кастуй каждый кадр.

## 3.4 Три способа общения Blueprints

| Способ | Когда | Пример |
|---|---|---|
| **Прямая ссылка + Cast** | Ты точно знаешь класс получателя, связь «один к одному» | Монета говорит герою «+1» |
| **Blueprint Interface** | Разные классы реагируют на одно сообщение по-своему. Не нужен Cast | `Interact` у двери, сундука, NPC, рычага |
| **Event Dispatcher** | Объект сообщает «со мной случилось X», а кто подписан — реагирует. Отправитель не знает подписчиков | Герой «здоровье изменилось» → HUD обновляет полоску; босс «умер» → дверь открылась |

Подробно с примерами — в гл. 05.

## 3.5 Жизненный цикл актора

1. **Construction Script** (в редакторе и при спавне)
2. **BeginPlay**
3. **Tick** каждый кадр (если включён: Class Defaults → Actor Tick → Start with Tick Enabled)
4. **EndPlay** / **Destroyed**

Спавн во время игры: `Spawn Actor from Class` (Class, Spawn Transform, Collision Handling Override). Переменные с флагом **Expose on Spawn** появятся пинами прямо на ноде.

## 3.6 Компоненты как переиспользуемая логика

**Actor Component** (без положения в мире) — логика, которую можно «прикрутить» к любому актору:
- `BPC_Health` — здоровье, урон, смерть, диспетчер `OnHealthChanged`, `OnDeath`
- `BPC_Inventory` — инвентарь
- `BPC_Interaction` — поиск объектов для взаимодействия

Добавил `BPC_Health` и герою, и врагу, и бочке — у всех есть здоровье без копирования кода. **Это один из главных приёмов хорошей архитектуры в UE.**

**Scene Component** — то же, но с положением (например, точка спавна снарядов).

## 3.7 Gameplay Tags

Project Settings → **Gameplay Tags** → иерархические метки: `Status.Stunned`, `Damage.Fire`, `Item.Key.Red`.
Переменная типа **Gameplay Tag Container** + ноды `Has Tag`, `Has Any`. Гибче, чем десяток Boolean. Используется в GAS (Gameplay Ability System) и State Tree.

## 3.8 Subsystems (продвинутое)

Начиная с UE 5.x в Blueprints можно получить встроенные подсистемы (например, Enhanced Input Local Player Subsystem). Свои подсистемы создаются только на C++ — для Blueprint-проекта замену им дают GameInstance и компоненты.

## Практика

1. Создай `BP_GameMode`, `BP_PlayerController`, `BP_GameInstance`, пропиши их в Project Settings.
2. В `BP_PlayerController` на BeginPlay выведи `Print String "Controller ready"`. Убедись, что выводится.
3. Создай `BPC_Health` (Actor Component): переменные `MaxHealth`, `CurrentHealth`; функция `ApplyHealthChange(Delta)`; диспетчеры `OnHealthChanged(New, Max)`, `OnDeath`. Добавь компонент персонажу.
4. Перенеси счётчик монет из персонажа в `BP_GameMode` (или GameState): монета вызывает `Get Game Mode → Cast → AddCoin`. При 10 монетах GameMode пишет «Победа!».
5. Сохрани имя игрока в GameInstance, смени уровень (`Open Level`) и выведи имя на новом уровне.

## Чек-лист

- [ ] Могу объяснить, что лежит в GameMode, PlayerController, Character, GameInstance
- [ ] Свои классы прописаны в Project Settings
- [ ] Использую Actor Component для переиспользуемой логики
- [ ] Знаю три способа общения: Cast, Interface, Dispatcher
