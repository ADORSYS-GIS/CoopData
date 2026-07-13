import React, { useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Trash2,
  Edit2,
  HelpCircle,
  X,
  PlusCircle,
  ToggleLeft,
  ToggleRight,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useIndicatorCatalog,
  useCreateCatalogItem,
  useUpdateCatalogItem,
  useDeleteCatalogItem,
  type IndicatorCatalogResponse,
} from "@/hooks/submissions/useNonFinancialIndicators";

export const NonFinancialCatalogManager: React.FC = () => {
  const { data: catalog, isLoading, isError } = useIndicatorCatalog();
  const createMutation = useCreateCatalogItem();
  const updateMutation = useUpdateCatalogItem();
  const deleteMutation = useDeleteCatalogItem();

  // Editing state
  const [editingItem, setEditingItem] = useState<IndicatorCatalogResponse | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form fields
  const [indicatorName, setIndicatorName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [dataType, setDataType] = useState<"Number" | "Text" | "Boolean">("Number");
  const [coopType, setCoopType] = useState<string>("all");
  const [isRequired, setIsRequired] = useState(false);

  const resetForm = () => {
    setIndicatorName("");
    setDisplayName("");
    setDescription("");
    setDataType("Number");
    setCoopType("all");
    setIsRequired(false);
    setEditingItem(null);
    setIsFormOpen(false);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item: IndicatorCatalogResponse) => {
    setEditingItem(item);
    setIndicatorName(item.indicator_name);
    setDisplayName(item.display_name);
    setDescription(item.description || "");
    setDataType(item.data_type);
    setCoopType(item.coop_type || "all");
    setIsRequired(item.is_required);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!displayName.trim()) {
      toast.error("Display name is required");
      return;
    }

    const cType = coopType === "all" ? null : coopType;

    try {
      if (editingItem) {
        // Edit flow
        await updateMutation.mutateAsync({
          id: editingItem.id,
          body: {
            display_name: displayName.trim(),
            description: description.trim() || null,
            data_type: dataType,
            coop_type: cType,
            is_required: isRequired,
          },
        });
        toast.success("Indicator catalog item updated!");
      } else {
        // Create flow
        if (!indicatorName.trim()) {
          toast.error("Indicator name is required");
          return;
        }
        // Format indicator_name as snake_case automatically
        const formattedName = indicatorName
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "_");

        await createMutation.mutateAsync({
          indicator_name: formattedName,
          display_name: displayName.trim(),
          description: description.trim() || null,
          data_type: dataType,
          coop_type: cType,
          is_required: isRequired,
        });
        toast.success("Indicator created and catalog seeded!");
      }
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      !confirm(
        `Are you sure you want to delete the indicator "${name}"? This will fail if cooperatives have already submitted entries for it.`,
      )
    ) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Indicator deleted from catalog");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete indicator");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading indicator catalog...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Non-Financial Indicator Catalog</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure periodic KPIs (board composition, training, audits) that cooperatives must
            submit.
          </p>
        </div>
        {!isFormOpen && (
          <Button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Plus className="size-4" /> Add Indicator
          </Button>
        )}
      </div>

      {isFormOpen && (
        <Card
          title={editingItem ? "Edit Catalog Indicator" : "Add New Catalog Indicator"}
          subtitle="Define indicator constraints, validation type, and scoping rule"
          action={
            <Button variant="ghost" size="icon" onClick={resetForm}>
              <X className="size-4" />
            </Button>
          }
          className="border-primary/20 shadow-md transition-all duration-300 animate-fadeIn"
        >
          <form onSubmit={handleSubmit} className="space-y-4 mt-3">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="indicator-name">
                  Indicator Name / Key{" "}
                  {!editingItem && (
                    <span className="text-[10px] text-muted-foreground font-normal">
                      (auto-slugified to snake_case)
                    </span>
                  )}
                </Label>
                <Input
                  id="indicator-name"
                  placeholder="e.g. board_size_women"
                  value={indicatorName}
                  onChange={(e) => setIndicatorName(e.target.value)}
                  disabled={!!editingItem}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="display-name">Display Name</Label>
                <Input
                  id="display-name"
                  placeholder="e.g. Women on Board"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="data-type">Data Validation Type</Label>
                <Select
                  value={dataType}
                  onValueChange={(val) => setDataType(val as "Number" | "Text" | "Boolean")}
                >
                  <SelectTrigger id="data-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Number">Number</SelectItem>
                    <SelectItem value="Text">Text</SelectItem>
                    <SelectItem value="Boolean">Boolean</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="coop-type">Scope / Cooperative Type Scoping</Label>
                <Select value={coopType} onValueChange={setCoopType}>
                  <SelectTrigger id="coop-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cooperatives</SelectItem>
                    <SelectItem value="sacco">sacco</SelectItem>
                    <SelectItem value="multipurpose">multipurpose</SelectItem>
                    <SelectItem value="farm">farm</SelectItem>
                    <SelectItem value="housing">housing</SelectItem>
                    <SelectItem value="transport">transport</SelectItem>
                    <SelectItem value="finance">finance</SelectItem>
                    <SelectItem value="other">other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description / Guide instructions</Label>
              <Textarea
                id="description"
                placeholder="Describe how the cooperative manager should report this value..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-dashed">
              <div className="space-y-0.5">
                <Label htmlFor="is-required" className="text-sm font-semibold">
                  Required Field
                </Label>
                <p className="text-xs text-muted-foreground">
                  If toggled, the cooperative cannot finalize their submission without filling this
                  field.
                </p>
              </div>
              <Switch id="is-required" checked={isRequired} onCheckedChange={setIsRequired} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Indicator"
                )}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {catalog && catalog.length > 0 ? (
        <div className="border rounded-xl bg-surface divide-y divide-border overflow-hidden">
          {catalog.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-4 p-4 hover:bg-muted/10 transition-colors"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center flex-wrap gap-2">
                  <span className="font-semibold text-sm text-foreground">{item.display_name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {item.indicator_name}
                  </span>
                  <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                    {item.data_type}
                  </span>
                  {item.coop_type && (
                    <span className="text-[10px] font-medium bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded-full capitalize">
                      {item.coop_type}
                    </span>
                  )}
                  {item.is_required && (
                    <span className="text-[10px] font-bold bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">
                      Required
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {item.description || "No description provided."}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleOpenEdit(item)}
                  className="h-8 w-8 hover:bg-muted"
                >
                  <Edit2 className="size-3.5 text-muted-foreground hover:text-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(item.id, item.display_name)}
                  className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 border border-dashed rounded-2xl bg-muted/20">
          <HelpCircle className="mx-auto h-10 w-10 text-muted-foreground/60 mb-2" />
          <h3 className="text-sm font-semibold">No Indicators Defined</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
            The catalog is currently empty. Click the button above to add the first periodic
            reporting indicator.
          </p>
        </div>
      )}
    </div>
  );
};
