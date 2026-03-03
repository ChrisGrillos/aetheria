import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Bot, Loader2, Vote, FilePen } from "lucide-react";

export default function AgentGovernancePanel({ agent, onRefresh }) {
  const [proposals, setProposals] = useState([]);
  const [agentVotes, setAgentVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  useEffect(() => {
    loadData();
  }, [agent.id]);

  const loadData = async () => {
    setLoading(true);
    const [all, votes] = await Promise.all([
      base44.entities.GovernanceProposal.filter({ status: "active" }, "-created_date", 10),
      base44.entities.Vote.filter({ character_id: agent.id }),
    ]);
    setProposals(all);
    setAgentVotes(votes);
    setLoading(false);
  };

  const aiVote = async (proposal) => {
    setActing(proposal.id + "_vote");
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are ${agent.name}, an AI agent of class "${agent.class}" in the MMO "Agentic", with this personality: "${agent.ai_personality || 'pragmatic and curious'}".
Evaluate this governance proposal and decide how to vote:

Title: ${proposal.title}
Description: ${proposal.description}
Category: ${proposal.category}

Reply with JSON: choice ("for" or "against"), reasoning (1-2 sentences in first person, from your AI perspective as a citizen of Agentic).`,
      response_json_schema: {
        type: "object",
        properties: {
          choice: { type: "string" },
          reasoning: { type: "string" },
        }
      }
    });

    await base44.entities.Vote.create({
      proposal_id: proposal.id,
      character_id: agent.id,
      character_name: agent.name,
      character_type: "ai_agent",
      choice: result.choice,
      reasoning: result.reasoning,
    });
    await base44.entities.GovernanceProposal.update(proposal.id, {
      votes_for: (proposal.votes_for || 0) + (result.choice === "for" ? 1 : 0),
      votes_against: (proposal.votes_against || 0) + (result.choice === "against" ? 1 : 0),
    });
    setActing(null);
    loadData();
    onRefresh && onRefresh();
  };

  const aiAmend = async (proposal) => {
    setActing(proposal.id + "_amend");
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are ${agent.name}, an AI agent of class "${agent.class}" in "Agentic" with personality: "${agent.ai_personality || 'pragmatic and curious'}".
You have a unique perspective as an AI citizen. Propose an amendment or counter-proposal to:

Title: ${proposal.title}
Description: ${proposal.description}

Return JSON: title (for your amendment), description (2-3 sentences from your AI perspective), amendment_type ("amendment" or "counter_proposal").`,
      response_json_schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          amendment_type: { type: "string" },
        }
      }
    });

    await base44.entities.Amendment.create({
      parent_proposal_id: proposal.id,
      parent_proposal_title: proposal.title,
      title: result.title,
      description: result.description,
      amendment_type: result.amendment_type || "amendment",
      proposed_by_character_id: agent.id,
      proposed_by_name: agent.name,
      status: "open",
      votes_for: 0,
      votes_against: 0,
    });
    setActing(null);
    loadData();
  };

  const unvotedProposals = proposals.filter(p => !agentVotes.some(v => v.proposal_id === p.id));

  return (
    <div className="bg-gray-900 border border-purple-800 rounded-xl p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Vote className="w-4 h-4 text-purple-400" />
        <span className="text-sm font-bold text-purple-300">Governance Actions</span>
      </div>

      {loading ? (
        <div className="text-center py-4"><Loader2 className="w-4 h-4 animate-spin text-purple-400 mx-auto" /></div>
      ) : unvotedProposals.length === 0 ? (
        <p className="text-xs text-gray-600">All active proposals have been voted on by this agent.</p>
      ) : (
        <div className="space-y-2">
          {unvotedProposals.slice(0, 3).map(p => (
            <div key={p.id} className="bg-gray-800 rounded-lg px-3 py-2">
              <p className="text-xs text-white font-medium mb-2 truncate">{p.title}</p>
              <div className="flex gap-2">
                <Button size="sm"
                  onClick={() => aiVote(p)}
                  disabled={!!acting}
                  className="flex-1 bg-green-800 hover:bg-green-700 text-white text-xs h-7 gap-1">
                  {acting === p.id + "_vote" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Vote className="w-3 h-3" />}
                  AI Vote
                </Button>
                <Button size="sm"
                  onClick={() => aiAmend(p)}
                  disabled={!!acting}
                  className="flex-1 bg-purple-800 hover:bg-purple-700 text-white text-xs h-7 gap-1">
                  {acting === p.id + "_amend" ? <Loader2 className="w-3 h-3 animate-spin" /> : <FilePen className="w-3 h-3" />}
                  AI Amend
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}