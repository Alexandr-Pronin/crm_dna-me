# План разработки v2: Расширенное управление задачами

> **Обновлено** после merge из параллельной ветки (part2). Учтены новые модули: Chat, Kanban, Email Marketing, Cituro, Triggers, Conversations.

## Что уже реализовано (наши изменения)

| Компонент | Статус | Файлы |
|-----------|--------|-------|
| DB: `priority` + `created_by` в tasks | ✅ | `migrations/...002_add-task-priority-and-communications.sql` |
| DB: таблица `communications` | ✅ | там же |
| Backend: TaskService (calendar, grouped) | ✅ | `src/services/taskService.ts` |
| Backend: API `/tasks/calendar`, `/tasks/grouped` | ✅ | `src/api/routes/tasks.ts` |
| Backend: CommunicationService + API | ✅ | `src/services/communicationService.ts`, `src/api/routes/communications.ts` |
| Frontend: TaskCreateDialog | ✅ | `frontend/src/components/tasks/TaskCreateDialog.jsx` |
| Frontend: TaskListView (To-Do list) | ✅ | `frontend/src/resources/tasks/TaskListView.jsx` |
| Frontend: TaskCalendarView (FullCalendar) | ✅ | `frontend/src/resources/tasks/TaskCalendarView.jsx` |
| Frontend: TaskList (toggle List/Calendar) | ✅ | `frontend/src/resources/tasks/TaskList.jsx` |
| Frontend: DealShow + DealAutoTasks | ✅ | `frontend/src/resources/deals/DealShow.jsx`, `DealAutoTasks.jsx` |
| Frontend: CommunicationPanel | ✅ | `frontend/src/components/communications/CommunicationPanel.jsx` |
| dataProvider extensions | ✅ | `frontend/src/providers/dataProvider.js` |

## Что появилось из параллельной ветки

| Модуль | Описание | Ключевые файлы |
|--------|---------|----------------|
| **Chat/Conversations** | Полноценный чат с real-time (SSE), типы: email / internal_note / cituro_invite | `components/Chat/`, `pages/Chat/`, `services/conversationService.ts`, `services/messageService.ts` |
| **MessageComposer** | Поле ввода с dropdown: Notiz / E-Mail / Termin einladen (Cituro) | `components/Chat/MessageComposer.jsx` |
| **Kanban Board** | Drag-and-drop доска с @dnd-kit, DealCard, StageTriggersModal | `components/Kanban/` |
| **StageTriggersModal** | UI настройки автоматизаций при смене stage | `components/Kanban/StageTriggersModal.jsx` |
| **TriggerService** | Backend для stage-триггеров (email sequence, moco, cituro, slack) | `services/triggerService.ts`, `api/routes/triggers.ts` |
| **Email Marketing** | Sequence builder, email tracking, enrollment | `pages/EmailMarketing/`, `services/emailService.ts` |
| **DealCreate / DealEdit** | Полные формы создания/редактирования deal | `resources/deals/DealCreate.jsx`, `DealEdit.jsx` |

---

## Что осталось доработать

### 1. Кнопка "Task" в чате (MessageComposer)

**Проблема:** `MessageComposer` сейчас поддерживает 3 типа: `internal_note`, `email`, `cituro_invite`. Тип `task` есть в schema backend, но НЕ в UI.

**Решение:** Добавить 4-й пункт `task` в dropdown `MessageComposer`. При выборе — открывать `TaskCreateDialog` с предзаполнением `lead_id` из контекста conversation.

**Изменения:**

| Файл | Что сделать |
|------|-------------|
| `frontend/src/components/Chat/MessageComposer.jsx` | Добавить `task` в `<Select>`, импортировать `TaskCreateDialog`, открывать при выборе |
| `frontend/src/components/tasks/TaskCreateDialog.jsx` | Уже готов, без изменений |

### 2. Кнопка "Create Task" в StageTriggersModal

**Проблема:** `StageTriggersModal` поддерживает 8 trigger actions, но `create_task` НЕТ в списке.

**Решение:** Добавить action `create_task` в StageTriggersModal с формой: title template, assignee strategy, priority, due offset.

**Изменения:**

| Файл | Что сделать |
|------|-------------|
| `frontend/src/components/Kanban/StageTriggersModal.jsx` | Добавить `create_task` в `AVAILABLE_ACTIONS`, с полями конфигурации |
| `src/services/triggerService.ts` | Добавить handler для `create_task` action |

### 3. Обновить DealShow под новую архитектуру

**Проблема:** Наш `DealShow.jsx` создан до merge, не использует новые компоненты (Chat, Kanban контекст).

**Решение:** Обновить DealShow чтобы:
- Использовать Chat (CommunicationPanel заменить на ChatPanel если conversation существует)
- Показывать задачи из deal
- Интегрировать с новым DealEdit

---

## Обновлённый план действий

### Этап 1: Task в MessageComposer (1 час)

Добавить в `MessageComposer.jsx`:
```
MenuItem value="task" → icon: Assignment, label: "Aufgabe"
```
При выборе — открыть `TaskCreateDialog` с `lead_id` из conversation.

### Этап 2: create_task в TriggerService (2-3 часа)

Добавить в `StageTriggersModal`:
- Новая категория "Tasks" в AVAILABLE_ACTIONS
- Action: `create_task` с конфигурацией: title_template, assign_strategy, priority, due_days_offset
- Template variables

Добавить в `triggerService.ts`:
- Handler `executeTrigger_createTask()` → вызывает `TaskService.createTask()`

### Этап 3: Тестирование и демо (1 час)
