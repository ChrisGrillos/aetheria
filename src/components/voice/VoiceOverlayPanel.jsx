export default function VoiceOverlayPanel({
  listening = false,
  supported = false,
  transcript = "",
  error = "",
  manualPrompt = false,
  manualInput = "",
  setManualInput,
  submitManual,
  closeManual,
  pushToTalk = true,
  togglePushToTalk,
  remoteCount = 0,
  inline = false,
}) {
  return (
    <div className={`${inline ? "relative w-full h-full" : "absolute bottom-2 right-2 z-30 w-[320px] max-w-[92vw]"} pointer-events-auto`}>
      <div className="rounded-lg border border-cyan-800/70 bg-black/85 px-3 py-2 text-[11px]">
        <div className="flex items-center justify-between text-cyan-300">
          <span>Voice</span>
          <button
            type="button"
            onClick={togglePushToTalk}
            className="px-2 py-0.5 rounded border border-cyan-700/70 hover:bg-cyan-900/30"
          >
            {pushToTalk ? "PTT: V" : "Mic Open"}
          </button>
        </div>
        <div className="mt-1 text-gray-300">
          Party peers: <span className="text-cyan-300">{remoteCount}</span>
        </div>
        <div className={`mt-1 ${listening ? "text-emerald-300" : "text-gray-400"}`}>
          {listening ? "Listening (hold Alt)..." : supported ? "Hold Alt for voice ability command" : "Speech API unavailable"}
        </div>
        {transcript && <div className="mt-1 text-gray-300 truncate">Last: {transcript}</div>}
        {error && <div className="mt-1 text-red-400 truncate">{error}</div>}

        {manualPrompt && (
          <div className="mt-2 border-t border-gray-800 pt-2 space-y-2">
            <div className="text-gray-300">Type command: "use hotbar ability 1"</div>
            <input
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitManual(); }}
              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-100"
              placeholder="use slot 3"
            />
            <div className="flex gap-2">
              <button onClick={submitManual} className="px-2 py-1 rounded border border-emerald-700 text-emerald-300 hover:bg-emerald-900/20">
                Submit
              </button>
              <button onClick={closeManual} className="px-2 py-1 rounded border border-gray-700 text-gray-300 hover:bg-gray-800/40">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
