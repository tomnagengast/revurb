/**
 * Exception thrown when an origin is not allowed.
 */
export class InvalidOrigin extends Error {
  constructor(message: string = 'Origin not allowed') {
    super(message);
    this.name = 'InvalidOrigin';
    Object.setPrototypeOf(this, InvalidOrigin.prototype);
  }
}
