import { Chat } from "./Chat";
import "./index.css";
import githubLogo from "./github.svg";

export function App() {
  return (
    <div className="max-w-7xl mx-auto p-8 text-center relative z-10">
      <h1 className="text-5xl font-bold my-4 leading-tight">Revurb</h1>
      <a
        href="https://github.com/tomnagengast/revurb"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img
          src={githubLogo}
          alt="GitHub"
          className="w-6 h-6 inline-block mb-4 invert"
        />
      </a>
      <p className="mb-4 max-w-2xl">
        A real-time chat demo using Revurb WebSocket server.
        <br />
        Enter your name, connect, join a channel, and start messaging.
        <br />
        Open multiple browser tabs to chat with yourself!
      </p>
      <Chat />
    </div>
  );
}

export default App;
