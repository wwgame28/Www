# 19. Продвинутая анимация, MetaHuman и кинематограф

Продолжение главы 07.

## 19.1 Control Rig
- **Control Rig** (`CR_`) — риг внутри UE: контролы, IK, процедурные движения. Граф Forwards Solve (контролы → кости), Backwards Solve (кости → контролы, для запекания).
- Применение: анимация прямо в Sequencer (без Maya/Blender), процедурная анимация (хвост, антенны, дыхание), Foot IK, прицеливание.
- **Modular Control Rig** (5.4+) — собрать риг из готовых модулей (руки, ноги, позвоночник) перетаскиванием.
- В Anim Blueprint — нода `Control Rig`.
- **Animation Mode / Anim Layers** в Sequencer — редактирование и слои поверх мокапа.

## 19.2 Современные системы локомоции
- **Motion Matching** (Pose Search) — см. 07.9. Компоненты: Pose Search Schema (что сравнивать: траектория, позы ног), Database (клипы), Chooser Table (выбор базы по состоянию), Character Trajectory Component.
- **Chooser Tables** — таблица выбора ассета по условиям (вместо гигантских State Machine).
- **Animation Warping**: Stride Warping (длина шага под скорость), Orientation Warping (бег боком без отдельных анимаций), Slope Warping.
- **Motion Warping** (компонент) — подгонка монтажа к цели: перелезание через препятствие точной высоты, добивания, прыжки к краю.
- **Distance Matching** — старт/стоп без скольжения.
- **Linked Anim Layers / Linked Anim Graphs** — модульные ABP (разные оружия меняют слой поз).
- **Anim Next / UAF** (экспериментально) — новая система анимации, следи за развитием к UE6.

## 19.3 Лицевая анимация и липсинк
- **MetaHuman Animator** — захват лица с iPhone (Live Link Face) или стерео-камеры → высококачественная анимация MetaHuman за минуты.
- **Audio to Facial Animation** (MetaHuman, 5.5+) — липсинк из аудиофайла.
- **Live Link** + **Live Link Hub** (production-ready в 5.8) — стриминг мокапа (Rokoko, Xsens, Vicon, iPhone) в редактор в реальном времени.
- Морф-таргеты: `Set Morph Target` для простых эмоций.

## 19.4 MetaHuman
- **MetaHuman Creator** — фотореалистичные люди; с UE 5.6 Creator встроен в редактор (плагин MetaHuman), включая создание тела и параметрическую одежду. Лицензия MetaHuman позволяет использовать персонажей и в других движках/DCC (уточняй условия).
- **Mesh to MetaHuman** — превратить свой скан/скульпт в MetaHuman с ригом.
- Импорт в проект: Quixel Bridge/Fab или напрямую из редактора; появляется Blueprint с телом, лицом, грумом и LOD.
- Оптимизация: LOD, отключение грума на дальних LOD, **MetaHuman Optimized** профили для игр (Medium/Low).
- Анимации от Manny/Quinn ретаргетятся на MetaHuman (скелеты совместимы по телу).

## 19.5 Sequencer — продвинуто
- **Shots / Subsequences** — монтаж фильма из шотов, каждый — своя последовательность.
- **Cine Camera Actor**: фокусное расстояние, диафрагма, Focus Tracking, Filmback; **Camera Rig Rail/Crane**.
- **Spawnables vs Possessables** — объекты, существующие только в катсцене, vs. объекты уровня.
- **Event Tracks / Director Blueprint** — вызывать логику из катсцены.
- **Gameplay в катсцене**: `Level Sequence Actor` с биндингами на пешку игрока (Binding Overrides).
- **Take Recorder** — запись игрового процесса/мокапа в последовательность.
- **Movie Render Queue / Movie Render Graph** (production-ready в 5.8) — рендер в EXR/PNG/ProRes, антиалиасинг накоплением, Path Tracer, рендер-пассы для композитинга, пакетный рендер на ферме.

## 19.6 Виртуальное производство (кратко)
nDisplay (LED-стены), ICVFX, Live Link камеры, Virtual Scouting в VR, Composure (композитинг), **SMPTE timecode / genlock**. Отдельная индустрия — интересно, если тянет в кино.

## Практика
1. Control Rig для хвоста/антенн + анимация персонажа в Sequencer на Control Rig.
2. Перелезание через препятствие на Motion Warping.
3. Персонаж из MetaHuman Creator в своей игре, анимации Manny ретаргетом.
4. Липсинк реплики NPC через Audio to Facial Animation.
5. 30-секундный трейлер игры через Sequencer + Movie Render Queue.

## Чек-лист
- [ ] Понимаю Control Rig, Motion Matching, Warping
- [ ] Импортировал и оптимизировал MetaHuman
- [ ] Отрендерил видео через Movie Render Queue
