# 14. C++ в Unreal Engine

Blueprints и C++ — не конкуренты. Профессиональная схема: **системы и «тяжёлая» логика — C++, контент, настройка и сценарии — Blueprints**. Blueprint наследуется от C++-класса и дописывает поведение.

## 14.1 Когда переходить на C++

- Логика в Blueprint стала огромной и медленной (циклы по тысячам элементов, сложная математика).
- Нужны вещи, недоступные из Blueprints: свои Subsystems, полный GAS, свои Anim Nodes, свои ноды BT/Pose Search, модули движка, сетевые оптимизации, свой Movement, интеграция сторонних библиотек (SDK платформ, аналитика).
- Командная работа: текстовый код легко мёржится в Git, Blueprint — нет.

## 14.2 Подготовка

1. **Visual Studio 2022** (Community бесплатно) с нагрузками: «Game development with C++» (+ компонент **Unreal Engine installer/Integration**), «Desktop development with C++», .NET SDK, Windows SDK последней версии. Требуемые версии компилятора/SDK для твоей версии UE смотри в доке «Setting Up Visual Studio» — они меняются от релиза к релизу.
2. Альтернатива: **JetBrains Rider** (бесплатен для некоммерческого использования) — лучшая IDE для UE, понимает Blueprints и рефлексию. На macOS — Xcode/Rider.
3. Плагин **Visual Studio Integration Tool** / **UnrealVS** для удобства.
4. Из Blueprint-проекта: **Tools → New C++ Class** — проект станет C++ (появятся папки `Source/`, файлы `.sln`, `.Target.cs`, `.Build.cs`).

## 14.3 Структура проекта

```
MyGame/
  MyGame.uproject          ← описание проекта, список модулей и плагинов
  Source/
    MyGame.Target.cs       ← цель сборки (Game)
    MyGameEditor.Target.cs ← цель сборки (Editor)
    MyGame/
      MyGame.Build.cs      ← зависимости модуля (PublicDependencyModuleNames)
      MyGame.h / .cpp      ← модуль
      Characters/MyCharacter.h / .cpp
  Plugins/                 ← свои плагины (тоже со своими модулями)
  Config/  Content/  Binaries/  Intermediate/
```
Модуль — единица компиляции. Подключить систему движка = добавить её модуль в `Build.cs`:
```csharp
PublicDependencyModuleNames.AddRange(new string[] {
    "Core", "CoreUObject", "Engine", "InputCore",
    "EnhancedInput", "UMG", "AIModule", "GameplayTasks",
    "NavigationSystem", "Niagara", "GameplayAbilities", "GameplayTags"
});
```
После изменения `Build.cs` или добавления файлов — ПКМ по `.uproject` → **Generate Visual Studio project files**.

## 14.4 Система рефлексии (главное отличие UE C++ от обычного C++)

Макросы сообщают движку о классах, чтобы работали Blueprints, сериализация, сборка мусора, сеть, редактор.

```cpp
// MyCharacter.h
#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "MyCharacter.generated.h"   // всегда последний include

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnHealthChanged, float, NewHealth, float, MaxHealth);

UCLASS(Blueprintable)
class MYGAME_API AMyCharacter : public ACharacter
{
    GENERATED_BODY()

public:
    AMyCharacter();

    UFUNCTION(BlueprintCallable, Category = "Health")
    void ApplyDamageSimple(float Amount);

    UFUNCTION(BlueprintImplementableEvent, Category = "Health")
    void OnDied();                       // реализуется в Blueprint

    UFUNCTION(BlueprintNativeEvent, Category = "Health")
    void PlayHitReaction();              // C++ по умолчанию + можно переопределить в BP

    UPROPERTY(BlueprintAssignable, Category = "Health")
    FOnHealthChanged OnHealthChanged;    // Event Dispatcher для BP

protected:
    virtual void BeginPlay() override;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Health", meta = (ClampMin = "1"))
    float MaxHealth = 100.f;

    UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Health")
    float Health = 0.f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
    TObjectPtr<class USpringArmComponent> CameraBoom;
};
```

```cpp
// MyCharacter.cpp
#include "MyCharacter.h"
#include "GameFramework/SpringArmComponent.h"

AMyCharacter::AMyCharacter()
{
    PrimaryActorTick.bCanEverTick = false;   // по умолчанию выключай Tick
    CameraBoom = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraBoom"));
    CameraBoom->SetupAttachment(RootComponent);
}

void AMyCharacter::BeginPlay()
{
    Super::BeginPlay();
    Health = MaxHealth;
}

void AMyCharacter::ApplyDamageSimple(float Amount)
{
    Health = FMath::Clamp(Health - Amount, 0.f, MaxHealth);
    OnHealthChanged.Broadcast(Health, MaxHealth);
    if (Health <= 0.f) { OnDied(); }
}

void AMyCharacter::PlayHitReaction_Implementation() { /* ... */ }
```

