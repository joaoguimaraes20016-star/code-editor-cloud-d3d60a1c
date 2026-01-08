type ButtonProps = {
  label?: string;
};

export function Button({ label = 'Button' }: ButtonProps) {
  return (
    <button
      type="button"
      className="builder-v2-component builder-v2-component--button"
      style={{ width: '100%', maxWidth: 320, alignSelf: 'center' }}
    >
      {label}
    </button>
  );
}
