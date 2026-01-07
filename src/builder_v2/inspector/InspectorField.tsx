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
  onChange: (value: string | number) => void;
};

export function InspectorField({ field, value, onChange }: InspectorFieldProps) {
  const inputType = inputTypeMap[field.inputType];

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const nextValue = field.inputType === 'number'
      ? Number(event.target.value)
      : event.target.value;

    onChange(nextValue);
  };

  if (inputType === 'textarea') {
    return (
      <label className="builder-v2-inspector-field">
        <span className="builder-v2-inspector-label">{field.label}</span>
        <textarea
          className="builder-v2-inspector-input"
          value={typeof value === 'string' ? value : ''}
          onChange={handleChange}
        />
      </label>
    );
  }

  return (
    <label className="builder-v2-inspector-field">
      <span className="builder-v2-inspector-label">{field.label}</span>
      <input
        className="builder-v2-inspector-input"
        type={inputType}
        value={field.inputType === 'number'
          ? Number.isFinite(value as number)
            ? String(value)
            : ''
          : typeof value === 'string'
            ? value
            : ''}
        onChange={handleChange}
      />
    </label>
  );
}
