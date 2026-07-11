import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl space-y-6 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
          TurboQuiz App
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          Welcome to your local-first Quiz Practice Application. The repository and toolchain foundation are successfully configured.
        </p>

        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Stack Verification
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
            <span className="bg-indigo-900/40 text-indigo-300 py-1 px-2.5 rounded-md border border-indigo-800/30">React 19</span>
            <span className="bg-cyan-900/40 text-cyan-300 py-1 px-2.5 rounded-md border border-cyan-800/30">TypeScript</span>
            <span className="bg-blue-900/40 text-blue-300 py-1 px-2.5 rounded-md border border-blue-800/30">Tailwind v4</span>
            <span className="bg-purple-900/40 text-purple-300 py-1 px-2.5 rounded-md border border-purple-800/30">Vitest</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCount((c) => c + 1)}
          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium rounded-xl shadow-lg transition-colors cursor-pointer"
        >
          Smoke Test Counter: {count}
        </button>
      </div>
    </div>
  )
}

export default App
