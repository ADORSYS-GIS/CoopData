import * as React from "react";
import {
    type ColumnDef,
    type SortingState,
    type ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    useReactTable,
} from "@tanstack/react-table";
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    isLoading?: boolean;
    error?: unknown;
    searchPlaceholder?: string;
    searchColumnId?: string;
    emptyMessage?: string;
    pageSize?: number;
}

export function DataTable<TData, TValue>({
    columns,
    data,
    isLoading,
    error,
    searchPlaceholder = "Search...",
    searchColumnId,
    emptyMessage = "No results found.",
    pageSize = 10,
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [globalFilter, setGlobalFilter] = React.useState("");

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onGlobalFilterChange: setGlobalFilter,
        state: {
            sorting,
            columnFilters,
            globalFilter,
        },
        initialState: {
            pagination: {
                pageSize,
            },
        },
    });

    if (isLoading) {
        return (
            <div className="space-y-3 py-8">
                {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="py-8 text-center text-destructive">
                <p>Failed to load data</p>
                <p className="text-sm text-muted-foreground">{String(error)}</p>
            </div>
        );
    }

    return (
        <div>
            {/* Search */}
            {searchColumnId && (
                <div className="flex items-center py-4">
                    <div className="relative max-w-sm">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder={searchPlaceholder}
                            value={globalFilter}
                            onChange={(e) => setGlobalFilter(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="rounded-md border">
                <table className="w-full">
                    <thead>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id} className="border-b bg-muted/50">
                                {headerGroup.headers.map((header) => (
                                    <th key={header.id} className="h-10 px-4 text-left align-middle text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(header.column.columnDef.header, header.getContext())}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <tr
                                    key={row.id}
                                    className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <td key={cell.id} className="px-4 py-3 align-middle">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : (
                            <tr className="border-b">
                                <td colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                                    {emptyMessage}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between space-x-2 py-4">
                <div className="text-sm text-muted-foreground">
                    {table.getFilteredRowModel().rows.length} row(s) total
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.setPageIndex(0)}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <ChevronsLeft className="size-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <ChevronLeft className="size-4" />
                    </Button>
                    <div className="text-sm font-medium">
                        Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        <ChevronRight className="size-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                        disabled={!table.getCanNextPage()}
                    >
                        <ChevronsRight className="size-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

/**
 * Helper to create a sortable column header
 */
export function SortableHeader({
    column,
    children,
    className,
}: {
    column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: () => void };
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <Button
            variant="ghost"
            onClick={() => column.toggleSorting()}
            className={cn("-ml-3 h-8 data-[state=asc]:rotate-180", className)}
        >
            {children}
            <ArrowUpDown className="ml-2 size-3" />
        </Button>
    );
}
