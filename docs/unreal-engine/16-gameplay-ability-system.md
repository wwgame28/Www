# 16. Gameplay Ability System (GAS)

GAS — фреймворк Epic для способностей, атрибутов и эффектов (используется в Fortnite, Paragon, Lyra). Идеален для RPG, MOBA, экшенов со множеством умений, баффов и дебаффов, особенно в мультиплеере (встроенное сетевое предсказание).

## 16.1 Нужен ли GAS?

| Да | Нет |
|---|---|
| Много способностей, кулдаунов, стоимости маны | Простая игра с 2–3 атаками |
| Баффы/дебаффы со стаками и длительностью | Одиночная казуалка |
| Мультиплеер с предсказанием способностей | Нет C++ в проекте (настройка атрибутов требует C++) |

## 16.2 Составные части

| Часть | Роль |
|---|---|
| **Ability System Component (ASC)** | Сердце: хранит способности, эффекты, атрибуты, теги. Вешается на Pawn или PlayerState (для мультиплеера с респауном — на PlayerState) |
| **Attribute Set** (C++) | Числа: Health, MaxHealth, Mana, Stamina, AttackPower. Макросы `ATTRIBUTE_ACCESSORS`, `PreAttributeChange`, `PostGameplayEffectExecute` для клампа и смерти |
| **Gameplay Ability** (GA_, можно в Blueprint) | Действие: удар, огненный шар, рывок, лечение. `ActivateAbility` → логика → `CommitAbility` (списать стоимость/кулдаун) → `EndAbility` |
| **Gameplay Effect** (GE_, только данные) | Изменение атрибутов/тегов: Instant (урон), Duration (бафф 10 сек), Infinite (пассивка). Modifiers, Executions (сложная формула урона), Stacking, Period (яд каждую секунду) |
| **Gameplay Tags** | Язык системы: `Ability.Fireball`, `State.Stunned`, `Cooldown.Dash`. Блокировка способностей по тегам (Activation Blocked Tags) |
| **Gameplay Cue** (GC_) | Косметика по тегу `GameplayCue.Hit.Fire`: звук, частицы. Реплицируется эффективно |
| **Ability Tasks** | Асинхронные шаги внутри способности: `PlayMontageAndWait`, `WaitTargetData`, `WaitGameplayEvent`, `WaitDelay`, `WaitInputRelease` |
| **Target Data / Target Actors** | Выбор цели (прицел, область) |

## 16.3 Минимальная настройка

1. Включи плагин **Gameplay Abilities** (Edit → Plugins). В Build.cs: `GameplayAbilities`, `GameplayTags`, `GameplayTasks`.
2. C++: `UMyAttributeSet : UAttributeSet` с Health/MaxHealth/Mana.
3. C++: персонаж (или PlayerState) реализует `IAbilitySystemInterface`, создаёт `UAbilitySystemComponent` и Attribute Set; в `PossessedBy` (сервер) и `OnRep_PlayerState` (клиент) — `InitAbilityActorInfo`.
4. Выдача способностей на сервере: `ASC->GiveAbility(FGameplayAbilitySpec(AbilityClass, Level))`.
5. Дальше — в Blueprint:
   - `GA_Fireball` (родитель Gameplay Ability): `Event ActivateAbility` → `Commit Ability` → `Play Montage and Wait` → по событию анимации спавн снаряда → `End Ability`.
   - Cost: `GE_Cost_Mana` (Instant, Mana −20). Cooldown: `GE_Cooldown_Fireball` (Duration 3 сек, Granted Tag `Cooldown.Fireball`).
   - Снаряд при попадании: `Apply Gameplay Effect Spec to Target` с `GE_Damage_Fire` (SetByCaller magnitude для урона).
6. Активация с ввода: `Try Activate Ability by Class` / `by Tag` из обработчика Enhanced Input (или привязка ввода как в Lyra).
7. UI: подписка на изменения атрибута (`Wait for Attribute Changed` async-нода в BP / `GetGameplayAttributeValueChangeDelegate` в C++).

## 16.4 Полезное

- **Gameplay Debugger** (`'`) → категория Abilities: активные эффекты, теги, атрибуты.
- Консоль: `showdebug abilitysystem`.
- Документация сообщества: **GASDocumentation** (tranek, GitHub) — лучший неофициальный учебник.
- Пример: **Lyra** (весь бой на GAS), шаблон **GAS Companion** (Fab, платный) для Blueprint-only настройки.

## Практика
1. Атрибуты Health/Mana/Stamina, смерть в `PostGameplayEffectExecute`.
2. 3 способности: удар (Montage + урон), огненный шар (стоимость, кулдаун), лечение со временем (Periodic GE).
3. Яд со стаками (Stacking Aggregate by Target, макс 5).
4. Стан: GE с тегом `State.Stunned`, который блокирует способности и движение.

## Чек-лист
- [ ] Понимаю ASC / AttributeSet / Ability / Effect / Tag / Cue
- [ ] Стоимость и кулдауны через эффекты
- [ ] Косметика через Gameplay Cues
