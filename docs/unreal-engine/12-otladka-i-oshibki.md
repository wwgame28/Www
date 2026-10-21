# 12. Отладка и типичные ошибки

## 12.1 Инструменты отладки

| Инструмент | Как пользоваться |
|---|---|
| **Print String** | Самый быстрый способ. Задай Key (чтобы строка обновлялась, а не спамила), Duration, цвет. Отключи «Print to Screen» перед релизом — в Shipping они и так не выводятся |
| **Breakpoint** | Выдели ноду → **F9**. Игра остановится, наведи мышь на провода — увидишь значения. **F10** — шаг, **F11** — шаг внутрь функции |
| **Watch value** | ПКМ по пину → Watch This Value |
| **Debug Object** | Вверху редактора Blueprint выбери экземпляр — во время игры видно, какие провода «горят» |
| **Blueprint Debugger** | Tools → Debug → Blueprint Debugger — стек вызовов |
| **Output Log** | Все предупреждения/ошибки. Фильтр по категориям |
| **Message Log** | После игры — список «Accessed None» и прочего с кликабельными ссылками на ноды |
| **Draw Debug** (`Draw Debug Sphere/Line/String`) | Визуализировать точки, радиусы, направления |
| **Gameplay Debugger** (клавиша `'`) | ИИ, восприятие, навигация, EQS |
| Консоль (`~`) | `stat unit`, `show collision`, `slomo 0.2`, `ToggleDebugCamera`, `ShowDebug AI` |

## 12.2 Топ ошибок новичка и как чинить

| Симптом | Причина | Решение |
|---|---|---|
| **«Accessed None trying to read property …»** | Переменная-ссылка пустая: не присвоена, объект уничтожен, Cast не удался | Найди, где ссылка задаётся; добавь `Is Valid` перед использованием; присваивай в BeginPlay |
| Cast всегда Failed | Объект другого класса (например, кастуешь Other Actor, а вошла пуля) | Print String имени класса (`Get Display Name`), фильтр по тегу/интерфейсу |
| Overlap не срабатывает | Нет Generate Overlap Events у одного из компонентов; Collision Preset = BlockAll/NoCollision; компонент слишком мал | Проверь пресеты обоих, `show collision` |
| Срабатывает дважды | Overlap ловит и капсулу, и меш персонажа | `Do Once`, или фильтр `Other Comp == капсула`, или у меша Generate Overlap Events = false |
| Ввод не работает | Не добавлен Mapping Context; пешка не possessed; включён Input Mode UI Only; у виджета фокус | Print в BeginPlay контроллера, проверь `Add Mapping Context`, режим ввода |
| Ввод в паузе не работает | У Input Action нет Trigger when Paused | Включить |
| Персонаж спавнится не тот / камера в нуле | Не тот GameMode (World Settings → GameMode Override перекрывает) | Проверь World Settings и Project Settings |
| ИИ стоит | Нет NavMesh (P во вьюпорте), нет AI Controller, задача без `Finish Execute`, `Auto Possess AI` не включён у заспавненных | Проверь всё по списку, Gameplay Debugger |
| Delay в функции не добавляется | Delay/Timeline нельзя в функциях | Используй Custom Event или макрос |
| Delay в цикле For Each не работает «по очереди» | Цикл выполняется за один кадр | Делай «цикл» через таймер и индекс |
| Переменная сбрасывается при смене уровня | Всё, кроме GameInstance, уничтожается | Храни в GameInstance / SaveGame |
| Значение по умолчанию не применилось | Не нажат Compile; у экземпляра на уровне значение переопределено (стрелка «Reset to Default») | Compile, сброс у экземпляра |
| В редакторе всё работает, в сборке — нет | Уровень не в списке упаковки; ассет грузится по строке и не «запёкся»; Print String в Shipping не видно | Packaging → maps, Additional Asset Directories; тестируй в Development |
| Ошибка сборки «Unknown Cook Failure» | Сломанные ассеты/ссылки | Output Log → первая ошибка; Fix Up Redirectors; удалить битый ассет; путь без кириллицы |
| Тёмная/пересвеченная сцена | Автоэкспозиция | Post Process → Exposure Min = Max |
| Чёрные пятна на мешах при запечённом свете | Нет Lightmap UV | Lumen, или сгенерировать Lightmap UV в меше |
| FPS падает со временем | Копятся акторы (снаряды, эффекты), таймеры не очищаются | Initial Life Span, Destroy, Clear Timer; `stat game` |
| «Infinite loop detected» | While/рекурсия без выхода | Условие выхода; Project Settings → Max Loop Iteration Count — не лечение |
| Персонаж «скользит» в анимации | Скорость анимации не соответствует Max Walk Speed | Подгони точки Blend Space или скорость |
| Монтаж не играет | Нет ноды Slot в Anim Graph или слот другой | Добавь `Slot 'DefaultSlot'` перед Output Pose |
| Виджет не реагирует на клики | Сверху лежит другой элемент с Visibility = Visible | У декоративных элементов Visibility = **Not Hit-Testable** |

## 12.3 Метод решения любой проблемы

1. **Воспроизведи**: точные шаги, когда ломается.
2. **Сузь**: Print String в начале цепочки → где поток обрывается?
3. **Проверь предположения**: «эта переменная точно не пустая?» — Breakpoint и посмотри.
4. **Упрости**: сделай минимальный пример на пустом уровне.
5. **Ищи**: текст ошибки в поиске + «Unreal Engine 5» → forums.unrealengine.com, Reddit r/unrealengine, docs.
6. **Спроси Claude**: опиши, что делаешь, что ожидаешь, что происходит, вставь текст ошибки и опиши граф (или скриншот). Скил `unreal-blueprint-mentor` знает этот курс.

## 12.4 Защита от ошибок заранее

- Ставь `Is Valid` перед ссылками на то, что может исчезнуть (враги, снаряды, цель ИИ).
- Используй **Validated Get** (ПКМ по Get переменной → Convert to Validated Get).
- Компилируй часто; не игнорируй жёлтые предупреждения.
- Сохраняй и коммить в Git после каждого рабочего шага.
- Включи автосохранение (Editor Preferences → Loading & Saving → Auto Save).
