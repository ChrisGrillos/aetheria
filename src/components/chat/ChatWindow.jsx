/**
 * ChatWindow — a scrollable message list for one tab.
 * Applies agent filter + summarization, then renders MessageRow per message.
 */
import { useEffect, useRef, useMemo } from "react";
import MessageRow from "./MessageRow";
import { applyAgentFilter } from "./agentChatFilters";

function collapseConsecutiveRepeats(messages) {
  if (!Array.isArray(messages) || messages.length < 2) return messages || [];
  const out = [];
  let run = null;

  const flush = () => {
    if (!run) return;
    if (run.count > 1) {
      out.push({
        ...run.msg,
        id: `${run.msg.id || run.msg.timestamp}_repeat`,
        message: `${run.msg.message} (x${run.count})`,
      });
    } else {
      out.push(run.msg);
    }
    run = null;
  };

  messages.forEach((msg) => {
    const key = `${msg.speaker_name}|${msg.channel_type}|${msg.message}`;
    if (!run) {
      run = { key, msg, count: 1 };
      return;
    }
    if (run.key === key) {
      run.count += 1;
    } else {
      flush();
      run = { key, msg, count: 1 };
    }
  });
  flush();

  return out;
}

export default function ChatWindow({
  messages,
  tab,
  myCharacter,
  showTimestamps,
  onClickSpeaker,
  muted = [],
  ignored = [],
  textScale = 1,
  textColor = "#d1d5db",
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const myId = myCharacter?.id;
  const myGuildId = myCharacter?.guild_id;
  const myPartyId = myCharacter?.party_id;

  const filtered = useMemo(() => {
    // 1. Filter by tab's channel list
    let msgs = messages.filter(m => {
      const ch = m.channel_type || m.channel || "say";
      return tab.channels.includes(ch) || tab.channels.includes("all");
    });

    // 2. Remove muted / ignored speakers
    msgs = msgs.filter(m =>
      !muted.includes(m.speaker_name) &&
      !ignored.includes(m.speaker_name) &&
      !ignored.includes(m.speaker_id)
    );

    // 3. Apply agent filter
    msgs = applyAgentFilter(msgs, tab.agentFilter || "show_all", myId, myGuildId, myPartyId);

    return collapseConsecutiveRepeats(msgs);
  }, [messages, tab, myId, myGuildId, myPartyId, muted, ignored]);

  return (
    <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0 min-h-0">
      <div
        style={{
          transform: `scale(${Math.max(0.75, Math.min(1.5, Number(textScale || 1)))})`,
          transformOrigin: "top left",
          width: `${100 / Math.max(0.75, Math.min(1.5, Number(textScale || 1)))}%`,
        }}
      >
        {filtered.length === 0 ? (
          <p className="text-gray-700 text-xs italic text-center mt-4">No messages</p>
        ) : (
          filtered.map((msg, i) => (
            <MessageRow
              key={msg.id || i}
              msg={msg}
              showTimestamps={showTimestamps}
              onClickSpeaker={onClickSpeaker}
              myCharacterId={myCharacter?.name}
              textColor={textColor}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
