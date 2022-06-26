export interface IError {
  code: string;
  message: string;
  details?: string;
}

export class AccountCreationError extends Error implements IError {
  public code: string;
  public details?: string;

  constructor(code: string, message: string, details?: string) {
    super(message);
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = AccountCreationError.name;
  }
}

export class ArgumentUndefinedError extends Error implements IError {
  public code: string;
  public argument: string;

  constructor(argument: string) {
    super(`Argument with name of ${argument} cannot be undefined`);
    this.code = `UndefinedArgument`;
    this.argument = argument;
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = ArgumentUndefinedError.name;
  }
}

export class ChildValidationError extends Error implements IError {
  public code: 'invalid_age' | 'invalid_firstname' | 'invalid_lastname';
  public details?: string;

  constructor(code: 'invalid_age' | 'invalid_firstname' | 'invalid_lastname') {
    super('Error validating child');
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = ChildValidationError.name;
  }
}
