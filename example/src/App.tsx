import { Chat } from "./Chat";
import "./index.css";
import githubLogo from "./github.svg";

export function App() {
  return (
    <div className="max-w-7xl mx-auto p-8 text-center relative z-10">
      <h1 className="text-5xl font-bold my-4 leading-tight">
        Revurb Chat Example
      </h1>
      <a
        href="https://github.com/tomnagengast/revurb"
        target="_blank"
        rel="noopener noreferrer"
      >
        {/* this should be white */}
        <img
          src={githubLogo}
          alt="GitHub"
          className="w-10 h-10 inline-block mb-4"
        />
      </a>
      <p className="mb-4">
        {/* Update this message with a short description of how to use the example demo app */}
        Connect to the Revurb WebSocket server and start chatting in real-time
      </p>
      <Chat />
    </div>
  );
}

export default App;
