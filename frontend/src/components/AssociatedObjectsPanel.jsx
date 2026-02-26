/**
 * Associated Objects Panel (HubSpot-like)
 * Right sidebar with collapsible sections and chicklet cards.
 */
import { useMemo, useState } from 'react';
import {
  Add as AddIcon,
  Settings as SettingsIcon,
  MoreHoriz as MoreHorizIcon,
  MailOutline as MailIcon,
  Phone as PhoneIcon,
  ContentCopy as CopyIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';

const DEFAULT_ASSOCIATIONS = {
  companies: [
    {
      id: 'org-1',
      name: 'Acme Biotech GmbH',
      domain: 'acme-biotech.de',
      phone: '+49 30 1234567',
      associationLabel: 'Primary Company',
      contacts: [
        {
          id: 'con-1',
          name: 'Anna Keller',
          email: 'anna@acme-biotech.de',
          phone: '+49 30 1234567',
          associationLabel: 'Contact with Primary Company',
        },
      ],
    },
  ],
};

const classNames = (...classes) => classes.filter(Boolean).join(' ');

const ChickletCard = ({ item }) => {
  const handleCopy = async (value) => {
    if (!value || !navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Ignore clipboard errors
    }
  };

  return (
    <div className="group rounded-lg border border-[#eaf0f6] bg-white px-3 py-3 shadow-sm transition hover:border-[#d6e0ea] hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#eaf0f6] text-[11px] font-semibold text-[#2d3e50]">
            {item.name?.[0]?.toUpperCase() || '?'}
          </div>
          <a
            href="#"
            className="text-sm font-semibold text-[#007a8b] hover:underline"
          >
            {item.name}
          </a>
        </div>
        <button
          type="button"
          className="text-[#7a8fa6] hover:text-[#2d3e50]"
          aria-label="More"
        >
          <MoreHorizIcon fontSize="small" />
        </button>
      </div>

      <div className="mt-2 space-y-1 text-xs text-[#516f90]">
        {item.company && (
          <div className="truncate">{item.company}</div>
        )}
        {item.email && (
          <div className="flex items-center gap-1">
            <MailIcon fontSize="inherit" />
            <span className="group/email relative">
              <a
                href={`mailto:${item.email}`}
                className="text-[#007a8b] hover:underline"
              >
                {item.email}
              </a>
              <button
                type="button"
                onClick={() => handleCopy(item.email)}
                className="ml-1 hidden align-middle text-[#7a8fa6] hover:text-[#2d3e50] group-hover/email:inline-flex"
                aria-label="Copy email"
              >
                <CopyIcon fontSize="inherit" />
              </button>
            </span>
          </div>
        )}
        {item.phone && (
          <div className="flex items-center gap-1">
            <PhoneIcon fontSize="inherit" />
            <span>{item.phone}</span>
          </div>
        )}
      </div>

      {item.associationLabel && (
        <div className="mt-3">
          <span className="inline-flex rounded-full bg-[#f0f3f7] px-2 py-0.5 text-[11px] font-medium text-[#4a5568]">
            {item.associationLabel}
          </span>
        </div>
      )}
    </div>
  );
};

const SectionHeader = ({ title, count, open, onToggle }) => (
  <div className="flex w-full items-center justify-between gap-2 px-2 py-2">
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-2 text-left"
    >
      <ChevronRightIcon
        fontSize="small"
        className={classNames(
          'text-[#7a8fa6] transition-transform',
          open ? 'rotate-90' : 'rotate-0'
        )}
      />
      <span className="text-sm font-semibold text-[#2d3e50]">
        {title} ({count})
      </span>
    </button>
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-md border border-[#eaf0f6] px-2 py-1 text-xs font-medium text-[#2d3e50] hover:bg-[#f7fafc]"
      >
        <AddIcon fontSize="inherit" />
        Add
      </button>
      <SettingsIcon fontSize="small" className="text-[#7a8fa6]" />
    </div>
  </div>
);

const CollapsibleSection = ({ title, items }) => {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-lg border border-[#eaf0f6] bg-white">
      <SectionHeader
        title={title}
        count={items.length}
        open={open}
        onToggle={() => setOpen((prev) => !prev)}
      />
      {open && (
        <div className="space-y-3 px-3 pb-3">
          {items.map((item) => (
            <ChickletCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
};

const flattenContacts = (companies) =>
  companies.flatMap((company) =>
    (company.contacts || []).map((contact) => ({
      ...contact,
      company: company.name,
    }))
  );

const AssociatedObjectsPanel = ({ associations = DEFAULT_ASSOCIATIONS }) => {
  const companies = associations.companies || [];
  const contacts = useMemo(() => flattenContacts(companies), [companies]);

  return (
    <aside className="w-[340px] shrink-0 border-l border-[#eaf0f6] bg-[#f8fafc] px-3 py-4 font-sans">
      <div className="flex flex-col gap-4">
        <CollapsibleSection title="Contacts" items={contacts} />
        <CollapsibleSection title="Companies" items={companies} />
      </div>
    </aside>
  );
};

export default AssociatedObjectsPanel;
