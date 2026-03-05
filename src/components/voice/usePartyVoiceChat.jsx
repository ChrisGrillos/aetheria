import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gameService from "@/api/gameService";

const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

function parseSignalPayload(payload) {
  if (!payload) return null;
  if (typeof payload === "string") {
    try { return JSON.parse(payload); } catch { return null; }
  }
  return payload;
}

export default function usePartyVoiceChat({ enabled = true, myCharacter, allCharacters = [] }) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [pushToTalk, setPushToTalk] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [remoteStreams, setRemoteStreams] = useState([]);

  const localStreamRef = useRef(null);
  const peerMapRef = useRef(new Map());
  const remoteStreamMapRef = useRef(new Map());
  const pollingRef = useRef(null);
  const joinedRef = useRef(false);
  const speakingRef = useRef(false);
  const roomRef = useRef("");
  const seenSignalIdsRef = useRef(new Set());

  const partyId = String(myCharacter?.party_id || "");
  const me = String(myCharacter?.id || "");
  const members = useMemo(
    () => allCharacters.filter((c) => c?.party_id === partyId && String(c.id || "") !== me && c.type === "human"),
    [allCharacters, partyId, me]
  );
  const memberIds = useMemo(() => members.map((m) => String(m.id)).sort(), [members]);
  const memberKey = memberIds.join("|");

  const setTrackEnabled = useCallback((enabledFlag) => {
    const tracks = localStreamRef.current?.getAudioTracks?.() || [];
    tracks.forEach((t) => { t.enabled = enabledFlag; });
    speakingRef.current = enabledFlag;
    setSpeaking(enabledFlag);
  }, []);

  const pushSignal = useCallback(async (toCharacterId, type, payload) => {
    if (!roomRef.current) return;
    await gameService.voiceSignal({
      action_type: "send_signal",
      room_id: roomRef.current,
      party_id: partyId,
      from_character_id: me,
      to_character_id: toCharacterId,
      signal_type: type,
      payload: JSON.stringify(payload || {}),
    }).catch(() => {});
  }, [partyId, me]);

  const removePeer = useCallback((characterId) => {
    const id = String(characterId || "");
    const pc = peerMapRef.current.get(id);
    if (pc) {
      try { pc.close(); } catch {}
      peerMapRef.current.delete(id);
    }
    remoteStreamMapRef.current.delete(id);
    setRemoteStreams([...remoteStreamMapRef.current.entries()].map(([peerId, stream]) => ({ peerId, stream })));
  }, []);

  const ensurePeer = useCallback((characterId, initiator) => {
    const id = String(characterId || "");
    if (!id || id === me) return null;
    let pc = peerMapRef.current.get(id);
    if (pc) return pc;

    pc = new RTCPeerConnection(RTC_CONFIG);
    peerMapRef.current.set(id, pc);

    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }

    pc.onicecandidate = (ev) => {
      if (ev.candidate) pushSignal(id, "ice", ev.candidate);
    };

    pc.ontrack = (ev) => {
      const [streamObj] = ev.streams || [];
      if (!streamObj) return;
      remoteStreamMapRef.current.set(id, streamObj);
      setRemoteStreams([...remoteStreamMapRef.current.entries()].map(([peerId, stream]) => ({ peerId, stream })));
    };

    pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        removePeer(id);
      }
    };

    if (initiator) {
      (async () => {
        try {
          const offer = await pc.createOffer({ offerToReceiveAudio: true });
          await pc.setLocalDescription(offer);
          await pushSignal(id, "offer", offer);
        } catch {
          // no-op
        }
      })();
    }

    return pc;
  }, [me, pushSignal, removePeer]);

  const handleSignal = useCallback(async (signalRow) => {
    const fromId = String(signalRow?.from_character_id || "");
    const type = String(signalRow?.signal_type || "");
    if (!fromId || fromId === me || !type) return;

    const payload = parseSignalPayload(signalRow?.payload);
    if (!payload) return;

    const amInitiator = me > fromId;
    const pc = ensurePeer(fromId, false);
    if (!pc) return;

    try {
      if (type === "offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await pushSignal(fromId, "answer", answer);
      } else if (type === "answer") {
        if (!pc.currentRemoteDescription) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
        }
      } else if (type === "ice") {
        await pc.addIceCandidate(new RTCIceCandidate(payload));
      } else if (type === "sync") {
        ensurePeer(fromId, amInitiator);
      }
    } catch {
      // keep session resilient
    }
  }, [ensurePeer, me, pushSignal]);

  const initLocalAudio = useCallback(async () => {
    if (localStreamRef.current) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      localStreamRef.current = stream;
      setTrackEnabled(!pushToTalk);
      return true;
    } catch (e) {
      setError(String(e?.message || "mic_permission_failed"));
      return false;
    }
  }, [pushToTalk, setTrackEnabled]);

  const cleanup = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    peerMapRef.current.forEach((pc) => {
      try { pc.close(); } catch {}
    });
    peerMapRef.current.clear();
    remoteStreamMapRef.current.clear();
    setRemoteStreams([]);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    joinedRef.current = false;
    roomRef.current = "";
    seenSignalIdsRef.current.clear();
    setRoomId("");
    setStatus("idle");
    setSpeaking(false);
  }, []);

  useEffect(() => {
    if (!enabled || !partyId || !me) {
      cleanup();
      return;
    }
    let cancelled = false;

    const joinAndStart = async () => {
      setStatus("connecting");
      const hasMic = await initLocalAudio();
      if (!hasMic || cancelled) return;

      const join = await gameService.voiceSignal({
        action_type: "join_room",
        party_id: partyId,
        character_id: me,
        members: [me, ...memberIds],
        region: "us-east",
      }).catch(() => null);

      if (!join?.ok) {
        setError(join?.error || "voice_join_failed");
        setStatus("error");
        return;
      }

      roomRef.current = String(join.room_id || `party:${partyId}`);
      setRoomId(roomRef.current);
      setStatus("connected");
      joinedRef.current = true;

      memberIds.forEach((id) => {
        const initiator = me > id;
        ensurePeer(id, initiator);
      });

      pollingRef.current = setInterval(async () => {
        if (!roomRef.current) return;
        const poll = await gameService.voiceSignal({
          action_type: "poll_signals",
          room_id: roomRef.current,
          party_id: partyId,
          character_id: me,
        }).catch(() => null);
        const signals = poll?.signals || [];
        for (const row of signals) {
          const sid = String(row?.id || "");
          if (sid && seenSignalIdsRef.current.has(sid)) continue;
          if (sid) {
            seenSignalIdsRef.current.add(sid);
            if (seenSignalIdsRef.current.size > 1200) seenSignalIdsRef.current.clear();
          }
          await handleSignal(row);
        }
      }, 900);
    };

    joinAndStart();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [enabled, partyId, me, memberKey, initLocalAudio, cleanup, ensurePeer, handleSignal]);

  useEffect(() => {
    if (!enabled) return;
    const down = (e) => {
      if (e.key.toLowerCase() !== "v") return;
      if (!pushToTalk) return;
      if (e.repeat) return;
      setTrackEnabled(true);
    };
    const up = (e) => {
      if (e.key.toLowerCase() !== "v") return;
      if (!pushToTalk) return;
      setTrackEnabled(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [enabled, pushToTalk, setTrackEnabled]);

  const togglePushToTalk = useCallback(() => {
    setPushToTalk((prev) => {
      const next = !prev;
      setTrackEnabled(!next);
      return next;
    });
  }, [setTrackEnabled]);

  return {
    status,
    error,
    roomId,
    remoteStreams,
    remotePeers: remoteStreams.map((row) => row.peerId),
    pushToTalk,
    speaking,
    togglePushToTalk,
  };
}
