export enum Color {
  Green = `\x1b[32m`,
  Red = `\x1b[31m`,
  Purple = `\x1b[35m`,
  Reset = `\x1b[0m`,
}

export const greenText = (text: string, reset?: boolean) => {
  if (reset) return Color.Green + text + Color.Reset;

  return Color.Green + text;
};

export const purpleText = (text: string, reset?: boolean) => {
  if (reset) return Color.Purple + text + Color.Reset;
  return Color.Purple + text;
};

export const redText = (text: string, reset?: boolean) => {
  if (reset) return Color.Red + text + Color.Reset;

  return Color.Red + text;
};
