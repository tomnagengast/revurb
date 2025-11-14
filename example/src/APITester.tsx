import { type FormEvent, useRef } from "react";

export function APITester() {
  const defaultServer = typeof location === "undefined" ? "" : location.origin;
  const responseInputRef = useRef<HTMLTextAreaElement>(null);

  const testEndpoint = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const form = e.currentTarget;
      const formData = new FormData(form);
      const serverInput = (formData.get("server") as string) || "";
      const trimmedServer = serverInput.trim();
      const baseServer =
        trimmedServer || defaultServer || "http://localhost:5173";
      const normalizedServer = /^https?:\/\//i.test(baseServer)
        ? baseServer
        : `http://${baseServer}`;
      const endpoint = formData.get("endpoint") as string;
      const url = new URL(endpoint, normalizedServer);
      const method = formData.get("method") as string;
      const res = await fetch(url, { method });

      const data = await res.json();
      if (responseInputRef.current) {
        responseInputRef.current.value = JSON.stringify(data, null, 2);
      }
    } catch (error) {
      if (responseInputRef.current) {
        responseInputRef.current.value = String(error);
      }
    }
  };

  return (
    <div className="mt-8 mx-auto w-full max-w-2xl text-left flex flex-col gap-4">
      <form
        onSubmit={testEndpoint}
        className="flex items-center gap-2 bg-[#1a1a1a] p-3 rounded-xl font-mono border-2 border-[#fbf0df] transition-colors duration-300 focus-within:border-[#f3d5a3] w-full"
      >
        {/* Is this relevant for revurb? If so, we should keep it, if not, we should remove it. */}
        <select
          name="method"
          className="bg-[#fbf0df] text-[#1a1a1a] py-1.5 px-3 rounded-lg font-bold text-sm min-w-[0px] appearance-none cursor-pointer hover:bg-[#f3d5a3] transition-colors duration-100"
        >
          <option value="GET" className="py-1">
            GET
          </option>
          <option value="PUT" className="py-1">
            PUT
          </option>
        </select>
        <input
          type="text"
          name="server"
          defaultValue={defaultServer || "http://localhost:5173"}
          className="w-full flex-1 bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white placeholder-[#fbf0df]/40"
          placeholder="http://localhost:5173"
        />
        {/* Connect to websocket server */}
        <input
          type="text"
          name="endpoint"
          defaultValue="/api/hello"
          className="w-full flex-1 bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white placeholder-[#fbf0df]/40"
          placeholder="/api/hello"
        />
        {/* Connect to websocket server (show disconnect button once connected) */}
        <button
          type="submit"
          className="bg-[#fbf0df] text-[#1a1a1a] border-0 px-5 py-1.5 rounded-lg font-bold transition-all duration-100 hover:bg-[#f3d5a3] hover:-translate-y-px cursor-pointer whitespace-nowrap"
        >
          Connect
        </button>
      </form>
      <div className="flex items-center gap-2 bg-[#1a1a1a] p-3 rounded-xl font-mono border-2 border-[#fbf0df] transition-colors duration-300 focus-within:border-[#f3d5a3] w-full">
        {/* Dropdown list with available channels to join (display once connected to websocket server) */}
        <input
          type="select"
          name="channel"
          className="w-full flex-1 bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white placeholder-[#fbf0df]/40"
          placeholder="Join channel..."
        />
      </div>
      <textarea
        ref={responseInputRef}
        placeholder="Response will appear here..."
        className="w-full min-h-[140px] bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 text-[#fbf0df] font-mono resize-y focus:border-[#f3d5a3] placeholder-[#fbf0df]/40"
      />
      <div className="flex justify-end">
        <button
          type="submit"
          className="bg-[#fbf0df] text-[#1a1a1a] border-0 px-5 py-1.5 rounded-lg font-bold transition-all duration-100 hover:bg-[#f3d5a3] hover:-translate-y-px cursor-pointer whitespace-nowrap"
        >
          Send
        </button>
      </div>
      {/* For each message, display the message, the sender, and the time. Ex: */}
      <div className="flex flex-col items-start gap-2 bg-[#1a1a1a] p-3 rounded-xl font-mono border-2 border-[#fbf0df] transition-colors duration-300 focus-within:border-[#f3d5a3] w-full">
        Hello! This is a test message.
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-gray-500">Tom</span>
          <span className="text-xs text-gray-500">12:00 PM</span>
        </div>
      </div>
    </div>
  );
}
