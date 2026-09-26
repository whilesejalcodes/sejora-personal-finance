import { useState } from "react";
import { OTHER_PAYMENT_METHOD_OPTION, PAYMENT_METHODS } from "@/lib/finance-options";

type PaymentMethodInputProps = {
  value: string;
  onChange: (value: string) => void;
};

export function getPaymentMethodInputState(value: string): { selection: string; otherValue: string } {
  const initialOther = value !== "" && !(PAYMENT_METHODS as readonly string[]).includes(value);
  return {
    selection: initialOther || value === "Other" ? OTHER_PAYMENT_METHOD_OPTION : value,
    otherValue: initialOther ? value : value === "Other" ? "Other" : "",
  };
}

export function PaymentMethodInput({ value, onChange }: PaymentMethodInputProps) {
  const initial = getPaymentMethodInputState(value);
  const [selection, setSelection] = useState(initial.selection);
  const [otherValue, setOtherValue] = useState(initial.otherValue);

  function handleSelectionChange(next: string) {
    setSelection(next);
    if (next === OTHER_PAYMENT_METHOD_OPTION) {
      onChange(otherValue || "Other");
    } else {
      onChange(next);
    }
  }

  return (
    <div className="space-y-2">
      <select value={selection} onChange={(event) => handleSelectionChange(event.target.value)} className="form-input" aria-label="Payment method">
        <option value="">Select a method</option>
        {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
        <option value={OTHER_PAYMENT_METHOD_OPTION}>Other</option>
      </select>
      {selection === OTHER_PAYMENT_METHOD_OPTION && (
        <input
          value={otherValue}
          onChange={(event) => {
            setOtherValue(event.target.value);
            onChange(event.target.value);
          }}
          placeholder="Enter payment method"
          className="form-input"
          aria-label="Custom payment method"
        />
      )}
    </div>
  );
}