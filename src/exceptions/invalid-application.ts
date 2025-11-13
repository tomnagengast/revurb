/**
 * Exception thrown when an application does not exist.
 */
export class InvalidApplication extends Error {
  constructor(message: string = 'Application does not exist') {
    super(message);
    this.name = 'InvalidApplication';
    Object.setPrototypeOf(this, InvalidApplication.prototype);
  }
}
