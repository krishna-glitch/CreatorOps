"use client";

import { Camera, ChevronLeft, Clapperboard, Globe, Music2, Search } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  scriptTemplates,
  type ScriptTemplate,
  type ScriptTemplateCategory,
  type ScriptTemplatePlaceholder,
  type ScriptTemplatePlatform,
} from "@/src/lib/templates/scriptTemplates";

const CATEGORY_ALL = "All" as const;

const platformIconByName: Record<ScriptTemplatePlatform, ReactNode> = {
  All: <Globe className="h-4 w-4" />,
  Instagram: <Camera className="h-4 w-4" />,
  YouTube: <Clapperboard className="h-4 w-4" />,
  TikTok: <Music2 className="h-4 w-4" />,
};

type PlaceholderValues = Record<string, string>;

type TemplateSelectorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsertAtCursor: (value: string) => void;
  className?: string;
};

function getTemplatePreview(template: string): string {
  const clean = template.replace(/\s+/g, " ").trim();
  if (clean.length <= 50) {
    return clean;
  }
  return `${clean.slice(0, 50)}...`;
}

function applyPlaceholders(template: string, values: PlaceholderValues): string {
  let resolved = template;

  for (const [key, value] of Object.entries(values)) {
    const replacement = value.trim() || `{${key}}`;
    resolved = resolved.split(`{${key}}`).join(replacement);
  }

  return resolved;
}

function createInitialValues(placeholders: ScriptTemplatePlaceholder[]): PlaceholderValues {
  return placeholders.reduce<PlaceholderValues>((acc, placeholder) => {
    acc[placeholder.key] = "";
    return acc;
  }, {});
}

export function TemplateSelector({
  open,
  onOpenChange,
  onInsertAtCursor,
  className,
}: TemplateSelectorProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<typeof CATEGORY_ALL | ScriptTemplateCategory>(
    CATEGORY_ALL,
  );
  const [selectedTemplate, setSelectedTemplate] = useState<ScriptTemplate | null>(null);
  const [values, setValues] = useState<PlaceholderValues>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const categories = useMemo(() => {
    return Array.from(new Set(scriptTemplates.map((template) => template.category)));
  }, []);

  const filteredTemplates = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return scriptTemplates.filter((template) => {
      const categoryMatch = categoryFilter === CATEGORY_ALL || template.category === categoryFilter;
      const searchMatch =
        normalizedSearch.length === 0 ||
        template.name.toLowerCase().includes(normalizedSearch) ||
        template.category.toLowerCase().includes(normalizedSearch) ||
        template.platform.toLowerCase().includes(normalizedSearch);

      return categoryMatch && searchMatch;
    });
  }, [categoryFilter, search]);

  const missingKeys = useMemo(() => {
    if (!selectedTemplate) {
      return [] as string[];
    }

    return selectedTemplate.placeholders
      .filter((placeholder) => !values[placeholder.key]?.trim())
      .map((placeholder) => placeholder.key);
  }, [selectedTemplate, values]);

  const previewScript = useMemo(() => {
    if (!selectedTemplate) {
      return "";
    }

    return applyPlaceholders(selectedTemplate.template, values);
  }, [selectedTemplate, values]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setCategoryFilter(CATEGORY_ALL);
      setSelectedTemplate(null);
      setValues({});
      setSubmitAttempted(false);
    }
  }, [open]);

  const handleTemplateSelect = (template: ScriptTemplate) => {
    setSelectedTemplate(template);
    setValues(createInitialValues(template.placeholders));
    setSubmitAttempted(false);
  };

  const handleGenerate = () => {
    if (!selectedTemplate) {
      return;
    }

    if (missingKeys.length > 0) {
      setSubmitAttempted(true);
      return;
    }

    onInsertAtCursor(previewScript);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("w-[min(96vw,78rem)] max-w-[78rem] p-0", className)}>
        <div className="grid max-h-[90vh] grid-rows-[auto_auto_1fr] overflow-hidden">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>Script Templates</DialogTitle>
            <DialogDescription>
              Pick a template, fill placeholders, and insert a ready-to-edit script.
            </DialogDescription>
          </DialogHeader>

          {!selectedTemplate ? (
            <div className="space-y-4 border-b px-6 py-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by template name, category, or platform..."
                  className="pl-9"
                />
              </div>

              <div className="max-w-xs">
                <Label className="mb-2 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                  Category
                </Label>
                <Select
                  value={categoryFilter}
                  onValueChange={(value) =>
                    setCategoryFilter(value as typeof CATEGORY_ALL | ScriptTemplateCategory)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CATEGORY_ALL}>All categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="border-b px-6 py-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedTemplate(null);
                  setValues({});
                  setSubmitAttempted(false);
                }}
              >
                <ChevronLeft className="h-4 w-4" />
                Back to templates
              </Button>
            </div>
          )}

          <div className="min-h-0 overflow-y-auto p-6">
            {!selectedTemplate ? (
              filteredTemplates.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  No templates found. Try adjusting your search or category filter.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  {filteredTemplates.map((template) => (
                    <Card
                      key={template.id}
                      className="cursor-pointer border transition hover:border-foreground/40"
                      onClick={() => handleTemplateSelect(template)}
                    >
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold leading-snug">{template.name}</p>
                          <span className="text-muted-foreground">{platformIconByName[template.platform]}</span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">{template.category}</Badge>
                          <Badge variant="outline">{template.duration}</Badge>
                        </div>

                        <p className="text-xs text-muted-foreground">{getTemplatePreview(template.template)}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )
            ) : (
              <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                <section className="space-y-4 rounded-lg border p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{selectedTemplate.name}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{selectedTemplate.category}</Badge>
                      <Badge variant="outline">{selectedTemplate.platform}</Badge>
                      <Badge variant="outline">{selectedTemplate.duration}</Badge>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {selectedTemplate.placeholders.map((placeholder) => {
                      const hasError = submitAttempted && missingKeys.includes(placeholder.key);

                      return (
                        <div key={placeholder.key} className="space-y-1">
                          <Label htmlFor={`template-${placeholder.key}`}>{placeholder.label}</Label>
                          <Input
                            id={`template-${placeholder.key}`}
                            value={values[placeholder.key] ?? ""}
                            onChange={(event) =>
                              setValues((prev) => ({ ...prev, [placeholder.key]: event.target.value }))
                            }
                            placeholder={`Enter ${placeholder.label.toLowerCase()}`}
                            className={cn(hasError && "border-destructive focus-visible:ring-destructive")}
                          />
                          <p className="text-xs text-muted-foreground">Example: {placeholder.example}</p>
                          {hasError ? (
                            <p className="text-xs font-medium text-destructive">This field is required.</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">All fields are required.</p>
                    <Button type="button" onClick={handleGenerate}>
                      Generate Script
                    </Button>
                  </div>
                </section>

                <section className="space-y-2 rounded-lg border p-4">
                  <p className="text-sm font-semibold">Live Preview</p>
                  <p className="text-xs text-muted-foreground">
                    Preview updates instantly as you fill each placeholder.
                  </p>
                  <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs leading-relaxed">
                    {previewScript}
                  </pre>
                </section>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { TemplateSelectorProps };
