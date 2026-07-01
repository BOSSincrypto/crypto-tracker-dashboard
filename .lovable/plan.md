# План рефакторинга и оптимизации Crypto Portfolio

Цель — привести код к предсказуемой архитектуре, снять узкие места производительности и убрать накопленный технический долг без изменения пользовательского функционала. Работы разбиты на изолированные шаги; каждый шаг заканчивается зелёным type-check и визуальной проверкой дашборда.

## Шаг 1. Гигиена storage-слоя
- Перенести объявления `ALL_PORTFOLIOS_ID`, `loadAllTransactions`, `loadMergedSnapshots` вниз файла (сейчас они выше `import`-ов — компилируется, но нарушает конвенции).
- Ввести единый `safeReadJSON<T>(key, schema)` с Zod-валидацией вместо `readArr` без схемы: защищает от повреждённого localStorage.
- Обернуть `writeArr` в try/catch на `QuotaExceededError`, показывать toast.
- Ввести версионирование ключей (`crypto-tracker:v2:*`) + миграцию из v1/legacy в одном месте.
- Кэшировать `loadPortfolios()` в модульной переменной, сбрасывать при mutations — сейчас на каждый вызов идёт `JSON.parse`.

## Шаг 2. Единый источник данных (React Query как state layer)
Проблема: `useTransactions`, `usePortfolios`, `loadAllTransactions`, `loadSnapshots` живут в `useState`+`useEffect`, синхронизация между вкладками и после импорта завязана на «магический» `snapshotVersion`.

- Ввести query-ключи `['portfolios']`, `['transactions', portfolioId]`, `['snapshots', portfolioId]`.
- `queryFn` читает из localStorage; мутации через `useMutation` + `queryClient.invalidateQueries`.
- Подписка на `window.addEventListener('storage', ...)` инвалидирует ключи → синхронизация между вкладками бесплатно.
- Убрать ручной `snapshotVersion` из `routes/index.tsx`.

## Шаг 3. Декомпозиция `routes/index.tsx`
Файл держит хедер, KPI, графики, таблицы, эффекты снапшотов и агрегацию — ~200 строк смешанной ответственности.

- Выделить `DashboardHeader`, `DashboardGrid`, `useDashboardData()` (хук возвращает `holdings`, `priced`, `summary`, `snapshots`).
- Логику агрегации All-view (`loadAllTransactions` в useMemo с ручным dep-массивом) заменить на query из Шага 2.
- Убрать `eslint-disable react-hooks/exhaustive-deps` — они компенсируют текущую архитектуру.

## Шаг 4. Расчётный слой: один проход вместо N
Сейчас `aggregateHoldings`, `withPrices`, `calculateSummary`, `costBasisTimeline`, `cashFlowWaterfall` многократно проходят по `transactions`.

- Ввести `buildPortfolioModel(transactions, prices)` → `{ holdings, priced, summary, timeline, waterfall }` за один проход с O(n) сортировкой по дате.
- Мемоизировать по ссылке `transactions` + серилизованному хэшу `prices` (округление до 4 знаков), чтобы 60-секундный refetch с идентичными ценами не пересчитывал модель.
- Вынести чистые функции в `src/lib/crypto/model.ts`, оставить `calculations.ts` фасадом на переходный период.

## Шаг 5. Сеть и CoinGecko
- Ввести общий `fetchJSON` с таймаутом (`AbortController`, 8s), экспоненциальным бэкоффом на 429/5xx и уважением `Retry-After`.
- Батчить `getPrices`: CoinGecko ограничивает длину URL — разбивать на чанки по 100 id и объединять ответы.
- Кэш поиска монет (`use-coin-search`) с `staleTime: 5 * 60_000` и дебаунсом 300ms.
- Прекратить polling (`refetchInterval`) при `document.hidden` через `refetchIntervalInBackground: false` (уже дефолт, но задокументировать) + `focusManager` пауза.

## Шаг 6. Recharts: bundle и рендер
- Переключить импорты Recharts на именованные из подпутей (`recharts/es6/chart/LineChart` и т.п.) либо, проще, на `lazy()` для тяжёлых панелей (Analytics, CostVsValue, Waterfall). Экономия ~120–180 KB в initial bundle.
- Заменить `ResponsiveContainer` пересчёт на фиксированный `aspect` где возможно (убирает ResizeObserver storm).
- Проверить, что все ряды данных стабильны по ссылке (уже частично сделано `React.memo`; довести до конца через Шаг 4).

## Шаг 7. Виртуализация таблиц
`TransactionsTable` и `MonthlySummaryTable` рендерят все строки. При 1000+ транзакций заметный jank.

- Внедрить `@tanstack/react-virtual` в `TransactionsTable`.
- Вынести форматтеры (`Intl.NumberFormat`) в модульные синглтоны — сейчас создаются на каждый рендер строки.

## Шаг 8. Типы и валидация на границах
- Ввести Zod-схемы `TransactionSchema`, `PortfolioSchema`, `SnapshotSchema` в `types.ts`, экспортировать `z.infer` вместо ручных интерфейсов.
- Использовать их в `storage`, `import-export`, миграциях. Единая точка правды.
- Включить `noUncheckedIndexedAccess` в `tsconfig` и починить всплывшие `possibly undefined`.

## Шаг 9. Доступность и UX-мелочи
- Проверить контраст `text-muted-foreground` на карточках KPI (WCAG AA).
- Добавить `aria-live="polite"` на KPI-значения при обновлении цен.
- Клавиатурная навигация в `PortfolioSwitcher` и `AddTransactionDialog` (focus trap, Esc).
- `prefers-reduced-motion` для live-dot и hover-анимаций.

## Шаг 10. Инструментальная проверка
- `bun tsgo` — обязательный gate после каждого шага.
- Добавить lightweight-тесты для `model.ts` (Vitest): 5–7 сценариев (buy/sell/reward/withdraw, ATH, drawdown, средняя цена после частичной продажи).
- Playwright smoke: открыть `/`, добавить транзакцию, проверить обновление KPI и графика.
- Замер производительности до/после: React Profiler запись 30s при активном polling, зафиксировать commit count и render duration топ-5 компонентов.

## Порядок выполнения и риски

```text
1 → 2 → 3   (архитектурный фундамент, ломает много импортов — делать одним PR)
        ↓
        4 → 5   (можно параллельно)
              ↓
              6 → 7   (визуально заметные оптимизации)
                    ↓
                    8 → 9 → 10   (полировка и защита от регрессий)
```

Риск №1 — Шаг 2 меняет контракт хуков; нужно обновить все потребители (`ImportExportMenu`, `AddTransactionDialog`, `PortfolioSwitcher`) в том же коммите. Риск №2 — Шаг 6 (lazy Recharts) требует Suspense fallback'ов, чтобы не мигал layout. Риск №3 — Шаг 8 (`noUncheckedIndexedAccess`) может вскрыть скрытые баги — планировать буфер времени.

## Что НЕ входит

Изменения фич, новые виджеты, смена дизайн-токенов, миграция на бэкенд (Lovable Cloud). Всё это отдельные инициативы поверх этой базы.
