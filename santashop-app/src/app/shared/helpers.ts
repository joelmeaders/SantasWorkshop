import { Registration } from 'santashop-core-lib/lib/models';

export abstract class Helpers {
  public static qrCodeString(registration: Registration): string {
    const clone: Registration = JSON.parse(JSON.stringify(registration));

    const obj = {
      id: clone.id,
      n: clone.fullName,
      d: clone.date,
      c: clone.children,
    };

    return JSON.stringify(obj);
  }

  public static generateId(index: number): string {
    const keys: string[] = defaultKeys;
    const customLib: string[] = keys.map((a: Key) => lib[a]).reduce((a, b) => a.concat(b));
    const n: number = customLib.length;

    let generatedId: string[] = [];

    while (index > 0) {
      generatedId.push(customLib[Math.round(Math.random() * n)]);
      index -= 1;
    }

    return generatedId.join('');
  }
}

interface ILib {
  alpha: string[];
  number: string[];
}

type Key = keyof ILib;

const lib: ILib = {
  alpha: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
  number: ['2', '3', '4', '5', '6', '7', '8', '9'],
};

const defaultKeys: Key[] = ['alpha', 'number'];
