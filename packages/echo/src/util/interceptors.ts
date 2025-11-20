export function registerVueRequestInterceptor(
  getSocketId: () => string | undefined,
): void {
  if (typeof window === "undefined") {
    return;
  }

  // biome-ignore lint/suspicious/noExplicitAny: Runtime check for optional Vue dependency
  const Vue = (window as any).Vue;
  if (!Vue?.http?.interceptors?.push) {
    return;
  }

  Vue.http.interceptors.push(
    // biome-ignore lint/suspicious/noExplicitAny: Vue HTTP interceptor signature
    (request: any, next: () => void) => {
      const socketId = getSocketId();
      if (socketId && request?.headers?.set) {
        request.headers.set("X-Socket-ID", socketId);
      }
      next();
    },
  );
}

export function registerAxiosRequestInterceptor(
  getSocketId: () => string | undefined,
): void {
  if (typeof window === "undefined") {
    return;
  }

  // biome-ignore lint/suspicious/noExplicitAny: Runtime check for optional axios dependency
  const axios = (window as any).axios;
  if (!axios?.interceptors?.request?.use) {
    return;
  }

  axios.interceptors.request.use(
    // biome-ignore lint/suspicious/noExplicitAny: Axios interceptor signature
    (config: any) => {
      const socketId = getSocketId();
      if (socketId) {
        config.headers = config.headers || {};
        config.headers["X-Socket-Id"] = socketId;
      }
      return config;
    },
  );
}

export function registerjQueryAjaxSetup(
  getSocketId: () => string | undefined,
): void {
  if (typeof window === "undefined") {
    return;
  }

  // biome-ignore lint/suspicious/noExplicitAny: Runtime check for optional jQuery dependency
  const jQuery = (window as any).jQuery;
  if (!jQuery?.ajaxPrefilter) {
    return;
  }

  jQuery.ajaxPrefilter(
    // biome-ignore lint/suspicious/noExplicitAny: jQuery ajaxPrefilter signature
    (_options: any, _originalOptions: any, xhr: any) => {
      const socketId = getSocketId();
      if (socketId && xhr?.setRequestHeader) {
        xhr.setRequestHeader("X-Socket-Id", socketId);
      }
    },
  );
}

export function registerTurboRequestInterceptor(
  getSocketId: () => string | undefined,
): void {
  if (typeof document === "undefined") {
    return;
  }

  // biome-ignore lint/suspicious/noExplicitAny: Runtime check for optional Turbo dependency
  const Turbo = (window as any).Turbo;
  if (typeof Turbo !== "object") {
    return;
  }

  document.addEventListener(
    "turbo:before-fetch-request",
    // biome-ignore lint/suspicious/noExplicitAny: Turbo event signature
    (event: any) => {
      const socketId = getSocketId();
      if (socketId && event?.detail?.fetchOptions?.headers) {
        event.detail.fetchOptions.headers["X-Socket-Id"] = socketId;
      }
    },
  );
}

export function registerAllInterceptors(
  getSocketId: () => string | undefined,
): void {
  registerVueRequestInterceptor(getSocketId);
  registerAxiosRequestInterceptor(getSocketId);
  registerjQueryAjaxSetup(getSocketId);
  registerTurboRequestInterceptor(getSocketId);
}
