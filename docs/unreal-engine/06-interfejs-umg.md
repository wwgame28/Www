# 06. Интерфейс (UMG — Unreal Motion Graphics)

## 6.1 Widget Blueprint

ПКМ → User Interface → **Widget Blueprint** → родитель User Widget → `WBP_HUD`.

Две вкладки:
- **Designer** — раскладка элементов.
- **Graph** — логика (события `Event Construct`, `Event Destruct`, `Event Tick`, обработчики кнопок).

## 6.2 Основные элементы (Palette)

| Элемент | Назначение |
|---|---|
| **Canvas Panel** | Свободное позиционирование. Корень для HUD. Важно: **Anchors** (якоря) — к какому углу/краю привязан элемент при смене разрешения |
| **Overlay** | Элементы друг поверх друга (картинка + текст) |
| **Horizontal / Vertical Box** | Ряд/столбец |
| **Grid Panel / Uniform Grid** | Сетка (инвентарь) |
| **Scroll Box** | Прокрутка |
| **Size Box** | Фиксированный размер |
| **Scale Box** | Масштабирование содержимого |
| **Widget Switcher** | Переключение «страниц» (вкладки меню настроек) |
| **Text**, **Rich Text** | Текст |
| **Image** | Картинка/иконка/материал |
| **Button** | Кнопка (внутрь кладётся Text/Image) |
| **Progress Bar** | Полоска здоровья/опыта |
| **Slider**, **Check Box**, **Combo Box (String)**, **Editable Text** | Элементы настроек и ввода |
| **Spacer** | Отступ |
| User Widget | Твой же виджет внутри другого (слот инвентаря, кнопка меню) |

Правило: **делай маленькие переиспользуемые виджеты** (`WBP_MenuButton`, `WBP_InventorySlot`) и собирай из них экраны.

Масштаб под разрешения: Project Settings → User Interface → **DPI Scaling** (кривая по короткой стороне). Проверяй в Designer: Screen Size (справа сверху) — 1280×720, 1920×1080, 2560×1440, 3840×2160.

## 6.3 Показ виджета

```
(в PlayerController, Event BeginPlay)
Create Widget (Class = WBP_HUD, Owning Player = Self) → Promote to Variable (HUDRef) → Add to Viewport
```
Убрать — `Remove from Parent`.

## 6.4 Режим ввода и курсор

| Ситуация | Ноды |
|---|---|
| Игра | `Set Input Mode Game Only`, `Set Show Mouse Cursor = false` |
| Меню | `Set Input Mode UI Only` (Widget to Focus = меню), `Set Show Mouse Cursor = true` |
| Инвентарь поверх игры | `Set Input Mode Game and UI` |

## 6.5 Обновление данных в UI — три способа

| Способ | Плюсы/минусы |
|---|---|
| **Binding** (кнопка Bind у свойства) | Просто, но вызывается **каждый кадр** — на большом UI бьёт по производительности |
| **Event Dispatcher** (рекомендуется) | Обновление только при изменении (см. гл. 05.6) |
| **Прямой вызов** | Логика зовёт `HUDRef → UpdateCoins(N)` — просто, но связывает классы |

**Viewmodel (MVVM)** — плагин **UMG Viewmodel**: отдельный объект с полями, виджет привязывается к ним, обновления автоматически по изменению. Хороший следующий шаг после диспетчеров.

## 6.6 Типовые экраны

### HUD
- Progress Bar здоровья (Percent = Health / MaxHealth), стамина, счётчик монет, прицел по центру (Image с Anchor по центру), подсказка взаимодействия.

### Главное меню
- Отдельный уровень `L_MainMenu` с GameMode, у которого Default Pawn = None, и контроллером, показывающим `WBP_MainMenu`.
- Кнопки: **Играть** → `Open Level (by Name) "L_Arena"`; **Продолжить** (если есть сохранение); **Настройки**; **Выход** → `Quit Game`.

### Пауза
```
IA_Pause Started (в PlayerController; в Input Action поставить Trigger Pressed)
  → Branch (Is Game Paused?)
     false → Set Game Paused (true) → Create/Add WBP_Pause → Input Mode UI Only, курсор
     true  → Set Game Paused (false) → Remove from Parent → Input Mode Game Only
```
Чтобы Esc снимал паузу, у `IA_Pause` включи галочку **Trigger when Paused** — иначе во время паузы ввод не доходит. В виджете паузы кнопка «Продолжить» делает то же самое, что второй раз Esc.

### Экран смерти / победы
`OnDeath` персонажа → GameMode → через 1.5 сек `WBP_GameOver` с кнопками «Заново» (`Open Level` текущего — `Get Current Level Name`) и «В меню».

### Настройки графики
- `Get Game User Settings` → `Set Overall Scalability Level (0..4)`, `Set Screen Resolution`, `Set Fullscreen Mode`, `Set VSync Enabled`, `Set Frame Rate Limit` → `Apply Settings`.
- Громкость: **Sound Class** + **Sound Mix** → `Set Sound Mix Class Override` + `Push Sound Mix Modifier`.
- Сохраняются автоматически в GameUserSettings.ini.

### Плавающие надписи над врагами
**Widget Component** внутри Blueprint врага (Space = Screen) → полоска здоровья над головой.

## 6.7 Анимация UI

В Designer внизу **Animations** → «+ Animation» → добавить трек виджета → ключи Render Opacity/Transform. В графе: `Play Animation`, `Play Animation Reverse`. Использование: плавное появление меню, «пульс» монет при подборе.

## 6.8 Common UI (продвинутое)

Плагин **Common UI** — стандарт Epic для меню с поддержкой геймпада: стек экранов, автоматический фокус, подсказки кнопок под устройство ввода. Для первой игры не обязателен; для релиза на консоли/Steam Deck — очень полезен.

## 6.9 Локализация

Весь видимый игроку текст — тип **Text** (не String). Window → **Localization Dashboard** → Gather Text → добавить язык → перевести → Compile. Переключение — `Set Current Culture`.

## Практика

1. `WBP_HUD`: здоровье, стамина, монеты, прицел, подсказка «[E] …». Обновление — через диспетчеры.
2. `L_MainMenu` + `WBP_MainMenu` (Играть / Настройки / Выход).
3. Пауза по Esc с кнопками «Продолжить», «Настройки», «В меню».
4. `WBP_Settings`: качество графики, разрешение, полноэкранный режим, громкость музыки/эффектов.
5. `WBP_GameOver` + `WBP_Victory`.
6. Полоска здоровья над врагом через Widget Component.

## Чек-лист

- [ ] Понимаю якоря и проверяю UI на разных разрешениях
- [ ] UI обновляется через диспетчеры, а не Binding
- [ ] Правильно переключаю режимы ввода и курсор
- [ ] Есть меню, пауза, HUD, экран конца игры
