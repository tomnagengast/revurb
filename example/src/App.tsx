import { APITester } from "./APITester";
import "./index.css";
import githubLogo from "./github.svg";

export function App() {
	return (
		<div className="max-w-7xl mx-auto p-8 text-center relative z-10">
			<h1 className="text-5xl font-bold my-4 leading-tight">Revurb Example</h1>
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
			<p>
				Edit{" "}
				<code className="bg-[#1a1a1a] px-2 py-1 rounded font-mono">
					src/App.tsx
				</code>{" "}
				and save to test HMR
			</p>
			<APITester />
		</div>
	);
}

export default App;
