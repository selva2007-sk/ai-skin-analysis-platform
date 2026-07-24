import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CALL_RECONNECT_DEBOUNCE_MS } from '../lib/voiceCallUtils';
import { NetworkQuality, SerializedIceCandidate, SerializedSessionDescription } from '../lib/voiceCallTypes';

const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
  ],
  iceCandidatePoolSize: 10
};

type UseWebRTCAudioSessionOptions = {
  onLocalCandidate?: (candidate: SerializedIceCandidate) => void | Promise<void>;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onIceStateChange?: (state: RTCIceConnectionState) => void;
  onNetworkQualityChange?: (quality: NetworkQuality) => void;
};

const serializeDescription = (description: RTCSessionDescriptionInit | null): SerializedSessionDescription | null => {
  if (!description?.type || !description?.sdp) return null;
  return {
    type: description.type,
    sdp: description.sdp
  };
};

export function useWebRTCAudioSession(options: UseWebRTCAudioSessionOptions = {}) {
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const statsIntervalRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const makingOfferRef = useRef(false);
  const appliedAnswerSdpRef = useRef<string>('');
  const appliedOfferSdpRef = useRef<string>('');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [iceState, setIceState] = useState<RTCIceConnectionState>('new');
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>('unknown');
  const [hasRemoteAudio, setHasRemoteAudio] = useState(false);

  const stopStatsLoop = useCallback(() => {
    if (statsIntervalRef.current) {
      window.clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
  }, []);

  const stopReconnectTimer = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const attachRemoteStream = useCallback((stream: MediaStream) => {
    if (!remoteAudioRef.current) {
      const audio = new Audio();
      audio.autoplay = true;
      audio.setAttribute('playsinline', 'true');
      remoteAudioRef.current = audio;
    }

    remoteAudioRef.current.srcObject = stream;
    remoteAudioRef.current.muted = false;
    remoteAudioRef.current.volume = isSpeakerOn ? 1 : 0.7;
    void remoteAudioRef.current.play().catch(() => {});
    setHasRemoteAudio(stream.getAudioTracks().length > 0);
  }, [isSpeakerOn]);

  const setRemoteNetworkQuality = useCallback((quality: NetworkQuality) => {
    setNetworkQuality(quality);
    options.onNetworkQualityChange?.(quality);
  }, [options]);

  const startStatsLoop = useCallback((peer: RTCPeerConnection) => {
    stopStatsLoop();

    statsIntervalRef.current = window.setInterval(async () => {
      try {
        const stats = await peer.getStats();
        let selected: NetworkQuality = 'unknown';

        stats.forEach((report) => {
          const candidatePair = report as RTCStats & { state?: string; currentRoundTripTime?: number };
          if (report.type === 'candidate-pair' && candidatePair.state === 'succeeded') {
            const currentRoundTripTime = Number(candidatePair.currentRoundTripTime || 0);
            if (currentRoundTripTime > 0 && currentRoundTripTime < 0.2) selected = 'excellent';
            else if (currentRoundTripTime < 0.5) selected = 'good';
            else selected = 'poor';
          }
        });

        setRemoteNetworkQuality(selected);
      } catch {
        setRemoteNetworkQuality('unknown');
      }
    }, 4_000);
  }, [setRemoteNetworkQuality, stopStatsLoop]);

  const cleanupPeer = useCallback(() => {
    stopStatsLoop();
    stopReconnectTimer();

    if (peerRef.current) {
      try {
        peerRef.current.ontrack = null;
        peerRef.current.onicecandidate = null;
        peerRef.current.onconnectionstatechange = null;
        peerRef.current.oniceconnectionstatechange = null;
        if (peerRef.current.signalingState !== 'closed') {
          peerRef.current.close();
        }
      } catch {}
    }

    peerRef.current = null;
    appliedAnswerSdpRef.current = '';
    appliedOfferSdpRef.current = '';
    setConnectionState('closed');
    setIceState('closed');
    setNetworkQuality('unknown');
    setHasRemoteAudio(false);

    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }

    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
    }
  }, [stopReconnectTimer, stopStatsLoop]);

  const releaseLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    cleanupPeer();
    releaseLocalStream();
    setIsMuted(false);
  }, [cleanupPeer, releaseLocalStream]);

  const ensureLocalStream = useCallback(async (providedStream?: MediaStream) => {
    if (providedStream) {
      localStreamRef.current = providedStream;
      return providedStream;
    }

    if (localStreamRef.current) return localStreamRef.current;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
    localStreamRef.current = stream;
    return stream;
  }, []);

  const createPeer = useCallback(async (providedStream?: MediaStream) => {
    if (peerRef.current && peerRef.current.signalingState !== 'closed') {
      return peerRef.current;
    }

    const stream = await ensureLocalStream(providedStream);
    const peer = new RTCPeerConnection(RTC_CONFIGURATION);
    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;
    attachRemoteStream(remoteStream);

    stream.getTracks().forEach((track) => {
      peer.addTrack(track, stream);
    });

    peer.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => remoteStream.addTrack(track));
      attachRemoteStream(remoteStream);
    };

    peer.onicecandidate = (event) => {
      if (!event.candidate) return;
      void options.onLocalCandidate?.({
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex,
        usernameFragment: event.candidate.usernameFragment
      });
    };

    peer.onconnectionstatechange = () => {
      setConnectionState(peer.connectionState);
      options.onConnectionStateChange?.(peer.connectionState);
      if (peer.connectionState === 'connected') {
        startStatsLoop(peer);
      }
    };

    peer.oniceconnectionstatechange = () => {
      setIceState(peer.iceConnectionState);
      options.onIceStateChange?.(peer.iceConnectionState);
      if (peer.iceConnectionState === 'disconnected' || peer.iceConnectionState === 'failed') {
        setRemoteNetworkQuality('reconnecting');
      }
    };

    peerRef.current = peer;
    return peer;
  }, [attachRemoteStream, ensureLocalStream, options, setRemoteNetworkQuality, startStatsLoop]);

  const createOffer = useCallback(async (providedStream?: MediaStream, iceRestart = false) => {
    const peer = await createPeer(providedStream);
    if (peer.signalingState === 'closed') {
      throw new Error('Cannot create offer on a closed peer connection.');
    }

    makingOfferRef.current = true;
    try {
      const offer = await peer.createOffer({ iceRestart });
      await peer.setLocalDescription(offer);
      return serializeDescription(peer.localDescription);
    } finally {
      makingOfferRef.current = false;
    }
  }, [createPeer]);

  const handleRemoteOffer = useCallback(async (offer: SerializedSessionDescription, providedStream?: MediaStream) => {
    const peer = await createPeer(providedStream);
    if (peer.signalingState === 'closed') {
      throw new Error('Call connection is already closed.');
    }

    if (appliedOfferSdpRef.current === offer.sdp && peer.currentRemoteDescription?.sdp === offer.sdp) {
      return serializeDescription(peer.localDescription);
    }

    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    appliedOfferSdpRef.current = offer.sdp;
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    return serializeDescription(peer.localDescription);
  }, [createPeer]);

  const applyAnswer = useCallback(async (answer: SerializedSessionDescription) => {
    const peer = peerRef.current;
    if (!peer || peer.signalingState === 'closed' || !answer?.sdp) return;
    if (appliedAnswerSdpRef.current === answer.sdp) return;
    if (!peer.currentLocalDescription) return;

    await peer.setRemoteDescription(new RTCSessionDescription(answer));
    appliedAnswerSdpRef.current = answer.sdp;
  }, []);

  const addIceCandidate = useCallback(async (candidate: SerializedIceCandidate) => {
    const peer = peerRef.current;
    if (!peer || peer.signalingState === 'closed' || !candidate.candidate) return;

    try {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      if (peer.remoteDescription) {
        throw error;
      }
    }
  }, []);

  const restartIce = useCallback(async () => {
    const peer = peerRef.current;
    if (!peer || peer.signalingState === 'closed' || makingOfferRef.current) return null;
    return await createOffer(undefined, true);
  }, [createOffer]);

  const scheduleIceRestart = useCallback((callback: (offer: SerializedSessionDescription | null) => void | Promise<void>) => {
    stopReconnectTimer();
    reconnectTimeoutRef.current = window.setTimeout(() => {
      void restartIce().then((offer) => callback(offer));
    }, CALL_RECONNECT_DEBOUNCE_MS);
  }, [restartIce, stopReconnectTimer]);

  const setMuted = useCallback((nextMuted: boolean) => {
    setIsMuted(nextMuted);
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
  }, []);

  const toggleMute = useCallback(() => {
    setMuted(!isMuted);
  }, [isMuted, setMuted]);

  const setSpeakerEnabled = useCallback((enabled: boolean) => {
    setIsSpeakerOn(enabled);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = enabled ? 1 : 0.7;
    }
  }, []);

  const toggleSpeaker = useCallback(() => {
    setSpeakerEnabled(!isSpeakerOn);
  }, [isSpeakerOn, setSpeakerEnabled]);

  useEffect(() => () => reset(), [reset]);

  return useMemo(() => ({
    connectionState,
    iceState,
    networkQuality,
    hasRemoteAudio,
    isMuted,
    isSpeakerOn,
    ensureLocalStream,
    createOffer,
    handleRemoteOffer,
    applyAnswer,
    addIceCandidate,
    reset,
    toggleMute,
    toggleSpeaker,
    setMuted,
    setSpeakerEnabled,
    scheduleIceRestart
  }), [
    addIceCandidate,
    applyAnswer,
    connectionState,
    createOffer,
    ensureLocalStream,
    handleRemoteOffer,
    hasRemoteAudio,
    iceState,
    isMuted,
    isSpeakerOn,
    networkQuality,
    reset,
    scheduleIceRestart,
    setMuted,
    setSpeakerEnabled,
    toggleMute,
    toggleSpeaker
  ]);
}
