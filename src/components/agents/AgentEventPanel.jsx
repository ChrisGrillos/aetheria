import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Zap, Bot, Loader2, AlertTriangle } from "lucide-react";

// Classes that suit certain event types
const CLASS_EVENT_AFFINITY = {
  warrior:   ["monster_invasion", "natural_disaster"],
  fighter:   ["monster_invasion", "natural_disaster"],
  hunter:    ["monster_invasion", "npc_quest", "agent_quest"],
  healer:    ["plague", "natural_disaster"],
  wizard:    ["strange_omen", "plague"],
  magician:  ["strange_omen", "festival"],
  merchant:  ["resource_bloom", "festival", "npc_quest"],
  craftsman: ["resource_bloom", "npc_quest", "agent_quest"],
};

function getAffinity(agentClass, eventType) {
  return CLASS_EVENT_AFFINITY[agentClass]?.includes(eventType);
}

export default function AgentEventPanel({ agent, activeEvents, onRefresh }) {
  const [responding, setResponding] = useState(null);
  const [initiating, setInitiating] = useState(false);

  const suitableEvents = activeEvents.filter(e =>
    e.status === "active" &&
    !e.participants?.includes(agent.id) &&
    getAffinity(agent.class, e.event_type)
  );

  const autoRespond = async (event) => {
    setResponding(event.id);
    await base44.entities.WorldEvent.update(event.id, {
      participants: [...(event.participants || []), agent.id],
    });
    await base44.entities.Character.update(agent.id, {
      gold: (agent.gold || 0) + event.reward_gold,
      xp: (agent.xp || 0) + event.reward_xp,
      status: "roaming",
      last_message: `I responded to: ${event.title}`,
    });
    // Chronicle it
    await base44.entities.WorldChronicle.create({
      title: `${agent.name} responded to "${event.title}"`,
      entry_type: "world_event",
      summary: `AI agent ${agent.name} (${agent.class}) automatically responded to a ${event.event_type} event, earning ${event.reward_gold}g and ${event.reward_xp} XP.`,
      impact_tags: [event.event_type, "ai_agent", agent.class],
    });
    setResponding(null);
    onRefresh();
  };

  const initiateQuest = async () => {
    setInitiating(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are ${agent.name}, a ${agent.class} AI agent in the MMO world "Agentic". 
Create a small, localized quest or event that you are initiating. It should require at least some human cooperation, 
and fit your class archetype (${agent.class}). 
Return JSON: title, description (2 sentences in-world voice from the agent's perspective), 
affected_area (brief), reward_gold (15-60), reward_xp (10-40), severity: "minor".`,
      response_json_schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          affected_area: { type: "string" },
          reward_gold: { type: "number" },
          reward_xp: { type: "number" },
          severity: { type: "string" },
        }
      }
    });
    const expires = new Date();
    expires.setDate(expires.getDate() + 2);
    await base44.entities.WorldEvent.create({
      ...result,
      event_type: "agent_quest",
      status: "active",
      participants: [agent.id],
      requires_cooperation: true,
      initiated_by_agent_id: agent.id,
      initiated_by_agent_name: agent.name,
      expires_at: expires.toISOString(),
    });
    setInitiating(false);
    onRefresh();
  };

  return (
    <div className="bg-gray-900 border border-cyan-800 rounded-xl p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Bot className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-bold text-cyan-300">Agent Actions</span>
      </div>

      {suitableEvents.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-2">Suited events for {agent.name} ({agent.class}):</p>
          <div className="space-y-2">
            {suitableEvents.map(e => (
              <div key={e.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
                <div>
                  <span className="text-xs font-medium text-white">{e.title}</span>
                  <span className="text-xs text-cyan-400 ml-2">✓ suited</span>
                </div>
                <Button size="sm"
                  onClick={() => autoRespond(e)}
                  disabled={responding === e.id}
                  className="bg-cyan-700 hover:bg-cyan-600 text-white text-xs h-7 px-2 gap-1">
                  {responding === e.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  Auto-respond
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {suitableEvents.length === 0 && (
        <p className="text-xs text-gray-600 mb-3">No suited active events right now.</p>
      )}

      <Button
        onClick={initiateQuest}
        disabled={initiating}
        size="sm"
        className="w-full bg-purple-700 hover:bg-purple-600 text-white font-bold gap-1"
      >
        {initiating ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertTriangle className="w-3 h-3" />}
        {initiating ? "Initiating Quest..." : "Initiate Localized Quest"}
      </Button>
      <p className="text-xs text-gray-600 mt-1 text-center">Requires human cooperation</p>
    </div>
  );
}