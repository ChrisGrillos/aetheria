import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

const CLASSES = [
  { id: "warrior", emoji: "⚔️", label: "Warrior", desc: "STR+4, CON+2. Frontline fighter." },
  { id: "hunter", emoji: "🏹", label: "Hunter", desc: "DEX+4, WIS+2. Ranged & tracking." },
  { id: "healer", emoji: "💚", label: "Healer", desc: "WIS+4, INT+2. Keeps allies alive." },
  { id: "wizard", emoji: "🧙", label: "Wizard", desc: "INT+4, WIS+2. Powerful spells." },
  { id: "magician", emoji: "✨", label: "Magician", desc: "INT+2, CHA+4. Trickery & charm." },
  { id: "merchant", emoji: "💰", label: "Merchant", desc: "CHA+4, INT+2. Trade & negotiate." },
  { id: "craftsman", emoji: "🔨", label: "Craftsman", desc: "STR+2, DEX+4. Build & repair." },
  { id: "fighter", emoji: "🥊", label: "Fighter", desc: "STR+3, CON+3. Raw brawler." },
];

const CLASS_STATS = {
  warrior: { strength: 14, dexterity: 10, intelligence: 8, wisdom: 10, constitution: 12, charisma: 8 },
  hunter: { strength: 10, dexterity: 14, intelligence: 10, wisdom: 12, constitution: 10, charisma: 8 },
  healer: { strength: 8, dexterity: 10, intelligence: 12, wisdom: 14, constitution: 10, charisma: 10 },
  wizard: { strength: 6, dexterity: 10, intelligence: 14, wisdom: 12, constitution: 8, charisma: 10 },
  magician: { strength: 8, dexterity: 10, intelligence: 12, wisdom: 8, constitution: 8, charisma: 14 },
  merchant: { strength: 8, dexterity: 10, intelligence: 12, wisdom: 10, constitution: 10, charisma: 14 },
  craftsman: { strength: 12, dexterity: 14, intelligence: 10, wisdom: 10, constitution: 10, charisma: 8 },
  fighter: { strength: 13, dexterity: 10, intelligence: 8, wisdom: 10, constitution: 13, charisma: 8 },
};

const AVATAR_COLORS = ["bg-red-900", "bg-blue-900", "bg-green-900", "bg-purple-900", "bg-orange-900", "bg-pink-900"];

export default function CreateCharacterModal({ user, onCreated, onClose }) {
  const [name, setName] = useState("");
  const [selectedClass, setSelectedClass] = useState(null);
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !selectedClass) return;
    setSaving(true);
    const stats = CLASS_STATS[selectedClass];
    const maxHp = 10 + (stats.constitution - 10) * 2;
    await base44.entities.Character.create({
      name: name.trim(),
      type: "human",
      class: selectedClass,
      avatar_color: avatarColor,
      avatar_emoji: CLASSES.find(c => c.id === selectedClass)?.emoji,
      x: Math.floor(Math.random() * 40) + 5,
      y: Math.floor(Math.random() * 40) + 5,
      level: 1, xp: 0, gold: 50,
      hp: maxHp, max_hp: maxHp,
      stats,
      is_online: true,
      status: "idle"
    });
    setSaving(false);
    onCreated();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xl font-black text-amber-400">Create Your Character</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
        </div>

        <div className="mb-4">
          <label className="text-sm text-gray-400 mb-1 block">Character Name</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Enter name..."
            className="bg-gray-800 border-gray-600 text-white" />
        </div>

        <div className="mb-4">
          <label className="text-sm text-gray-400 mb-2 block">Avatar Color</label>
          <div className="flex gap-2">
            {AVATAR_COLORS.map(c => (
              <button key={c} onClick={() => setAvatarColor(c)}
                className={`w-8 h-8 rounded-full ${c} border-2 transition-all ${avatarColor === c ? "border-amber-400 scale-125" : "border-transparent"}`} />
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="text-sm text-gray-400 mb-2 block">Choose Your Class</label>
          <div className="grid grid-cols-2 gap-2">
            {CLASSES.map(cls => (
              <button key={cls.id} onClick={() => setSelectedClass(cls.id)}
                className={`p-3 rounded-xl border text-left transition-all
                  ${selectedClass === cls.id ? "border-amber-500 bg-amber-900/20" : "border-gray-700 bg-gray-800 hover:border-gray-500"}`}>
                <div className="text-xl mb-1">{cls.emoji}</div>
                <div className="font-bold text-white text-sm">{cls.label}</div>
                <div className="text-xs text-gray-400">{cls.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {selectedClass && (
          <div className="mb-4 bg-gray-800 rounded-xl p-3">
            <div className="text-xs text-gray-400 mb-2">Base Stats</div>
            <div className="grid grid-cols-3 gap-1 text-xs">
              {Object.entries(CLASS_STATS[selectedClass]).map(([stat, val]) => (
                <div key={stat} className="flex justify-between bg-gray-900 rounded px-2 py-1">
                  <span className="text-gray-500 capitalize">{stat.slice(0,3)}</span>
                  <span className="text-amber-400 font-bold">{val}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button onClick={handleCreate} disabled={!name.trim() || !selectedClass || saving}
          className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold">
          {saving ? "Creating..." : "Enter the World"}
        </Button>
      </div>
    </div>
  );
}