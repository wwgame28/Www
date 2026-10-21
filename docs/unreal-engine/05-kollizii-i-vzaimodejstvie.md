# 05. Коллизии и взаимодействие объектов

## 5.1 Коллизия: как объекты «видят» друг друга

Каждый примитив (меш, капсула, бокс) имеет:
- **Collision Enabled**: No Collision / Query Only (трассы и overlap) / Physics Only / Collision Enabled (всё).
- **Object Type**: WorldStatic, WorldDynamic, Pawn, PhysicsBody, Vehicle, Destructible + свои.
- **Ответы на каналы**: для каждого Object Type и Trace-канала — **Ignore / Overlap / Block**.

Правило: **Block** срабатывает, только если оба объекта блокируют друг друга. **Overlap** — если хотя бы один Overlap, а другой не Ignore. Плюс у компонента должно быть **Generate Overlap Events = true**.

Готовые пресеты (Collision Presets): `BlockAll`, `OverlapAllDynamic`, `Pawn`, `Trigger`, `NoCollision`, `PhysicsActor`… Для триггеров бери **Trigger** или `OverlapAllDynamic`.

Свои каналы: Project Settings → **Collision** → New Object Channel (например, `Projectile`) / New Trace Channel (`Interact`).

Отладка: во вьюпорте **Show → Collision** или консольная команда `show collision` в игре.

## 5.2 Overlap и Hit

```
On Component Begin Overlap (TriggerBox)
  Other Actor → Cast To BP_Hero → (успех) → логика
```
или лучше без Cast — через тег или интерфейс:
```
Other Actor → Actor Has Tag ("Player") → Branch
```

**Hit** — при физическом столкновении: у компонента включи **Simulation Generates Hit Events**. Событие `Event Hit` / `On Component Hit` даёт точку удара, нормаль, Other Actor.

## 5.3 Трассировки (Line Trace / Sphere Trace)

«Луч» из точки A в точку B, возвращает первое, во что попал.

```
Start = Camera World Location
End   = Start + Camera Forward Vector × 1000
Line Trace By Channel (Visibility, Draw Debug Type = For Duration)
  → Return Value (bool попал?) → Branch
  → Out Hit → Break Hit Result → Hit Actor, Location, Impact Normal
```

Виды: `Line Trace`, `Sphere Trace` (толстый луч), `Box Trace`, `Capsule Trace`, `Multi…` (все попадания), `…ForObjects` (по типам объектов). **Draw Debug Type** — визуально видно луч, незаменимо при отладке.

Применение: стрельба hitscan, «на что я смотрю» для взаимодействия, проверка земли, видимость.

## 5.4 Урон

Встроенная система:
```
Атакующий: Apply Damage (Damaged Actor, Base Damage, Event Instigator, Damage Causer)
Жертва:    Event AnyDamage (Damage, Damage Type, Instigated By, Damage Causer)
             → Health = Clamp(Health − Damage, 0, MaxHealth)
             → Branch (Health <= 0) → Die
```
Также `Apply Point Damage` (с направлением, для попаданий в голову через Bone Name) и `Apply Radial Damage` (взрывы, с затуханием).

Свой **Damage Type** (ПКМ → Blueprint Class → DamageType → `DT_Fire`) — чтобы различать огонь, яд и т.п.

## 5.5 Blueprint Interface — взаимодействие с чем угодно

1. Создай `BPI_Interactable` с функциями:
   - `Interact(Instigator: Actor)` — без выходов → в классах это будет **событие**.
   - `GetInteractText() → Text` — с выходом → в классах это будет функция.
2. В `BP_Door`, `BP_Chest`, `BP_Lever`, `BP_NPC`: Class Settings → **Implemented Interfaces → Add → BPI_Interactable**. В My Blueprint появятся `Event Interact` — реализуй по-разному.
3. В герое:
```
IA_Interact Started
  → Line Trace (от камеры на 300 см)
  → Hit Actor → Does Object Implement Interface (BPI_Interactable) → Branch
  → Interact (Message) (Target = Hit Actor, Instigator = Self)
```
Вызов «Message» (иконка конверта) безопасен: если объект не реализует интерфейс — ничего не произойдёт, без ошибок и без Cast.

## 5.6 Event Dispatcher — «подписка на события»

В `BPC_Health`: My Blueprint → Event Dispatchers → «+» → `OnHealthChanged` (входы: NewHealth, MaxHealth), `OnDeath`.

```
Отправитель (BPC_Health):  ...изменили здоровье → Call OnHealthChanged(Health, MaxHealth)

Подписчик (WBP_HUD, Event Construct):
  Get Owning Player Pawn → Get Component by Class (BPC_Health)
   → Bind Event to OnHealthChanged → [Custom Event: UpdateHealthBar(NewHealth, MaxHealth)]
```
Отписка — `Unbind Event from …` (например, при уничтожении виджета).

Примеры: босс `OnDeath` → дверь открывается; кнопка `OnPressed` → платформа едет; GameMode `OnCoinsChanged` → HUD.

## 5.7 Физика

- Static Mesh → **Simulate Physics** = true (меш должен иметь коллизию — проверь в редакторе меша: Show → Simple Collision; если нет — Collision → Add Box Simplified Collision).
- Масса, Linear/Angular Damping — в Details → Physics.
- `Add Impulse` (мгновенный толчок, Vel Change для игнора массы), `Add Force` (постоянная сила, в Tick), `Add Radial Impulse` (взрыв).
- **Physics Constraint** — шарниры, двери на петлях, цепи.
- **Physics Handle** — подбирать и таскать предметы (как в Half-Life).
- Разрушаемость — **Chaos Destruction** (Geometry Collection, Fracture Mode).

## 5.8 Снаряды

`BP_Projectile` (Actor):
- Root: **Sphere Collision** (Collision Preset — свой `Projectile` или BlockAllDynamic), Simulation Generates Hit Events.
- Static Mesh без коллизии (визуал).
- **Projectile Movement Component**: Initial Speed 3000, Max Speed 3000, Projectile Gravity Scale 0 (пуля) / 1 (граната), Should Bounce.
- `On Component Hit` → Apply Damage → эффект → Destroy Actor.
- **Initial Life Span** = 5 сек в Class Defaults — чтобы промахи не копились.
- Спавн из героя: `Spawn Actor from Class` в точке сокета/Arrow-компонента, поворот = Control Rotation, **Instigator** = Self, и `Ignore Actor when Moving` (себя), чтобы снаряд не попадал в стрелка.

## Практика

1. `BPI_Interactable` + дверь, сундук и рычаг, которые открываются по E.
2. Надпись «[E] Открыть» над объектом: в герое трасса на Tick с таймером 0.1 сек → `GetInteractText` → в HUD.
3. `BPC_Health` с `Event AnyDamage`, диспетчерами `OnHealthChanged`, `OnDeath`.
4. Ловушка-шипы: пока стоишь — 10 урона в секунду (таймер на Begin Overlap, Clear на End Overlap).
5. Стрельба снарядами по ЛКМ; бочки (`BP_Barrel` с `BPC_Health`) взрываются с `Apply Radial Damage` и `Add Radial Impulse`.
6. Подбор и бросок ящиков через Physics Handle.

## Чек-лист

- [ ] Понимаю Block / Overlap / Ignore и Object Type
- [ ] Использую Line Trace с отладочной отрисовкой
- [ ] Делаю взаимодействие через Interface без Cast
- [ ] Связываю UI и логику через Event Dispatcher
- [ ] Есть снаряд с уроном и временем жизни
