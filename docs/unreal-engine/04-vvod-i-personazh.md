# 04. Ввод и персонаж

## 4.1 Enhanced Input — система управления UE5

Три вида ассетов (папка `_Game/Input`):

| Ассет | Что это | Пример |
|---|---|---|
| **Input Action** (`IA_`) | Абстрактное действие и тип его значения | `IA_Move` (Axis2D), `IA_Look` (Axis2D), `IA_Jump` (Digital/bool), `IA_Sprint`, `IA_Interact`, `IA_Attack`, `IA_Pause` |
| **Input Mapping Context** (`IMC_`) | Какие клавиши/кнопки геймпада вызывают какие действия | `IMC_Default`, `IMC_UI`, `IMC_Vehicle` |
| **Modifiers / Triggers** | Обработка значения (инверсия, мёртвая зона) и условия срабатывания (Hold, Tap, Pressed) | Hold 0.5 сек для «тяжёлого удара» |

Создание: ПКМ → Input → Input Action / Input Mapping Context.

### Раскладка WASD для IA_Move (Axis2D)

| Клавиша | Modifiers |
|---|---|
| W | **Swizzle Input Axis Values** (YXZ) |
| S | Swizzle (YXZ) + **Negate** |
| A | **Negate** |
| D | — |
| Gamepad Left Thumbstick 2D-Axis | Dead Zone |

`IA_Look`: Mouse XY 2D-Axis (+ Negate по Y, если нужна инверсия), Gamepad Right Thumbstick.

### Подключение контекста

В **PlayerController** (или в персонаже) на `Event BeginPlay`:

```
Event BeginPlay
 └► Get Enhanced Input Local Player Subsystem (Player Controller = Self)
     └► Add Mapping Context (Mapping Context = IMC_Default, Priority = 0)
```

### События ввода

В графе набери имя действия: `EnhancedInputAction IA_Jump`. Выходы:

| Выход | Когда |
|---|---|
| **Started** | Нажали |
| **Ongoing** | Удерживается, но триггер ещё не сработал (для Hold) |
| **Triggered** | Условие выполнено (для обычной кнопки — каждый кадр, пока зажата) |
| **Completed** | Отпустили / триггер завершён |
| **Canceled** | Отпустили раньше, чем сработал Hold |
| Action Value | Значение (bool / float / Vector2D) |

Смена схемы управления (машина, меню) — `Remove Mapping Context` / `Add Mapping Context` с другим приоритетом.
Переназначение клавиш игроком — **Enhanced Input User Settings** (Project Settings → Enhanced Input → Enable User Settings) + Player Mappable Key Settings на Input Action.

## 4.2 Движение персонажа (как в шаблоне Third Person)

```
EnhancedInputAction IA_Move (Triggered) → Action Value (Vector2D) → Break
 ├► Get Control Rotation → обнулить Pitch и Roll (Make Rotator: Yaw только)
 │     ├► Get Forward Vector → Add Movement Input (Scale = Y)
 │     └► Get Right Vector   → Add Movement Input (Scale = X)

EnhancedInputAction IA_Look (Triggered) → Break Vector2D
 ├► Add Controller Yaw Input (X)
 └► Add Controller Pitch Input (Y)

EnhancedInputAction IA_Jump  Started → Jump    Completed → Stop Jumping
```

## 4.3 Камера (Spring Arm + Camera)

| Компонент / настройка | Что даёт |
|---|---|
| **Spring Arm** → Target Arm Length 300–400 | Расстояние камеры. Сама приближается, если упирается в стену (Do Collision Test) |
| Spring Arm → **Use Pawn Control Rotation** = true | Камера крутится мышью |
| Spring Arm → **Enable Camera Lag** / Rotation Lag | Плавность |
| Spring Arm → Socket Offset (0, 50, 60) | Камера «через плечо» |
| Camera → Field of View 90 | Угол обзора |
| Персонаж: **Use Controller Rotation Yaw** = false + Character Movement → **Orient Rotation to Movement** = true | Персонаж поворачивается в сторону бега (как в 3rd person) |
| Use Controller Rotation Yaw = true, Orient Rotation to Movement = false | Персонаж всегда смотрит туда, куда камера (шутер) |

