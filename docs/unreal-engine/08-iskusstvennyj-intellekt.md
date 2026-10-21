# 08. Искусственный интеллект (AI)

## 8.1 Составные части

| Часть | Роль |
|---|---|
| **Nav Mesh Bounds Volume** | Объём, внутри которого строится сетка навигации. Нажми **P** во вьюпорте — зелёная область = где ИИ может ходить |
| **AIController** (`BP_AIC_Enemy`) | Мозг: запускает дерево поведения, получает восприятие |
| **Behavior Tree** (`BT_`) | Дерево решений: что делать сейчас |
| **Blackboard** (`BB_`) | «Память» ИИ: переменные-ключи (TargetActor, PatrolPoint, bCanSeePlayer) |
| **AI Perception** | Зрение, слух, урон — «органы чувств» |
| **EQS** (Environment Query System) | Поиск лучшей точки: укрытие, позиция для стрельбы, точка обхода |
| **State Tree** | Альтернатива Behavior Tree: иерархическая машина состояний (production-ready в UE 5.4+; хороша и для ИИ, и для логики объектов) |
| **Smart Objects** | Объекты, которые «предлагают» действия ИИ: лавка — сесть, стойка — облокотиться |
| **Mass AI** | Тысячи простых агентов (толпы, трафик) |

## 8.2 Простейший враг без дерева

```
BP_Enemy (Character), AI Controller Class = AIController, Auto Possess AI = Placed in World or Spawned
Event BeginPlay → Set Timer by Event (0.5 сек, Looping) → ChaseEvent
ChaseEvent → AI Move To (Pawn = Self, Target Actor = Get Player Character, Acceptance Radius = 100)
```
Не забудь **Nav Mesh Bounds Volume** на уровне, растянутый на всю игровую зону.

Враги, которые спавнятся во время игры, получат контроллер, только если `Auto Possess AI = Placed in World or Spawned`. Если во время игры двигаются препятствия (двери, платформы) — Project Settings → Navigation Mesh → **Runtime Generation = Dynamic**.

## 8.3 Behavior Tree — правильный способ

### Blackboard `BB_Enemy`
Ключи: `TargetActor` (Object, Base Class = Actor), `PatrolLocation` (Vector), `LastKnownLocation` (Vector), `State` (Enum `E_EnemyState`).

### Узлы дерева

| Тип | Примеры | Смысл |
|---|---|---|
| **Root** | — | Начало |
| **Composite** | **Selector** | Пробует детей слева направо, пока один не **успешен** («ИЛИ») |
| | **Sequence** | Выполняет детей по очереди, пока один не **провалится** («И») |
| | Simple Parallel | Основная задача + фоновая |
| **Task** (фиолетовые) | Move To, Wait, Rotate to face BB entry, Play Animation, Run EQS Query, свои `BTT_` | Действие |
| **Decorator** (синие, сверху узла) | Blackboard (Is Set / Is Not Set), Cooldown, Loop, Time Limit, свои `BTD_` | Условие входа. **Observer Aborts** = Self / Lower Priority / Both — прервать выполнение, если условие поменялось |
| **Service** (зелёные) | свои `BTS_` | Выполняется периодически, пока ветка активна (обновить расстояние до цели) |

### Типичное дерево врага

```
Root
 └─ Selector
     ├─ Sequence  [Decorator: Blackboard TargetActor Is Set, Observer Aborts = Both]
     │    ├─ Move To (TargetActor, Acceptance Radius 150)
     │    └─ BTT_Attack  (Play Montage + урон)  → Wait 1.0
     ├─ Sequence  [Decorator: LastKnownLocation Is Set]
     │    ├─ Move To (LastKnownLocation)
     │    ├─ Wait 3 (осмотреться)
     │    └─ BTT_ClearKey (LastKnownLocation)
     └─ Sequence  (патруль)
          ├─ BTT_FindRandomPatrol  (Get Random Reachable Point in Radius → Set Blackboard Value as Vector)
          ├─ Move To (PatrolLocation)
          └─ Wait 2 ± 1
```

