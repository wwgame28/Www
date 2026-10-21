# 13. Ресурсы, ассеты, что дальше

## 13.1 Официальное обучение (бесплатно)

| Ресурс | Что там |
|---|---|
| **dev.epicgames.com/documentation** | Документация UE 5.x (есть русский интерфейс у части страниц). Начни с «Blueprints Visual Scripting», «Gameplay Framework», «Enhanced Input» |
| **dev.epicgames.com/community/unreal-engine/learning** | Курсы Epic: «Your First Hour in Unreal Engine», «Blueprint Programming», «Game Design Using Blueprints», туториалы по анимации и ИИ |
| **YouTube: Unreal Engine** (официальный канал) | Inside Unreal (еженедельные стримы), разборы фич, State of Unreal |
| **Шаблоны и примеры (Fab / Epic Launcher → Samples)** | **Lyra** (эталонная архитектура игры, C++ + Blueprints), **Game Animation Sample** (Motion Matching), **Stack O Bot** (простой платформер на Blueprints — отлично разбирать), **Cropout** (стратегия на Blueprints), **Content Examples** (сотни мини-примеров по всем системам) |

## 13.2 YouTube-авторы по Blueprints

- **Matt Aspland** — короткие рецепты механик.
- **Ryan Laley** — серии «сделай игру» и механики на Blueprints.
- **Gorka Games** — полные игры по шагам.
- **Unreal Sensei** — большие курсы для начинающих.
- **Mathew Wadstein** — «WTF Is…?» — объяснение каждой ноды по отдельности.
- **Smart Poly**, **Kekdot**, **Reids Channel** — системы (инвентарь, диалоги, сохранения).
- На русском: ищи «Unreal Engine 5 Blueprints уроки» — **XYZ School**, **Unreal Engine Русское сообщество** и др.

Совет: из видео бери идеи, но **пиши граф сам**, а не копируй один в один.

## 13.3 Платные курсы (по желанию)

- **GameDev.tv** (Udemy) — Unreal Blueprint Game Developer.
- **Udemy: Unreal Engine 5 Blueprints** — много курсов, бери с высоким рейтингом и обновлением под UE5.
- **XYZ School / Skillbox** — русскоязычные с наставником.

## 13.4 Ассеты

| Источник | Что | Лицензия |
|---|---|---|
| **Fab** (fab.com, магазин Epic) | Модели, анимации, звуки, VFX, Blueprint-системы. Ежемесячные бесплатные ассеты. **Quixel Megascans** — фотограмметрия, бесплатно для использования в UE | Fab Standard License |
| **Mixamo** | Персонажи и анимации | Бесплатно для коммерции |
| **Kenney.nl** | Стилизованные 3D/2D/звуки | CC0 |
| **Poly Haven** | HDRI, текстуры, модели | CC0 |
| **Sketchfab** (фильтр Downloadable + CC) | Модели | разные CC — проверяй! |
| **Freesound.org** | Звуки | CC0/CC-BY — проверяй атрибуцию |
| **Pixabay / incompetech** | Музыка | Проверяй лицензию |

Веди файл `CREDITS.md` в проекте: что, откуда, лицензия.

## 13.5 Инструменты рядом с UE

- **Blender** — моделирование, риггинг, анимация (бесплатно).
- **Krita / GIMP / Photopea** — текстуры, иконки.
- **Audacity** — обработка звука.
- **Material Maker / Substance (Adobe)** — материалы и текстуры.
- **Git + GitHub Desktop + LFS** или **Anchorpoint** — версии.
- **Trello / Notion / Claude Docs** — задачи и дизайн-документ.

## 13.6 Сообщества

- forums.unrealengine.com, **Unreal Slackers** (Discord, самое большое сообщество UE).
- Reddit: r/unrealengine, r/UnrealEngine5, r/gamedev.
- Русскоязычные Telegram/Discord сообщества по UE.
- Геймджемы: itch.io/jams, Epic MegaJam (раз в год), GMTK Jam, Ludum Dare.

