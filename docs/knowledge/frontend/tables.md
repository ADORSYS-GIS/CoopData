# Table Implementation Guide

> **Core Philosophy**: Tables utilize **TanStack Table (React Table v8)** + **shadcn/ui** components. Since we operate offline-first, all sorting, filtering, and pagination occur **client-side** directly on the IndexedDB dataset cached in memory. Tables must also render visual sync statuses for rows waiting to sync.

---

## 1. Column Definition & Offline Cell Markers

Define table columns with strong types. Integrate connection checks and status badges directly inside cells to represent local sync states.

```typescript
// File: frontend/src/components/shared/OrganizationColumns.tsx
import { ColumnDef } from "@tanstack/react-table";
import { Organization } from "@/types/organization";
import { SyncStatus } from "@/types/sync";
import { Badge } from "@/components/ui/badge";
import { CloudCheck, CloudLightning, AlertCircle } from "lucide-react";

export const organizationColumns: ColumnDef<Organization>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "domain",
    header: "Domain",
  },
  {
    accessorKey: "syncStatus",
    header: "Sync Status",
    cell: ({ row }) => {
      const status: SyncStatus = row.getValue("syncStatus");

      switch (status) {
        case SyncStatus.PENDING:
          return (
            <Badge variant="outline" className="text-yellow-600 bg-yellow-50 border-yellow-200 gap-1.5 py-0.5">
              <CloudLightning className="h-3.5 w-3.5 animate-pulse" />
              <span>Pending</span>
            </Badge>
          );
        case SyncStatus.FAILED:
          return (
            <Badge variant="outline" className="text-red-600 bg-red-50 border-red-200 gap-1.5 py-0.5">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Failed</span>
            </Badge>
          );
        case SyncStatus.SYNCED:
        default:
          return (
            <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 gap-1.5 py-0.5">
              <CloudCheck className="h-3.5 w-3.5" />
              <span>Synced</span>
            </Badge>
          );
      }
    },
  },
];
```

---

## 2. Reusable Client-Side Data Table Component

The DataTable component manages local sorting, global filtering, and pagination states in-memory, avoiding unnecessary loading queries.

```typescript
// File: frontend/src/components/ui/data-table.tsx
import React, { useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  SortingState,
  ColumnFiltersState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  searchKey?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = "Filter items...",
  searchKey,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    // Client-side operations
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="space-y-4">
      {/* Search Filter Input */}
      {searchKey && (
        <div className="flex items-center">
          <Input
            placeholder={searchPlaceholder}
            value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn(searchKey)?.setFilterValue(event.target.value)
            }
            className="max-w-sm"
          />
        </div>
      )}

      {/* Table grid */}
      <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-4 text-sm text-slate-700">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-slate-400">
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">
          Showing page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
```

---

## 3. Integration inside Pages

```tsx
import { useOrganizations } from "@/hooks/organizations/useOrganizations";
import { DataTable } from "@/components/ui/data-table";
import { organizationColumns } from "./OrganizationColumns";

export const ManageOrganizations = () => {
  const { data: orgs = [], isLoading } = useOrganizations();

  if (isLoading) return <p>Loading...</p>;

  return (
    <DataTable
      columns={organizationColumns}
      data={orgs}
      searchKey="name"
      searchPlaceholder="Search organizations by name..."
    />
  );
};
```

---

## Checklist

- [ ] Columns definition is placed in a separate file from the main page view.
- [ ] Columns are typed explicitly with `ColumnDef<TEntity>`.
- [ ] Elements include a Sync Status column rendering `PENDING`, `FAILED`, and `SYNCED` badges.
- [ ] Sorting and filtering configurations use client-side getters (`getSortedRowModel`, `getFilteredRowModel`).
- [ ] Pagination controls disable button triggers when the current page index hits bounds.
- [ ] Pagination calculations render current indexes correctly in a subtext element.
- [ ] Magic columns refer to accessor key variables instead of hardcoded labels.
