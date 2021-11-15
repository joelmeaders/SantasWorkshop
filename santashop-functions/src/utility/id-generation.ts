export const generateId = (length: number): string => {
  const customLib = lib.alpha.concat(lib.number);
  const n: number = customLib.length;

  const generatedId: string[] = [];

  while (length > 0) {
    generatedId.push(customLib[Math.round(Math.random() * n)]);
    length -= 1;
  }

  return generatedId.join('');
};

interface ILib {
  alpha: string[];
  number: string[];
}

const lib: ILib = {
  alpha: [
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
    'G',
    'H',
    'J',
    'K',
    'L',
    'M',
    'N',
    'P',
    'Q',
    'R',
    'S',
    'T',
    'U',
    'V',
    'W',
    'X',
    'Y',
    'Z',
  ],
  number: ['2', '3', '4', '5', '6', '7', '8', '9'],
};
