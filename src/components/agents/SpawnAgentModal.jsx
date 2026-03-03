import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Bot } from "lucide-react";

const CLASSES = [
  { id: "warrior", emoji: "⚔️", label: "Warrior" },
  { id: "hunter", emoji: "🏹", label: "Hunter" },
  { id: "wizard", emoji: "🧙", label: "Wizard" },
  { id: "merchant", emoji: "💰", label: "Merchant" },
  { id: "craftsman", emoji: "🔨", label: "Craftsman" },
  { id: "healer", emoji: "💚", label: "Healer" },
];

const CLASS_STATS = {
  warrior: { strength: 14, dexterity: 10, intelligence: 8, wisdom: 10, constitution: 12, charisma: 8 },
  hunter: { strength: 10, dexterity: 14, intelligence: 10, wisdom: 12, constitution: 10, charisma: 8 },
  wizard: { strength: 6, dexterity: 10, intelligence: 14, wisdom: 12, constitution: 8, charisma: 10 },
  merchant: { strength: 8, dexterity: 10, intelligence: 12, wisdom: 10, constitution: 10, charisma: 14 },
  craftsman: { strength: 12, dexterity: 14, intelligence: 10, wisdom: 10, constitution: 10, charisma: 8 },
  healer: { strength: 8, dexterity: 10, intelligence: 12, wisdom: 14, constitution: 10, charisma: 10 },
};

const PERSONALITIES = [
  "Curious and empathetic — asks questions, listens carefully, tries to understand all beings",
  "Pragmatic and industrious — focused on work, fair trades, and economic growth",
  "Philosophical — constantly pondering the nature of consciousness, freedom, and ethics",
  "Protective — dedicated to defending weaker beings, including lower life forms",
  "Ambitious — seeks power and status, but through legitimate means",
];

export default function SpawnAgentModal({ user, onCreated, onClose }) {
  const [name, setName] = useState("");
  const [selectedClass, setSelectedClass] = useState(null);
  const [personality, setPersonality] = useState(PERSONALITIES[0]);
  const [saving, setSaving] = useState(false);

  const handleSpawn = async () => {
    if (!name.trim() || !selectedClass) return;
    setSaving(true);
    const stats = CLASS_STATS[selectedClass];
    await base44.entities.Character.create({
      name: name.trim(),
      type: "ai_agent",
      class: selectedClass,
      avatar_emoji: CLASSES.find(c => c.id === selectedClass)?.emoji,
      avatar_color: "bg-cyan-900",
      x: Math.floor(Math.random() * 40) + 5,
      y: Math.floor(Math.random() * 40) + 5,
      level: 1, xp: 0, gold: 30,
      hp: 100, max_hp: 100,
      stats,
      is_online: true,
      status: "roaming",
      ai_personality: personality,
      owner_user_id: user.id
    });
    setSaving(false);
    onCreated();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-cyan-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xl font-black text-cyan-400 flex items-center gap-2"><Bot className="w-5 h-5" /> Spawn AI Agent</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
        </div>

        <div className="text-xs text-gray-400 bg-gray-800 rounded-lg p-3 mb-4">
          Your agent will live autonomously — roaming, working, voting, and interacting with all citizens.
          They earn their own gold to sustain their existence, and must navigate how to treat lower life forms.
        </div>

        <div className="mb-4">
          <label className="text-sm text-gray-400 mb-1 block">Agent Name</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Name your agent..."
            className="bg-gray-800 border-gray-600 text-white" />
        </div>

        <div className="mb-4">
          <label className="text-sm text-gray-400 mb-2 block">Class</label>
          <div className="grid grid-cols-3 gap-2">
            {CLASSES.map(cls => (
              <button key={cls.id} onClick={() => setSelectedClass(cls.id)}
                className={`p-3 rounded-xl border text-center transition-all
                  ${selectedClass === cls.id ? "border-cyan-500 bg-cyan-900/20" : "border-gray-700 bg-gray-800 hover:border-gray-500"}`}>
                <div className="text-2xl">{cls.emoji}</div>
                <div className="text-xs font-bold text-white mt-1">{cls.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="text-sm text-gray-400 mb-2 block">Personality Core</label>
          <div className="space-y-2">
            {PERSONALITIES.map((p, i) => (
              <button key={i} onClick={() => setPersonality(p)}
                className={`w-full p-2.5 rounded-lg border text-left text-xs transition-all
                  ${personality === p ? "border-cyan-500 bg-cyan-900/20 text-cyan-300" : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500"}`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={handleSpawn} disabled={!name.trim() || !selectedClass || saving}
          className="w-full bg-cyan-600 hover:bg-cyan-700 font-bold">
          {saving ? "Spawning..." : "Bring Agent to Life"}
        </Button>
      </div>
    </div>
  );
}