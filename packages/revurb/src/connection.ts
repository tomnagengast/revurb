import { Connection as ConnectionContract } from "./contracts/connection";
import type { FrameOpcode } from "./contracts/websocket-connection";
import { FrameOpcode as FrameOpcodeEnum } from "./contracts/websocket-connection";
import { MessageSent } from "./events/message-sent";

/**
 * Connection Implementation
 *
 * Concrete implementation of the Connection contract that wraps a WebSocket
 * connection with application context and state management.
 */
export class Connection extends ConnectionContract {
  /**
   * The normalized socket ID.
   *
   * @private
   */
  private _id: string | null = null;

  /**
   * Get the raw socket connection identifier.
   *
   * @returns The raw connection identifier
   */
  identifier(): string {
    return String(this.connection.id());
  }

  /**
   * Get the normalized socket ID.
   *
   * @returns The normalized socket ID
   */
  id(): string {
    if (!this._id) {
      this._id = this.generateId();
    }

    return this._id;
  }

  /**
   * Send a message to the connection.
   *
   * @param message - The message to send
   */
  send(message: string): void {
    this.connection.send(message);

    MessageSent.dispatch(this, message);
  }

  /**
   * Send a control frame to the connection.
   *
   * @param type - The frame opcode (default: PING)
   */
  control(type: FrameOpcode = FrameOpcodeEnum.PING): void {
    this.connection.send({
      payload: "",
      opcode: type,
      getContents: () => "",
    });
  }

  /**
   * Terminate a connection.
   */
  terminate(): void {
    this.connection.close();
  }
}