Камеры по типам игр:
- **First Person**: камера в голове (сокет `head`), видимые только руки (Only Owner See / Owner No See).
- **Top Down**: Spring Arm с поворотом -60° по Pitch, Absolute Rotation, клик мышью → `Simple Move to Location` (нужен NavMesh, гл. 08).
- **Side Scroller**: камера сбоку, движение только по одной оси (Character Movement → Planar Movement → Constrain to Plane).

## 4.4 Character Movement Component — главные параметры

| Параметр | По умолчанию | Смысл |
|---|---|---|
| Max Walk Speed | 500 (шаблон) | Скорость бега, см/с |
| Max Walk Speed Crouched | 300 | Присед (нужен Can Crouch в Nav Movement) |
| Jump Z Velocity | 700 | Сила прыжка |
| Air Control | 0.35 | Управление в воздухе 0..1 |
| Gravity Scale | 1 | Множитель гравитации |
| Rotation Rate (Z) | 500 | Скорость поворота персонажа |
| Braking Deceleration Walking | 2000 | Насколько резко останавливается |
| Max Step Height | 45 | Высота ступеньки, на которую заходит |
| Walkable Floor Angle | 44° | Максимальный уклон |
| Jump Max Count (в Character) | 1 | 2 = двойной прыжок |

Режимы движения: Walking, Falling, Swimming (в Physics Volume с Water Volume), Flying, Custom. Смена — `Set Movement Mode`.

## 4.5 Рецепты механик

**Спринт:**
```
IA_Sprint Started   → Set Max Walk Speed (Character Movement) = 900
IA_Sprint Completed → Set Max Walk Speed = 500
```
Со стаминой: переменная `Stamina`; таймер каждые 0.1 сек уменьшает её при беге, при 0 — сброс скорости; восстановление другим таймером.

**Рывок (Dash):**
```
IA_Dash Started → Branch (bCanDash)
  → Launch Character (Get Actor Forward Vector × 2000, XY Override = true)
  → bCanDash = false → Delay 1.0 → bCanDash = true
```

**Двойной прыжок:** в Class Defaults персонажа `Jump Max Count = 2`.

**Присед:** Nav Movement → Can Crouch = true. `IA_Crouch Started → Crouch`, `Completed → Un Crouch`.

**Прицеливание (зум):** Timeline 0→1 за 0.2 сек → Lerp FOV 90→60 и Target Arm Length 300→150.

**Карабкание/подтягивание (идея):** Line Trace вперёд на уровне груди + Line Trace сверху вниз перед персонажем → найден край → Set Movement Mode Flying + Montage подтягивания + Move Component To. Это уже продвинутая механика — делай после гл. 07.

## 4.6 Свой персонаж с нуля

1. ПКМ → Blueprint Class → **Character** → `BP_Hero`.
2. Mesh: выбери Skeletal Mesh (например, `SKM_Manny`/`SKM_Quinn` из шаблона), сдвинь по Z на −90 и поверни на −90 по Yaw (смотреть вдоль красной стрелки X).
3. Добавь Spring Arm и Camera (Camera — дочерняя к Spring Arm).
4. Anim Class → `ABP_Manny` (или свой из гл. 07).
5. Скопируй логику ввода (см. 4.2) или создай заново со своими Input Action.
6. В `BP_GameMode` → Default Pawn Class = `BP_Hero`.

## Практика

1. Создай `BP_Hero` с нуля, свои `IA_*` и `IMC_Default`.
2. Добавь спринт со стаминой, рывок с перезарядкой и двойной прыжок.
3. Добавь управление с геймпада (если есть).
4. Сделай `IA_Pause` (Esc / Start) — пока просто `Print String "Пауза"`.
5. Попробуй Top Down вариант: отдельный `BP_TopDownHero` и движение по клику.

## Чек-лист

- [ ] Понимаю Input Action / Mapping Context / Modifiers / Triggers
- [ ] Умею собрать персонажа с нуля, с камерой
- [ ] Знаю главные параметры Character Movement
- [ ] Сделал спринт, рывок, двойной прыжок