## 13.7 Что дальше после курса

1. **Вторая игра сам**, без пошагового гайда.
2. **Продвинутые системы на Blueprints**: инвентарь на Data Assets, диалоговая система, квесты, крафт, GAS (Gameplay Ability System — частично доступен из Blueprints, полностью — через C++), Common UI, MVVM.
3. **C++ в Unreal**: когда нужна производительность, свои подсистемы, сетевые оптимизации. Путь: базовый C++ → «Unreal Engine C++ Developer» (GameDev.tv) → разбор Lyra. Правило индустрии: ядро систем — C++, контент и настройка — Blueprints.
4. **Мультиплеер**: репликация (Replicates, RepNotify, Run on Server/Client RPC), Listen Server, Online Subsystem (Steam/EOS). Начни с документации «Networking Overview» и примера на Blueprints.
5. **UEFN / Verse** — создание игр внутри Fortnite с выплатами авторам (Epic расширяет программу в 2026). Другой язык (Verse), но знания редактора UE переносятся.
6. **Unreal Engine 6** — ранний доступ ожидается в конце 2027. Blueprints и основы редактора останутся, так что всё изученное сохранит ценность.

## 13.8 Выпуск игры

| Площадка | Стоимость | Комментарий |
|---|---|---|
| **itch.io** | Бесплатно | Лучший старт: игры с джемов, бесплатные проекты, демо |
| **Steam** | 100 $ за каждую игру (возвращаются после 1000 $ выручки) | Страница «Скоро» минимум за 2 недели, лучше за 6–12 месяцев для вишлистов |
| **Epic Games Store** | Взнос за продукт при самопубликации (уточняй на сайте) | 88/12 разделение выручки; при одновременном выходе в EGS снижается роялти UE |
| **VK Play** | — | Для аудитории в России |
| **Яндекс Игры / CrazyGames / Poki** | — | Только веб-игры. Unreal 5 официально не экспортирует в HTML5 — для веба лучше другой движок |

## Claude + Unreal: как подключить плагин

Официальный плагин **«Unreal Engine Skills»** от Epic Games позволяет Claude Code управлять редактором Unreal: создавать и редактировать Blueprints, акторы, материалы, Niagara, виджеты, Control Rig, Sequencer, State Tree, запускать тесты.

1. **Установи плагин**: claude.ai → Customize → Plugins → «Unreal Engine Skills» → Install (или нажми Install на карточке в чате).
2. **Нужен локальный Claude Code**: облачная сессия не видит твой ПК. Установи Claude Code на компьютер с Unreal (desktop-приложение Claude или CLI) и открой его в папке своего UE-проекта.
3. В проекте Unreal включи нужные плагины редактора по инструкции скила **`unreal-mcp`** из плагина (он расскажет, какой MCP-сервер запустить и как подключить к Claude Code).
4. Проверка: попроси Claude «перечисли акторы на текущем уровне». Если ответил списком — связь работает.

Как учиться с плагином, **а не вместо себя**:
- Сначала делай сам по главам курса. Потом проси Claude проверить твой Blueprint («открой BP_Hero и найди, почему двойной прыжок не работает»).
- Проси Claude объяснить чужой Blueprint (из шаблонов Epic) «нода за нодой».
- Рутину (расставить 50 кристаллов, создать 10 инстансов материалов) — смело отдавай Claude.

Скилы этого репозитория:
- `.claude/skills/unreal-blueprint-mentor/` — наставник: объясняет, проверяет, даёт задания.
- `.claude/skills/unreal-game-builder/` — ведёт проект игры по этапам с чек-листами.

Чтобы использовать их в своём проекте UE на ПК, скопируй папки скилов в `.claude/skills/` внутри папки проекта Unreal (или в `~/.claude/skills/` — тогда они будут доступны во всех проектах).
