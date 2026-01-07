type TextProps = {
  text?: string;
};

export function Text({ text = 'Text' }: TextProps) {
  return <p className="builder-v2-component builder-v2-component--text">{text}</p>;
}
