# 23. Архитектура больших проектов и продакшн

## 23.1 Data-driven дизайн
- **Primary Data Assets** (`UPrimaryDataAsset`, в BP — Primary Data Asset) — каждый предмет/оружие/враг — отдельный ассет с данными. Удобнее Data Tables для сложных объектов и ссылок на ассеты.
- **Data Tables + Curve Tables** — табличный баланс, импорт CSV/JSON из Google Sheets.
- **Curve Float / Curve Table** — кривые прогрессии (опыт по уровням, урон по дистанции).
- **Data Registries** — объединение таблиц из разных плагинов.
- **Gameplay Tags** вместо строк и Enum-ов для расширяемых категорий.

## 23.2 Asset Manager и загрузка
- Project Settings → **Asset Manager**: Primary Asset Types (Weapon, Map, Character) — движок знает, как их искать и упаковывать.
- **Soft References** (`Soft Object Reference`, `Soft Class Reference`) — ссылка без загрузки в память. Загрузка: `Async Load Asset`/`Async Load Class Asset` в BP, `StreamableManager` в C++.
- Правило: **меню, Data Assets, менеджеры → soft-ссылки на тяжёлый контент**. Иначе загрузка главного меню тянет всю игру (проверяй Size Map).
- **Chunking / Pak-разделение** — DLC, патчи, загрузка контента по частям (мобильные).

## 23.3 Модульность
- **Game Features + Modular Gameplay** (плагины): функциональность в виде плагинов, которые включаются/выключаются в рантайме (новый режим, сезонный ивент). Game Feature Actions: Add Components, Add Abilities, Add Input Mapping, Add Widgets. Пример — Lyra (`Plugins/GameFeatures/ShooterCore`).
- **Компоненты вместо наследования**: персонаж = набор компонентов (Health, Inventory, Interaction, Equipment).
- **Interfaces** для слабой связанности, **Gameplay Message Subsystem** (Lyra) — шина сообщений по тегам.
- **Модули C++**: Runtime-ядро, Editor-инструменты, отдельный модуль на большую систему.

## 23.4 Типовые системы и где их держать

| Система | Где | Подход |
|---|---|---|
| Инвентарь | Actor Component + Data Assets предметов | Массив структур (ID + количество), UI через диспетчеры |
| Экипировка/оружие | Component + отдельные Actor оружия | Attach to Socket, анимационные слои |
| Квесты | GameInstance Subsystem (C++) или менеджер | Data Asset квеста: шаги, условия (теги), награды; события «убит враг X» через Message Subsystem |
| Диалоги | Data Assets / Data Tables + UI | Или плагины (Not Yet Dialogue, Dialogue Plugin), Ink/Yarn через интеграции |
| Сохранения | SaveGame + GameInstance Subsystem | Версия формата сохранения! Миграция при обновлении игры |
| Настройки | `GameUserSettings` (наследник в C++) + Enhanced Input User Settings | |
| UI-стек | Common UI Activatable Widgets + Layers (Game, GameMenu, Menu, Modal) | Как в Lyra |
| Аудио | Sound Classes/Mixes, MetaSounds, **Audio Modulation** (Control Bus) для громкости | |
| Локализация | Localization Dashboard, String Tables | Весь текст — FText |
| Достижения/статистика | Online Subsystem (Steam/EOS) Achievements | |
| Аналитика | Analytics плагины (свой провайдер / GameAnalytics и др.) | Не забудь согласие игрока (GDPR) |

## 23.5 Доступность (Accessibility)
- Субтитры (Subtitle в Sound Wave / Dialogue Wave), размер шрифта, контраст.
- Переназначение всех клавиш, удержание → переключение, одна рука.
- Режимы для дальтоников (Post Process / `Set Color Vision Deficiency Type` нода).
- Уровни сложности, отключение тряски камеры и мигания.
- Озвучка UI (Screen Reader плагин).

## 23.6 Производство игры

### Этапы
1. **Концепт** (1–4 недели): идея, референсы, «почему это весело».
2. **Прототип** (greybox): проверка ядра геймплея. Если не весело — меняй/выбрасывай.
3. **Вертикальный срез**: один уровень в финальном качестве — проверка пайплайна и объёма работ.
4. **Производство**: контент по плану.
5. **Альфа** (всё есть, много багов) → **Бета** (контент заморожен, только фиксы) → **Release Candidate** → **Релиз** → **Поддержка** (патчи, DLC).

### Документы
- GDD (живой, короткий), план задач (Jira/Trello/HacknPlan/Codecks), **бюджет производительности** (FPS, память, draw calls на платформу), **стандарты** (имена, папки, код — Epic Coding Standard).
- Риски и scope: режь фичи раньше, а не позже.

### Команда и роли
Геймдизайнер, программист геймплея, технический художник, 3D/2D художник, аниматор, левел-дизайнер, звук, QA, продюсер. В инди — один человек на несколько ролей; аутсорс (модели, музыка) — через Fab и фриланс.

## 23.7 Бизнес и юридическое
- **Лицензия UE**: 5 % роялти после 1 млн $ валовой выручки на продукт; отчётность ежеквартально; Epic Games Store-релиз снижает ставку (программа «Launch Everywhere with Epic» — проверь текущие условия).
- Лицензии ассетов (Fab Standard / CC / свои), шрифты (OFL), музыка.
- Возрастные рейтинги: **IARC** (бесплатно, через магазины), PEGI/ESRB для консолей.
- Политика конфиденциальности, если собираешь данные/есть онлайн.
- Маркетинг: страница в Steam рано, вишлисты, трейлер, Steam Next Fest, блог разработки, соцсети, пресс-кит, стримеры.
- Издатель vs самиздат; гранты: **Epic MegaGrants**.

## 23.8 Разбор Lyra (обязательная домашка для «100 %»)
Скачай **Lyra Starter Game** (Fab/Launcher). Изучи по порядку:
1. Experiences (`ULyraExperienceDefinition`) — как одна карта превращается в разные режимы.
2. Pawn Data, Hero Component, Input Config (теги ввода).
3. GAS: способности, атрибуты, эффекты оружия.
4. Equipment и Inventory.
5. Common UI: UI Layers, Activatable Widgets, Settings.
6. Game Features: ShooterCore, TopDownArena.
7. Gameplay Message Subsystem.
8. Анимация: Linked Anim Layers на оружии.

## Чек-лист
- [ ] Использую Soft References и Asset Manager для тяжёлого контента
- [ ] Системы — в компонентах/подсистемах, данные — в Data Assets
- [ ] Знаю этапы производства и держу scope под контролем
- [ ] Разобрал архитектуру Lyra
