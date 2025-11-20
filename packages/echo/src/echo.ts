import type { Channel, PresenceChannel } from "./channel";
import { NullConnector, PusherConnector, SocketIoConnector } from "./connector";
import type { Connector } from "./connector/connector";
import type { BroadcastDriver, EchoOptions } from "./types";
import { isConstructor } from "./util";

export class Echo<TBroadcaster extends BroadcastDriver = "reverb"> {
  connector!: Connector<BroadcastDriver>;
  options: EchoOptions<TBroadcaster>;

  constructor(options: EchoOptions<TBroadcaster>) {
    this.options = options;
    this.connect();

    if (!this.options.withoutInterceptors) {
      this.registerInterceptors();
    }
  }

  channel(channel: string): Channel {
    return this.connector.channel(channel);
  }

  connect(): void {
    const broadcaster = this.options.broadcaster;

    if (broadcaster === "reverb") {
      this.connector = new PusherConnector({
        ...this.options,
        broadcaster: "reverb",
        cluster: "",
      } as EchoOptions<"reverb">);
    } else if (broadcaster === "pusher") {
      this.connector = new PusherConnector(
        this.options as unknown as EchoOptions<"reverb">,
      );
    } else if (broadcaster === "ably") {
      this.connector = new PusherConnector({
        ...this.options,
        cluster: "",
        broadcaster: "pusher",
      } as unknown as EchoOptions<"reverb">);
    } else if (broadcaster === "socket.io") {
      this.connector = new SocketIoConnector(
        this.options as EchoOptions<"socket.io">,
      );
    } else if (broadcaster === "null") {
      this.connector = new NullConnector(this.options as EchoOptions<"null">);
    } else if (
      typeof broadcaster === "function" &&
      isConstructor(broadcaster)
    ) {
      // biome-ignore lint/suspicious/noExplicitAny: Custom constructor type handling
      this.connector = new (broadcaster as any)(this.options);
    } else {
      throw new Error(
        `Broadcaster ${typeof broadcaster} ${String(broadcaster)} is not supported.`,
      );
    }
  }

  disconnect(): void {
    this.connector.disconnect();
  }

  join(channel: string): PresenceChannel {
    return this.connector.presenceChannel(channel);
  }

  leave(channel: string): void {
    this.connector.leave(channel);
  }

  leaveChannel(channel: string): void {
    this.connector.leaveChannel(channel);
  }

  leaveAllChannels(): void {
    const connector = this.connector as { channels?: Record<string, unknown> };
    if (connector.channels) {
      for (const channel in connector.channels) {
        this.leaveChannel(channel);
      }
    }
  }

  listen(
    channel: string,
    event: string,
    callback: (...args: unknown[]) => unknown,
  ): Channel {
    return this.connector.listen(channel, event, callback);
  }

  private(channel: string): Channel {
    return this.connector.privateChannel(channel);
  }

  encryptedPrivate(channel: string): Channel {
    return this.connector.encryptedPrivateChannel(channel);
  }

  socketId(): string | undefined {
    return this.connector.socketId();
  }

  /**
   * Register 3rd party request interceptors. These are used to automatically
   * send a connections socket id to a Laravel app with a X-Socket-Id header.
   */
  registerInterceptors(): void {
    if (typeof window === "undefined") {
      return;
    }

    // Guard Vue HTTP interceptor
    // biome-ignore lint/suspicious/noExplicitAny: Runtime check for optional Vue dependency
    const Vue = (window as any).Vue;
    if (Vue?.http?.interceptors?.push) {
      this.registerVueRequestInterceptor();
    }

    // Guard Axios interceptor
    // biome-ignore lint/suspicious/noExplicitAny: Runtime check for optional axios dependency
    const axios = (window as any).axios;
    if (typeof axios === "function" && axios?.interceptors?.request?.use) {
      this.registerAxiosRequestInterceptor();
    }

    // Guard jQuery AjaxPrefilter
    // biome-ignore lint/suspicious/noExplicitAny: Runtime check for optional jQuery dependency
    const jQuery = (window as any).jQuery;
    if (typeof jQuery === "function" && jQuery?.ajaxPrefilter) {
      this.registerjQueryAjaxSetup();
    }

    // Guard Turbo Request interceptor
    if (typeof document !== "undefined") {
      // biome-ignore lint/suspicious/noExplicitAny: Runtime check for optional Turbo dependency
      const Turbo = (window as any).Turbo;
      if (typeof Turbo === "object") {
        this.registerTurboRequestInterceptor();
      }
    }
  }

  /**
   * Register a Vue HTTP interceptor to add the X-Socket-ID header.
   */
  private registerVueRequestInterceptor(): void {
    // biome-ignore lint/suspicious/noExplicitAny: Runtime check for optional Vue dependency
    const Vue = (window as any).Vue;
    if (!Vue?.http?.interceptors?.push) {
      return;
    }

    Vue.http.interceptors.push(
      // biome-ignore lint/suspicious/noExplicitAny: Vue HTTP interceptor signature
      (request: any, next: () => void) => {
        const socketId = this.socketId();
        if (socketId && request?.headers?.set) {
          request.headers.set("X-Socket-ID", socketId);
        }
        next();
      },
    );
  }

  /**
   * Register an Axios HTTP interceptor to add the X-Socket-ID header.
   */
  private registerAxiosRequestInterceptor(): void {
    // biome-ignore lint/suspicious/noExplicitAny: Runtime check for optional axios dependency
    const axios = (window as any).axios;
    if (!axios?.interceptors?.request?.use) {
      return;
    }

    axios.interceptors.request.use(
      // biome-ignore lint/suspicious/noExplicitAny: Axios interceptor signature
      (config: any) => {
        const socketId = this.socketId();
        if (socketId) {
          config.headers = config.headers || {};
          config.headers["X-Socket-Id"] = socketId;
        }
        return config;
      },
    );
  }

  /**
   * Register jQuery AjaxPrefilter to add the X-Socket-ID header.
   */
  private registerjQueryAjaxSetup(): void {
    // biome-ignore lint/suspicious/noExplicitAny: Runtime check for optional jQuery dependency
    const jQuery = (window as any).jQuery;
    if (!jQuery?.ajaxPrefilter) {
      return;
    }

    jQuery.ajaxPrefilter(
      // biome-ignore lint/suspicious/noExplicitAny: jQuery ajaxPrefilter signature
      (_options: any, _originalOptions: any, xhr: any) => {
        const socketId = this.socketId();
        if (socketId && xhr?.setRequestHeader) {
          xhr.setRequestHeader("X-Socket-Id", socketId);
        }
      },
    );
  }

  /**
   * Register the Turbo Request interceptor to add the X-Socket-ID header.
   */
  private registerTurboRequestInterceptor(): void {
    if (typeof document === "undefined") {
      return;
    }

    document.addEventListener(
      "turbo:before-fetch-request",
      // biome-ignore lint/suspicious/noExplicitAny: Turbo event signature
      (event: any) => {
        const socketId = this.socketId();
        if (socketId && event?.detail?.fetchOptions?.headers) {
          event.detail.fetchOptions.headers["X-Socket-Id"] = socketId;
        }
      },
    );
  }
}

export default Echo;
