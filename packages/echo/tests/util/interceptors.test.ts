import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
  registerAxiosRequestInterceptor,
  registerjQueryAjaxSetup,
  registerTurboRequestInterceptor,
  registerVueRequestInterceptor,
} from "../../src/util/interceptors";

describe("Interceptors", () => {
  let socketId: string | undefined;

  beforeEach(() => {
    socketId = "123.456";
    // biome-ignore lint/suspicious/noExplicitAny: Mocking global
    global.window = {} as any;
    global.document = {
      addEventListener: mock(),
      // biome-ignore lint/suspicious/noExplicitAny: Mocking global
    } as any;
  });

  it("should register Vue interceptor", () => {
    const Vue = {
      http: {
        interceptors: {
          // biome-ignore lint/suspicious/noExplicitAny: Mocking callback
          push: mock((callback: any) => {
            const request = { headers: { set: mock() } };
            const next = mock();
            callback(request, next);
            expect(request.headers.set).toHaveBeenCalledWith(
              "X-Socket-ID",
              "123.456",
            );
            expect(next).toHaveBeenCalled();
          }),
        },
      },
    };
    // biome-ignore lint/suspicious/noExplicitAny: Mocking global
    (global.window as any).Vue = Vue;

    registerVueRequestInterceptor(() => socketId);

    expect(Vue.http.interceptors.push).toHaveBeenCalled();
  });

  it("should register Axios interceptor", () => {
    const axios = {
      interceptors: {
        request: {
          // biome-ignore lint/suspicious/noExplicitAny: Mocking callback
          use: mock((callback: any) => {
            const config = { headers: {} as Record<string, string> };
            const result = callback(config);
            expect(result.headers["X-Socket-Id"]).toBe("123.456");
          }),
        },
      },
      // biome-ignore lint/suspicious/noExplicitAny: Mocking global
    } as any;
    // biome-ignore lint/suspicious/noExplicitAny: Mocking global
    (global.window as any).axios = axios;

    registerAxiosRequestInterceptor(() => socketId);

    expect(axios.interceptors.request.use).toHaveBeenCalled();
  });

  it("should register jQuery interceptor", () => {
    const jQuery = {
      // biome-ignore lint/suspicious/noExplicitAny: Mocking callback
      ajaxPrefilter: mock((callback: any) => {
        const xhr = { setRequestHeader: mock() };
        callback({}, {}, xhr);
        expect(xhr.setRequestHeader).toHaveBeenCalledWith(
          "X-Socket-Id",
          "123.456",
        );
      }),
      // biome-ignore lint/suspicious/noExplicitAny: Mocking global
    } as any;
    // biome-ignore lint/suspicious/noExplicitAny: Mocking global
    (global.window as any).jQuery = jQuery;

    registerjQueryAjaxSetup(() => socketId);

    expect(jQuery.ajaxPrefilter).toHaveBeenCalled();
  });

  it("should register Turbo interceptor", () => {
    const Turbo = {};
    // biome-ignore lint/suspicious/noExplicitAny: Mocking global
    (global.window as any).Turbo = Turbo;

    registerTurboRequestInterceptor(() => socketId);

    expect(document.addEventListener).toHaveBeenCalledWith(
      "turbo:before-fetch-request",
      expect.any(Function),
    );

    // biome-ignore lint/suspicious/noExplicitAny: accessing mock calls
    const callback = (document.addEventListener as any).mock.calls[0][1];
    const event = {
      detail: { fetchOptions: { headers: {} as Record<string, string> } },
    };
    callback(event);
    expect(event.detail.fetchOptions.headers["X-Socket-Id"]).toBe("123.456");
  });
});
