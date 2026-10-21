# 07. Анимация

## 7.1 Ассеты анимации

| Ассет | Что это |
|---|---|
| **Skeleton** | Иерархия костей. Анимации привязаны к скелету |
| **Skeletal Mesh** (`SK_`/`SKM_`) | Модель, «натянутая» на скелет |
| **Animation Sequence** (`A_`) | Один клип: бег, прыжок, удар |
| **Blend Space** (`BS_`) | Плавное смешивание клипов по параметрам (скорость, направление) |
| **Animation Montage** (`AM_`) | Клип, запускаемый из логики: атака, перезарядка, смерть. Есть слоты, секции, уведомления |
| **Animation Blueprint** (`ABP_`) | Логика: какую анимацию проигрывать сейчас |
| **Physics Asset** (`PHYS_`) | Физические тела костей — для рэгдолла |
| **IK Rig / IK Retargeter** | Перенос анимаций между разными скелетами |
| **Control Rig** | Процедурная анимация и риггинг прямо в UE |
| **Pose Search (Motion Matching)** | Современная система: сама подбирает лучший кадр из базы анимаций |

## 7.2 Animation Blueprint

ПКМ → Animation → Animation Blueprint → выбрать скелет → `ABP_Hero`.

**Event Graph** — собирает данные о персонаже каждый кадр:
```
Event Blueprint Initialize Animation → Try Get Pawn Owner → Cast To Character → сохранить CharacterRef, MovementRef
Event Blueprint Update Animation (Delta Time)
  → Is Valid (CharacterRef)
  → GroundSpeed = Vector Length XY (Velocity)
  → bIsFalling = MovementRef → Is Falling
  → bShouldMove = GroundSpeed > 3 AND Current Acceleration != 0
  → Direction = Calculate Direction (Velocity, Actor Rotation)    // для стрейфа
```
Совет: начиная с UE 5 используй **Blueprint Thread Safe Update Animation** и **Property Access** — анимация считается в отдельном потоке и быстрее (в шаблонах Epic уже так).

**Anim Graph** — итоговая поза:
```
State Machine "Locomotion" → Slot 'DefaultSlot' → Output Pose
```

## 7.3 State Machine

Состояния и переходы:
```
[Idle/Walk/Run (Blend Space по GroundSpeed)] ──bIsFalling──► [Jump Start] ──► [Fall Loop] ──!bIsFalling──► [Land] ──► [Idle/Walk/Run]
```
- В каждом **состоянии** — анимация или Blend Space.
- На **переходе** (стрелка) — правило (Boolean). Для «анимация доиграла»: **Automatic Rule Based on Sequence Player in State** или `Time Remaining (ratio) < 0.1`.
- **Blend Settings** перехода — длительность смешивания (0.1–0.25 сек).
- **Conduit** — узел для общих правил; **State Alias** — «из любого состояния».

## 7.4 Blend Space

ПКМ → Animation → Blend Space (2D) или Blend Space 1D.
- 1D: ось Speed 0..600 → Idle (0), Walk (150), Run (500).
- 2D: оси Direction −180..180 и Speed → бег в 8 направлениях для шутера.
- Включи **Smoothing** (Weight Speed) для плавности.

## 7.5 Montage — анимации по команде

1. ПКМ по анимации → Create → **Create AnimMontage** → `AM_Attack`.
2. Слот: по умолчанию `DefaultGroup.DefaultSlot`. В Anim Graph ABP должна быть нода **Slot 'DefaultSlot'** перед Output Pose.
3. **Notifies** (в таймлайне монтажа ПКМ → Add Notify): `AN_Hit` в кадре удара, звук шага, эффект.
4. В персонаже:
```
IA_Attack Started → Branch(!bIsAttacking) → bIsAttacking = true
  → Play Montage (Mesh, AM_Attack) → On Completed / On Interrupted → bIsAttacking = false
                                    → On Notify Begin (Notify Name == "Hit") → Sphere Trace вокруг кулака → Apply Damage
```
5. **Комбо**: секции монтажа (Attack1, Attack2, Attack3) + `Montage Jump to Section` при повторном нажатии в окне Notify State `ANS_ComboWindow`.

**Атака только верхней частью тела во время бега**: в Anim Graph — `Layered Blend per Bone` (Base Pose = Locomotion, Blend Pose 0 = Slot 'UpperBody', Bone Name = `spine_01`).

## 7.6 Рэгдолл при смерти

```
Die → Mesh: Set Collision Profile Name "Ragdoll" → Set Simulate Physics (true)
    → Capsule: Set Collision Enabled (No Collision)
    → Character Movement: Disable Movement
    → Set Life Span (10)
```

## 7.7 IK: ноги на неровной поверхности

В UE 5 шаблоны используют **Control Rig** с Foot IK. Простой вариант: нода **Leg IK** / **Two Bone IK** + трассы вниз от ступней. В шаблонах Epic с 5.4+ уже есть готовая настройка — изучи её.

## 7.8 Анимации из других источников

- **Retargeting**: если у модели свой скелет (например, Mixamo) — создай **IK Rig** для обоих скелетов → **IK Retargeter** → Export Selected Animations. В UE 5.4+ есть **автоматический ретаргет**: ПКМ по анимации → Retarget Animations → выбрать целевой меш.
- **Mixamo** (бесплатно, нужен аккаунт Adobe) — модели и тысячи анимаций; импорт FBX без скина (Without Skin) для анимаций.
- **Game Animation Sample Project** (бесплатно от Epic, Fab) — 500+ анимаций и готовая система Motion Matching. Отличный источник для изучения современной анимации.
- **Fab** — магазин Epic (бывший Marketplace), есть бесплатные паки анимаций.

## 7.9 Motion Matching (кратко)

Вместо ручной State Machine: **Pose Search Database** из множества клипов → нода **Motion Matching** в Anim Graph сама подбирает лучшую позу по траектории движения. Даёт AAA-качество, но сложнее в настройке. Изучать после того, как освоишь State Machine — на примере Game Animation Sample.

## Практика

1. Свой `ABP_Hero`: State Machine (Locomotion / Jump / Fall / Land), Blend Space 1D.
2. Атака через Montage + Notify `Hit` + урон через Sphere Trace.
3. Комбо из 3 ударов.
4. Атака только верхом тела во время бега.
5. Рэгдолл при смерти.
6. Импортируй персонажа с Mixamo и сделай ретаргет анимаций с Manny.

## Чек-лист

- [ ] Понимаю разницу Sequence / Blend Space / Montage
- [ ] Собрал State Machine с правилами переходов
- [ ] Использую Anim Notify для синхронизации урона/звука с анимацией
- [ ] Умею ретаргетить анимации
