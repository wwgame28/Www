# 11. Сквозной проект: «Кристальная арена»

Законченная игра от третьего лица, полностью на Blueprints. Используются все темы курса. Делай этапы по порядку; после каждого этапа — **игра запускается и в неё можно играть**.

## Дизайн-документ (1 страница — сначала напиши свой такой же)

- **Жанр**: экшен от третьего лица, 3 уровня-арены.
- **Цель уровня**: собрать 10 кристаллов и выжить; потом открывается портал на следующий уровень.
- **Игровой цикл**: бегать → собирать кристаллы → драться с врагами (ближний бой + снаряды) → лечиться аптечками → портал.
- **Управление**: WASD, мышь, Space — прыжок (двойной), Shift — спринт (стамина), Q — рывок, ЛКМ — удар (комбо 3), ПКМ — выстрел энергошаром (стоит 20 энергии), E — взаимодействие, Esc — пауза.
- **Враги**: «Страж» (ближний бой, патруль), «Искра» (стрелок, держит дистанцию), «Голем» — босс на 3 уровне.
- **Прогресс**: кристаллы = валюта; между уровнями — магазин улучшений (здоровье +25, урон +20 %, стамина +25).
- **Проигрыш**: здоровье 0 → экран смерти → рестарт с последнего чекпоинта.
- **Сохранение**: открытые уровни, кристаллы, улучшения, настройки.
- **Объём**: 3 уровня по 5–10 минут.

## Структура классов

```
Core:        BP_GameInstance, BP_GameMode_Arena, BP_GameMode_Menu, BP_PlayerController, BP_SaveGame
Player:      BP_Hero, ABP_Hero, IA_* / IMC_Default
Components:  BPC_Health, BPC_Stamina, BPC_Energy
Interfaces:  BPI_Interactable, BPI_Damageable (по желанию)
Pickups:     BP_PickupBase → BP_Crystal, BP_HealthPack, BP_EnergyCell
World:       BP_Portal, BP_Checkpoint, BP_Door, BP_Chest, BP_SpikeTrap, BP_JumpPad, BP_MovingPlatform
Combat:      BP_Projectile_Player, BP_Projectile_Enemy, DT_Damage (опционально)
AI:          BP_EnemyBase → BP_Enemy_Guard, BP_Enemy_Spark, BP_Boss_Golem; BP_AIC_Enemy, BT_Guard, BT_Spark, BT_Boss, BB_Enemy, BTT_*/BTS_*
Systems:     BP_WaveManager
UI:          WBP_HUD, WBP_MainMenu, WBP_Pause, WBP_Settings, WBP_GameOver, WBP_LevelComplete, WBP_Shop, WBP_InteractPrompt, WBP_BossBar
Data:        S_Upgrade, DT_Upgrades, E_EnemyState
Maps:        L_MainMenu, L_Arena_01, L_Arena_02, L_Arena_03_Boss
```

---

## Этап 0. Проект (0.5 дня)
- [ ] Новый проект: Third Person, Blueprint, Starter Content, имя `CrystalArena`.
- [ ] Структура папок `_Game/...` (гл. 01.7).
- [ ] Git + LFS (гл. 10.5), первый коммит.
- [ ] Создай пустые классы Core и пропиши в Project Settings (гл. 03.2).

## Этап 1. Герой (2–3 дня)
- [ ] `BP_Hero` (можно дочерний от `BP_ThirdPersonCharacter`, лучше — свой Character, гл. 04.6).
- [ ] Input Actions: Move, Look, Jump, Sprint, Dash, Attack, Shoot, Interact, Pause. `IMC_Default` добавляется в `BP_PlayerController`.
- [ ] Двойной прыжок (`Jump Max Count = 2`).
- [ ] `BPC_Stamina`: Max 100, трата 20/сек при спринте, восстановление 15/сек через 1 сек после остановки; диспетчер `OnStaminaChanged`.
- [ ] Рывок: Launch Character, перезарядка 1.5 сек, стоит 25 стамины.
- **Проверка**: бегаю, прыгаю дважды, спринт кончается.

## Этап 2. Уровень-прототип (1 день)
- [ ] `L_Arena_01`: пол, стены, платформы из BSP/кубов (Modeling Mode — Shift+5 — для блокинга), Nav Mesh Bounds Volume на всю арену.
- [ ] Env. Light Mixer: Sky Atmosphere, Sky Light, Directional Light, Height Fog.
- [ ] `BP_JumpPad` (overlap → `Launch Character` вверх 1500), `BP_MovingPlatform` (Timeline + Lerp между двумя точками, Looping, Instance Editable целевая точка с **Show 3D Widget**).
- **Проверка**: уровень проходим, платформы двигаются и везут игрока.

