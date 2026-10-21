# 15. Мультиплеер и сеть

Unreal изначально сетевой движок (на нём сделаны Fortnite, PUBG, Valorant). Модель — **клиент-сервер с авторитетным сервером**: сервер решает, что правда; клиенты присылают ввод и получают реплицированное состояние.

## 15.1 Режимы

| Режим | Что это |
|---|---|
| **Standalone** | Одиночная игра |
| **Listen Server** | Один из игроков — сервер (кооп на 2–8 человек) |
| **Dedicated Server** | Отдельный сервер без графики (соревновательные игры). Нужен движок из исходников для Server target |
| **Client** | Подключается к серверу |

Тест в редакторе: кнопка ⋮ рядом с Play → **Number of Players = 2–4**, **Net Mode = Play As Listen Server / Play As Client**. Также **Emulate network conditions** (лаг, потери пакетов) в Editor Preferences → Level Editor → Play → Multiplayer Options.

## 15.2 Кто где существует

| Класс | Сервер | Владеющий клиент | Остальные клиенты |
|---|---|---|---|
| GameMode | ✅ | ❌ | ❌ |
| GameState | ✅ | ✅ | ✅ |
| PlayerController | ✅ (все) | ✅ (только свой) | ❌ |
| PlayerState | ✅ | ✅ | ✅ |
| Pawn/Character | ✅ | ✅ | ✅ |
| HUD / Widgets | ❌ | ✅ (только свой) | ❌ |
| GameInstance | у каждого свой, не реплицируется | | |

Отсюда типичные ошибки: обращаться к GameMode с клиента (`Get Game Mode` вернёт None), создавать UI на сервере.

## 15.3 Authority и роли

- **Has Authority** (нода `Switch Has Authority`) — выполняется ли код на сервере (для акторов, созданных сервером).
- **Is Locally Controlled** — это моя пешка на этом компьютере?
- Роли: `ROLE_Authority` (сервер), `ROLE_AutonomousProxy` (моя пешка у меня), `ROLE_SimulatedProxy` (чужие пешки у меня).

## 15.4 Репликация

1. **Актор**: Class Defaults → **Replicates = true**. Движение — **Replicate Movement** (у Character уже включено, плюс Character Movement имеет встроенное предсказание на клиенте).
2. **Переменные**: Details переменной → Replication = **Replicated** или **RepNotify** (вызывает функцию `OnRep_Health` на клиентах при изменении — обновить UI, эффекты). Меняй реплицируемые переменные **только на сервере**.
3. **Компоненты**: Component Replicates.
4. Условия (C++ `DOREPLIFETIME_CONDITION`, в BP — Replication Condition): Owner Only, Skip Owner, Initial Only…
5. **Relevancy**: клиент получает только «релевантные» акторы — по расстоянию (Net Cull Distance Squared), Always Relevant, Only Relevant to Owner.
6. **Net Update Frequency** — частота обновлений; для неважных акторов — понизить.
7. Спавн на сервере реплицированного актора → появится у всех клиентов. Спавн на клиенте → только у него (для эффектов это правильно!).

## 15.5 RPC — удалённые вызовы

Custom Event → Details → **Replicates**:

| Тип | Вызывается | Выполняется | Пример |
|---|---|---|---|
| **Run on Server** | клиентом (из актора, которым он владеет!) | на сервере | «Я стреляю», «Я открываю дверь» |
| **Run on owning Client** | сервером | на клиенте-владельце | «Покажи тебе урон», «Ты победил» |
| **Multicast** | сервером | на сервере и всех клиентах | Звук/эффект взрыва |

**Reliable** — гарантированная доставка (важное: смерть, покупка). **Unreliable** — может потеряться (косметика, частые события).

**Правило владения**: клиент может вызвать Server RPC только у актора, которым **владеет** (свой PlayerController, своя пешка и её оружие с Owner = пешка). У двери на уровне — нельзя: делай `Interact` через пешку/контроллер → Server RPC → сервер вызывает дверь.

### Типичная схема выстрела
```
Клиент: IA_Fire → (локально: анимация, звук, вспышка — для отзывчивости)
        → ServerFire(Start, Direction)   [Run on Server, Reliable]
Сервер: проверить (патроны, кулдаун, разумность направления) → трасса → Apply Damage
        → Health (RepNotify) меняется → OnRep у всех → UI/эффекты
        → MulticastFireFX (Unreliable) → эффекты у остальных (пропустить на владельце)
```

## 15.6 Сетевая отладка и производительность

- **Network Profiler / Networking Insights** (Unreal Insights → `-trace=net`): какие акторы и свойства жрут трафик.
- Консоль: `stat net`, `net.PktLag=100`, `net.PktLoss=5`.
- **Iris** — новая система репликации (production-ready в 5.8), эффективнее для большого числа акторов; включается настройкой проекта/модулями (смотри доку «Iris Replication System»).
- **Replication Graph** (C++) — масштабирование на сотни игроков (используется Fortnite до Iris).
- **Network Prediction / Mover plugin** — продвинутое предсказание движения (Mover — новая экспериментальная система движения вместо Character Movement).

## 15.7 Сессии и подключение

| Способ | Что даёт |
|---|---|
| `open 127.0.0.1` / `open IP:7777` (консоль), `Open Level` с опцией `?listen` | Прямое подключение по IP. Хост: `Open Level (L_Arena, Options = "listen")` |
| **Online Subsystem Null** + ноды `Create Session`, `Find Sessions`, `Join Session` | LAN/тест |
| **Online Subsystem Steam** | Лобби и друзья Steam, NAT через Steam Relay (нужен App ID; для теста 480 — Spacewar) |
| **Epic Online Services (EOS)** | Бесплатно, кроссплатформа: лобби, матчмейкинг, друзья, голос, ачивки, облачные сохранения. Плагин **Online Services EOS** / OSS EOS |
| Плагин **Advanced Sessions** (сообщество) | Больше нод сессий для Blueprints |

Seamless Travel (`ServerTravel` с GameMode → Use Seamless Travel) — смена карты без разрыва соединения.

## 15.8 Выделенный сервер

1. Движок из исходников (гл. 14.12), проект C++.
2. Добавь `MyGameServer.Target.cs` (Type = Server).
3. Сборка: Platforms → Windows/Linux → Build Target = MyGameServer → Package.
4. Хостинг: свой VPS, **AWS GameLift**, **Edgegap**, **Hathora** и др. Linux-серверы дешевле (кросс-компиляция с Windows через тулчейн Linux).

## 15.9 Античит и безопасность

- Никогда не доверяй клиенту: урон, деньги, инвентарь считает сервер; клиент только просит.
- Проверяй параметры RPC (дистанция, кулдауны, наличие предметов).
- Easy Anti-Cheat бесплатен через EOS.

## Практика
1. Кооп на 2 игроков (Listen Server) в «Кристальной арене»: общий счёт кристаллов в GameState, у каждого свои монеты в PlayerState.
2. Здоровье с RepNotify, урон только на сервере, полоски у всех.
3. Подбор предмета через Server RPC (предмет исчезает у всех один раз).
4. Меню хоста/поиска игр через Create/Find/Join Session (OSS Null → Steam).
5. Протестируй с `net.PktLag=150` — что «плывёт»?

## Чек-лист
- [ ] Знаю, где существует каждый класс фреймворка
- [ ] Понимаю Replicated / RepNotify / RPC и владение
- [ ] Логика игры — на сервере, косметика — локально
- [ ] Проверил игру при задержке и потере пакетов
