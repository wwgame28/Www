# Шпаргалка по нодам Blueprints

Ищи по задаче → найди ноду. В графе: ПКМ → набери название. Галочка **Context Sensitive** скрывает ноды, недоступные из текущего провода.

## Горячие клавиши в графе

| Клавиша + ЛКМ | Нода |
|---|---|
| B | Branch |
| S | Sequence |
| D | Delay |
| F | For Each Loop |
| N | Do N |
| O | Do Once |
| G | Gate |
| M | Multigate |
| T | Event Tick |
| Ctrl / Alt + перетащить переменную | Get / Set |
| C (с выделением) | Комментарий |
| Q (с выделением) | Выровнять |
| Двойной клик по проводу | Reroute |
| Alt + клик по пину | Оборвать провод |
| Ctrl + тянуть провод | Перенести провода с пина |
| F9 | Точка останова |

## По задачам

| Задача | Ноды |
|---|---|
| Сделать что-то при старте | `Event BeginPlay` |
| Каждый кадр | `Event Tick` (лучше `Set Timer by Event`) |
| Подождать | `Delay`, `Retriggerable Delay`, `Set Timer by Event` |
| Повторять каждые N сек | `Set Timer by Event` (Looping), стоп — `Clear and Invalidate Timer by Handle` |
| Плавно изменить значение | `Timeline`, `FInterp To`, `Lerp` |
| Создать объект | `Spawn Actor from Class`, `Spawn AI from Class` |
| Удалить объект | `Destroy Actor`, `Set Life Span` |
| Найти игрока | `Get Player Character`, `Get Player Pawn`, `Get Player Controller` |
| Проверить тип | `Cast To …`, `Does Object Implement Interface`, `Actor Has Tag`, `Class Is Child Of` |
| Проверить ссылку | `Is Valid` |
| Двигать | `Set Actor Location`, `Add Actor World Offset`, `Move Component To`, `Set Relative Location` |
| Поворачивать | `Set Actor Rotation`, `Add Actor Local Rotation`, `Find Look at Rotation`, `RInterp To` |
| Направления | `Get Actor Forward/Right/Up Vector`, `Get Control Rotation` |
| Расстояние | `Get Distance To`, `Vector Length`, `Distance (Vector)` |
| Луч | `Line Trace By Channel`, `Sphere Trace By Channel`, `Multi Sphere Trace for Objects` |
| Найти в радиусе | `Sphere Overlap Actors`, `Get Overlapping Actors` |
| Урон | `Apply Damage`, `Apply Point Damage`, `Apply Radial Damage`, `Event AnyDamage` |
| Физика | `Add Impulse`, `Add Force`, `Add Radial Impulse`, `Set Simulate Physics`, `Launch Character` |
| Движение персонажа | `Add Movement Input`, `Jump`, `Stop Jumping`, `Crouch`, `Set Max Walk Speed`, `Set Movement Mode` |
| Ввод | `Add Mapping Context`, `EnhancedInputAction …`, `Enable/Disable Input` |
| UI | `Create Widget`, `Add to Viewport`, `Remove from Parent`, `Set Input Mode …`, `Set Show Mouse Cursor` |
| Текст | `Format Text`, `To Text (Integer)`, `Append` (String) |
| Пауза / время | `Set Game Paused`, `Set Global Time Dilation`, `Get Game Time in Seconds` |
| Уровни | `Open Level (by Name)`, `Get Current Level Name`, `Load Stream Level`, `Quit Game` |
| Сохранения | `Create Save Game Object`, `Save Game to Slot`, `Load Game from Slot`, `Does Save Game Exist`, `Delete Game in Slot` |
| Звук | `Play Sound 2D`, `Play Sound at Location`, `Spawn Sound Attached`, `Fade In/Out` |
| Эффекты | `Spawn System at Location`, `Spawn System Attached`, `Start Camera Shake` |
| Анимация | `Play Montage`, `Montage Jump to Section`, `Stop Anim Montage`, `Play Animation` |
| Материалы | `Create Dynamic Material Instance`, `Set Scalar/Vector Parameter Value`, `Set Material` |
| ИИ | `AI Move To`, `Run Behavior Tree`, `Set Value as Object/Vector`, `Get Random Reachable Point in Radius`, `Report Noise Event`, `Finish Execute` |
| Случайность | `Random Float in Range`, `Random Integer in Range`, `Random Bool with Weight`, `Random Array Item` |
| Массивы | `Add`, `Remove`, `Get (copy)`, `Length`, `Contains`, `Find`, `Shuffle`, `Clear`, `For Each Loop with Break` |
| Данные | `Get Data Table Row`, `Get Data Table Row Names`, `Break S_…`, `Make S_…` |
| Настройки графики | `Get Game User Settings`, `Set Overall Scalability Level`, `Set Screen Resolution`, `Apply Settings` |
| Отладка | `Print String`, `Draw Debug Sphere/Line/Arrow`, `Get Display Name` |

## Цвета проводов

| Цвет | Тип |
|---|---|
| Белый | Exec (порядок выполнения) |
| Красный | Boolean |
| Бирюзовый | Integer |
| Зелёный | Float |
| Сиреневый | Name |
| Розовый | String / Text |
| Жёлтый | Vector |
| Фиолетово-синий | Rotator |
| Оранжевый | Transform |
| Синий | Object Reference |
| Фиолетовый | Class Reference |
| Тёмно-синий | Struct |
