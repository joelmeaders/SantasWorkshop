export const MAX_BIRTHDATE = (): Date => new Date('12/31/2021');

export const MAX_CHILD_AGE_IN_YEARS = (): number => 12;

export const MIN_BIRTHDATE = (): Date =>
  new Date(
    MAX_BIRTHDATE().setFullYear(
      MAX_BIRTHDATE().getFullYear() - MAX_CHILD_AGE_IN_YEARS()
    )
  );
