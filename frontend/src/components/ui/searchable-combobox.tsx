import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

export interface ComboboxOption {
  value: string;
  label: string;
  /** Optional secondary line shown beneath the label (e.g. region, description) */
  description?: string;
  /** Optional group key for grouping items */
  group?: string;
  /** Optional icon node rendered before the label */
  icon?: React.ReactNode;
}

export interface ComboboxGroup {
  key: string;
  label: string;
  icon?: React.ReactNode;
}

interface SearchableComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  groups?: ComboboxGroup[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  /** If true, keeps the selected item's description visible in the trigger */
  showDescription?: boolean;
}

export function SearchableCombobox({
  value,
  onChange,
  options,
  groups,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyMessage = "No results found.",
  disabled = false,
  className,
}: SearchableComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const selected = options.find((o) => o.value === value);

  // Filter options by search query (label + description)
  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.description?.toLowerCase().includes(q) ?? false),
    );
  }, [options, search]);

  // Group the filtered options if groups are defined
  const grouped = React.useMemo(() => {
    if (!groups || groups.length === 0) return null;
    const map = new Map<string, ComboboxOption[]>();
    groups.forEach((g) => map.set(g.key, []));
    const ungrouped: ComboboxOption[] = [];
    filtered.forEach((opt) => {
      if (opt.group && map.has(opt.group)) {
        map.get(opt.group)!.push(opt);
      } else {
        ungrouped.push(opt);
      }
    });
    return { map, ungrouped, groups };
  }, [filtered, groups]);

  const handleSelect = (val: string) => {
    onChange(val === value ? "" : val);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex w-full items-center justify-between rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/20",
            "h-9 px-3 py-2 text-sm",
            "hover:bg-slate-100/50 dark:hover:bg-slate-950/40 transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span className={cn("truncate text-left flex-1", !selected && "text-muted-foreground")}>
            {selected ? (
              <span className="flex items-center gap-1.5 min-w-0">
                {selected.icon && <span className="shrink-0">{selected.icon}</span>}
                <span className="truncate">{selected.label}</span>
              </span>
            ) : (
              placeholder
            )}
          </span>
          <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-40" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="p-0 shadow-xl border-border"
        style={{ width: "var(--radix-popover-trigger-width)", minWidth: 220 }}
        align="start"
        sideOffset={4}
      >
        <Command shouldFilter={false}>
          {/* Search input */}
          <div className="flex items-center border-b border-border px-3">
            <Search className="mr-2 size-3.5 shrink-0 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex h-9 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>

          <CommandList>
            {filtered.length === 0 && (
              <CommandEmpty>{emptyMessage}</CommandEmpty>
            )}

            {/* Grouped rendering */}
            {grouped ? (
              <>
                {grouped.ungrouped.length > 0 && (
                  <CommandGroup>
                    {grouped.ungrouped.map((opt) => (
                      <OptionItem
                        key={opt.value}
                        opt={opt}
                        selected={value}
                        onSelect={handleSelect}
                      />
                    ))}
                  </CommandGroup>
                )}

                {grouped.groups.map((group, idx) => {
                  const items = grouped.map.get(group.key) ?? [];
                  if (items.length === 0) return null;
                  return (
                    <React.Fragment key={group.key}>
                      {(idx > 0 || grouped.ungrouped.length > 0) && (
                        <CommandSeparator />
                      )}
                      <CommandGroup
                        heading={
                          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                            {group.icon && <span>{group.icon}</span>}
                            {group.label}
                          </span>
                        }
                      >
                        {items.map((opt) => (
                          <OptionItem
                            key={opt.value}
                            opt={opt}
                            selected={value}
                            onSelect={handleSelect}
                          />
                        ))}
                      </CommandGroup>
                    </React.Fragment>
                  );
                })}
              </>
            ) : (
              /* Flat (ungrouped) rendering */
              <CommandGroup>
                {filtered.map((opt) => (
                  <OptionItem
                    key={opt.value}
                    opt={opt}
                    selected={value}
                    onSelect={handleSelect}
                  />
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Internal option row ─────────────────────────────────────────────────────

function OptionItem({
  opt,
  selected,
  onSelect,
}: {
  opt: ComboboxOption;
  selected: string;
  onSelect: (val: string) => void;
}) {
  const isSelected = selected === opt.value;
  return (
    <CommandItem
      value={opt.value}
      onSelect={() => onSelect(opt.value)}
      className={cn(
        "flex items-start gap-2 cursor-pointer rounded-md px-2 py-2 text-sm",
        isSelected && "bg-primary/10 text-primary font-medium",
      )}
    >
      <Check
        className={cn("mt-0.5 size-3.5 shrink-0 text-primary", isSelected ? "opacity-100" : "opacity-0")}
      />
      <span className="flex flex-col min-w-0">
        <span className="flex items-center gap-1.5 min-w-0">
          {opt.icon && <span className="shrink-0 text-muted-foreground">{opt.icon}</span>}
          <span className="truncate">{opt.label}</span>
        </span>
        {opt.description && (
          <span className="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate">
            {opt.description}
          </span>
        )}
      </span>
    </CommandItem>
  );
}
