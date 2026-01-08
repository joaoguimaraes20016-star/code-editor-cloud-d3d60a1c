type TextProps = {
  text?: string;
};

export function Text({ text = 'Text' }: TextProps) {
  return (
    <p
      className="builder-v2-component builder-v2-component--text"
      style={{ textAlign: 'center', maxWidth: 672, margin: '0 auto' }}
    >
      {text}
    </p>
  );
}