### Своя задача (BTT_)
ПКМ → Blueprint Class → **BTTask_BlueprintBase** → `BTT_Attack`:
```
Event Receive Execute AI (Owner Controller, Controlled Pawn)
  → Cast To BP_Enemy → Attack (Montage)
  → Finish Execute (Success = true)    ← ОБЯЗАТЕЛЬНО, иначе дерево зависнет
```

### Запуск
`BP_AIC_Enemy` (AIController): `Event On Possess` → **Run Behavior Tree (BT_Enemy)**. У врага: AI Controller Class = `BP_AIC_Enemy`.

Отладка: во время игры нажми **'** (апостроф) — AI Debugger; или открой BT во время Play и выбери экземпляр — увидишь, какая ветка активна.

## 8.4 AI Perception — зрение и слух

В `BP_AIC_Enemy` добавь компонент **AIPerception**:
- Senses Config → **AI Sight config**: Sight Radius 1500, Lose Sight Radius 2000, Peripheral Vision Half Angle 60, **Detection by Affiliation: Detect Enemies/Neutrals/Friendlies** = все три (в Blueprint нельзя назначить команды, поэтому отмечаем все).
- **AI Hearing config**: Hearing Range 1500.
- Dominant Sense = Sight.

```
On Target Perception Updated (Actor, Stimulus)
  → Actor Has Tag "Player"? → Break AIStimulus → Successfully Sensed?
     true  → Set Value as Object (TargetActor = Actor)
     false → Clear Value (TargetActor), Set Value as Vector (LastKnownLocation = Stimulus Location)
```
Игрок становится видимым автоматически (все Pawn регистрируются как источник зрения по умолчанию). Шум: `Report Noise Event` (при выстреле, беге) — враг услышит.

## 8.5 EQS (кратко)

Включи плагин/настройку EQS (в UE5 включено). Environment Query: **Generator** (сетка точек вокруг врага) → **Tests** (Distance до игрока, Trace — видна ли точка игроку, Pathfinding — достижима ли) → лучшая точка. Применение: найти укрытие, обойти сбоку, отбежать (лучник).

## 8.6 State Tree (кратко)

ПКМ → Artificial Intelligence → **State Tree** (схема StateTree AI Component Schema). Состояния (Idle, Patrol, Chase, Attack) с **Enter Conditions**, **Tasks** и **Transitions** — иерархическая машина состояний с понятной визуализацией. В UE 5.5+ это рекомендованная Epic альтернатива Behavior Tree для новых проектов; принципы те же — сначала освой BT по этой главе, затем попробуй переписать врага на State Tree.

## 8.7 Типы врагов — рецепты

| Враг | Что меняется |
|---|---|
| Ближний бой | Move To + атака Montage |
| Стрелок | Держать дистанцию (EQS: точка на расстоянии 800–1200 с линией видимости) + спавн снарядов |
| Камикадзе | Max Walk Speed выше, при подходе — Apply Radial Damage и Destroy |
| Босс | Фазы через Enum State + разные ветки дерева; полоска здоровья в HUD через диспетчер |
| Турель | Pawn без движения, Find Look at Rotation + RInterp To на Tick |

## 8.8 Волны врагов

`BP_WaveManager` (или в GameMode): массив точек спавна (`Target Point` на уровне, Instance Editable массив), номер волны, `EnemiesAlive`. Спавн через `Spawn AI from Class` (сразу с Behavior Tree). Подписка на `OnDeath` каждого врага → `EnemiesAlive − 1` → при 0 — следующая волна через 5 сек.

## Практика

1. NavMesh на уровне; простой враг, бегущий за игроком.
2. Полноценный враг: BT + Blackboard + Perception (зрение + слух), патруль, погоня, поиск по последней позиции, атака.
3. Враг-стрелок с EQS.
4. Менеджер волн.
5. Перепиши одного врага на State Tree и сравни.

## Чек-лист

- [ ] Понимаю Selector / Sequence / Decorator / Service / Task
- [ ] Мои задачи всегда вызывают Finish Execute
- [ ] Враг видит, слышит, теряет игрока и ищет его
- [ ] Умею отлаживать ИИ через AI Debugger и BT во время игры