### Спецификаторы UPROPERTY
| Спецификатор | Где можно менять/видеть |
|---|---|
| `EditAnywhere` | В Class Defaults и у экземпляров на уровне |
| `EditDefaultsOnly` | Только в Class Defaults (Blueprint) |
| `EditInstanceOnly` | Только у экземпляров |
| `VisibleAnywhere` / `VisibleDefaultsOnly` | Видно, но не редактируется (для компонентов) |
| `BlueprintReadOnly` / `BlueprintReadWrite` | Доступ из графа |
| `Replicated` / `ReplicatedUsing=OnRep_X` | Сеть (гл. 15) |
| `Transient` | Не сохраняется |
| `SaveGame` | Попадает в сериализацию SaveGame-архива |
| `meta=(ClampMin, UIMin, EditCondition="bX", AllowPrivateAccess="true", ExposeOnSpawn)` | Подсказки редактору |

### Спецификаторы UFUNCTION
`BlueprintCallable` (нода с exec), `BlueprintPure` (без exec), `BlueprintImplementableEvent` (только в BP), `BlueprintNativeEvent` (C++ `_Implementation` + override в BP), `Exec` (консольная команда), `Server`/`Client`/`NetMulticast` + `Reliable`/`Unreliable` (RPC, гл. 15), `CallInEditor` (кнопка в Details).

Также: `USTRUCT(BlueprintType)`, `UENUM(BlueprintType)`, `UINTERFACE`, `UCLASS(Abstract)`, `meta=(BlueprintSpawnableComponent)` для компонентов.

## 14.5 Типы и контейнеры UE

| Обычный C++ | В UE |
|---|---|
| `int`, `float` | `int32`, `float`, `double` (UE5 — векторы на double, Large World Coordinates), `uint8`, `int64` |
| `std::string` | `FString` (изменяемая), `FName` (идентификатор, быстрое сравнение), `FText` (для UI, локализуемый). `TEXT("...")` для литералов |
| `std::vector` | `TArray<T>` |
| `std::unordered_map` / `set` | `TMap<K,V>`, `TSet<T>` |
| указатели на UObject | `TObjectPtr<T>` (в UPROPERTY), `TWeakObjectPtr<T>`, `TSoftObjectPtr<T>`, `TSubclassOf<T>`, `TSoftClassPtr<T>` |
| `std::unique_ptr` / `shared_ptr` (для не-UObject) | `TUniquePtr`, `TSharedPtr`, `TSharedRef`, `TWeakPtr` |
| `std::function` | `TFunction`, делегаты |
| математика | `FVector`, `FRotator`, `FQuat`, `FTransform`, `FMath::` |

Префиксы классов: `U` — UObject, `A` — Actor, `F` — struct/обычный класс, `E` — enum, `I` — интерфейс, `T` — шаблон, `S` — Slate-виджет, `b` — bool-переменные (`bIsDead`).

## 14.6 Память и сборка мусора

- UObject создаются только через `NewObject<T>()`, `CreateDefaultSubobject<T>()` (в конструкторе), `GetWorld()->SpawnActor<T>()`. **Никогда** `new`/`delete` для UObject.
- Сборщик мусора (GC) удаляет UObject, на который нет ссылок из **UPROPERTY** (или `AddReferencedObjects`/`TStrongObjectPtr`). Голый `UObject*` без UPROPERTY в члене класса → объект может быть удалён → висячий указатель → краш.
- Проверка: `IsValid(Ptr)` (учитывает «помечен на уничтожение»).
- `Destroy()` для акторов; `MarkAsGarbage()` — редко нужен.

## 14.7 Делегаты

| Тип | Блупринты | Подписчиков |
|---|---|---|
| `DECLARE_DELEGATE` | нет | 1 |
| `DECLARE_MULTICAST_DELEGATE` | нет | много |
| `DECLARE_DYNAMIC_DELEGATE` | да (как параметр) | 1 |
| `DECLARE_DYNAMIC_MULTICAST_DELEGATE` | да (`BlueprintAssignable` — Event Dispatcher) | много |

Подписка: `OnHealthChanged.AddDynamic(this, &UMyWidget::HandleHealth);` (функция должна быть `UFUNCTION()`); у не-dynamic — `AddUObject`, `AddLambda`.

## 14.8 Ввод, таймеры, трассы — в C++

