# 21. Платформы: мобильные, VR/XR, консоли, Linux, Steam Deck, облако

## 21.1 Общий принцип
Project Settings → **Platforms** — настройки для каждой платформы. Сборка — Platforms → <платформа> → Package Project. Для большинства платформ нужен SDK (кнопка **Platforms → Installed SDK / Turnkey** подскажет, что установить).

## 21.2 Android
1. Установи **Android Studio** (версию, указанную в доке «Setting Up Android SDK and NDK» для твоей версии UE), затем скрипт `Engine/Extras/Android/SetupAndroid.bat`.
2. Project Settings → Platforms → **Android**: Package Name (`com.company.game`), Min/Target SDK, **Configure Now** (accept SDK license), Package game data inside .apk / **App Bundle (.aab)** для Google Play.
3. Подпись: Distribution Signing (keystore).
4. Рендер: **Mobile Renderer** (Vulkan / OpenGL ES 3.2), или **Desktop Renderer on Mobile** для топовых устройств. Lumen/Nanite на мобильных ограничены — проектируй под запечённый свет или простое динамическое.
5. Управление: **Touch Interface** (Virtual Joystick) или свой UMG, Enhanced Input поддерживает касания; гироскоп.
6. Отладка: Quick Launch на устройство по USB, `adb logcat`, **Android GPU Inspector**, Snapdragon Profiler.

## 21.3 iOS
- Нужен **Mac с Xcode** и аккаунт Apple Developer (99 $/год). С Windows возможна удалённая сборка через Mac (Remote Build).
- Bundle ID, Provisioning Profile, сертификаты; **Metal** рендер.
- Публикация через App Store Connect / TestFlight.

## 21.4 Мобильная оптимизация
- Цель: 30–60 FPS, нагрев и батарея.
- Draw calls < 500–1000, мало динамического света, запечённое освещение, простые материалы (`Fully Rough`, без Translucent), **Mobile Scalability** (Device Profiles), меньшие текстуры (ASTC/ETC2), **Mobile HDR** выключить для слабых.
- Размер: **Mobile Patching / Chunk Downloader**, Asset Manager chunking, исключение ненужных плагинов (уменьшает .apk).

## 21.5 VR / XR
- Шаблон **Virtual Reality** (OpenXR, VR Pawn, телепортация, захват предметов, меню на руке).
- Плагины: **OpenXR** (стандарт для Quest, Valve Index, Pico, Windows MR), **Meta XR** (расширения Quest), OpenXR Hand Tracking.
- Рендер: **Forward Shading**, MSAA, **Instanced Stereo**, Mobile Multi-View для автономных шлемов, **Fixed Foveated Rendering**.
- Частота: 72/90/120 FPS стабильно — иначе укачивает. Никаких резких движений камеры без запроса игрока; виньетка при движении; телепорт как опция.
- **Quest standalone** = Android-сборка с Mobile Renderer (Vulkan).
- **AR**: Apple ARKit, Google ARCore, OpenXR AR — плагины Handheld AR, шаблон Handheld AR.

## 21.6 Консоли (PlayStation, Xbox, Nintendo Switch / Switch 2)
- Доступ к SDK — только после регистрации разработчика у платформодержателя (Sony Partner, ID@Xbox, Nintendo Developer Portal). Код платформ — отдельные закрытые репозитории Epic, выдаются после подтверждения.
- Сертификация (TRC/XR/Lotcheck): сохранения, профили пользователей, обработка отключения контроллера, локализация, рейтинги.
- **Switch 2**: в UE 5.8 Lumen Lite нацелен на 60 FPS на Switch 2 (по заявлениям Epic).
- Шаг для инди: портинг-студии или издатели.

## 21.7 Linux и Steam Deck
- Linux сборка с Windows — через **кросс-компилятор** (Linux Toolchain от Epic, версия под твою UE). Native Linux редактор — сборка из исходников или бинарные сборки с сайта Epic.
- **Steam Deck**: часто достаточно Windows-сборки через Proton; проверь: 1280×800, управление геймпадом, текст ≥ 9 px при 1280×800, без лаунчеров, нужные настройки графики (пресет «Deck»). Проверка Steam Deck Verified.

## 21.8 macOS
Сборка на Mac (Xcode). Apple Silicon поддерживается нативно; Metal; ограничения по некоторым фичам рендера (смотри доку платформы).

## 21.9 Веб и облачный стриминг
- Экспорт в HTML5 официально прекращён с UE 4.24.
- **Pixel Streaming** — игра рендерится на сервере с GPU, в браузер идёт видеопоток (WebRTC). Для демо, конфигураторов, презентаций. Плагин Pixel Streaming 2 + Signalling Server.
- Для лёгких браузерных игр выбирай другой движок (three.js, PlayCanvas, Godot, Unity WebGL).

## 21.10 Ввод на разных устройствах
- Enhanced Input: отдельные Mapping Context для клавиатуры/геймпада/тача; **Common Input** (из Common UI) — определение текущего устройства и смена подсказок кнопок.
- Steam Input / PlayStation DualSense (плагин Game Input / DualSense вибрация и адаптивные триггеры).
- **Force Feedback** (Force Feedback Effect ассет) — вибрация.

## Практика
1. Android-сборка «Кристальной арены» с тач-управлением и Mobile Scalability.
2. VR-сцена: захват и бросок предметов, телепорт.
3. Проверка игры в режиме Steam Deck (1280×800, только геймпад).

## Чек-лист
- [ ] Понимаю, какие технологии не работают на мобильных/VR и чем их заменить
- [ ] Собрал APK и запустил на устройстве
- [ ] Знаю путь к консолям и требования сертификации
