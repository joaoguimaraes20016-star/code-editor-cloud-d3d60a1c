type ButtonProps = {
  label?: string;
};

export function Button({ label = 'Button' }: ButtonProps) {
  return (
    <button type="button" className="builder-v2-component builder-v2-component--button">
      {label}
    </button>
  );
}