```cpp
// Enhanced Input
void AMyCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    Super::SetupPlayerInputComponent(PlayerInputComponent);
    if (auto* EIC = Cast<UEnhancedInputComponent>(PlayerInputComponent))
    {
        EIC->BindAction(MoveAction, ETriggerEvent::Triggered, this, &AMyCharacter::Move);
        EIC->BindAction(JumpAction, ETriggerEvent::Started,   this, &ACharacter::Jump);
    }
}

// Таймер
GetWorldTimerManager().SetTimer(RegenHandle, this, &AMyCharacter::Regen, 0.5f, /*loop*/ true);

// Трасса
FHitResult Hit;
FCollisionQueryParams Params(SCENE_QUERY_STAT(Interact), false, this);
if (GetWorld()->LineTraceSingleByChannel(Hit, Start, End, ECC_Visibility, Params)) { /* Hit.GetActor() */ }

// Лог
UE_LOG(LogTemp, Warning, TEXT("Health: %f, Actor: %s"), Health, *GetName());
// Свой лог: DECLARE_LOG_CATEGORY_EXTERN(LogMyGame, Log, All); в .h и DEFINE_LOG_CATEGORY(LogMyGame); в .cpp
```

## 14.9 Subsystems — «синглтоны» правильно

| Базовый класс | Живёт |
|---|---|
| `UGameInstanceSubsystem` | Всю игру (сохранения, аналитика, менеджер квестов) |
| `UWorldSubsystem` / `UTickableWorldSubsystem` | Пока жив уровень (менеджер врагов, пул снарядов) |
| `ULocalPlayerSubsystem` | Для каждого локального игрока (настройки ввода, UI-стек) |
| `UEngineSubsystem` / `UEditorSubsystem` | Движок / редактор |

Создаются автоматически, из Blueprint доступны нодой `Get <Name> Subsystem`.

## 14.10 Сборка и итерация

- **Live Coding** (Ctrl+Alt+F11 в редакторе) — перекомпиляция .cpp без перезапуска. Изменения в `.h` с новыми UPROPERTY/UFUNCTION/конструктором — надёжнее закрыть редактор и собрать из IDE.
- Конфигурации: `DebugGame Editor` (отладка твоего кода), `Development Editor` (обычная работа), `Shipping`.
- Отладка: запуск из IDE (F5) с брейкпоинтами; **Attach to Process** к редактору.
- Ошибка «модули устарели, пересобрать?» при открытии — согласиться или собрать из IDE.
- Не коммить `Binaries/`, `Intermediate/` — но в команде без программистов можно коммитить `Binaries` редактора, чтобы художникам не ставить VS.

## 14.11 Плагины

`Edit → Plugins → Add` → шаблон (Blank, Blueprint Library, Editor Mode…). Плагин = переиспользуемый набор модулей и контента. Хорошо для систем, которые хочешь перенести в другие проекты (инвентарь, диалоги). Типы модулей: `Runtime`, `Editor`, `Developer`, `UncookedOnly`. Фазы загрузки: `Default`, `PreDefault`, `PostEngineInit`.

## 14.12 Сборка движка из исходников

1. Привяжи GitHub к аккаунту Epic (epicgames.com → Apps and Accounts → GitHub) и прими приглашение в организацию EpicGames.
2. `git clone https://github.com/EpicGames/UnrealEngine` (ветка `release` или тег версии).
3. `Setup.bat` → `GenerateProjectFiles.bat` → открыть `UE5.sln` → собрать `UnrealEditor` (Development Editor, Win64).
Нужно для: выделенного сервера (Dedicated Server target), правок движка, консольных SDK. Занимает 200+ ГБ и несколько часов.

## 14.13 Hybrid-паттерн на практике

1. `AMyCharacterBase` (C++): компоненты, ввод, здоровье, делегаты, функции `BlueprintCallable`.
2. `BP_Hero` (Blueprint, наследник): меш, анимации, звуки, эффекты, числа, реакция на `OnDied` (`BlueprintImplementableEvent`).
3. Дизайнеры трогают только BP и Data Assets, программисты — C++.

## 14.14 Как учить C++ для UE

1. Основы C++ (классы, указатели, ссылки, наследование, виртуальные функции, шаблоны) — learncpp.com.
2. Документация «Programming with C++», «Unreal Engine Reflection System», «Gameplay Classes», «Coding Standard».
3. Разбор C++ шаблонов Third Person/First Person (создай C++-версии проектов).
4. Курсы: GameDev.tv «Unreal Engine 5 C++ Developer», Tom Looman «Professional Game Development in C++ and Unreal Engine».
5. **Lyra Starter Game** — эталон архитектуры (Game Features, GAS, Common UI, Modular Gameplay).

## Практика
1. Перенеси `BPC_Health` в C++ (`UHealthComponent`) с делегатами — и используй в существующих Blueprint.
2. `UFUNCTION(BlueprintPure)` библиотека (`UBlueprintFunctionLibrary`) с полезной математикой.
3. `UWorldSubsystem` — пул снарядов.
4. Свой плагин «InteractionSystem» с интерфейсом и компонентом.

## Чек-лист
- [ ] Понимаю UCLASS/UPROPERTY/UFUNCTION и зачем `.generated.h`
- [ ] Знаю правила памяти UObject и GC
- [ ] Умею выставить C++ в Blueprint и наоборот (Implementable/Native Event)
- [ ] Использую Subsystems вместо глобальных синглтонов
