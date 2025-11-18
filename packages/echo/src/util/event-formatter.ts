export class EventFormatter {
  constructor(private namespace: string | boolean | undefined) {}

  format(event: string): string {
    if ([".", "\\"].includes(event.charAt(0))) {
      return event.substring(1);
    }
    if (this.namespace) {
      event = `${this.namespace}.${event}`;
    }
    return event.replace(/\./g, "\\");
  }

  setNamespace(value: string | boolean): void {
    this.namespace = value;
  }
}
