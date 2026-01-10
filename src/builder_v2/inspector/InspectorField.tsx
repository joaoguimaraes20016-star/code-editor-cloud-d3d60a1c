import type { ChangeEvent } from 'react';
import type { InspectorField as InspectorFieldDefinition } from '../registry/componentRegistry';

type InspectorFieldProps = {
  field: InspectorFieldDefinition;
  value: unknown;
  defaultValue: unknown;
  onChange: (value: string | number) => void;
  onReset: () => void;
};

function valuesMatch(current: unknown, baseline: unknown) {
  if (current === baseline) return true;

  const isNumber = typeof current === 'number' || typeof baseline === 'number';
  if (isNumber) {
    const a = Number(current);
    const b = Number(baseline);
    if (Number.isNaN(a) && Number.isNaN(b)) return true;
    return a === b;
  }

  if (typeof current === 'string' || typeof baseline === 'string') {
    return String(current ?? '') === String(baseline ?? '');
  }

  return false;
}

/**
 * Framer-style inline field: label left, input right
 */
export function InspectorField({ 
  field, 
  value, 
  defaultValue, 
  onChange, 
  onReset 
}: InspectorFieldProps) {
  const hasAuthoredValue = value !== undefined && value !== null;
  const displayValue = hasAuthoredValue ? value : defaultValue;
  const isDirty = hasAuthoredValue ? !valuesMatch(value, defaultValue) : false;

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const nextValue = field.inputType === 'number'
      ? Number(event.target.value)
      : event.target.value;
    onChange(nextValue);
  };

  const getValue = (): string => {
    if (field.inputType === 'number') {
      if (typeof displayValue === 'number' && Number.isFinite(displayValue)) {
        return String(displayValue);
      }
      if (typeof displayValue === 'string' && displayValue.trim() !== '') {
        return displayValue;
      }
      return '';
    }
    return typeof displayValue === 'string' ? displayValue : '';
  };

  // Textarea for multiline content
  if (field.inputType === 'textarea') {
    return (
      <div className="builder-field builder-field--textarea">
        <div className="builder-field-header">
          <label className="builder-field-label">{field.label}</label>
          {isDirty && (
            <button
              type="button"
              className="builder-field-reset"
              onClick={onReset}
              aria-label="Reset"
            >
              ↺
            </button>
          )}
        </div>
        <textarea
          className="builder-field-input"
          value={getValue()}
          onChange={handleChange}
          placeholder={field.optional ? 'Optional' : undefined}
          rows={3}
        />
      </div>
    );
  }

  // Inline row for other types
  return (
    <div className="builder-field">
      <label className="builder-field-label">{field.label}</label>
      <div className="builder-field-control">
        {field.inputType === 'color' ? (
          <input
            type="color"
            className="builder-field-color"
            value={getValue() || '#000000'}
            onChange={handleChange}
          />
        ) : (
          <input
            type={field.inputType === 'number' ? 'number' : 'text'}
            className="builder-field-input"
            value={getValue()}
            onChange={handleChange}
            placeholder={field.optional ? '—' : undefined}
          />
        )}
        {isDirty && (
          <button
            type="button"
            className="builder-field-reset"
            onClick={onReset}
            aria-label="Reset"
          >
            ↺
          </button>
        )}
      </div>
    </div>
  );
}
