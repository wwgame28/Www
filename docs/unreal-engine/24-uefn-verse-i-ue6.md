# 24. UEFN, Verse и будущее (Unreal Engine 6)

## 24.1 UEFN — Unreal Editor for Fortnite
- Отдельный бесплатный редактор (Epic Games Launcher → UEFN) для создания островов (игр) внутри Fortnite.
- Плюсы: готовая аудитория в сотни миллионов, сервера, мультиплеер, монетизация через **Fortnite Creator Economy** — выплаты авторам по вовлечённости игроков (Epic объявила о крупных выплатах в 2026 году).
- Ограничения: нет Blueprints и C++ — логика на **Verse** и готовых **устройствах (Devices)**; ограничения по памяти острова и контенту; правила контента Epic.
- Знания редактора UE (уровни, материалы, Niagara, Sequencer, ландшафт, анимация) переносятся почти целиком.

## 24.2 Устройства (Devices)
Готовые блоки логики: Trigger, Button, Item Granter, Elimination Manager, Score Manager, Timer, HUD Message, Spawn Pad, Class Designer, Player Spawner, Mutator Zone… Связываются через **Direct Event Binding** (событие одного устройства → функция другого) — без кода. На них можно собрать много режимов.

## 24.3 Verse — язык Epic
- Функциональный + императивный язык со статической типизацией, **транзакциями** и «failure» как частью языка (`if (Value := Map[Key]):`).
- Создаётся **Verse Device** (`creative_device`) с `OnBegin<override>()<suspends>:void`.
- Конкурентность: `spawn{}`, `race{}`, `sync{}`, `Sleep()` — удобно для игровых скриптов во времени.

```verse
using { /Fortnite.com/Devices }
using { /Verse.org/Simulation }

crystal_counter := class(creative_device):
    @editable Trigger : trigger_device = trigger_device{}
    @editable Message : hud_message_device = hud_message_device{}
    var Count : int = 0

    OnBegin<override>()<suspends> : void =
        Trigger.TriggeredEvent.Subscribe(OnCrystal)

    OnCrystal(Agent : ?agent) : void =
        set Count += 1
        if (Count >= 10):
            Message.Show()
```
- Учебник: dev.epicgames.com → Fortnite → Verse Language Reference, «Learn Programming with Verse».
- **Scene Graph** (бета/развивается) — новая модель сущностей и компонентов в UEFN, предвестник архитектуры UE6.

## 24.4 Unreal Engine 6 — что известно (октябрь 2026)
- Анонсирован 24 мая 2026; **ранний доступ ожидается в конце 2027**, полный релиз — через 12–18 месяцев после.
- По заявлениям Epic: объединение UE и UEFN в один инструмент; **Verse** как язык геймплея наряду с C++ и Blueprints; Scene Graph.
- UE 5.8 — последний запланированный крупный релиз UE5 (Epic оставляет возможность 5.9).
- Что это значит для тебя: учи UE5 сейчас — редактор, рендер, анимация, архитектура и Blueprints продолжат работать; начни знакомиться с Verse в UEFN, чтобы быть готовым к UE6.
- Следи: State of Unreal, блог unrealengine.com/news, Inside Unreal, форумы и публичный Roadmap Epic.

## Практика
1. Остров в UEFN: «собери 10 кристаллов» только на устройствах.
2. То же на Verse-устройстве с таймером и таблицей лидеров.
3. Сравни: что было проще в UE5 Blueprints, а что в Verse?

## Чек-лист
- [ ] Понимаю, чем UEFN отличается от UE5 и что переносится
- [ ] Написал первое Verse-устройство
- [ ] Знаю план Epic по UE6
