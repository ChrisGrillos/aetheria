import { Button } from "@/components/ui/button";

export default function QuestOfferModal({ offer, onAccept, onDecline }) {
  if (!offer) return null;

  return (
    <div className="absolute inset-0 z-40 bg-black/55 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-gray-950 border border-amber-700 rounded-xl shadow-2xl">
        <div className="px-4 py-3 border-b border-gray-800">
          <p className="text-[10px] uppercase tracking-wider text-amber-500">Quest Offer</p>
          <h3 className="text-lg font-black text-white">{offer.title}</h3>
          <p className="text-xs text-gray-400 mt-1">From {offer.sourceNpcName || "NPC"} in {offer.zoneName || "Unknown Zone"}</p>
        </div>

        <div className="px-4 py-3 space-y-3">
          <p className="text-sm text-gray-200">{offer.summary}</p>

          <div>
            <p className="text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Objectives</p>
            <ul className="space-y-1">
              {(offer.objectives || []).map((obj) => (
                <li key={obj.id} className="text-xs text-gray-200 bg-gray-900/60 border border-gray-800 rounded px-2 py-1">
                  {obj.description}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Rewards</p>
            <div className="flex gap-2 flex-wrap">
              {(offer.rewards || []).map((r, idx) => (
                <span key={`${r.type}_${idx}`} className="text-xs px-2 py-1 rounded border border-gray-700 bg-gray-900 text-amber-300">
                  {r.type.toUpperCase()} +{r.amount}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-end gap-2">
          <Button variant="outline" className="border-gray-700 text-gray-300" onClick={onDecline}>
            Decline
          </Button>
          <Button className="bg-amber-600 hover:bg-amber-500 text-black font-bold" onClick={onAccept}>
            Accept Quest
          </Button>
        </div>
      </div>
    </div>
  );
}