## Этап 3. Подбор предметов и счёт (1 день)
- [ ] `BP_PickupBase`: Sphere Collision + Static Mesh + Rotating Movement Component; событие `OnPickedUp(Hero)` (пустое в базовом); на overlap: Cast To BP_Hero → `OnPickedUp` → звук + `NS_Pickup` → Destroy.
- [ ] `BP_Crystal` (дочерний): `OnPickedUp` → GameMode `AddCrystal()`; переменная `ItemID` для сохранения.
- [ ] `BP_HealthPack`: +30 HP (не подбирается при полном здоровье).
- [ ] `BP_GameMode_Arena`: `CrystalsCollected`, `CrystalsToWin = 10`, диспетчер `OnCrystalsChanged`; при достижении цели → `OnObjectiveComplete` → портал активируется.
- **Проверка**: собираю 10 кристаллов → Print «Портал открыт».

## Этап 4. HUD (1 день)
- [ ] `WBP_HUD`: здоровье, стамина, энергия (Progress Bar), «Кристаллы 3/10», прицел, подсказка взаимодействия.
- [ ] Обновления — **только через диспетчеры** (гл. 05.6, 06.5).
- [ ] Анимация «пульса» счётчика при подборе.
- **Проверка**: все полоски живые, без Binding.

## Этап 5. Здоровье, урон, смерть (1–2 дня)
- [ ] `BPC_Health` (гл. 03.6): `Event AnyDamage` владельца привязывается в компоненте (`Get Owner → Bind Event to On Take Any Damage`), `OnHealthChanged`, `OnDeath`, кадры неуязвимости 0.5 сек после удара.
- [ ] `BP_SpikeTrap` (урон 10/сек), падение в пропасть (**Kill Z** в World Settings, или триггер → Apply Damage 9999).
- [ ] Смерть героя: рэгдолл (гл. 07.6), `Disable Input`, через 2 сек GameMode → `WBP_GameOver`.
- [ ] `BP_Checkpoint`: сохраняет Transform в GameMode; «Заново» → респаун в чекпоинте (`Destroy` старого героя → `Spawn Actor` → `Possess`) или `Open Level` текущего.
- [ ] Красная вспышка экрана и Camera Shake при уроне.
- **Проверка**: умираю на шипах, вижу экран смерти, возрождаюсь на чекпоинте.

## Этап 6. Бой (2–3 дня)
- [ ] Анимации атаки (из шаблона Combat-варианта, Game Animation Sample или Mixamo), `AM_Attack_Combo` с 3 секциями.
- [ ] `ABP_Hero`: Slot + Layered Blend per Bone (гл. 07.5).
- [ ] Notify `Hit` → Sphere Trace перед героем (радиус 80) → `Apply Damage` 25 × множитель улучшения; игнорировать себя; хит-стоп 0.05 сек.
- [ ] Окно комбо через Notify State; `Montage Jump to Section`.
- [ ] `BPC_Energy` + выстрел по ПКМ: `BP_Projectile_Player` (Projectile Movement, урон 40, `NS_Hit` при попадании).
- **Проверка**: бью манекен (`BP_TrainingDummy` с BPC_Health и полоской над головой) — урон проходит, комбо работает.

## Этап 7. Враги (3–4 дня)
- [ ] `BP_EnemyBase` (Character): `BPC_Health`, Widget Component с полоской, тег `Enemy`, функция `Attack` (переопределяется), смерть → растворение (Dynamic Material) + выпадение кристалла с шансом 30 % + Destroy через 3 сек.
- [ ] `BP_AIC_Enemy` + AI Perception (зрение 1500, слух 1200), запись в Blackboard (гл. 08.4). В Blueprint ИИ-контроллера переменная `BehaviorTree` (Instance Editable в враге) — один контроллер на всех.
- [ ] `BT_Guard`: патруль → погоня → атака Montage → поиск по последней позиции.
- [ ] `BT_Spark`: держит дистанцию 800–1200 (EQS) и стреляет `BP_Projectile_Enemy` каждые 2 сек.
- [ ] `BP_WaveManager`: 3 волны на уровень, точки спавна — Target Points; между волнами 5 сек; объявление «Волна 2» в HUD.
- [ ] Враги реагируют на шум: `Report Noise Event` при выстреле героя.
- **Проверка**: враги патрулируют, замечают, атакуют, умирают; волны идут.

