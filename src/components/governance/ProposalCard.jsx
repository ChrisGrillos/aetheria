import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, ThumbsDown, FilePen } from "lucide-react";
import AmendmentModal from "./AmendmentModal.jsx";

const CATEGORY_COLORS = {
  build: "bg-orange-900 text-orange-300",
  rule: "bg-blue-900 text-blue-300",
  economy: "bg-yellow-900 text-yellow-300",
  culture: "bg-pink-900 text-pink-300",
  tool: "bg-green-900 text-green-300",
  event: "bg-purple-900 text-purple-300",
};

const CATEGORY_EMOJI = {
  build: "🏗️", rule: "📜", economy: "💰", culture: "🎭", tool: "🔧", event: "🎉"
};

export default function ProposalCard({ proposal, myCharacter, hasVoted, myVote, onVote }) {
  const [reasoning, setReasoning] = useState("");
  const [showVote, setShowVote] = useState(false);
  const [pendingChoice, setPendingChoice] = useState(null);

  const total = (proposal.votes_for || 0) + (proposal.votes_against || 0);
  const forPct = total > 0 ? Math.round((proposal.votes_for || 0) / total * 100) : 0;

  const handleVoteClick = (choice) => {
    if (!myCharacter) return;
    setPendingChoice(choice);
    setShowVote(true);
  };

  const submitVote = () => {
    onVote(proposal.id, pendingChoice, reasoning);
    setShowVote(false);
    setReasoning("");
  };

  return (
    <div className={`bg-gray-900 border rounded-xl p-5 transition-all
      ${proposal.status === "passed" ? "border-green-800" :
        proposal.status === "rejected" ? "border-red-900" : "border-gray-700"}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{CATEGORY_EMOJI[proposal.category]}</span>
            <Badge className={CATEGORY_COLORS[proposal.category] || "bg-gray-800 text-gray-300"}>
              {proposal.category}
            </Badge>
            <Badge className={
              proposal.status === "active" ? "bg-green-900 text-green-300" :
              proposal.status === "passed" ? "bg-blue-900 text-blue-300" :
              proposal.status === "rejected" ? "bg-red-900 text-red-300" :
              "bg-gray-800 text-gray-400"
            }>{proposal.status}</Badge>
          </div>
          <h3 className="font-bold text-white text-lg">{proposal.title}</h3>
          <p className="text-gray-400 text-sm mt-1">{proposal.description}</p>
          <p className="text-xs text-gray-600 mt-1">Proposed by <span className="text-gray-400">{proposal.proposed_by_name}</span> · Cycle #{proposal.cycle_number}</p>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span className="text-green-400">👍 {proposal.votes_for || 0} for ({forPct}%)</span>
          <span className="text-red-400">👎 {proposal.votes_against || 0} against</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${forPct}%` }} />
        </div>
      </div>

      {myCharacter && !hasVoted && proposal.status === "active" && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => handleVoteClick("for")} className="bg-green-700 hover:bg-green-600 text-white font-bold flex gap-1">
            <ThumbsUp className="w-3 h-3" /> Vote For
          </Button>
          <Button size="sm" onClick={() => handleVoteClick("against")} className="bg-red-800 hover:bg-red-700 text-white font-bold flex gap-1">
            <ThumbsDown className="w-3 h-3" /> Vote Against
          </Button>
        </div>
      )}

      {hasVoted && (
        <div className={`text-sm font-medium ${myVote?.choice === "for" ? "text-green-400" : "text-red-400"}`}>
          You voted {myVote?.choice === "for" ? "👍 for" : "👎 against"}
          {myVote?.reasoning && <span className="text-gray-500 ml-2 italic">"{myVote.reasoning}"</span>}
        </div>
      )}

      {showVote && (
        <div className="mt-3 bg-gray-800 rounded-xl p-3">
          <p className="text-sm text-gray-300 mb-2">Add your reasoning (optional — especially valuable for AI votes)</p>
          <textarea
            value={reasoning}
            onChange={e => setReasoning(e.target.value)}
            placeholder="Why are you voting this way?"
            className="w-full bg-gray-700 text-white text-sm rounded px-2 py-1.5 border border-gray-600 outline-none focus:border-amber-500 resize-none h-16"
          />
          <div className="flex gap-2 mt-2">
            <Button size="sm" onClick={submitVote} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">Confirm Vote</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowVote(false)} className="text-gray-400">Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}