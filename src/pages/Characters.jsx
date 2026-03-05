import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import gameService from "@/api/gameService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import CharacterCard from "@/components/characters/CharacterCard.jsx";
import CreateCharacterModalV2 from "@/components/characters/CreateCharacterModalV2.jsx";

function isArchivedCharacter(character) {
  if (!character) return true;
  if (character.is_deleted === true) return true;
  return String(character.status || "").toLowerCase() === "archived";
}

export default function Characters() {
  const [myCharacters, setMyCharacters] = useState([]);
  const [allCharacters, setAllCharacters] = useState([]);
  const [user, setUser] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteCode, setDeleteCode] = useState("");
  const [issuedCode, setIssuedCode] = useState("");
  const [deleteExpiresAt, setDeleteExpiresAt] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const u = await base44.auth.me().catch(() => null);
    setUser(u);
    const all = await base44.entities.Character.list("-updated_date", 100);
    const activeCharacters = (all || []).filter((c) => !isArchivedCharacter(c));
    setAllCharacters(activeCharacters);
    if (u) {
      const mine = activeCharacters.filter((c) => c.created_by === u.email && c.type === "human");
      setMyCharacters(mine);
    } else {
      setMyCharacters([]);
    }
    setLoading(false);
  };

  const handleCreated = () => {
    setShowCreate(false);
    loadData();
  };

  const handleSelectCharacter = async (charId) => {
    if (!user) return;
    await base44.auth.updateMe({ active_character_id: charId }).catch(() => {});
    const next = await base44.auth.me().catch(() => user);
    setUser(next);
    loadData();
  };

  const openDeleteModal = (character) => {
    setDeleteTarget(character);
    setDeleteCode("");
    setIssuedCode("");
    setDeleteExpiresAt("");
    setDeleteError("");
  };

  const closeDeleteModal = () => {
    if (deleteBusy) return;
    setDeleteTarget(null);
    setDeleteCode("");
    setIssuedCode("");
    setDeleteExpiresAt("");
    setDeleteError("");
  };

  const requestDeleteCode = async () => {
    if (!deleteTarget?.id) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      const res = await gameService.characterDelete({
        action: "request_delete_code",
        character_id: deleteTarget.id,
      });
      setIssuedCode(String(res?.code || ""));
      setDeleteExpiresAt(String(res?.expires_at || ""));
    } catch (err) {
      setDeleteError(String(err?.message || "Failed to request delete code."));
    } finally {
      setDeleteBusy(false);
    }
  };

  const confirmDeleteCharacter = async () => {
    if (!deleteTarget?.id || !deleteCode.trim()) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      const res = await gameService.characterDelete({
        action: "confirm_delete",
        character_id: deleteTarget.id,
        code: deleteCode.trim(),
      });

      if (user?.active_character_id === deleteTarget.id) {
        const nextActive = res?.suggested_active_character_id || null;
        await base44.auth.updateMe({ active_character_id: nextActive || "" }).catch(() => {});
      }

      closeDeleteModal();
      await loadData();
    } catch (err) {
      setDeleteError(String(err?.message || "Failed to archive character."));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <Link to={createPageUrl("Home")} className="text-gray-500 hover:text-amber-400 text-sm mb-3 inline-block">
            {"<- Back to Home"}
          </Link>
          <h1 className="text-3xl font-black text-amber-400 mb-2">My Characters</h1>
          <p className="text-gray-400">Manage your character roster. You can have up to 6 characters.</p>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-20">Loading characters...</div>
        ) : (
          <div>
            <div className="mb-10">
              <h2 className="text-xl font-bold text-amber-400 mb-4">Your Characters ({myCharacters.length}/6)</h2>
              {myCharacters.length === 0 ? (
                <p className="text-gray-500">You do not have any characters yet. Create one below.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {myCharacters.map((c) => (
                    <div
                      key={c.id}
                      className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-amber-500 transition-all"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-3xl">{c.avatar_emoji || "@"}</div>
                        <span
                          className={`text-xs px-2 py-1 rounded border ${
                            user?.active_character_id === c.id
                              ? "bg-amber-900/50 text-amber-400 border-amber-800"
                              : "bg-gray-800 text-gray-400 border-gray-700"
                          }`}
                        >
                          {user?.active_character_id === c.id ? "Active" : "Owned"}
                        </span>
                      </div>
                      <div className="font-bold text-white text-lg mb-1">{c.name}</div>
                      <div className="text-xs text-gray-500 space-y-1 mb-3">
                        <div>{c.race || "human"} - {(c.base_class || c.class || "-")}</div>
                        <div>Level {c.level || 1} - {c.xp || 0} XP</div>
                        {c.hp && (
                          <div>
                            <div className="text-xs text-gray-600 mb-1">HP</div>
                            <div className="bg-gray-800 rounded-full h-2 overflow-hidden">
                              <div className="bg-green-500 h-2" style={{ width: `${Math.min(100, ((c.hp || 0) / (c.max_hp || 100)) * 100)}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Link to={createPageUrl("World")} className="flex-1">
                          <Button size="sm" className="w-full bg-amber-600 hover:bg-amber-500 h-8 text-xs">
                            Play
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-gray-700 h-8 text-xs"
                          onClick={() => handleSelectCharacter(c.id)}
                        >
                          Select
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-900 text-red-300 hover:bg-red-950 h-8 text-xs"
                          onClick={() => openDeleteModal(c)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {myCharacters.length < 6 && (
              <div className="mb-10 flex justify-center">
                <Button
                  onClick={() => setShowCreate(true)}
                  className="bg-green-700 hover:bg-green-600 text-white font-bold px-6 py-3"
                >
                  + Create New Character
                </Button>
              </div>
            )}

            <div className="border-t border-gray-800 pt-10">
              <h2 className="text-xl font-bold text-gray-400 mb-4">All Citizens</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {allCharacters.map((c) => (
                  <CharacterCard key={c.id} character={c} isMe={user && c.created_by === user.email} onRefresh={loadData} />
                ))}
                {allCharacters.length === 0 && (
                  <div className="col-span-3 text-center text-gray-500 py-10">No citizens yet.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {showCreate && (
          <CreateCharacterModalV2 user={user} onCreated={handleCreated} onClose={() => setShowCreate(false)} />
        )}

        {deleteTarget && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-xl p-5">
              <h3 className="text-lg font-bold text-red-300 mb-2">Archive Character</h3>
              <p className="text-sm text-gray-400 mb-3">
                You are archiving <span className="text-white font-semibold">{deleteTarget.name}</span>.
                This uses a confirmation code for safety.
              </p>

              {!issuedCode ? (
                <Button
                  onClick={requestDeleteCode}
                  disabled={deleteBusy}
                  className="w-full bg-red-700 hover:bg-red-600 text-white"
                >
                  {deleteBusy ? "Requesting Code..." : "Send Delete Code"}
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs text-gray-500">
                    Prototype delete code: <span className="text-amber-300 font-mono tracking-widest">{issuedCode}</span>
                    {deleteExpiresAt ? ` (expires ${new Date(deleteExpiresAt).toLocaleTimeString()})` : ""}
                  </div>
                  <Input
                    value={deleteCode}
                    onChange={(e) => setDeleteCode(e.target.value)}
                    placeholder="Enter delete code..."
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                  <Button
                    onClick={confirmDeleteCharacter}
                    disabled={deleteBusy || !deleteCode.trim()}
                    className="w-full bg-red-700 hover:bg-red-600 text-white"
                  >
                    {deleteBusy ? "Archiving..." : "Confirm Archive"}
                  </Button>
                </div>
              )}

              {deleteError && (
                <div className="mt-3 text-xs text-red-400 bg-red-950/40 border border-red-900 rounded px-2 py-1">
                  {deleteError}
                </div>
              )}

              <Button
                variant="outline"
                className="mt-4 w-full border-gray-700 text-gray-300"
                onClick={closeDeleteModal}
                disabled={deleteBusy}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