## Этап 8. Мир и взаимодействие (1–2 дня)
- [ ] `BPI_Interactable` (гл. 05.5) + трасса взгляда героя каждые 0.1 сек → подсказка «[E] Открыть».
- [ ] `BP_Door` (нужен ключ или все враги волны убиты — подписка на диспетчер `BP_WaveManager.OnWaveCleared`).
- [ ] `BP_Chest`: открытие Timeline-ом крышки, выпадают 3 кристалла с `Add Impulse`.
- [ ] `BP_Portal`: неактивен до `OnObjectiveComplete`, затем эффект Niagara; overlap → `WBP_LevelComplete` → сохранение → следующий уровень.

## Этап 9. Меню, пауза, настройки, магазин (2 дня)
- [ ] `L_MainMenu` + `BP_GameMode_Menu` (Default Pawn = None) + `WBP_MainMenu`: Новая игра, Продолжить (видна, если есть сохранение), Настройки, Выход.
- [ ] Пауза по Esc (гл. 06.6), `IA_Pause` с Trigger when Paused.
- [ ] `WBP_Settings`: качество, разрешение, оконный/полноэкранный режим, VSync, громкость музыки/эффектов, чувствительность мыши (множитель в `IA_Look` через переменную в GameInstance).
- [ ] `WBP_Shop` между уровнями: `DT_Upgrades` (название, цена, эффект), покупка за кристаллы.

## Этап 10. Сохранения (1 день)
- [ ] `BP_SaveGame`: Crystals (банк), UnlockedLevel, Upgrades (Map<Name,Int>), Settings, CollectedIDs.
- [ ] Загрузка в `BP_GameInstance.Event Init`; сохранение — при прохождении уровня, покупке, смене настроек.
- [ ] Улучшения применяются при спавне героя (MaxHealth, урон, стамина).

## Этап 11. Анимации, звук, эффекты, «сочность» (2–3 дня)
- [ ] Свой `ABP_Hero` (Locomotion / Jump / Fall / Land), звуки шагов через Notify.
- [ ] MetaSounds: удар, выстрел, подбор (питч растёт при серии подборов), смерть врага.
- [ ] Музыка: спокойная ↔ боевая (переключение при начале/конце волны с Fade).
- [ ] Niagara: подбор, попадание, смерть врага, портал, след рывка.
- [ ] Camera Shake, хит-стоп, вспышки, всплывающие цифры урона (виджет в мире с анимацией).

## Этап 12. Уровни 2 и 3, босс (3–5 дней)
- [ ] `L_Arena_02`: другая геометрия, больше «Искр», движущиеся платформы над пропастью.
- [ ] `L_Arena_03_Boss`: `BP_Boss_Golem` — 3 фазы (Enum), атаки: удар по земле (`Apply Radial Damage` + Niagara-волна), бросок камня (снаряд с гравитацией), призыв стражей на 50 % HP. `WBP_BossBar` сверху экрана.
- [ ] Катсцена появления босса (Sequencer), пропуск по кнопке.
- [ ] Финальный экран + титры.

## Этап 13. Красота (2–3 дня)
- [ ] Заменить блокинг на ассеты (Fab/Megascans, бесплатные паки), Nanite.
- [ ] Master Material + инстансы, Post Process (цвет, Bloom, виньетка).
- [ ] Освещение и туман под настроение каждого уровня.

## Этап 14. Оптимизация и тестирование (2 дня)
- [ ] `stat unit` на каждом уровне, цель 60 FPS на среднем ПК.
- [ ] Отключить лишние Tick, пул снарядов, Cull Distance.
- [ ] Чек-лист багов: застревания в геометрии, враги без NavMesh, UI на 4K и 720p, геймпад, пауза во время смерти, двойной подбор кристалла (Do Once!), Alt+Tab, повторный «Продолжить».
- [ ] Дай поиграть 3 людям, молча смотри и записывай, где они путаются.

## Этап 15. Сборка и релиз (1 день)
- [ ] Иконка, название, Splash, версия (Project Settings → Description → Project Version).
- [ ] Все карты в List of maps to include.
- [ ] **Shipping**-сборка, Include Prerequisites.
- [ ] Проверка на другом ПК.
- [ ] Страница на **itch.io** (бесплатно) или Steam (взнос 100 $ за игру): скриншоты (`HighResShot 2` в консоли), трейлер (Movie Render Queue), описание.

---

## Итог по времени
≈ 30–45 рабочих дней по 2–3 часа. Не торопись: лучше маленькая, но **законченная** игра, чем большая и брошенная.

## Что делать после
1. Сделай вторую игру **сам, без инструкции** — другой жанр (платформер, хоррор, гонка, top-down шутер).
2. Пройди **Game Jam** (Epic MegaJam, GMTK, Ludum Dare) — 48–72 часа, учит доводить до конца.
3. Изучи основы C++ в UE, когда упрёшься в ограничения Blueprints (гл. 13).
