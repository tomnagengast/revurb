import { ServerProvider } from "../../contracts/server-provider";
import type { IPubSubProvider } from "./contracts/pubsub-provider";

export class ReverbServerProvider extends ServerProvider {
  constructor(protected pubSubProvider: IPubSubProvider | null = null) {
    super();
  }

  /**
   * Set the PubSub provider.
   *
   * @param provider - The PubSub provider to set
   */
  public setPubSubProvider(provider: IPubSubProvider): void {
    this.pubSubProvider = provider;
  }

  /**
   * Determine whether the server should publish events.
   *
   * @returns {boolean}
   */
  override shouldPublishEvents(): boolean {
    return !!this.pubSubProvider;
  }

  /**
   * Publish a payload to the PubSub provider.
   *
   * @param payload
   */
  override publish(payload: Record<string, unknown>): void {
    this.pubSubProvider?.publish(payload);
  }
}
