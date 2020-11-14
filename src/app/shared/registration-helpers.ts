export abstract class RegistrationHelpers {

  public static expandT(toyType: string) {
    switch (toyType) {
      case 'b': return 'boy';
      case 'g': return 'girl';
      case 'i': return 'infant';
    }
  }

  public static expandA(ageGroup: string) {
    switch (ageGroup) {
      case '0': return '0-2';
      case '3': return '3-5';
      case '6': return '6-8';
      case '9': return '9-11';
    }
  }

}