// =============================================================================
// Clear DB schema: clearable table groups and FK graph for cascade explanation
// =============================================================================

/** One clearable "group" = one root table. Truncating it with CASCADE removes it and all tables that reference it. */
export interface ClearableGroup {
  id: string;
  tableName: string;
  label: string;
  description: string;
  /** Tables that will be truncated by CASCADE when this table is truncated (transitive). */
  cascadeTo: Array<{ table: string; label: string }>;
}

/** Edge: child has FK to parent. Truncate parent CASCADE → truncates child. */
export interface FkEdge {
  from: string;
  to: string;
}

/** Human-readable table labels for diagram */
export const TABLE_LABELS: Record<string, string> = {
  organizations: 'Организации',
  campaigns: 'Кампании',
  leads: 'Лиды',
  deals: 'Сделки',
  events: 'События',
  automation_rules: 'Правила автоматизации',
  conversations: 'Чаты',
  messages: 'Сообщения',
  email_sequences: 'Email-последовательности',
  email_sequence_steps: 'Шаги последовательностей',
  email_sequence_enrollments: 'Записи в последовательностях',
  email_tracking: 'Открытия/клики писем',
  intent_signals: 'Сигналы интента',
  score_history: 'История скоринга',
  automation_logs: 'Логи автоматизаций',
  tasks: 'Задачи',
};

/** Direct FK: table "to" references table "from". */
const FK_EDGES: FkEdge[] = [
  { from: 'organizations', to: 'leads' },
  { from: 'leads', to: 'intent_signals' },
  { from: 'leads', to: 'score_history' },
  { from: 'leads', to: 'deals' },
  { from: 'leads', to: 'events' },
  { from: 'leads', to: 'conversations' },
  { from: 'leads', to: 'email_sequence_enrollments' },
  { from: 'leads', to: 'tasks' },
  { from: 'leads', to: 'automation_logs' },
  { from: 'deals', to: 'conversations' },
  { from: 'deals', to: 'tasks' },
  { from: 'deals', to: 'automation_logs' },
  { from: 'conversations', to: 'messages' },
  { from: 'automation_rules', to: 'automation_logs' },
  { from: 'automation_rules', to: 'tasks' },
  { from: 'email_sequences', to: 'email_sequence_steps' },
  { from: 'email_sequences', to: 'email_sequence_enrollments' },
  { from: 'email_sequence_steps', to: 'email_tracking' },
  { from: 'email_sequence_enrollments', to: 'email_tracking' },
];

/** Root tables we allow to clear (user selects by group). */
const CLEARABLE_GROUPS: Omit<ClearableGroup, 'cascadeTo'>[] = [
  { id: 'organizations', tableName: 'organizations', label: 'Организации', description: 'Компании контактов. Каскадно удалит лидов и все связанные с ними данные.' },
  { id: 'campaigns', tableName: 'campaigns', label: 'Кампании', description: 'Маркетинговые кампании и атрибуция. Нет зависимых таблиц.' },
  { id: 'leads', tableName: 'leads', label: 'Лиды', description: 'Контакты и лиды. Каскадно: сигналы интента, история скоринга, сделки, события, чаты, записи в email-последовательностях, задачи, логи автоматизаций.' },
  { id: 'deals', tableName: 'deals', label: 'Сделки', description: 'Сделки в пайплайнах. Каскадно: чаты по сделкам, задачи, логи автоматизаций.' },
  { id: 'events', tableName: 'events', label: 'События', description: 'Маркетинговые события (визиты, клики). Нет зависимых таблиц.' },
  { id: 'automation_rules', tableName: 'automation_rules', label: 'Правила автоматизации', description: 'Триггеры и автоматизации. Каскадно: логи правил, задачи, созданные правилами.' },
  { id: 'conversations', tableName: 'conversations', label: 'Чаты и переписка', description: 'Разговоры с лидами/сделками. Каскадно: сообщения.' },
  { id: 'email_sequences', tableName: 'email_sequences', label: 'Email-последовательности', description: 'Цепочки писем. Каскадно: шаги, записи лидов в последовательностях, открытия/клики.' },
];

function transitiveCascadeFrom(tableName: string): Set<string> {
  const result = new Set<string>();
  const stack = [tableName];
  while (stack.length) {
    const t = stack.pop()!;
    for (const e of FK_EDGES) {
      if (e.from === t && !result.has(e.to)) {
        result.add(e.to);
        stack.push(e.to);
      }
    }
  }
  return result;
}

export function getClearDbSchema(): {
  groups: ClearableGroup[];
  edges: FkEdge[];
  tableLabels: Record<string, string>;
} {
  const groups: ClearableGroup[] = CLEARABLE_GROUPS.map((g) => {
    const cascadeTables = transitiveCascadeFrom(g.tableName);
    const cascadeTo = Array.from(cascadeTables).map((table) => ({
      table,
      label: TABLE_LABELS[table] ?? table,
    }));
    return { ...g, cascadeTo };
  });

  return {
    groups,
    edges: FK_EDGES,
    tableLabels: TABLE_LABELS,
  };
}
