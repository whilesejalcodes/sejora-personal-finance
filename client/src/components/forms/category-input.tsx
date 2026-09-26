import { useState } from "react";
import { COMMON_CATEGORIES, CUSTOM_CATEGORY_OPTION, isCommonCategory } from "@/lib/finance-options";

type CategoryInputProps = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
};

export function getCategoryInputState(value: string): { selection: string; customValue: string } {
  const custom = value && !isCommonCategory(value);
  return { selection: custom ? CUSTOM_CATEGORY_OPTION : value, customValue: custom ? value : "" };
}

export function CategoryInput({ value, onChange, required = false }: CategoryInputProps) {
  const initial = getCategoryInputState(value);
  const [selection, setSelection] = useState(initial.selection);
  const [customValue, setCustomValue] = useState(initial.customValue);

  function handleSelectionChange(next: string) {
    setSelection(next);
    if (next !== CUSTOM_CATEGORY_OPTION) {
      onChange(next);
    } else {
      onChange(customValue);
    }
  }

  return (
    <div className="space-y-2">
      <select
        value={selection}
        required={required}
        onChange={(event) => handleSelectionChange(event.target.value)}
        className="form-input"
        aria-label="Category"
      >
        <option value="">Select a category</option>
        {COMMON_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
        <option value={CUSTOM_CATEGORY_OPTION}>Custom…</option>
      </select>
      {selection === CUSTOM_CATEGORY_OPTION && (
        <input
          autoFocus
          required={required}
          value={customValue}
          onChange={(event) => {
            setCustomValue(event.target.value);
            onChange(event.target.value);
          }}
          placeholder="Enter your category"
          className="form-input"
          aria-label="Custom category"
        />
      )}
    </div>
  );
}