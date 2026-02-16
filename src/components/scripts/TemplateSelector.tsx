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
      <DialogContent className={cn("w-[min(96vw,78rem)] max-w-[78rem] gap-0 p-0 overflow-hidden rounded-xl", className)}>
        <div className="grid h-[85vh] grid-rows-[auto_1fr]">
          <DialogHeader className="border-b dash-border dash-bg-card px-6 py-4">
            <DialogTitle className="text-xl font-semibold text-slate-900">Script Templates</DialogTitle>
            <DialogDescription className="text-slate-500">
              Pick a template, fill placeholders, and insert a ready-to-edit script.
            </DialogDescription>
          </DialogHeader>

          {!selectedTemplate ? (
            <div className="grid grid-rows-[auto_1fr] overflow-hidden dash-bg-card">
              <div className="flex items-center gap-4 border-b dash-border dash-bg-card px-6 py-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by template name, category, or platform..."
                    className="pl-9 dash-bg-card dash-border text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-400"
                  />
                </div>

                <div className="min-w-[180px]">
                  <Select
                    value={categoryFilter}
                    onValueChange={(value) =>
                      setCategoryFilter(value as typeof CATEGORY_ALL | ScriptTemplateCategory)
                    }
                  >
                    <SelectTrigger className="dash-border dash-bg-card text-slate-900">
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

              <div className="overflow-y-auto p-6">
                {filteredTemplates.length === 0 ? (
                  <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed dash-border dash-bg-card text-center text-sm text-slate-500">
                    <Search className="mb-2 h-8 w-8 text-slate-300" />
                    <p>No templates found</p>
                    <p className="text-xs">Try adjusting your search or category filter.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredTemplates.map((template) => (
                      <Card
                        key={template.id}
                        className="group cursor-pointer dash-border dash-bg-card transition-all dash-border hover:shadow-md"
                        onClick={() => handleTemplateSelect(template)}
                      >
                        <CardContent className="space-y-3 p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg dash-bg-card text-slate-600 group-dash-bg-panel group-hover:text-white transition-colors">
                              {platformIconByName[template.platform]}
                            </div>
                            <Badge variant="outline" className="dash-border text-slate-500 font-normal">
                              {template.duration}
                            </Badge>
                          </div>

                          <div>
                            <h3 className="font-semibold text-slate-900 leading-tight mb-1">{template.name}</h3>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{template.category}</p>
                          </div>

                          <p className="line-clamp-3 text-xs text-slate-500 leading-relaxed dash-bg-card p-2 rounded-md border border-slate-100">
                            {getTemplatePreview(template.template)}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid h-full grid-cols-1 overflow-hidden lg:grid-cols-[1fr_1fr]">
              <section className="flex flex-col border-r dash-border dash-bg-card">
                <div className="border-b dash-border px-6 py-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedTemplate(null);
                      setValues({});
                      setSubmitAttempted(false);
                    }}
                    className="text-slate-500 hover:text-slate-900 -ml-2"
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Back to library
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  <div className="mb-6 space-y-1">
                    <h2 className="text-xl font-bold text-slate-900">{selectedTemplate.name}</h2>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="dash-bg-card text-slate-700 hover:bg-slate-200">{selectedTemplate.category}</Badge>
                      <Badge variant="outline" className="dash-border text-slate-500">{selectedTemplate.platform}</Badge>
                      <Badge variant="outline" className="dash-border text-slate-500">{selectedTemplate.duration}</Badge>
                    </div>
                  </div>

                  <div className="space-y-5">
                    {selectedTemplate.placeholders.map((placeholder) => {
                      const hasError = submitAttempted && missingKeys.includes(placeholder.key);

                      return (
                        <div key={placeholder.key} className="space-y-1.5">
                          <Label htmlFor={`template-${placeholder.key}`} className="text-sm font-medium text-slate-700">
                            {placeholder.label} <span className="text-rose-500">*</span>
                          </Label>
                          <Input
                            id={`template-${placeholder.key}`}
                            value={values[placeholder.key] ?? ""}
                            onChange={(event) =>
                              setValues((prev) => ({ ...prev, [placeholder.key]: event.target.value }))
                            }
                            placeholder={`Enter ${placeholder.label.toLowerCase()}...`}
                            className={cn(
                              "dash-bg-card dash-border text-slate-900 focus-visible:ring-slate-900",
                              hasError && "border-rose-300 focus-visible:ring-rose-200 bg-rose-50"
                            )}
                          />
                          {placeholder.example && (
                            <p className="text-xs text-slate-500">
                              <span className="font-medium">Example:</span> {placeholder.example}
                            </p>
                          )}
                          {hasError && (
                            <p className="text-xs font-medium text-rose-500">This field is required.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t dash-border dash-bg-card px-6 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs text-slate-500">Fill in all fields to generate.</p>
                    <Button type="button" onClick={handleGenerate} className="dash-bg-panel text-white dash-bg-panel">
                      Generate Script
                    </Button>
                  </div>
                </div>
              </section>

              <section className="flex flex-col dash-bg-card">
                <div className="border-b dash-border dash-bg-card px-6 py-4">
                  <p className="text-sm font-semibold text-slate-900">Live Preview</p>
                  <p className="text-xs text-slate-500">
                    Preview updates instantly as you fill each placeholder.
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="rounded-xl border dash-border dash-bg-card p-6 shadow-sm">
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800">
                      {previewScript || <span className="text-slate-400 italic">Script preview will appear here...</span>}
                    </pre>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { TemplateSelectorProps };
