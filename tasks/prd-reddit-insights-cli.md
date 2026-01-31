# PRD: Reddit Insights CLI

## Overview

CLI-инструмент для продактов, фаундеров и UX-researchers, который извлекает структурированные инсайты из Reddit-сабреддитов. Пользователь указывает сабреддит и период — получает markdown-отчёт с болями пользователей, паттернами, цитатами и продуктовыми гипотезами.

Ключевая ценность: обработка большого объёма Reddit-данных за секунды вместо часов ручного чтения.

## Goals

- Сократить время получения инсайтов из Reddit с часов до минут
- Предоставить структурированный, переиспользуемый формат отчёта
- Интегрироваться в vibecoding workflow через Claude Code skill
- Извлекать не сырые данные, а осмысленные продуктовые выводы

## Quality Gates

These commands must pass for every user story:
- `npm run typecheck` - Type checking (если используем TypeScript)
- `npm run lint` - Linting
- Ручная проверка: команда выполняется и генерирует валидный markdown

## User Stories

### US-001: Базовый CLI с вводом сабреддита
As a product manager, I want to run a simple command with a subreddit name so that I can get insights without complex setup.

**Acceptance Criteria:**
- [ ] Команда `reddit-insights <subreddit>` принимает название сабреддита (с или без r/)
- [ ] Поддерживаются форматы: `r/BeginnersRunning`, `BeginnersRunning`, полный URL
- [ ] При невалидном вводе показывается понятное сообщение об ошибке
- [ ] При успехе выводится путь к созданному файлу

### US-002: Получение данных из Reddit API
As a user, I want the tool to fetch real posts and comments from Reddit so that the analysis is based on actual data.

**Acceptance Criteria:**
- [ ] Получение top/hot постов из указанного сабреддита
- [ ] Получение комментариев к постам (top-level + replies)
- [ ] Параметр `--period` фильтрует посты по времени (7d, 30d, 90d, 180d)
- [ ] Параметр `--limit` ограничивает количество постов (default: 50)
- [ ] Graceful handling при rate limiting или ошибках API

### US-003: LLM-анализ собранных данных
As a user, I want the collected data to be analyzed by an LLM so that I get structured insights, not raw posts.

**Acceptance Criteria:**
- [ ] Собранные посты и комментарии отправляются на анализ в LLM
- [ ] Промпт запрашивает: боли, паттерны, цитаты, язык пользователей, гипотезы
- [ ] Обработка больших объёмов данных (chunking если нужно)
- [ ] Анализ выполняется за разумное время (< 2 минут для 50 постов)

### US-004: Генерация markdown-отчёта
As a user, I want to receive a well-structured markdown file so that I can use it in Notion, docs, or presentations.

**Acceptance Criteria:**
- [ ] Отчёт сохраняется в файл `reddit-insights-{subreddit}-{date}.md`
- [ ] Структура отчёта включает: TL;DR, боли (с количеством упоминаний), желания пользователей, язык аудитории, продуктовые гипотезы
- [ ] Каждая боль/паттерн сопровождается 2-3 цитатами
- [ ] Указаны метаданные: сабреддит, период, количество постов/комментариев
- [ ] Параметр `--output` позволяет указать кастомный путь

### US-005: Claude Code Skill интеграция
As a vibecoding user, I want to invoke the tool as a Claude Code skill so that I can get insights without leaving my workflow.

**Acceptance Criteria:**
- [ ] Skill `/reddit` вызывает CLI с переданными аргументами
- [ ] Результат отображается в чате или указывается путь к файлу
- [ ] Поддерживаются основные флаги: subreddit, --period, --limit
- [ ] Skill зарегистрирован в конфигурации Claude Code

### US-006: Help и документация
As a new user, I want clear help output so that I can understand how to use the tool.

**Acceptance Criteria:**
- [ ] `reddit-insights --help` показывает все команды и опции
- [ ] Каждая опция имеет описание и пример
- [ ] Показаны примеры типичного использования
- [ ] Указана информация о требованиях (API keys если нужны)

## Functional Requirements

- FR-1: CLI должен работать на macOS и Linux
- FR-2: Вывод прогресса при длительных операциях (fetching..., analyzing...)
- FR-3: Конфигурация (API keys) через environment variables или config file
- FR-4: Результат всегда сохраняется в файл (не только stdout)
- FR-5: Имя файла включает дату для версионирования

## Non-Goals

- Веб-интерфейс (v2)
- Анализ конкретного треда по URL (v2)
- Сравнительный анализ нескольких сабреддитов (v2)
- Real-time мониторинг/алерты (v2)
- Экспорт в форматы кроме markdown (v2)
- Аутентификация пользователей (не нужна для CLI)

## Technical Considerations

- Reddit API: использовать public API или snoowrap/reddit-wrapper
- Rate limits: Reddit имеет лимиты, нужен backoff
- LLM: Claude API для анализа (уже есть в контексте vibecoding)
- Язык: TypeScript или Python — на усмотрение
- Размер контекста: chunking для больших сабреддитов

## Success Metrics

- CLI успешно генерирует отчёт для r/BeginnersRunning
- Отчёт содержит минимум 5 уникальных болей с цитатами
- Время выполнения < 2 минут для 50 постов
- Markdown корректно рендерится в Notion/GitHub

## Open Questions

- Нужна ли аутентификация Reddit (OAuth) или хватит public API?
- Какой LLM использовать: Claude через API или текущий контекст Claude Code?
- Хранить ли историю запросов для сравнения со временем?
- Нужен ли кэш для избежания повторных запросов к Reddit?