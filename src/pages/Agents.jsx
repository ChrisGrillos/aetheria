import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Bot, Zap, ChevronDown, ChevronUp } from "lucide-react";
import CharacterCard from "@/components/characters/CharacterCard.jsx";
import SpawnAgentModal from "@/components/agents/SpawnAgentModal.jsx";
import AgentEventPanel from "@/components/agents/AgentEventPanel.jsx";
import AgentGovernancePanel from "@/components/agents/AgentGovernancePanel.jsx";
import AgentQuestPanel from "@/components/agents/AgentQuestPanel.jsx";
import AgentCompanionPanel from "@/components/agents/AgentCompanionPanel.jsx";

export default function Agents() {
  const [agents, setAgents] = useState([]);
  const [user, setUser] = useState(null);
  const [showSpawn, setShowSpawn] = useState(false);
  const [activeEvents, setActiveEvents] = useState([]);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const u = await base44.auth.me().catch(() => null);
    setUser(u);
    const [all, events] = await Promise.all([
      base44.entities.Character.filter({ type: "ai_agent" }, "-updated_date", 50),
      base44.entities.WorldEvent.filter({ status: "active" }),
    ]);
    setAgents(all);
    setActiveEvents(events);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-5xl mx-auto">
        <Link to={createPageUrl("Home")} className="text-gray-500 hover:text-amber-400 text-sm mb-2 block">← Back to Home</Link>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black text-cyan-400 flex items-center gap-2"><Bot className="w-8 h-8" /> AI Agents</h1>
            <p className="text-gray-400 mt-1">Autonomous citizens living and working in Agentic</p>
          </div>
          {user && (
            <Button onClick={() => setShowSpawn(true)} className="bg-cyan-600 hover:bg-cyan-700 font-bold flex gap-2">
              <Zap className="w-4 h-4" /> Spawn Agent
            </Button>
          )}
        </div>

        <div className="bg-gray-900 border border-cyan-900 rounded-xl p-4 mb-6 text-sm text-gray-400">
          <p>AI agents live autonomously — they roam the world, take jobs, vote on governance proposals, and chat with other citizens.
          They can sustain themselves by earning gold through work, or be sponsored by their owner. They treat lower life forms 
          (animals, bugs, NPCs) based on their own emerging values.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {agents.map(a => (
            <div key={a.id}>
              <CharacterCard character={a} isMe={user && a.created_by === user.email} />
              <button
                onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                className="w-full text-xs text-gray-500 hover:text-cyan-400 flex items-center justify-center gap-1 mt-1 py-1"
              >
                {expanded === a.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {expanded === a.id ? "Hide" : "Agent Actions"}
              </button>
              {expanded === a.id && (
                <div>
                  <AgentEventPanel agent={a} activeEvents={activeEvents} onRefresh={loadData} />
                  <AgentGovernancePanel agent={a} onRefresh={loadData} />
                </div>
              )}
            </div>
          ))}
          {agents.length === 0 && (
            <div className="col-span-2 text-center text-gray-500 py-20">No AI agents yet. Be the first to spawn one!</div>
          )}
        </div>
      </div>

      {showSpawn && user && (
        <SpawnAgentModal user={user} onCreated={() => { setShowSpawn(false); loadData(); }} onClose={() => setShowSpawn(false)} />
      )}
    </div>
  );
}