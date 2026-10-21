# 22. Инструменты редактора, автоматизация, тестирование, CI/CD

## 22.1 Editor Utility — свои инструменты без C++
- **Editor Utility Blueprint** (Asset Action Utility / Actor Action Utility) — пункты в контекстном меню: «переименовать по стандарту», «создать Material Instance для всех текстур», «выровнять акторы по сетке». Функции с `Call In Editor`.
- **Editor Utility Widget** (`EUW_`) — своё окно-панель (UMG) в редакторе: менеджер уровней, генератор предметов, проверка ассетов. Запуск: ПКМ → Run Editor Utility Widget.
- **Scriptable Tools** (5.4+) — свои интерактивные инструменты во вьюпорте на Blueprint.
- Ноды: `Get Selected Assets`, `Get Selected Level Actors`, `Rename Asset`, `Duplicate Asset`, `Set Editor Property`, `Spawn Actor from Class` (Editor), `Editor Asset Library`, `Editor Level Library`.

## 22.2 Python в редакторе
1. Включи плагин **Python Editor Script Plugin**.
2. Output Log → режим **Python** или `py "script.py"`; File → Execute Python Script.
3. API: модуль `unreal`:
```python
import unreal
assets = unreal.EditorUtilityLibrary.get_selected_assets()
for a in assets:
    if isinstance(a, unreal.Texture2D):
        a.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_NORMALMAP)
        unreal.EditorAssetLibrary.save_loaded_asset(a)
```
4. Применение: массовый импорт, проверка именования, генерация Data Tables из CSV, пайплайны для художников, автоматизация Sequencer/Movie Render Queue.
5. Документация: «Python API» для твоей версии; в `Engine/Plugins/Experimental/PythonScriptPlugin` — примеры.
6. **Remote Control API** (плагин) — управление редактором по HTTP/WebSocket. Для управления редактором из Claude есть отдельный плагин **Unreal Engine Skills** (MCP, см. гл. 13).

## 22.3 Валидация данных
- **Data Validation** плагин: свои правила (Editor Utility Validator / C++ `UEditorValidatorBase`) — «у каждого оружия заполнена иконка», «текстуры ≤ 2048». Запуск: ПКМ → Validate Assets; можно при сохранении и перед сборкой.
- **Asset Audit**, **Size Map** (ПКМ → Size Map) — сколько памяти тянет ассет со всеми зависимостями. **Reference Viewer** — граф ссылок.

## 22.4 Тестирование
| Вид | Инструмент |
|---|---|
| Юнит-тесты C++ | **Automation Spec** (`BEGIN_DEFINE_SPEC`), `IMPLEMENT_SIMPLE_AUTOMATION_TEST` |
| Тесты игровых сценариев | **Functional Testing**: актор `Functional Test` на тестовой карте — Blueprint с `Prepare Test` / `Start Test` / `Finish Test (Succeeded/Failed)` |
| Скриншот-тесты | `Screenshot Functional Test` — сравнение картинки с эталоном |
| Запуск | Tools → **Session Frontend → Automation** или **Test Automation** окно; из командной строки: `UnrealEditor-Cmd.exe MyGame.uproject -ExecCmds="Automation RunTests MyGame; Quit" -unattended -nullrhi` |
| Длительные/устройство | **Gauntlet** — фреймворк запуска сборок на устройствах и сбора результатов |
| Мультиплеер-боты | Свои AI-контроллеры, имитирующие игроков; **Gauntlet** для серверов |
| Плагин CQTest (5.3+) | Более удобный синтаксис C++ тестов |

## 22.5 Командная строка и сборка без редактора
- **UnrealBuildTool (UBT)** — компиляция C++.
- **Unreal Automation Tool (UAT)** — `RunUAT.bat BuildCookRun -project=... -platform=Win64 -clientconfig=Shipping -build -cook -stage -pak -archive -archivedirectory=...` — то, что делает кнопка Package.
- **Commandlets**: `-run=ResavePackages`, `-run=DerivedDataCache -fill`, `-run=Cook`.
- **BuildGraph** — XML-описание пайплайна сборки (то, на чём построены сборки Epic).
- **Horde** — бесплатная система CI и распределённой сборки от Epic (UBA — Unreal Build Accelerator для распределённой компиляции).
- CI на **GitHub Actions / Jenkins / TeamCity**: свой runner на Windows с установленным UE (облачные бесплатные runners слишком малы), шаги: обновить код → собрать редактор → прогнать тесты → BuildCookRun → загрузить сборку (Steam через `steamcmd`, itch.io через `butler`).

## 22.6 Профилирование глубже (Unreal Insights)
- Запуск: `MyGame.exe -trace=default,memory,bookmark,loadtime,task -statnamedevents`, или в редакторе Trace → Start.
- Вкладки: **Timing Insights** (кадры, потоки, CPU/GPU события), **Memory Insights** (кто выделил память), **Networking Insights**, **Asset Loading Insights**, **Slate Insights** (UI).
- Свои метки в C++: `TRACE_CPUPROFILER_EVENT_SCOPE(MyFunction)`; в BP — видны вызовы событий при `-statnamedevents`.
- Память: `memreport -full`, `obj list class=Texture2D`, `stat memory`, LLM (`-llm`).
- **Crash Reporter**: сбор крашей из Shipping (свой сервер или **Sentry**/**Backtrace** — у них есть плагины UE). Символы (.pdb) храни для каждой выпущенной сборки.

## 22.7 Контроль версий — продвинуто
- **Perforce (Helix Core)**: стрим-депо, typemap для бинарников (exclusive checkout для `.uasset`), UGS (**Unreal Game Sync**) — синхронизация с предсобранными бинарниками для художников.
- **Git**: LFS + file locking (`git lfs lock`), плагин **Git LFS 2** для редактора (сообщество) / встроенный Git (beta).
- **Diff/Merge Blueprints**: в редакторе ПКМ → Revision Control → Diff Against Depot — визуальный дифф графов.
- **Multi-User Editing** (плагин Concert) — несколько человек правят один уровень одновременно.

## Практика
1. Editor Utility Widget «Проверка проекта»: все ли ассеты с правильными префиксами, подсветка нарушений.
2. Python-скрипт: импорт папки FBX с созданием Material Instance для каждого.
3. 3 Functional Test для «Кристальной арены»: подбор кристалла увеличивает счёт, шипы наносят урон, портал открывается после 10 кристаллов.
4. Скрипт `build.bat` на UAT BuildCookRun + автотесты.

## Чек-лист
- [ ] Пишу свои инструменты редактора (EUB/EUW или Python)
- [ ] Есть автотесты и запуск из командной строки
- [ ] Умею собрать игру без кнопки Package и профилировать через Insights
