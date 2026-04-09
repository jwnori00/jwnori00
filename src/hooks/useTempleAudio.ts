import { useState, useEffect, useRef, useCallback } from 'react';
import { AUDIO_TRACKS, type AudioTrack } from '../constants/audioTracks';

export const useTempleAudio = () => {
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem('temple_audio_enabled');
    // Default to muted (true) if not set, or if set to false
    return saved ? JSON.parse(saved) === false : true;
  });

  const [selectedTrack, setSelectedTrack] = useState<AudioTrack>(() => {
    const saved = localStorage.getItem('temple_selected_track');
    if (saved) {
      const track = AUDIO_TRACKS.find(t => t.id === saved);
      if (track) return track;
    }
    return AUDIO_TRACKS[0];
  });

  const [audioError, setAudioError] = useState<string | null>(null);
  const [activeSrc, setActiveSrc] = useState<string>(selectedTrack.filePath);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load saved progress for the selected track
  const getSavedProgress = (trackId: string) => {
    const saved = localStorage.getItem(`temple_audio_progress_${trackId}`);
    return saved ? parseFloat(saved) : 0;
  };

  // Save progress
  const saveProgress = (trackId: string, time: number) => {
    localStorage.setItem(`temple_audio_progress_${trackId}`, time.toString());
  };

  // Sync muted state with audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
      if (isMuted) {
        audioRef.current.pause();
      } else {
        // Try to play when unmuted
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            // NotAllowedError is common if user hasn't interacted yet, ignore it
            if (err.name !== 'NotAllowedError') {
              console.warn("Audio play failed:", err);
            }
          });
        }
      }
    }
  }, [isMuted]);

  // Sync track with audio element
  useEffect(() => {
    setActiveSrc(selectedTrack.filePath);
    setAudioError(null);
  }, [selectedTrack]);

  // Force load when src changes
  useEffect(() => {
    if (audioRef.current && activeSrc) {
      audioRef.current.load();
    }
  }, [activeSrc]);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current && selectedTrack) {
      const current = audioRef.current.currentTime;
      const total = audioRef.current.duration;
      setProgress(current);
      if (total) setDuration(total);
      
      // Save progress every few seconds or so (throttled by the browser's timeupdate event)
      saveProgress(selectedTrack.id, current);
    }
  }, [selectedTrack]);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current && selectedTrack) {
      setDuration(audioRef.current.duration);
      const savedTime = getSavedProgress(selectedTrack.id);
      if (savedTime > 0 && savedTime < audioRef.current.duration - 1) {
        audioRef.current.currentTime = savedTime;
      }
    }
  }, [selectedTrack]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      localStorage.setItem('temple_audio_enabled', JSON.stringify(!next));
      return next;
    });
  }, []);

  const changeTrack = useCallback((track: AudioTrack) => {
    setSelectedTrack(track);
    localStorage.setItem('temple_selected_track', track.id);
  }, []);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  }, []);

  const handleAudioError = useCallback((e: any) => {
    // Log more details about the error
    const error = audioRef.current?.error;
    console.warn("Audio element error details:", {
      code: error?.code,
      message: error?.message,
      activeSrc
    });

    // If the error code is 4 (MEDIA_ERR_SRC_NOT_SUPPORTED) and it's a local file, 
    // it's very likely the file is empty or invalid.
    
    // If we have a fallback URL and haven't tried it yet, try it
    if (selectedTrack.fallbackUrl && activeSrc !== selectedTrack.fallbackUrl) {
      console.log(`Audio error at ${activeSrc}. Attempting fallback URL: ${selectedTrack.fallbackUrl}`);
      
      // Reset the error state before trying fallback
      setAudioError(null);
      setActiveSrc(selectedTrack.fallbackUrl);
      
      // Use a small timeout to ensure state update propagates before loading
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.load();
          if (!isMuted) {
            audioRef.current.play().catch(err => console.warn("Fallback play failed:", err));
          }
        }
      }, 100);
      return;
    }

    console.error("Audio element reported a fatal error or fallback failed");
    setAudioError("법음을 재생할 수 없습니다. 파일이 비어있거나 경로가 잘못되었습니다. (폴백 실패)");
    setIsMuted(true);
  }, [selectedTrack, activeSrc, isMuted]);

  return {
    isMuted,
    setIsMuted,
    selectedTrack,
    audioError,
    activeSrc,
    progress,
    duration,
    audioRef,
    toggleMute,
    changeTrack,
    seek,
    handleAudioError,
    handleTimeUpdate,
    handleLoadedMetadata,
    setAudioError
  };
};
