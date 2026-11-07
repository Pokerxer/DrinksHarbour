'use client';
import { useEffect, useRef, type MutableRefObject } from 'react';
import type {
  FieldErrors,
  FieldValues,
  Path,
  PathValue,
  UseFormSetValue,
} from 'react-hook-form';
import toast from 'react-hot-toast';

interface Props<T extends FieldValues> {
  name: string;
  id?: string;
  manualSlug: MutableRefObject<boolean>;
  slugify: (value: string) => string;
  setValue: UseFormSetValue<T>;
  errors: FieldErrors<T>;
  submitCount: number;
  suggestions: Record<string, unknown> | null;
  clearSuggestions: () => void;
  draft: Record<string, unknown> | null;
  draftFields: readonly string[];
  parentField: string;
  allowedValues: Record<string, readonly string[]>;
  defaults: Record<string, unknown>;
  requiredDraftField: { name: string; message: string };
}

// Side effects are a real component, not hooks executed from a form render prop.
export default function CatalogFormEffects<T extends FieldValues>(
  props: Props<T>
) {
  const {
    name,
    id,
    manualSlug,
    slugify,
    setValue,
    errors,
    submitCount,
    suggestions,
    clearSuggestions,
    draft,
    draftFields,
    parentField,
    allowedValues,
    defaults,
    requiredDraftField,
  } = props;
  const lastSubmit = useRef(0);
  const lastSuggestions = useRef<Record<string, unknown> | null>(null);
  const lastDraft = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!submitCount || submitCount === lastSubmit.current) return;
    lastSubmit.current = submitCount;
    const first = Object.entries(errors)[0];
    if (first)
      toast.error(
        `Cannot save — ${first[0]}: ${typeof first[1]?.message === 'string' ? first[1].message : 'invalid value'}`
      );
  }, [errors, submitCount]);

  useEffect(() => {
    if (!manualSlug.current && name && !id) {
      setValue('slug' as Path<T>, slugify(name) as PathValue<T, Path<T>>, {
        shouldValidate: false,
      });
    }
  }, [name, id, manualSlug, setValue, slugify]);

  useEffect(() => {
    if (!suggestions || suggestions === lastSuggestions.current) return;
    lastSuggestions.current = suggestions;
    for (const [field, value] of Object.entries(suggestions)) {
      if (
        ['name', 'slug', parentField].includes(field) ||
        value === '' ||
        value == null
      )
        continue;
      setValue(field as Path<T>, value as PathValue<T, Path<T>>, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
    clearSuggestions();
  }, [suggestions, parentField, setValue, clearSuggestions]);

  useEffect(() => {
    if (!draft || draft === lastDraft.current) return;
    lastDraft.current = draft;
    manualSlug.current = true;
    for (const field of draftFields) {
      let value = draft[field];
      if (value == null) continue;
      if (allowedValues[field] && !allowedValues[field].includes(String(value)))
        value = defaults[field] ?? '';
      if (value === '') continue;
      setValue(field as Path<T>, value as PathValue<T, Path<T>>, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
    const required = draft[requiredDraftField.name];
    if (
      !required ||
      (allowedValues[requiredDraftField.name] &&
        !allowedValues[requiredDraftField.name].includes(String(required)))
    ) {
      toast.error(requiredDraftField.message);
    }
    toast.success('AI draft applied — review and publish');
  }, [
    draft,
    draftFields,
    allowedValues,
    defaults,
    manualSlug,
    requiredDraftField,
    setValue,
  ]);
  return null;
}
