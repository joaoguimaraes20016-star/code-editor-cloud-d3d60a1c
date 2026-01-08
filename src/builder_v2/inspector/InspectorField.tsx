import type { ChangeEvent } from 'react';

import type { InspectorField as InspectorFieldDefinition } from '../registry/componentRegistry';

const inputTypeMap: Record<InspectorFieldDefinition['inputType'], string> = {
  text: 'text',
  textarea: 'textarea',
  number: 'number',
  color: 'color',
};

type InspectorFieldProps = {
  field: InspectorFieldDefinition;
  value: unknown;
  defaultValue: unknown;
  onChange: (value: string | number) => void;
  onReset: () => void;
};

function valuesMatch(current: unknown, baseline: unknown) {
  if (current === baseline) {
    return true;
  }

  const isNumber = typeof current === 'number' || typeof baseline === 'number';

  if (isNumber) {
    const currentNumber = Number(current);
    const baselineNumber = Number(baseline);

    if (Number.isNaN(currentNumber) && Number.isNaN(baselineNumber)) {
      return true;
    }

    return currentNumber === baselineNumber;
  }

  if (typeof current === 'string' || typeof baseline === 'string') {
    return String(current ?? '') === String(baseline ?? '');
  }

  return false;
}

export function InspectorField({ field, value, defaultValue, onChange, onReset }: InspectorFieldProps) {
  const inputType = inputTypeMap[field.inputType];
  const hasAuthoredValue = value !== undefined && value !== null;
  const displayValue = hasAuthoredValue ? value : defaultValue;
  const isDirty = hasAuthoredValue ? !valuesMatch(value, defaultValue) : false;

  const commonProps = {
    className: 'builder-v2-inspector-input',
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const nextValue = field.inputType === 'number'
        ? Number(event.target.value)
        : event.target.value;

      onChange(nextValue);
    },
    placeholder: field.optional ? 'Optional' : undefined,
  } as const;

  const handleReset = () => {
    if (!isDirty) {
      return;
    }

    onReset();
  };

  if (inputType === 'textarea') {
    return (
      <label className="builder-v2-inspector-field">
        <span className="builder-v2-inspector-label-row">
          <span className="builder-v2-inspector-label">{field.label}</span>
          <button
            type="button"
            className="builder-v2-inspector-reset"
            onClick={handleReset}
            disabled={!isDirty}
            aria-label={`Reset ${field.label} to default`}
          >
            Reset
          </button>
        </span>
        <textarea
          {...commonProps}
          value={typeof displayValue === 'string' ? displayValue : ''}
        />
      </label>
    );
  }

  return (
    <label className="builder-v2-inspector-field">
      <span className="builder-v2-inspector-label-row">
        <span className="builder-v2-inspector-label">{field.label}</span>
        <button
          type="button"
          className="builder-v2-inspector-reset"
          onClick={handleReset}
          disabled={!isDirty}
          aria-label={`Reset ${field.label} to default`}
        >
          Reset
        </button>
      </span>
      <input
        type={inputType}
        {...commonProps}
        value={field.inputType === 'number'
          ? (() => {
              if (typeof displayValue === 'number' && Number.isFinite(displayValue)) {
                return String(displayValue);
              }

              if (typeof displayValue === 'string' && displayValue.trim() !== '') {
                return displayValue;
              }

              return '';
            })()
          : typeof displayValue === 'string'
            ? displayValue
            : ''}
      />
    </label>
  );
}
