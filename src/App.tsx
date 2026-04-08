import { useState, useEffect, useRef, useMemo, useCallback, ReactNode, useId } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './lib/supabase';
import { 
  Volume2, 
  VolumeX, 
  Heart, 
  Send, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw,
  X, 
  Ticket, 
  Sparkles,
  MessageSquare,
  Moon,
  Trash2,
  Music,
  LogOut
} from 'lucide-react';
import { useTempleAudio } from './hooks/useTempleAudio';
import { AUDIO_TRACKS, type AudioTrack } from './constants/audioTracks';

// --- Types & Constants ---

type Screen = 'entrance' | 'profile-setup' | 'space-select' | 'main' | 'team-select' | 'prayer-room' | 'lantern-form' | 'lantern-gallery' | 'abbot-room' | 'master-room' | 'hoejoo-room' | 'admin-login' | 'support-form' | 'admin-support-inbox' | 'login';
type TempleMode = 'private' | 'public';
type UserRole = 'user' | 'jooji' | 'josil' | 'hoejoo';

interface UserProfile {
  accountId: string;
  nickname: string;
  teamId: string;
  role: UserRole;
  assignedTeamId?: string;
  createdAt: string;
}

interface Team {
  id: string;
  name: string;
  color: string;
  defaultNickname: string;
}

interface Wish {
  id: string;
  name: string;
  content: string;
  teamId: string;
  created_at: string;
  pin_hash: string;
  author_account_id?: string;
  owner_deleted?: boolean;
  is_locked?: boolean;
}

interface PrayerMessage {
  id: string;
  teamId: string;
  nickname: string;
  content: string;
  created_at: string;
  likes: number;
  author_account_id?: string;
  author_team_id?: string;
  owner_deleted?: boolean;
  is_locked?: boolean;
}

interface SupportRequest {
  id: string;
  created_at: string;
  category: 'bug' | 'question' | 'suggestion';
  subject: string;
  content: string;
  account_id: string;
  nickname: string;
  author_team_id?: string;
  current_space?: string;
  room_team_id?: string;
  status: 'new' | 'in_review' | 'resolved' | 'closed';
  admin_note?: string;
  handled_by_account_id?: string;
}

const PROFANITY_FILTER = ['시발', '개새끼', '병신', '미친', '존나']; // 간단한 금칙어 필터

// --- Helper Functions ---

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const filterProfanity = (text: string) => {
  let filtered = text;
  PROFANITY_FILTER.forEach(word => {
    const regex = new RegExp(word, 'gi');
    filtered = filtered.replace(regex, '***');
  });
  return filtered;
};

const KBO_TEAMS: Team[] = [
  { id: 'lg', name: 'LG 트윈스', color: '#C0002F', defaultNickname: '쌍둥이보살' },
  { id: 'doosan', name: '두산 베어스', color: '#131230', defaultNickname: '곰보살' },
  { id: 'lotte', name: '롯데 자이언츠', color: '#DC032D', defaultNickname: '거인보살' },
  { id: 'nc', name: 'NC 다이노스', color: '#071D3D', defaultNickname: '공룡보살' },
  { id: 'kia', name: 'KIA 타이거즈', color: '#EA0029', defaultNickname: '호랑이보살' },
  { id: 'samsung', name: '삼성 라이온즈', color: '#074CA1', defaultNickname: '사자보살' },
  { id: 'hanwha', name: '한화 이글스', color: '#FF6600', defaultNickname: '독수리보살' },
  { id: 'ssg', name: 'SSG 랜더스', color: '#CE0E2D', defaultNickname: '랜더보살' },
  { id: 'kt', name: 'KT 위즈', color: '#000000', defaultNickname: '마법보살' },
  { id: 'kiwoom', name: '키움 히어로즈', color: '#820024', defaultNickname: '영웅보살' },
];

// --- Helper Components ---

const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`bg-stone-800/80 backdrop-blur-md border border-stone-700 rounded-2xl p-4 sm:p-6 shadow-2xl ${className}`}>
    {children}
  </div>
);

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = "",
  disabled = false
}: { 
  children: ReactNode; 
  onClick?: () => void; 
  variant?: 'primary' | 'secondary' | 'gold' | 'ghost' | 'lantern';
  className?: string;
  disabled?: boolean;
}) => {
  const variants = {
    primary: "bg-stone-700 hover:bg-stone-600 text-stone-100",
    secondary: "bg-stone-800/50 hover:bg-stone-700 text-stone-300",
    gold: "bg-temple-gold/30 hover:bg-temple-gold/40 text-temple-gold border border-temple-gold/60",
    ghost: "bg-transparent hover:bg-stone-700/50 text-stone-300",
    lantern: "bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40"
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl transition-colors duration-300 flex items-center justify-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base break-keep ${variants[variant]} ${className}`}
    >
      {children}
    </motion.button>
  );
};

const LotusLantern = ({ teamColor, size = 60, className = "" }: { teamColor: string, size?: number, className?: string }) => {
  const id = useId().replace(/:/g, '');
  const gradId = `petal-grad-${id}`;
  const glowId = `lantern-glow-${id}`;
  const petalPathId = `petal-path-${id}`;
  const petalTexturedId = `petal-textured-${id}`;
  
  return (
    <div className={`relative flex flex-col items-center ${className}`} style={{ width: size }}>
      {/* Hanging String */}
      <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-px h-12 bg-stone-700/50" />
      
      {/* The Lantern Illustration */}
      <div className="relative w-full aspect-square">
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_8px_20px_rgba(0,0,0,0.4)]">
          <defs>
            <radialGradient id={gradId} cx="50%" cy="100%" r="100%" fx="50%" fy="100%">
              <stop offset="0%" stopColor="white" />
              <stop offset="30%" stopColor="white" />
              <stop offset="100%" stopColor={teamColor} />
            </radialGradient>
            
            <filter id={glowId}>
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feComposite in="SourceGraphic" in2="blur" operator="over"/>
            </filter>

            {/* Pointed Petal Shape - Sharper top */}
            <path id={petalPathId} d="M 0,0 C -6,-2 -12,-12 -12,-22 C -12,-32 -4,-42 0,-50 C 4,-42 12,-32 12,-22 C 12,-12 6,-2 0,0 Z" />
            
            {/* Petal with texture lines */}
            <symbol id={petalTexturedId} viewBox="-12 -50 24 50">
              <use href={`#${petalPathId}`} fill={`url(#${gradId})`} />
              <path d="M 0,0 L 0,-45" stroke="black" strokeWidth="0.15" opacity="0.08" />
              <path d="M -4,-4 L -1.5,-38" stroke="black" strokeWidth="0.08" opacity="0.04" />
              <path d="M 4,-4 L 1.5,-38" stroke="black" strokeWidth="0.08" opacity="0.04" />
            </symbol>
          </defs>

          {/* Green Leaves at bottom (Layered) */}
          <g transform="translate(50, 92)">
            {/* Back leaves */}
            {[30, 90, 150, 210, 270, 330].map((angle, i) => (
              <path 
                key={`leaf-back-${i}`} 
                d="M 0,0 C -10,-2 -12,-16 0,-20 C 12,-16 10,-2 0,0 Z" 
                fill="#14532d" 
                transform={`rotate(${angle}) scale(1.2)`}
              />
            ))}
            {/* Front leaves */}
            {[0, 60, 120, 180, 240, 300].map((angle, i) => (
              <path 
                key={`leaf-front-${i}`} 
                d="M 0,0 C -8,-2 -10,-14 0,-18 C 10,-14 8,-2 0,0 Z" 
                fill="#166534" 
                transform={`rotate(${angle})`}
              />
            ))}
          </g>

          {/* Petal Layers - More spherical and pointed */}
          <g transform="translate(50, 88)">
            {/* Back Row (Outer) */}
            <g transform="scale(0.85) translate(0, -12)">
              {[-32, -16, 0, 16, 32].map((x, i) => (
                <use key={`p1-${i}`} href={`#${petalTexturedId}`} x={x} y={0} width="24" height="50" transform={`translate(-12, -50) rotate(${x/1.5})`} />
              ))}
            </g>
            {/* Middle Row */}
            <g transform="scale(0.95) translate(0, -6)">
              {[-38, -19, 0, 19, 38].map((x, i) => (
                <use key={`p2-${i}`} href={`#${petalTexturedId}`} x={x} y={0} width="24" height="50" transform={`translate(-12, -50) rotate(${x/2.5})`} />
              ))}
            </g>
            {/* Front Row (Inner) */}
            <g transform="translate(0, 0)">
              {[-22, 0, 22].map((x, i) => (
                <use key={`p3-${i}`} href={`#${petalTexturedId}`} x={x} y={0} width="24" height="50" transform={`translate(-12, -50) rotate(${x/4})`} />
              ))}
            </g>
          </g>

          {/* Inner Light Glow */}
          <circle cx="50" cy="50" r="15" fill="white" opacity="0.3" filter={`url(#${glowId})`} className="animate-pulse" />
        </svg>
      </div>

      {/* Hanging Tag */}
      <div className="relative w-1/2 h-12 sm:h-16 bg-stone-100 border border-stone-300 shadow-lg flex flex-col items-center justify-start pt-1 overflow-hidden mt-[-10px] sm:mt-[-12px]">
        <div className="w-full h-0.5 sm:h-1" style={{ backgroundColor: teamColor }} />
        <div className="flex-1 w-full flex flex-col items-center justify-center gap-0.5 px-0.5">
          <div className="w-px h-full bg-stone-200 absolute left-1/2 -translate-x-1/2 top-1" />
          <div className="text-[5px] sm:text-[6px] text-stone-400 font-serif leading-none opacity-50">發願</div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [screenStack, setScreenStack] = useState<Screen[]>(['entrance']);
  const screen = screenStack[screenStack.length - 1];
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('temple_user_profile');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [templeMode, setTempleMode] = useState<TempleMode | null>(null);
  const { 
    isMuted, 
    setIsMuted, 
    selectedTrack, 
    audioError, 
    progress,
    duration,
    audioRef, 
    toggleMute, 
    changeTrack, 
    handleAudioError,
    handleTimeUpdate,
    handleLoadedMetadata,
    setAudioError,
    activeSrc
  } = useTempleAudio();
  const [isAudioSelectionModalOpen, setIsAudioSelectionModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isOffering, setIsOffering] = useState(false);
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [messages, setMessages] = useState<PrayerMessage[]>([]);
  const [newWish, setNewWish] = useState("");
  const [wishName, setWishName] = useState("");
  const [wishPin, setWishPin] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [lanternTeamId, setLanternTeamId] = useState("");
  const [selectedWish, setSelectedWish] = useState<Wish | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletePin, setDeletePin] = useState("");
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');

  const handleChangePassword = async () => {
    if (!userProfile) return;
    if (!currentPasswordInput || !newPassword || !confirmPassword) {
      setFeedback({ type: 'error', message: "모든 필드를 입력해주세요." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback({ type: 'error', message: "새 비밀번호가 일치하지 않습니다." });
      return;
    }
    if (!/^[a-zA-Z0-9!@]{4,8}$/.test(newPassword)) {
      setFeedback({ type: 'error', message: "비밀번호는 4~8자의 영문, 숫자, !, @만 가능합니다." });
      return;
    }

    setIsLoading(true);
    try {
      // Verify current password
      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select('password')
        .eq('account_id', userProfile.accountId)
        .single();

      if (fetchErr) throw fetchErr;
      if (data.password !== currentPasswordInput) {
        setFeedback({ type: 'error', message: "현재 비밀번호가 올바르지 않습니다." });
        return;
      }

      // Update password
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ password: newPassword })
        .eq('account_id', userProfile.accountId);

      if (updateErr) throw updateErr;

      setFeedback({ type: 'success', message: "비밀번호가 성공적으로 변경되었습니다." });
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPasswordInput('');
    } catch (err) {
      console.error('Error changing password:', err);
      setFeedback({ type: 'error', message: "비밀번호 변경에 실패했습니다." });
    } finally {
      setIsLoading(false);
    }
  };
  const [isStepBackModalOpen, setIsStepBackModalOpen] = useState(false);
  const [isTempleCleaningModalOpen, setIsTempleCleaningModalOpen] = useState(false);
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [allAccounts, setAllAccounts] = useState<UserProfile[]>([]);
  const [lastSubmitTime, setLastSubmitTime] = useState(0);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | null, message: string | null }>({ type: null, message: null });
  const [claimCode, setClaimCode] = useState("");
  const [adminNickname, setAdminNickname] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [setupNickname, setSetupNickname] = useState("");
  const [selectedSetupTeamId, setSelectedSetupTeamId] = useState<string | null>(null);
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([]);
  const [supportCategory, setSupportCategory] = useState<'bug' | 'question' | 'suggestion'>('question');
  const [supportSubject, setSupportSubject] = useState("");
  const [supportContent, setSupportContent] = useState("");

  const bellRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRefs = useRef<number[]>([]);

  const clearAllTimeouts = () => {
    timeoutRefs.current.forEach(id => window.clearTimeout(id));
    timeoutRefs.current = [];
  };

  // --- Reset Helpers ---
  const handleLogout = useCallback(() => {
    clearAllTimeouts();
    
    // Audio reset
    setIsMuted(true);
    localStorage.setItem('temple_audio_enabled', JSON.stringify(false));

    // Navigation reset
    setScreenStack(['entrance']);

    // Mode & Selection reset
    setTempleMode(null);
    setSelectedTeam(null);
    setSelectedWish(null);
    
    // Form reset
    setNewWish("");
    setWishName("");
    setWishPin("");
    setNewMessage("");
    setLanternTeamId("");
    setDeletePin("");
    setClaimCode("");
    setAdminNickname("");
    setSetupPassword("");
    setLoginPassword("");
    setAdminPassword("");
    setSetupNickname("");
    setSelectedSetupTeamId(null);
    setSupportSubject("");
    setSupportContent("");

    // UI State reset
    setIsDeleting(false);
    setIsProfileModalOpen(false);
    setIsStepBackModalOpen(false);
    setIsTempleCleaningModalOpen(false);
    setIsDeleteAccountModalOpen(false);
    setIsAudioSelectionModalOpen(false);
    setIsLoading(false);
    setIsOffering(false);

    // Clear Storage
    localStorage.removeItem('temple_user_profile');
    localStorage.removeItem('temple_private_wishes');
    localStorage.removeItem('temple_private_messages');
    
    // Clear State
    setUserProfile(null);
    setWishes([]);
    setMessages([]);
    setSupportRequests([]);
    setAllAccounts([]);
    
    setFeedback({ type: 'success', message: "모든 인연을 정리하고 물러납니다." });
  }, [setIsMuted]);

  // --- Auth & Role Helpers ---
  const isJooji = useCallback((profile: UserProfile | null) => profile?.role === 'jooji', []);
  const isJosil = useCallback((profile: UserProfile | null) => profile?.role === 'josil', []);
  const isHoejoo = useCallback((profile: UserProfile | null) => profile?.role === 'hoejoo', []);
  const isAdmin = useCallback((profile: UserProfile | null) => isJooji(profile) || isJosil(profile) || isHoejoo(profile), [isJooji, isJosil, isHoejoo]);

  const refreshCurrentProfile = useCallback(async () => {
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      setIsProfileLoading(false);
      return;
    }
    
    const savedProfile = localStorage.getItem('temple_user_profile');
    const accountId = userProfile?.accountId || (savedProfile ? JSON.parse(savedProfile).accountId : null);
    
    if (!accountId) {
      setIsProfileLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('account_id', accountId)
        .maybeSingle();

      if (error) {
        console.error('Error refreshing profile:', error);
      } else if (data) {
        if (data.account_status === 'deleted') {
          handleLogout();
          setFeedback({ type: 'error', message: "삭제된 계정입니다. 다시 시작합니다." });
          return;
        }

        const updatedProfile: UserProfile = {
          accountId: data.account_id,
          nickname: data.nickname,
          teamId: data.team_id,
          role: data.role_type as UserRole,
          assignedTeamId: data.assigned_team_id,
          createdAt: data.created_at
        };
        setUserProfile(updatedProfile);
        localStorage.setItem('temple_user_profile', JSON.stringify(updatedProfile));
      } else {
        // Profile not found in DB
        handleLogout();
      }
    } catch (err) {
      console.error('Unexpected error refreshing profile:', err);
    } finally {
      setIsProfileLoading(false);
    }
  }, [userProfile?.accountId, handleLogout]);

  // --- Navigation Helpers ---
  const resetNavigation = useCallback(() => {
    setScreenStack(['entrance']);
  }, []);

  const goToEntrance = useCallback(() => {
    setScreenStack(['entrance']);
  }, []);

  const goToProfileSetup = useCallback(() => {
    setSetupNickname("");
    setSelectedSetupTeamId(null);
    setSetupPassword("");
    setScreenStack(['entrance', 'profile-setup']);
  }, []);

  const goToSpaceSelect = useCallback(() => {
    setScreenStack(['entrance', 'space-select']);
  }, []);

  const goToMain = useCallback(() => {
    setScreenStack(['entrance', 'space-select', 'main']);
  }, []);

  const goToAdminLogin = useCallback(() => {
    setScreenStack(['entrance', 'admin-login']);
  }, []);

  const goToLogin = useCallback(() => {
    setScreenStack(['entrance', 'login']);
  }, []);

  const navigateTo = useCallback((nextScreen: Screen) => {
    setScreenStack(prev => {
      // Prevent duplicate screens in a row
      if (prev[prev.length - 1] === nextScreen) return prev;
      return [...prev, nextScreen];
    });
  }, []);

  const handleBack = useCallback(() => {
    setScreenStack(prev => {
      if (prev.length > 1) return prev.slice(0, -1);
      return prev;
    });
  }, []);

  const resetFlow = useCallback((options: { 
    clearProfile?: boolean, 
    clearPrivateData?: boolean,
    message?: string 
  } = {}) => {
    if (options.clearProfile || options.clearPrivateData) {
      handleLogout();
      if (options.message) {
        setFeedback({ type: 'success', message: options.message });
      }
      return;
    }

    clearAllTimeouts();
    
    // Audio reset
    setIsMuted(true);
    localStorage.setItem('temple_audio_enabled', JSON.stringify(false));

    // Navigation reset
    setScreenStack(['entrance']);

    // Mode & Selection reset
    setTempleMode(null);
    setSelectedTeam(null);
    setSelectedWish(null);
    
    // Form reset
    setNewWish("");
    setWishName("");
    setWishPin("");
    setNewMessage("");
    setLanternTeamId("");
    setDeletePin("");
    setClaimCode("");

    // UI State reset
    setIsDeleting(false);
    setIsProfileModalOpen(false);
    setIsStepBackModalOpen(false);
    setIsTempleCleaningModalOpen(false);
    setIsDeleteAccountModalOpen(false);
    setIsAudioSelectionModalOpen(false);
    setIsLoading(false);
    setIsOffering(false);

    if (options.message) {
      setFeedback({ type: 'success', message: options.message });
    }
  }, [setIsMuted, handleLogout]);

  const handleStepBack = () => {
    resetFlow({ message: "입장 흐름을 다시 시작합니다. (물러나기)" });
  };

  const handleTempleCleaning = async () => {
    resetFlow({ 
      clearPrivateData: true, 
      message: "토굴의 개인 기록을 비웠습니다. (토굴청소)" 
    });
  };

  const handleDeleteAccount = async () => {
    if (!userProfile?.accountId) return;
    
    clearAllTimeouts();
    setIsLoading(true);

    try {
      // 1. 대웅전 데이터 잠금 (Supabase)
      await supabase
        .from('wishes')
        .update({ owner_deleted: true, is_locked: true })
        .eq('author_account_id', userProfile.accountId);
      
      await supabase
        .from('prayer_messages')
        .update({ owner_deleted: true, is_locked: true })
        .eq('author_account_id', userProfile.accountId);

      await supabase
        .from('profiles')
        .update({ account_status: 'deleted', deleted_at: new Date().toISOString() })
        .eq('account_id', userProfile.accountId);

      handleLogout();
      setFeedback({ type: 'success', message: "계정이 삭제되었습니다. 모든 인연을 정리하고 물러납니다." });
    } catch (err) {
      console.error("Unexpected error during account deletion:", err);
      setFeedback({ type: 'error', message: "계정 삭제 중 오류가 발생했습니다." });
    } finally {
      setIsLoading(false);
    }
  };


  // Sync profile with DB on mount
  useEffect(() => {
    refreshCurrentProfile();
  }, []);

  // Access Control: Kick out users from admin rooms if role changes
  useEffect(() => {
    if (isProfileLoading) return;
    
    if (screen === 'abbot-room' && !isJooji(userProfile) && !isHoejoo(userProfile)) {
      setFeedback({ type: 'error', message: "주지 권한이 필요합니다." });
      goToMain();
    }
    if (screen === 'master-room' && !isJosil(userProfile) && !isHoejoo(userProfile)) {
      setFeedback({ type: 'error', message: "조실 권한이 필요합니다." });
      goToMain();
    }
    if (screen === 'hoejoo-room' && !isHoejoo(userProfile)) {
      setFeedback({ type: 'error', message: "회주 권한이 필요합니다." });
      goToMain();
    }
  }, [screen, userProfile, isJooji, isJosil, isHoejoo, goToMain, isProfileLoading]);

  // Save profile to localStorage
  useEffect(() => {
    if (userProfile) {
      localStorage.setItem('temple_user_profile', JSON.stringify(userProfile));
    }
  }, [userProfile]);

  // Clear feedback after 3 seconds
  useEffect(() => {
    if (feedback.message) {
      const timer = setTimeout(() => setFeedback({ type: null, message: null }), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Load data based on mode
  useEffect(() => {
    if (!templeMode) return;

    if (templeMode === 'private') {
      const savedWishes = localStorage.getItem('temple_private_wishes');
      const savedMessages = localStorage.getItem('temple_private_messages');
      setWishes(savedWishes ? JSON.parse(savedWishes) : []);
      setMessages(savedMessages ? JSON.parse(savedMessages) : []);
    } else {
      fetchWishes();
      fetchMessages();

      // Realtime subscriptions for Public Mode
      const wishesChannel = supabase
        .channel('wishes-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'wishes' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            const d = payload.new;
            const newWish: Wish = {
              id: d.id,
              name: d.name,
              content: d.content,
              teamId: d.team_id,
              created_at: d.created_at,
              pin_hash: d.pin_hash,
              author_account_id: d.author_account_id,
              owner_deleted: d.owner_deleted,
              is_locked: d.is_locked
            };
            setWishes(prev => [newWish, ...prev]);
          } else if (payload.eventType === 'DELETE') {
            setWishes(prev => prev.filter(w => w.id !== payload.old.id));
          } else if (payload.eventType === 'UPDATE') {
            const d = payload.new;
            setWishes(prev => prev.map(w => w.id === d.id ? {
              id: d.id,
              name: d.name,
              content: d.content,
              teamId: d.team_id,
              created_at: d.created_at,
              pin_hash: d.pin_hash,
              author_account_id: d.author_account_id,
              owner_deleted: d.owner_deleted,
              is_locked: d.is_locked
            } : w));
          }
        })
        .subscribe();

      const messagesChannel = supabase
        .channel('messages-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'prayer_messages' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            const d = payload.new;
            const newMessage: PrayerMessage = {
              id: d.id,
              teamId: d.team_id,
              nickname: d.nickname,
              content: d.content,
              created_at: d.created_at,
              likes: d.likes,
              author_account_id: d.author_account_id,
              author_team_id: d.author_team_id,
              owner_deleted: d.owner_deleted,
              is_locked: d.is_locked
            };
            setMessages(prev => [newMessage, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const d = payload.new;
            setMessages(prev => prev.map(m => m.id === d.id ? {
              id: d.id,
              teamId: d.team_id,
              nickname: d.nickname,
              content: d.content,
              created_at: d.created_at,
              likes: d.likes,
              author_account_id: d.author_account_id,
              author_team_id: d.author_team_id,
              owner_deleted: d.owner_deleted,
              is_locked: d.is_locked
            } : m));
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== payload.old.id));
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(wishesChannel);
        supabase.removeChannel(messagesChannel);
      };
    }
  }, [templeMode]);

  // Save private data to localStorage
  useEffect(() => {
    if (templeMode === 'private') {
      localStorage.setItem('temple_private_wishes', JSON.stringify(wishes));
    }
  }, [wishes, templeMode]);

  useEffect(() => {
    if (templeMode === 'private') {
      localStorage.setItem('temple_private_messages', JSON.stringify(messages));
    }
  }, [messages, templeMode]);

  const fetchWishes = async () => {
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) return;
    const { data, error } = await supabase
      .from('wishes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) console.error('Error fetching wishes:', error);
    else if (data) {
      setWishes(data.map(d => ({
        id: d.id,
        name: d.name,
        content: d.content,
        teamId: d.team_id,
        created_at: d.created_at,
        pin_hash: d.pin_hash,
        author_account_id: d.author_account_id,
        owner_deleted: d.owner_deleted,
        is_locked: d.is_locked
      })));
    }
  };

  const fetchMessages = async () => {
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) return;
    const { data, error } = await supabase
      .from('prayer_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) console.error('Error fetching messages:', error);
    else if (data) {
      setMessages(data.map(d => ({
        id: d.id,
        teamId: d.team_id,
        nickname: d.nickname,
        content: d.content,
        created_at: d.created_at,
        likes: d.likes,
        author_account_id: d.author_account_id,
        author_team_id: d.author_team_id,
        owner_deleted: d.owner_deleted,
        is_locked: d.is_locked
      })));
    }
  };

  const playBell = () => {
    if (bellRef.current && !isMuted) {
      bellRef.current.currentTime = 0;
      bellRef.current.play().catch(() => {});
    }
  };

  const handleEnter = () => {
    if (userProfile) {
      goToSpaceSelect();
    } else {
      goToLogin();
    }
  };

  const handleLogin = async (nickname: string, password?: string) => {
    if (!nickname.trim()) return;
    const finalPassword = password || loginPassword;
    if (!finalPassword) {
      setFeedback({ type: 'error', message: "비밀번호를 입력해 주세요." });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('nickname', nickname.trim())
        .eq('account_status', 'active')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const dbPassword = data.password || "0000";
        if (dbPassword !== finalPassword) {
          setFeedback({ type: 'error', message: "비밀번호가 일치하지 않습니다." });
          setIsLoading(false);
          return;
        }

        const profile: UserProfile = {
          accountId: data.account_id,
          nickname: data.nickname,
          teamId: data.team_id,
          role: data.role_type as UserRole,
          assignedTeamId: data.assigned_team_id,
          createdAt: data.created_at
        };
        setUserProfile(profile);
        localStorage.setItem('temple_user_profile', JSON.stringify(profile));
        setFeedback({ type: 'success', message: `${profile.nickname}님, 다시 오신 것을 환영합니다.` });
        setLoginPassword("");
        goToSpaceSelect();
      } else {
        setFeedback({ type: 'error', message: "존재하지 않는 이름입니다. 처음이시라면 '새로 시작하기'를 눌러주세요." });
      }
    } catch (err) {
      console.error('Login error:', err);
      setFeedback({ type: 'error', message: "로그인 중 오류가 발생했습니다." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimAdmin = async () => {
    if (!claimCode || !adminNickname.trim() || !adminPassword) {
      setFeedback({ type: 'error', message: "관리자 닉네임, 코드, 비밀번호를 모두 입력해주세요." });
      return;
    }

    setIsLoading(true);
    
    try {
      // 1. First, find if the profile with this nickname exists and is an admin
      const { data: profile, error: fetchErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('nickname', adminNickname.trim())
        .eq('account_status', 'active')
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      // 2. If profile exists, check if it's already an admin and verify code & password
      if (profile) {
        const dbPassword = profile.password || "0000";
        if (dbPassword !== adminPassword) {
          setFeedback({ type: 'error', message: "비밀번호가 일치하지 않습니다." });
          setIsLoading(false);
          return;
        }

        const role = profile.role_type;
        let isValid = false;
        
        const HOEJOO_CODE = import.meta.env.VITE_ADMIN_CODE_HOEJOO;
        const JOSIL_CODE = import.meta.env.VITE_ADMIN_CODE_JOSIL;
        const JOOJI_CODE = import.meta.env.VITE_ADMIN_CODE_JOOJI;

        if (!HOEJOO_CODE || !JOSIL_CODE || !JOOJI_CODE) {
          setFeedback({ type: 'error', message: "관리자 설정(환경 변수)이 누락되었습니다." });
          setIsLoading(false);
          return;
        }

        if (role === 'hoejoo' && claimCode === HOEJOO_CODE) isValid = true;
        else if (role === 'josil' && claimCode === JOSIL_CODE) isValid = true;
        else if (role === 'jooji' && claimCode === JOOJI_CODE) isValid = true;

        if (isValid) {
          const updatedProfile: UserProfile = {
            accountId: profile.account_id,
            nickname: profile.nickname,
            teamId: profile.team_id,
            role: profile.role_type as UserRole,
            assignedTeamId: profile.assigned_team_id,
            createdAt: profile.created_at
          };
          setUserProfile(updatedProfile);
          localStorage.setItem('temple_user_profile', JSON.stringify(updatedProfile));
          setFeedback({ type: 'success', message: `${profile.nickname}님, 관리자로 로그인되었습니다.` });
          setClaimCode("");
          setAdminNickname("");
          setAdminPassword("");
          goToMain();
          return;
        } else {
          setFeedback({ type: 'error', message: "관리자 코드가 일치하지 않거나 권한이 없습니다." });
          setIsLoading(false);
          return;
        }
      }

      // 3. If profile doesn't exist, check if it's a new Hoejoo claim (only if no active Hoejoo exists)
      const HOEJOO_CODE = import.meta.env.VITE_ADMIN_CODE_HOEJOO;
      
      if (!HOEJOO_CODE) {
        setFeedback({ type: 'error', message: "관리자 설정(환경 변수)이 누락되었습니다." });
        setIsLoading(false);
        return;
      }

      if (claimCode === HOEJOO_CODE) {
        // Validate password format for new account
        if (!/^[a-zA-Z0-9!@]{4,8}$/.test(adminPassword)) {
          setFeedback({ type: 'error', message: "비밀번호는 4~8자의 영문, 숫자, !, @만 가능합니다." });
          setIsLoading(false);
          return;
        }

        const { data: hoejooList, error: countErr } = await supabase
          .from('profiles')
          .select('account_id')
          .eq('role_type', 'hoejoo')
          .eq('account_status', 'active');

        if (countErr) throw countErr;

        if (hoejooList && hoejooList.length > 0) {
          setFeedback({ type: 'error', message: "이미 회주가 존재합니다. 기존 회주에게 권한을 요청하십시오." });
          setIsLoading(false);
          return;
        }

        // Create new Hoejoo
        const accountId = generateUUID();
        const nickname = adminNickname.trim();
        const teamId = "lg"; // Default

        const { error: insertErr } = await supabase
          .from('profiles')
          .insert([{
            account_id: accountId,
            nickname: nickname,
            team_id: teamId,
            role_type: 'hoejoo',
            password: adminPassword
          }]);
        
        if (insertErr) throw insertErr;

        const updatedProfile: UserProfile = {
          accountId,
          nickname,
          teamId,
          role: 'hoejoo',
          createdAt: new Date().toISOString()
        };
        
        setUserProfile(updatedProfile);
        localStorage.setItem('temple_user_profile', JSON.stringify(updatedProfile));
        
        setFeedback({ type: 'success', message: "초대 회주로 임명되었습니다." });
        setClaimCode("");
        setAdminNickname("");
        setAdminPassword("");
        goToMain();
      } else {
        setFeedback({ type: 'error', message: "존재하지 않는 관리자 닉네임이거나 코드가 틀렸습니다." });
      }
    } catch (err) {
      console.error('Error claiming admin:', err);
      setFeedback({ type: 'error', message: "인증 중 오류가 발생했습니다." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnterSpace = (mode: TempleMode) => {
    setTempleMode(mode);
    if (mode === 'private') {
      const team = KBO_TEAMS.find(t => t.id === userProfile?.teamId);
      if (team) {
        setSelectedTeam(team);
        navigateTo('prayer-room');
      } else {
        navigateTo('team-select');
      }
    } else {
      navigateTo('main');
    }
  };

  const handleProfileSetup = async (nickname: string, teamId: string) => {
    if (!teamId) {
      setFeedback({ type: 'error', message: "응원 구단을 선택해 주세요." });
      return;
    }

    const team = KBO_TEAMS.find(t => t.id === teamId);
    let finalNickname = nickname.trim() || (team?.defaultNickname || "익명의 보살");
    
    if (!setupPassword) {
      setFeedback({ type: 'error', message: "비밀번호를 설정해 주세요." });
      return;
    }

    if (!/^[a-zA-Z0-9!@]{4,8}$/.test(setupPassword)) {
      setFeedback({ type: 'error', message: "비밀번호는 4~8자의 영문, 숫자, !, @만 가능합니다." });
      return;
    }

    setIsLoading(true);
    try {
      // Check for duplicate nickname
      const { data: existing, error: checkErr } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('nickname', finalNickname)
        .eq('account_status', 'active')
        .maybeSingle();

      if (checkErr) throw checkErr;

      if (existing) {
        // If exists, append random 3 digits
        const randomSuffix = Math.floor(100 + Math.random() * 900).toString();
        finalNickname = `${finalNickname}${randomSuffix}`;
        setFeedback({ type: 'success', message: `중복된 이름이 있어 '${finalNickname}'(으)로 설정되었습니다.` });
      }

      const accountId = generateUUID();
      const newProfile: UserProfile = {
        accountId,
        nickname: finalNickname,
        teamId,
        role: 'user',
        createdAt: new Date().toISOString()
      };
      
      if (import.meta.env.VITE_SUPABASE_URL) {
        const { error } = await supabase.from('profiles').insert([{
          account_id: accountId,
          nickname: finalNickname,
          team_id: teamId,
          role_type: 'user',
          password: setupPassword
        }]);
        
        if (error) throw error;
      }
      
      setUserProfile(newProfile);
      setSetupPassword("");
      setSetupNickname("");
      setSelectedSetupTeamId(null);
      goToSpaceSelect();
    } catch (err) {
      console.error('Error saving profile:', err);
      setFeedback({ type: 'error', message: "프로필 저장에 실패했습니다." });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAccounts = async () => {
    if (!import.meta.env.VITE_SUPABASE_URL) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('account_status', 'active')
      .order('created_at', { ascending: false });
      
    if (error) console.error('Error fetching accounts:', error);
    else if (data) {
      setAllAccounts(data.map(d => ({
        accountId: d.account_id,
        nickname: d.nickname,
        teamId: d.team_id,
        role: d.role_type as UserRole,
        assignedTeamId: d.assigned_team_id,
        createdAt: d.created_at
      })));
    }
  };

  const handleAppointHoejoo = async (targetAccountId: string) => {
    if (!isHoejoo(userProfile)) return;
    setIsLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ role_type: 'hoejoo', assigned_team_id: null })
      .eq('account_id', targetAccountId);
    
    if (error) setFeedback({ type: 'error', message: "회주 임명에 실패했습니다." });
    else {
      setFeedback({ type: 'success', message: "회주로 임명되었습니다." });
      fetchAccounts();
    }
    setIsLoading(false);
  };

  const handleAppointJosil = async (targetAccountId: string, targetTeamId: string) => {
    if (!isHoejoo(userProfile)) return;
    setIsLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ role_type: 'josil', assigned_team_id: targetTeamId })
      .eq('account_id', targetAccountId);
    
    if (error) setFeedback({ type: 'error', message: "조실 임명에 실패했습니다." });
    else {
      setFeedback({ type: 'success', message: "조실로 임명되었습니다." });
      fetchAccounts();
    }
    setIsLoading(false);
  };

  const handleAppointJooji = async (targetAccountId: string) => {
    if (!isHoejoo(userProfile)) return;
    setIsLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ role_type: 'jooji', assigned_team_id: null })
      .eq('account_id', targetAccountId);
    
    if (error) setFeedback({ type: 'error', message: "주지 임명에 실패했습니다." });
    else {
      setFeedback({ type: 'success', message: "주지로 임명되었습니다." });
      fetchAccounts();
    }
    setIsLoading(false);
  };

  const handleRevokeRole = async (targetAccountId: string) => {
    if (!isHoejoo(userProfile)) return;
    
    // Protect the last hoejoo
    const hoejooCount = allAccounts.filter(a => a.role === 'hoejoo').length;
    const targetAccount = allAccounts.find(a => a.accountId === targetAccountId);
    if (targetAccount?.role === 'hoejoo' && hoejooCount <= 1) {
      setFeedback({ type: 'error', message: "마지막 회주는 권한을 회수할 수 없습니다." });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ role_type: 'user', assigned_team_id: null })
      .eq('account_id', targetAccountId);
    
    if (error) setFeedback({ type: 'error', message: "권한 회수에 실패했습니다." });
    else {
      setFeedback({ type: 'success', message: "권한이 회수되었습니다." });
      fetchAccounts();
      if (targetAccountId === userProfile?.accountId) {
        await refreshCurrentProfile();
      }
    }
    setIsLoading(false);
  };

  const handleSupportSubmit = async () => {
    if (!supportSubject.trim() || !supportContent.trim() || !userProfile) return;
    
    // Verify account is still active
    const { data: profile, error: checkErr } = await supabase
      .from('profiles')
      .select('account_status')
      .eq('account_id', userProfile.accountId)
      .maybeSingle();

    if (checkErr || !profile || profile.account_status === 'deleted') {
      handleLogout();
      setFeedback({ type: 'error', message: "유효하지 않은 계정입니다. 다시 로그인해 주세요." });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('support_requests')
        .insert([{
          category: supportCategory,
          subject: supportSubject,
          content: supportContent,
          account_id: userProfile.accountId,
          nickname: userProfile.nickname,
          author_team_id: userProfile.teamId,
          current_space: templeMode,
          room_team_id: selectedTeam?.id
        }]);

      if (error) throw error;
      
      setFeedback({ type: 'success', message: "접수되었습니다. 관리자에게 전달되었습니다." });
      setSupportSubject("");
      setSupportContent("");
      handleBack();
    } catch (err) {
      console.error('Error submitting support request:', err);
      setFeedback({ type: 'error', message: "접수에 실패했습니다. 다시 시도해주세요." });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSupportRequests = async () => {
    if (!import.meta.env.VITE_SUPABASE_URL || !isAdmin(userProfile)) return;
    
    const { data, error } = await supabase
      .from('support_requests')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) console.error('Error fetching support requests:', error);
    else if (data) setSupportRequests(data);
  };

  const updateSupportStatus = async (id: string, status: string, adminNote?: string) => {
    if (!import.meta.env.VITE_SUPABASE_URL || !isAdmin(userProfile)) return;
    
    const { error } = await supabase
      .from('support_requests')
      .update({ 
        status, 
        admin_note: adminNote,
        handled_by_account_id: userProfile?.accountId 
      })
      .eq('id', id);
      
    if (error) {
      setFeedback({ type: 'error', message: "상태 변경에 실패했습니다." });
    } else {
      setFeedback({ type: 'success', message: "상태가 변경되었습니다." });
      fetchSupportRequests();
    }
  };

  const handleUpdateProfile = async (nickname: string, teamId: string) => {
    if (!userProfile) return;
    const team = KBO_TEAMS.find(t => t.id === teamId);
    const finalNickname = nickname.trim() || (team?.defaultNickname || "익명의 보살");
    
    const updated = { 
      ...userProfile,
      nickname: finalNickname, 
      teamId 
    };

    if (import.meta.env.VITE_SUPABASE_URL) {
      const { error } = await supabase.from('profiles')
        .update({ nickname: finalNickname, team_id: teamId })
        .eq('account_id', userProfile.accountId);
      
      if (error) {
        setFeedback({ type: 'error', message: "프로필 업데이트에 실패했습니다." });
        return;
      }
    }
    
    setUserProfile(updated);
    setFeedback({ type: 'success', message: "정보가 정상적으로 변경되었습니다." });
    setIsProfileModalOpen(false);
  };

  const handleSelectMode = (mode: TempleMode) => {
    setTempleMode(mode);
    goToMain();
  };

  const handleOfferTicket = (team: Team) => {
    setSelectedTeam(team);
    setIsOffering(true);
    playBell();
    
    // Animation delay
    const timer = window.setTimeout(() => {
      setIsOffering(false);
      navigateTo('prayer-room');
    }, 2500);
    timeoutRefs.current.push(timer);
  };

  const handleAddWish = async () => {
    if (!newWish.trim() || !lanternTeamId || wishPin.length !== 4) return;
    
    // 쿨다운 체크 (3초)
    const now = Date.now();
    if (now - lastSubmitTime < 3000) {
      setFeedback({ type: 'error', message: "잠시 후 다시 시도해주세요. (3초 쿨다운)" });
      return;
    }

    setIsLoading(true);
    const team = KBO_TEAMS.find(t => t.id === lanternTeamId);
    const filteredContent = filterProfanity(newWish.slice(0, 20));
    const filteredName = filterProfanity(wishName.trim() || (team?.defaultNickname || "익명의 시주자"));
    const pinHash = btoa(wishPin); // Simple obfuscation for MVP

    if (templeMode === 'public') {
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        setFeedback({ type: 'error', message: "공용 법당 설정이 필요합니다. 관리자에게 문의하세요." });
        setIsLoading(false);
        return;
      }

      const { error } = await supabase
        .from('wishes')
        .insert([{
          team_id: lanternTeamId,
          name: filteredName,
          content: filteredContent,
          pin_hash: pinHash,
          author_account_id: userProfile?.accountId
        }]);

      if (error) {
        setFeedback({ type: 'error', message: "연등을 밝히는 데 실패했습니다. 다시 시도해주세요." });
        console.error(error);
      } else {
        setFeedback({ type: 'success', message: "연등이 대웅전에 정상적으로 올라갔습니다." });
        setNewWish("");
        setWishName("");
        setWishPin("");
        setLanternTeamId("");
        setLastSubmitTime(now);
        playBell();
        const timer = window.setTimeout(() => handleBack(), 1500);
        timeoutRefs.current.push(timer);
      }
    } else {
      // Private Mode
      const newWishObj: Wish = {
        id: Date.now().toString(),
        name: filteredName,
        content: filteredContent,
        teamId: lanternTeamId,
        created_at: new Date().toISOString(),
        pin_hash: pinHash
      };
      setWishes(prev => [newWishObj, ...prev]);
      setFeedback({ type: 'success', message: "연등이 토굴에 정상적으로 올라갔습니다." });
      setNewWish("");
      setWishName("");
      setWishPin("");
      setLanternTeamId("");
      setLastSubmitTime(now);
      playBell();
      const timer = window.setTimeout(() => handleBack(), 1500);
      timeoutRefs.current.push(timer);
    }
    setIsLoading(false);
  };

  const handleDeleteWish = async () => {
    if (!selectedWish || deletePin.length !== 4) return;
    
    const pinHash = btoa(deletePin);
    const MASTER_PIN = '1004'; // 관리자 마스터 비밀번호
    
    // 잠금 상태 확인
    if (selectedWish.is_locked && deletePin !== MASTER_PIN) {
      setFeedback({ type: 'error', message: "이 연등은 잠겨 있어 관리자만 내릴 수 있습니다." });
      return;
    }

    // 마스터 비밀번호 또는 설정된 비밀번호와 일치하는지 확인
    if (selectedWish.pin_hash !== pinHash && deletePin !== MASTER_PIN) {
      setFeedback({ type: 'error', message: "비밀번호가 일치하지 않습니다." });
      return;
    }

    setIsLoading(true);
    if (templeMode === 'public') {
      const { error } = await supabase
        .from('wishes')
        .delete()
        .eq('id', selectedWish.id);

      if (error) {
        setFeedback({ type: 'error', message: "연등을 내리는 데 실패했습니다." });
      } else {
        setFeedback({ type: 'success', message: "연등이 조용히 내려졌습니다." });
        setSelectedWish(null);
        setIsDeleting(false);
        setDeletePin("");
      }
    } else {
      setWishes(prev => prev.filter(w => w.id !== selectedWish.id));
      setFeedback({ type: 'success', message: "연등이 조용히 내려졌습니다." });
      setSelectedWish(null);
      setIsDeleting(false);
      setDeletePin("");
    }
    setIsLoading(false);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTeam) return;

    // 쿨다운 체크 (3초)
    const now = Date.now();
    if (now - lastSubmitTime < 3000) {
      setFeedback({ type: 'error', message: "잠시 후 다시 시도해주세요. (3초 쿨다운)" });
      return;
    }

    setIsLoading(true);
    const filteredContent = filterProfanity(newMessage.trim());
    const finalNickname = userProfile?.nickname || "익명의 보살";

    if (templeMode === 'public') {
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        setFeedback({ type: 'error', message: "공용 법당 설정이 필요합니다. 관리자에게 문의하세요." });
        setIsLoading(false);
        return;
      }

      const { error } = await supabase
        .from('prayer_messages')
        .insert([{
          team_id: selectedTeam.id,
          nickname: finalNickname,
          content: filteredContent,
          author_account_id: userProfile?.accountId,
          author_team_id: userProfile?.teamId
        }]);

      if (error) {
        setFeedback({ type: 'error', message: "기도를 올리는 데 실패했습니다. 다시 시도해주세요." });
        console.error(error);
      } else {
        setFeedback({ type: 'success', message: "기도문이 정상적으로 등록되었습니다." });
        setNewMessage("");
        setLastSubmitTime(now);
        playBell();
      }
    } else {
      // Private Mode
      const newMessageObj: PrayerMessage = {
        id: Date.now().toString(),
        teamId: selectedTeam.id,
        nickname: finalNickname,
        content: filteredContent,
        created_at: new Date().toISOString(),
        likes: 0,
        author_team_id: userProfile?.teamId
      };
      setMessages(prev => [newMessageObj, ...prev]);
      setFeedback({ type: 'success', message: "기도문이 토굴에 정상적으로 등록되었습니다." });
      setNewMessage("");
      setLastSubmitTime(now);
      playBell();
    }
    setIsLoading(false);
  };

  const handleLikeMessage = async (id: string) => {
    if (templeMode === 'public') {
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) return;
      const msg = messages.find(m => m.id === id);
      if (!msg) return;

      const { error } = await supabase
        .from('prayer_messages')
        .update({ likes: (msg.likes || 0) + 1 })
        .eq('id', id);

      if (error) {
        console.error('Error updating likes:', error);
      } else {
        setFeedback({ type: 'success', message: "합장이 정상적으로 반영되었습니다." });
      }
    } else {
      // Private Mode
      setMessages(prev => prev.map(m => m.id === id ? { ...m, likes: m.likes + 1 } : m));
      setFeedback({ type: 'success', message: "합장이 정상적으로 반영되었습니다." });
    }
  };

  const handleClaimAbbot = async () => {
    // Secret code to become the first Abbot for demo/setup
    if (claimCode === "1080") {
      if (!userProfile) return;
      setIsLoading(true);
      const { error } = await supabase
        .from('profiles')
        .update({ role_type: 'jooji' })
        .eq('account_id', userProfile.accountId);
      
      if (error) {
        console.error('Error claiming abbot:', error);
        setFeedback({ type: 'error', message: "권한 획득에 실패했습니다." });
      } else {
        await refreshCurrentProfile();
        setFeedback({ type: 'success', message: "주지(Abbot) 권한을 획득했습니다." });
      }
      setIsLoading(false);
      setClaimCode("");
    } else {
      setFeedback({ type: 'error', message: "비밀 코드가 일치하지 않습니다." });
    }
  };

  const handleAdminAction = async (action: 'lock' | 'unlock' | 'delete', type: 'wish' | 'message', id: string) => {
    if (!isAdmin(userProfile)) return;
    
    // Permission check for Josil
    if (isJosil(userProfile)) {
      const item = type === 'wish' ? wishes.find(w => w.id === id) : messages.find(m => m.id === id);
      const teamId = type === 'wish' ? (item as Wish)?.teamId : (item as PrayerMessage)?.teamId;
      if (teamId !== userProfile?.assignedTeamId) {
        setFeedback({ type: 'error', message: "담당 구단의 데이터만 관리할 수 있습니다." });
        return;
      }
    }

    setIsLoading(true);
    const table = type === 'wish' ? 'wishes' : 'prayer_messages';
    let error;

    if (action === 'delete') {
      const { error: err } = await supabase.from(table).delete().eq('id', id);
      error = err;
    } else {
      const { error: err } = await supabase.from(table).update({ is_locked: action === 'lock' }).eq('id', id);
      error = err;
    }

    if (error) setFeedback({ type: 'error', message: "작업에 실패했습니다." });
    else {
      setFeedback({ type: 'success', message: "작업이 완료되었습니다." });
      if (type === 'wish') fetchWishes();
      else fetchMessages();
    }
    setIsLoading(false);
  };

  const filteredMessages = useMemo(() => {
    // Consolidated Grand Hall: Show all messages in public mode
    if (templeMode === 'public') return messages;
    
    // Private mode: Show only messages for the selected team (or user's team)
    if (!selectedTeam) return [];
    return messages.filter(m => m.teamId === selectedTeam.id);
  }, [messages, selectedTeam, templeMode]);

  useEffect(() => {
    if (screen === 'lantern-form' && userProfile) {
      setLanternTeamId(userProfile.teamId);
      setWishName(userProfile.nickname);
    }
  }, [screen, userProfile]);

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-start overflow-x-hidden">
      {/* Background Image with Overlay */}
      <div 
        className="fixed inset-0 z-0 transition-transform duration-1000"
        style={{ 
          backgroundImage: `url('${screen === 'entrance' ? '/temple-bg.jpg' : '/temple.jpg'}')`,
          backgroundSize: screen === 'entrance' ? 'cover' : '100% auto',
          backgroundPosition: screen === 'entrance' ? 'center' : 'center 30%',
          backgroundRepeat: 'no-repeat',
          backgroundColor: '#1c1917'
        }}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" />
      </div>

      {/* Audio Elements */}
      <audio 
        ref={audioRef} 
        loop 
        muted={isMuted} 
        src={activeSrc}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onError={handleAudioError}
        onPlay={() => setAudioError(null)}
      />
      <audio ref={bellRef}>
        <source src="https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3" type="audio/mpeg" />
      </audio>

      {/* UI Layer */}
      <main className={`relative z-10 w-full max-w-md px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-6 sm:gap-8 min-h-screen ${isAdmin(userProfile) && screen !== 'entrance' && screen !== 'profile-setup' && screen !== 'admin-login' ? 'pt-16 sm:pt-20' : ''}`}>
        
        {/* Admin Quick Bar */}
        {isAdmin(userProfile) && screen !== 'entrance' && screen !== 'profile-setup' && screen !== 'admin-login' && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed top-0 left-0 right-0 z-[100] bg-stone-900/90 backdrop-blur-md border-b border-stone-800 px-4 py-2 flex items-center justify-between shadow-lg"
          >
            <div className="flex items-center gap-3">
              <div className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1.5 ${
                isHoejoo(userProfile) ? 'bg-amber-900/40 text-amber-400 border border-amber-900/50' :
                isJosil(userProfile) ? 'bg-indigo-900/40 text-indigo-300 border border-indigo-900/50' :
                'bg-temple-gold/20 text-temple-gold border border-temple-gold/40'
              }`}>
                {isJosil(userProfile) && userProfile?.assignedTeamId && (
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: KBO_TEAMS.find(t => t.id === userProfile.assignedTeamId)?.color }} />
                )}
                {isHoejoo(userProfile) ? '회주' : isJosil(userProfile) ? '조실' : '주지'}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-stone-300 font-medium truncate max-w-[80px]">{userProfile?.nickname}</span>
                <span className="text-[8px] text-stone-500 uppercase tracking-widest">
                  {templeMode === 'private' ? '토굴(개인)' : '대웅전(공용)'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              {isHoejoo(userProfile) && (
                <button 
                  onClick={() => {
                    fetchAccounts();
                    navigateTo('hoejoo-room');
                  }}
                  className="p-1.5 rounded-lg hover:bg-stone-800 text-amber-400 transition-colors"
                  title="회주실"
                >
                  <Sparkles size={14} />
                </button>
              )}
              {(isJosil(userProfile) || isHoejoo(userProfile)) && (
                <button 
                  onClick={() => navigateTo('master-room')}
                  className="p-1.5 rounded-lg hover:bg-stone-800 text-indigo-300 transition-colors"
                  title="조실방"
                >
                  <Moon size={14} />
                </button>
              )}
              {(isJooji(userProfile) || isHoejoo(userProfile)) && (
                <button 
                  onClick={() => {
                    fetchAccounts();
                    navigateTo('abbot-room');
                  }}
                  className="p-1.5 rounded-lg hover:bg-stone-800 text-temple-gold transition-colors"
                  title="주지실"
                >
                  <Sparkles size={14} />
                </button>
              )}
              <button 
                onClick={() => {
                  fetchSupportRequests();
                  navigateTo('admin-support-inbox');
                }}
                className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 transition-colors"
                title="접수함"
              >
                <MessageSquare size={14} />
              </button>
              <button 
                onClick={handleLogout}
                className="p-1.5 rounded-lg hover:bg-rose-900/20 text-rose-500/70 hover:text-rose-500 transition-colors"
                title="로그아웃"
              >
                <LogOut size={14} />
              </button>
              <div className="w-px h-3 bg-stone-700 mx-1" />
              <button 
                onClick={handleStepBack}
                className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-500 hover:text-stone-300 transition-colors"
                title="물러나기"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
        {/* Header Section */}
        {screen !== 'entrance' && screen !== 'profile-setup' && screen !== 'space-select' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleBack}
                    className="p-2 -ml-2 rounded-full text-stone-400 hover:text-stone-200 hover:bg-stone-900/50 transition-all"
                    aria-label="뒤로 가기"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button 
                    onClick={goToMain}
                    className="text-temple-gold font-serif text-xl tracking-widest hover:opacity-80 transition-opacity"
                  >
                    홈보살
                  </button>
                </div>
                {templeMode && (
                  <div className="flex items-center gap-2 ml-8">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      templeMode === 'public' 
                        ? 'bg-temple-gold/10 border-temple-gold text-temple-gold' 
                        : 'bg-stone-800 border-stone-600 text-stone-400'
                    }`}>
                      {templeMode === 'public' ? '대웅전 (공용)' : '토굴 (개인)'}
                    </span>
                    <button 
                      onClick={goToSpaceSelect}
                      className="text-[9px] text-stone-500 hover:text-stone-300 underline underline-offset-2"
                    >
                      공간 바꾸기
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {userProfile && (
                  <button 
                    onClick={() => setIsProfileModalOpen(true)}
                    className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg bg-stone-900/50 border border-stone-700 hover:border-stone-500 transition-all"
                  >
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full" style={{ backgroundColor: KBO_TEAMS.find(t => t.id === userProfile.teamId)?.color }} />
                    <span className="text-[10px] sm:text-[11px] text-stone-300 font-medium truncate max-w-[60px] sm:max-w-none">{userProfile.nickname}</span>
                  </button>
                )}
                <button 
                  onClick={() => setIsProfileModalOpen(true)}
                  className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg bg-stone-900/50 border border-stone-700 text-stone-500 hover:text-stone-300 transition-all"
                  title="설정 및 관리"
                >
                  <X size={16} sm:size={18} className="rotate-45" />
                  <span className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wider">설정</span>
                </button>
              </div>
            </div>

            {/* Mini Music Player Card */}
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-stone-900/40 backdrop-blur-sm border border-stone-800/50 rounded-2xl p-3 flex items-center gap-4 shadow-xl"
            >
              <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isMuted ? 'bg-stone-800 text-stone-600' : 'bg-temple-gold/20 text-temple-gold shadow-inner shadow-temple-gold/10'}`}>
                {isMuted ? <VolumeX size={18} /> : (
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  >
                    <Volume2 size={18} />
                  </motion.div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[9px] font-bold uppercase tracking-tighter px-1.5 py-0.5 rounded ${isMuted ? 'bg-stone-800 text-stone-500' : 'bg-temple-gold text-stone-900'}`}>
                    {isMuted ? "OFF" : "LIVE"}
                  </span>
                  <span className="text-[10px] text-stone-500 font-medium">
                    {isMuted ? "법음이 꺼져 있습니다" : "현재 재생 중인 법음"}
                  </span>
                </div>
                <h4 className={`text-sm font-serif truncate ${isMuted ? 'text-stone-500' : 'text-stone-200'}`}>
                  {isMuted ? "고요한 정진" : selectedTrack.title}
                </h4>
                {!isMuted && duration > 0 && (
                  <div className="mt-1.5 space-y-1">
                    <div 
                      className="h-1 w-full bg-stone-800 rounded-full overflow-hidden cursor-pointer group"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const pct = x / rect.width;
                        if (audioRef.current) {
                          audioRef.current.currentTime = pct * duration;
                        }
                      }}
                    >
                      <div 
                        className="h-full bg-temple-gold transition-all duration-300 group-hover:bg-temple-gold/80" 
                        style={{ width: `${(progress / duration) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[8px] text-stone-600 font-mono">
                      <span>{Math.floor(progress / 60)}:{Math.floor(progress % 60).toString().padStart(2, '0')}</span>
                      <span>{Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}</span>
                    </div>
                  </div>
                )}
                {audioError && !isMuted && (
                  <p className="text-[8px] text-rose-500 mt-0.5 font-medium">{audioError}</p>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button 
                  onClick={toggleMute}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                    isMuted 
                      ? 'bg-temple-gold text-stone-900 hover:bg-temple-gold/90' 
                      : 'bg-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {isMuted ? "켜기" : "끄기"}
                </button>
                {!isMuted && (
                  <button 
                    onClick={() => setIsAudioSelectionModalOpen(true)}
                    className="p-1.5 rounded-lg bg-stone-800 text-stone-400 hover:text-temple-gold hover:bg-stone-700 transition-all"
                    title="법음 선택"
                  >
                    <Music size={16} />
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {/* Feedback Toast */}
        <AnimatePresence>
          {feedback.message && (
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] w-full max-w-xs px-4"
            >
              <div className={`flex items-center gap-3 p-4 rounded-xl shadow-2xl border backdrop-blur-md ${
                feedback.type === 'success' 
                  ? 'bg-emerald-900/40 border-emerald-500/50 text-emerald-100' 
                  : 'bg-rose-900/40 border-rose-500/50 text-rose-100'
              }`}>
                {feedback.type === 'success' ? <Sparkles size={18} /> : <X size={18} />}
                <span className="text-sm font-medium">{feedback.message}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {/* 1. Entrance Screen */}
          {screen === 'entrance' && (
            <motion.div 
              key="entrance"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex-1 flex flex-col items-center justify-center text-center gap-8"
            >
              <div className="space-y-4">
                <motion.h1 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-4xl sm:text-5xl font-serif text-temple-gold tracking-[0.15em] sm:tracking-[0.2em] leading-tight break-keep"
                >
                  야구팬법당<br />홈보살
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="text-stone-400 font-light tracking-widest text-sm sm:text-base break-keep px-4"
                >
                  야구로 흔들린 마음을 잠시 내려놓는 곳
                </motion.p>
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                className="flex flex-col gap-4 w-full max-w-[200px]"
              >
                {userProfile ? (
                  <Button 
                    variant="gold" 
                    onClick={handleEnter}
                    className="text-lg py-4 rounded-full border-2"
                  >
                    법당 입장
                  </Button>
                ) : (
                  <>
                    <Button 
                      variant="gold" 
                      onClick={goToLogin}
                      className="text-lg py-4 rounded-full border-2"
                    >
                      기존 이름으로 입장
                    </Button>
                    <Button 
                      variant="secondary" 
                      onClick={goToProfileSetup}
                      className="text-sm py-3 rounded-full border border-stone-700"
                    >
                      새로 시작하기
                    </Button>
                  </>
                )}
                <button 
                  onClick={goToAdminLogin}
                  className="text-stone-600 hover:text-stone-400 text-xs underline underline-offset-4 mt-2"
                >
                  관리자 전용 입구
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* 1-0. Login Screen */}
          {screen === 'login' && (
            <motion.div 
              key="login"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col items-center justify-center gap-8"
            >
              <div className="text-center space-y-2 px-4">
                <h2 className="text-xl sm:text-2xl font-serif text-stone-200 break-keep">다시 오셨군요</h2>
                <p className="text-stone-500 text-xs sm:text-sm break-keep">사용하시던 이름과 비밀번호를 입력해 주세요</p>
              </div>

              <Card className="w-full space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-stone-500 font-bold uppercase tracking-wider px-1">이름 (닉네임)</label>
                    <input 
                      type="text" 
                      placeholder="이름을 입력하세요"
                      className="w-full bg-stone-900/50 border border-stone-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-temple-gold/50 transition-colors"
                      id="login-nickname"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-stone-500 font-bold uppercase tracking-wider px-1">비밀번호</label>
                    <input 
                      type="password" 
                      placeholder="비밀번호를 입력하세요"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full bg-stone-900/50 border border-stone-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-temple-gold/50 transition-colors"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const nicknameInput = document.getElementById('login-nickname') as HTMLInputElement;
                          handleLogin(nicknameInput.value);
                        }
                      }}
                    />
                  </div>
                </div>
                <Button 
                  variant="gold" 
                  onClick={() => {
                    const input = document.getElementById('login-nickname') as HTMLInputElement;
                    handleLogin(input.value);
                  }}
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl"
                >
                  {isLoading ? "확인 중..." : "입장하기"}
                </Button>
              </Card>

              <div className="flex flex-col items-center gap-4">
                <button 
                  onClick={goToProfileSetup}
                  className="text-stone-500 hover:text-stone-300 text-xs underline underline-offset-4"
                >
                  처음이신가요? 새로 시작하기
                </button>
                <button 
                  onClick={handleBack}
                  className="text-stone-600 hover:text-stone-400 text-sm"
                >
                  돌아가기
                </button>
              </div>
            </motion.div>
          )}

          {/* 1-0. Profile Setup Screen */}
          {screen === 'profile-setup' && (
            <motion.div 
              key="profile-setup"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex-1 flex flex-col items-center justify-center gap-8"
            >
              <div className="text-center space-y-2 px-4">
                <h2 className="text-xl sm:text-2xl font-serif text-stone-200 break-keep">법당에 들기 전,<br />마음의 이름을 정하세요</h2>
                <p className="text-stone-500 text-xs sm:text-sm break-keep">당신의 이름과 비밀번호, 응원팀을 알려주세요</p>
              </div>

              <Card className="w-full space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-stone-500 font-bold uppercase tracking-wider px-1">법명 (닉네임)</label>
                    <input 
                      type="text" 
                      placeholder="이름을 입력하세요 (미입력 시 기본 닉네임)"
                      value={setupNickname}
                      onChange={(e) => setSetupNickname(e.target.value)}
                      className="w-full bg-stone-900/50 border border-stone-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-temple-gold/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-stone-500 font-bold uppercase tracking-wider px-1">비밀번호 (4~8자, 숫자/영문/!/@)</label>
                    <input 
                      type="password" 
                      placeholder="비밀번호를 입력하세요"
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                      className="w-full bg-stone-900/50 border border-stone-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-temple-gold/50 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] sm:text-xs text-stone-500 font-bold uppercase tracking-wider">응원팀 선택</label>
                  <div className="grid grid-cols-2 gap-2 max-h-56 sm:max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {KBO_TEAMS.map((team) => (
                      <button
                        key={team.id}
                        onClick={() => setSelectedSetupTeamId(team.id)}
                        className={`flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl border transition-all text-left ${
                          selectedSetupTeamId === team.id 
                            ? 'bg-temple-gold/20 border-temple-gold shadow-[0_0_15px_rgba(212,175,55,0.2)]' 
                            : 'bg-stone-900/50 border-stone-700 hover:border-stone-500'
                        }`}
                      >
                        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
                        <span className={`text-[11px] sm:text-xs truncate ${selectedSetupTeamId === team.id ? 'text-temple-gold font-bold' : 'text-stone-400'}`}>
                          {team.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <Button 
                  variant="gold" 
                  onClick={() => handleProfileSetup(setupNickname, selectedSetupTeamId || "")}
                  disabled={isLoading}
                  className="w-full py-4 rounded-xl text-lg font-serif tracking-widest"
                >
                  {isLoading ? "처리 중..." : "가입하기"}
                </Button>
              </Card>

              <button 
                onClick={handleBack}
                className="text-stone-600 hover:text-stone-400 text-sm underline underline-offset-4"
              >
                돌아가기
              </button>
            </motion.div>
          )}

          {/* 1-1. Space Selection Screen */}
          {screen === 'space-select' && (
            <motion.div 
              key="space-select"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex-1 flex flex-col items-center justify-center gap-8"
            >
              <div className="text-center space-y-2 px-4">
                <h2 className="text-xl sm:text-2xl font-serif text-stone-200 break-keep">어느 공간에 머무시겠습니까?</h2>
                <p className="text-stone-500 text-xs sm:text-sm break-keep">마음의 평온을 찾는 길을 선택하세요</p>
              </div>

              <div className="w-full flex flex-col gap-3 sm:gap-4 px-2 sm:px-0">
                <motion.button
                  whileHover={{ scale: 1.02, backgroundColor: 'rgba(41, 37, 36, 0.6)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectMode('private')}
                  className="w-full p-5 sm:p-6 rounded-2xl bg-stone-800/40 border border-stone-700 text-left group transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg sm:text-xl font-serif text-stone-300 group-hover:text-stone-100">토굴 (土窟)</h3>
                    <Moon size={18} className="text-stone-600 group-hover:text-stone-400" />
                  </div>
                  <p className="text-xs sm:text-sm text-stone-500 group-hover:text-stone-400 leading-relaxed break-keep">
                    내 기도와 내 연등만 조용히 보관하는 개인 공간입니다. 타인에게 보이지 않습니다.
                  </p>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02, backgroundColor: 'rgba(41, 37, 36, 0.6)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectMode('public')}
                  className="w-full p-5 sm:p-6 rounded-2xl bg-stone-800/40 border border-temple-gold/30 text-left group transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg sm:text-xl font-serif text-temple-gold">대웅전 (大雄殿)</h3>
                    <Sparkles size={18} className="text-temple-gold/60 group-hover:text-temple-gold" />
                  </div>
                  <p className="text-xs sm:text-sm text-stone-500 group-hover:text-stone-400 leading-relaxed break-keep">
                    모두의 연등과 기도문이 함께 모이는 공용 공간입니다. 실시간으로 소통할 수 있습니다.
                  </p>
                </motion.button>
              </div>

              <button 
                onClick={handleBack}
                className="text-stone-600 hover:text-stone-400 text-sm underline underline-offset-4"
              >
                처음으로 돌아가기
              </button>
            </motion.div>
          )}

          {/* 2. Main Temple Screen */}
          {screen === 'main' && templeMode && (
            <motion.div 
              key="main"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-8"
            >
              <Card className="text-center space-y-6 py-8 sm:py-12">
                <div className="space-y-2 px-2">
                  <h2 className="text-xl sm:text-2xl font-serif text-stone-200 break-keep">
                    {templeMode === 'public' ? '대웅전에서 번뇌를 씻어내세요' : '토굴에서 조용히 마음을 다스리세요'}
                  </h2>
                  <p className="text-stone-500 text-xs sm:text-sm break-keep">
                    {templeMode === 'public' ? '모두와 함께 티켓을 시주하여 마음을 비웁니다' : '나만의 공간에서 티켓을 시주하며 번뇌를 잊습니다'}
                  </p>
                </div>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    if (templeMode === 'private' && userProfile) {
                      const userTeam = KBO_TEAMS.find(t => t.id === userProfile.teamId);
                      if (userTeam) handleOfferTicket(userTeam);
                    } else {
                      navigateTo('team-select');
                    }
                  }}
                  className="relative group"
                >
                  <div className="absolute inset-0 bg-temple-gold/20 blur-2xl rounded-full group-hover:bg-temple-gold/30 transition-colors" />
                  <div className="relative bg-stone-800 border-4 border-stone-700 w-48 h-32 mx-auto rounded-xl flex flex-col items-center justify-center gap-2 shadow-inner">
                    <div className="w-24 h-2 bg-stone-900 rounded-full mb-2" />
                    <span className="text-stone-500 font-serif tracking-widest">佛錢函</span>
                  </div>
                </motion.button>
              </Card>

              {/* Lantern Offering Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-serif text-temple-gold flex items-center gap-2">
                  <span className="text-xl">🪷</span> 연등 시주
                </h3>
                <Card className="flex flex-col gap-4">
                  <p className="text-stone-400 text-sm leading-relaxed">
                    간절한 소망을 담아 연등을 밝히세요. <br />
                    구단별로 모인 연등이 법당을 환하게 비춥니다.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="lantern" onClick={() => navigateTo('lantern-form')}>
                      연등 시주하기
                    </Button>
                    <Button variant="secondary" onClick={() => navigateTo('lantern-gallery')}>
                      연등 보기
                    </Button>
                  </div>
                </Card>
              </div>
            </motion.div>
          )}

          {/* 3. Team Selection Screen */}
          {screen === 'team-select' && (
            <motion.div 
              key="team-select"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-6"
            >
              <div className="flex items-center gap-4">
                <button onClick={handleBack} className="text-stone-500 hover:text-stone-200">
                  <X size={24} />
                </button>
                <h2 className="text-xl font-serif">응원팀을 선택하세요</h2>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {KBO_TEAMS.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => handleOfferTicket(team)}
                    className="p-3 sm:p-4 rounded-xl bg-stone-800/50 border border-stone-700 hover:border-temple-gold/50 hover:bg-stone-700/50 transition-all text-center group"
                  >
                    <div 
                      className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full mx-auto mb-2 opacity-80 group-hover:opacity-100 transition-opacity shadow-[0_0_8px_rgba(0,0,0,0.5)]"
                      style={{ backgroundColor: team.color }}
                    />
                    <span className="text-sm sm:text-base text-stone-200 group-hover:text-temple-gold transition-colors truncate block">{team.name}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* 3-1. Lantern Offering Form Screen */}
          {screen === 'lantern-form' && (
            <motion.div 
              key="lantern-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-6"
            >
              <div className="flex items-center gap-4">
                <button onClick={handleBack} className="text-stone-500 hover:text-stone-200">
                  <X size={24} />
                </button>
                <h2 className="text-xl font-serif">연등 시주하기</h2>
              </div>

              <Card className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] sm:text-xs text-stone-500 font-bold uppercase tracking-wider">응원팀 선택</label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {KBO_TEAMS.map((team) => (
                      <button
                        key={team.id}
                        onClick={() => {
                          setLanternTeamId(team.id);
                          if (!wishName || KBO_TEAMS.some(t => t.defaultNickname === wishName)) {
                            setWishName(team.defaultNickname);
                          }
                        }}
                        className={`flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl transition-all border-2 ${
                          lanternTeamId === team.id 
                            ? 'border-temple-gold bg-temple-gold/20' 
                            : 'border-stone-700 bg-stone-800/50'
                        }`}
                      >
                        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
                        <span className={`text-[11px] sm:text-xs truncate ${lanternTeamId === team.id ? 'text-temple-gold font-bold' : 'text-stone-400'}`}>
                          {team.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs text-stone-500 font-bold uppercase tracking-wider">시주자 명</label>
                  <input 
                    type="text" 
                    value={wishName}
                    onChange={(e) => setWishName(e.target.value)}
                    placeholder="이름을 입력하세요"
                    className="w-full bg-stone-800/50 border border-stone-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-temple-gold/50 transition-colors"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-xs text-stone-500 font-bold uppercase tracking-wider">비밀번호 (숫자 4자리)</label>
                  <input 
                    type="password" 
                    inputMode="numeric"
                    maxLength={4}
                    value={wishPin}
                    onChange={(e) => setWishPin(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="나중에 연등을 내릴 때 필요합니다"
                    className="w-full bg-stone-800/50 border border-stone-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-temple-gold/50 transition-colors"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <label className="text-xs text-stone-500 font-bold uppercase tracking-wider">발원 소원</label>
                    <span className="text-[10px] text-stone-600">{newWish.length}/20</span>
                  </div>
                  <textarea 
                    value={newWish}
                    onChange={(e) => setNewWish(e.target.value.slice(0, 20))}
                    placeholder="간절한 소망을 담아주세요 (최대 20자)"
                    rows={3}
                    className="w-full bg-stone-800/50 border border-stone-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-temple-gold/50 transition-colors resize-none"
                  />
                </div>

                <Button 
                  variant="gold" 
                  onClick={handleAddWish} 
                  className="w-full py-4"
                  disabled={!newWish.trim() || !lanternTeamId || wishPin.length !== 4 || isLoading}
                >
                  {isLoading ? "시주 중..." : "연등 밝히기"}
                </Button>
              </Card>
            </motion.div>
          )}

          {/* 3-2. Lantern Gallery Screen */}
          {screen === 'lantern-gallery' && (
            <motion.div 
              key="lantern-gallery"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-6 flex-1"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={handleBack} className="text-stone-500 hover:text-stone-200">
                    <X size={24} />
                  </button>
                  <h2 className="text-xl font-serif">연등 보기</h2>
                </div>
                <Button variant="ghost" onClick={() => navigateTo('lantern-form')} className="px-3 py-1 text-xs">
                  시주하기
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1">
                <div className="grid grid-cols-3 gap-y-12 sm:gap-y-20 gap-x-2 sm:gap-x-4 pt-12 pb-20">
                  {wishes.length === 0 ? (
                    <div className="col-span-3 text-center py-20 text-stone-600 italic break-keep">
                      아직 밝혀진 연등이 없습니다.
                    </div>
                  ) : (
                    wishes.map((wish) => {
                      const team = KBO_TEAMS.find(t => t.id === wish.teamId);
                      return (
                        <motion.button
                          key={wish.id}
                          initial={{ opacity: 0, y: -20 }}
                          animate={{ opacity: 1, y: 0 }}
                          whileHover={{ y: 5 }}
                          onClick={() => setSelectedWish(wish)}
                          className="flex flex-col items-center relative"
                        >
                          <LotusLantern teamColor={team?.color || '#ccc'} size={window.innerWidth < 640 ? 70 : 90} />
                          <div className="mt-2 bg-stone-800/80 backdrop-blur-sm px-1.5 sm:px-2 py-0.5 rounded border border-stone-700 max-w-full">
                            <span className="text-[8px] sm:text-[9px] text-stone-300 font-serif truncate max-w-[50px] sm:max-w-[60px] block">
                              {wish.name}
                            </span>
                          </div>
                        </motion.button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Wish Detail Modal */}
              <AnimatePresence>
                {selectedWish && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
                    onClick={() => setSelectedWish(null)}
                  >
                    <motion.div
                      initial={{ scale: 0.9, y: 20 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.9, y: 20 }}
                      className="bg-stone-100 w-full max-w-[280px] sm:max-w-xs p-6 sm:p-8 rounded-sm shadow-2xl relative flex flex-col items-center text-stone-900 font-serif"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="absolute top-0 left-0 w-full h-2" style={{ backgroundColor: KBO_TEAMS.find(t => t.id === selectedWish.teamId)?.color }} />
                      
                      <div className="text-stone-400 text-[10px] tracking-widest mb-4 sm:mb-6 border-b border-stone-200 w-full text-center pb-2">
                        發願文
                      </div>

                      <div className="space-y-4 sm:space-y-6 text-center w-full">
                        <div className="space-y-1">
                          <p className="text-[10px] sm:text-xs text-stone-500">시주자</p>
                          <p className="text-lg sm:text-xl font-bold truncate">{selectedWish.name}</p>
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-[10px] sm:text-xs text-stone-500">응원 구단</p>
                          <p className="text-base sm:text-lg">{KBO_TEAMS.find(t => t.id === selectedWish.teamId)?.name}</p>
                        </div>

                        <div className="pt-4 border-t border-stone-200">
                          <p className="text-stone-800 leading-relaxed text-base sm:text-lg break-keep">
                            "{selectedWish.content}"
                          </p>
                        </div>
                      </div>

                      <div className="mt-8 text-temple-gold text-2xl">
                        _()_
                      </div>

                      <div className="mt-6 w-full space-y-3">
                        {!isDeleting ? (
                          <button 
                            onClick={() => setIsDeleting(true)}
                            className="w-full py-2 text-xs text-stone-400 hover:text-rose-400 transition-colors border border-stone-200 rounded"
                          >
                            연등 거두기
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <input 
                              type="password"
                              inputMode="numeric"
                              maxLength={4}
                              placeholder="비밀번호 4자리"
                              value={deletePin}
                              onChange={(e) => setDeletePin(e.target.value.replace(/[^0-9]/g, ''))}
                              className="w-full bg-white border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none"
                            />
                            <div className="flex gap-2">
                              <button 
                                onClick={handleDeleteWish}
                                disabled={deletePin.length !== 4 || isLoading}
                                className="flex-1 py-2 bg-rose-500 text-white text-xs rounded disabled:opacity-50"
                              >
                                {isLoading ? "거두는 중..." : "확인"}
                              </button>
                              <button 
                                onClick={() => { setIsDeleting(false); setDeletePin(""); }}
                                className="flex-1 py-2 bg-stone-200 text-stone-600 text-xs rounded"
                              >
                                취소
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <button 
                        onClick={() => setSelectedWish(null)}
                        className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-white/50 hover:text-white"
                      >
                        <X size={32} />
                      </button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* 6. Abbot's Room (주지실) */}
          {screen === 'abbot-room' && (isJooji(userProfile) || isHoejoo(userProfile)) && (
            <motion.div 
              key="abbot-room"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col gap-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={handleBack} className="text-stone-500 hover:text-stone-200">
                    <ChevronLeft size={24} />
                  </button>
                  <h2 className="text-xl font-serif text-temple-gold">주지실 (住持室)</h2>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-temple-gold/10 border border-temple-gold text-temple-gold">운영 관리자</span>
              </div>

              <div className="space-y-6">
                <button 
                  onClick={() => {
                    fetchSupportRequests();
                    navigateTo('admin-support-inbox');
                  }}
                  className="w-full py-4 px-6 rounded-2xl bg-stone-800/50 border border-stone-700 text-stone-200 flex items-center justify-between hover:bg-stone-800 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare size={20} className="text-temple-gold" />
                    <div className="text-left">
                      <p className="text-sm font-bold">문의 및 신고 내역</p>
                      <p className="text-[10px] text-stone-500">사용자들의 요청을 확인합니다.</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-stone-600" />
                </button>

                <section className="space-y-4">
                  <h3 className="text-sm font-serif text-stone-300 border-b border-stone-700 pb-2">대웅전 공용 데이터 관리</h3>
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                      <h4 className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">최근 연등</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                        {wishes.slice(0, 10).map(wish => (
                          <div key={wish.id} className="p-3 rounded-lg bg-stone-900/50 border border-stone-800 flex justify-between items-center">
                            <div className="flex flex-col">
                              <span className="text-[11px] text-stone-300 truncate max-w-[150px]">{wish.content}</span>
                              <span className="text-[9px] text-stone-500">{wish.name} ({KBO_TEAMS.find(t => t.id === wish.teamId)?.name})</span>
                            </div>
                            <div className="flex gap-1">
                              <button 
                                onClick={() => handleAdminAction(wish.is_locked ? 'unlock' : 'lock', 'wish', wish.id)}
                                className={`p-1.5 rounded-md transition-all ${wish.is_locked ? 'text-temple-gold bg-temple-gold/10' : 'text-stone-500 hover:text-stone-300'}`}
                              >
                                {wish.is_locked ? <Sparkles size={14} /> : <Moon size={14} />}
                              </button>
                              <button 
                                onClick={() => handleAdminAction('delete', 'wish', wish.id)}
                                className="p-1.5 rounded-md text-stone-500 hover:text-rose-400 transition-all"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <h4 className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">최근 기도문</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                        {messages.slice(0, 10).map(msg => (
                          <div key={msg.id} className="p-3 rounded-lg bg-stone-900/50 border border-stone-800 flex justify-between items-center">
                            <div className="flex flex-col">
                              <span className="text-[11px] text-stone-300 truncate max-w-[150px]">{msg.content}</span>
                              <span className="text-[9px] text-stone-500">{msg.nickname} ({KBO_TEAMS.find(t => t.id === msg.teamId)?.name})</span>
                            </div>
                            <div className="flex gap-1">
                              <button 
                                onClick={() => handleAdminAction(msg.is_locked ? 'unlock' : 'lock', 'message', msg.id)}
                                className={`p-1.5 rounded-md transition-all ${msg.is_locked ? 'text-temple-gold bg-temple-gold/10' : 'text-stone-500 hover:text-stone-300'}`}
                              >
                                {msg.is_locked ? <Sparkles size={14} /> : <Moon size={14} />}
                              </button>
                              <button 
                                onClick={() => handleAdminAction('delete', 'message', msg.id)}
                                className="p-1.5 rounded-md text-stone-500 hover:text-rose-400 transition-all"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </motion.div>
          )}

          {/* 7. Master's Room (조실방) */}
          {screen === 'master-room' && (isJosil(userProfile) || isHoejoo(userProfile)) && (
            <motion.div 
              key="master-room"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col gap-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={handleBack} className="text-stone-500 hover:text-stone-200">
                    <ChevronLeft size={24} />
                  </button>
                  <h2 className="text-xl font-serif text-indigo-300">조실방 (祖室房)</h2>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-900/20 border border-indigo-900 text-indigo-300">구단 관리자</span>
                  <span className="text-[9px] text-stone-500 mt-1">{KBO_TEAMS.find(t => t.id === userProfile.assignedTeamId)?.name} 담당</span>
                </div>
              </div>

              <div className="space-y-6">
                <button 
                  onClick={() => {
                    fetchSupportRequests();
                    navigateTo('admin-support-inbox');
                  }}
                  className="w-full py-4 px-6 rounded-2xl bg-stone-800/50 border border-stone-700 text-stone-200 flex items-center justify-between hover:bg-stone-800 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare size={20} className="text-indigo-400" />
                    <div className="text-left">
                      <p className="text-sm font-bold">문의 및 신고 내역</p>
                      <p className="text-[10px] text-stone-500">사용자들의 요청을 확인합니다.</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-stone-600" />
                </button>

                <section className="space-y-4">
                  <h3 className="text-sm font-serif text-stone-300 border-b border-stone-700 pb-2">구단 데이터 관리</h3>
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                      <h4 className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">연등 관리</h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                        {wishes.filter(w => w.teamId === userProfile.assignedTeamId).map(wish => (
                          <div key={wish.id} className="p-3 rounded-lg bg-stone-900/50 border border-stone-800 flex justify-between items-center">
                            <div className="flex flex-col">
                              <span className="text-[11px] text-stone-300 truncate max-w-[150px]">{wish.content}</span>
                              <span className="text-[9px] text-stone-500">{wish.name}</span>
                            </div>
                            <div className="flex gap-1">
                              <button 
                                onClick={() => handleAdminAction(wish.is_locked ? 'unlock' : 'lock', 'wish', wish.id)}
                                className={`p-1.5 rounded-md transition-all ${wish.is_locked ? 'text-temple-gold bg-temple-gold/10' : 'text-stone-500 hover:text-stone-300'}`}
                              >
                                {wish.is_locked ? <Sparkles size={14} /> : <Moon size={14} />}
                              </button>
                              <button 
                                onClick={() => handleAdminAction('delete', 'wish', wish.id)}
                                className="p-1.5 rounded-md text-stone-500 hover:text-rose-400 transition-all"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <h4 className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">기도문 관리</h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                        {messages.filter(m => m.teamId === userProfile.assignedTeamId).map(msg => (
                          <div key={msg.id} className="p-3 rounded-lg bg-stone-900/50 border border-stone-800 flex justify-between items-center">
                            <div className="flex flex-col">
                              <span className="text-[11px] text-stone-300 truncate max-w-[150px]">{msg.content}</span>
                              <span className="text-[9px] text-stone-500">{msg.nickname}</span>
                            </div>
                            <div className="flex gap-1">
                              <button 
                                onClick={() => handleAdminAction(msg.is_locked ? 'unlock' : 'lock', 'message', msg.id)}
                                className={`p-1.5 rounded-md transition-all ${msg.is_locked ? 'text-temple-gold bg-temple-gold/10' : 'text-stone-500 hover:text-stone-300'}`}
                              >
                                {msg.is_locked ? <Sparkles size={14} /> : <Moon size={14} />}
                              </button>
                              <button 
                                onClick={() => handleAdminAction('delete', 'message', msg.id)}
                                className="p-1.5 rounded-md text-stone-500 hover:text-rose-400 transition-all"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </motion.div>
          )}

          {/* 8. Hoejoo's Room (회주실) */}
          {screen === 'hoejoo-room' && isHoejoo(userProfile) && (
            <motion.div 
              key="hoejoo-room"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col gap-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={handleBack} className="text-stone-500 hover:text-stone-200">
                    <ChevronLeft size={24} />
                  </button>
                  <h2 className="text-xl font-serif text-amber-400">회주실 (會主室)</h2>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/20 border border-amber-900 text-amber-400">최상위 관리자</span>
              </div>

              <div className="space-y-8">
                <button 
                  onClick={() => {
                    fetchSupportRequests();
                    navigateTo('admin-support-inbox');
                  }}
                  className="w-full py-4 px-6 rounded-2xl bg-stone-800/50 border border-stone-700 text-stone-200 flex items-center justify-between hover:bg-stone-800 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare size={20} className="text-amber-400" />
                    <div className="text-left">
                      <p className="text-sm font-bold">문의 및 신고 내역</p>
                      <p className="text-[10px] text-stone-500">사용자들의 요청을 확인합니다.</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-stone-600" />
                </button>

                <section className="space-y-4">
                  <h3 className="text-sm font-serif text-stone-300 border-b border-stone-700 pb-2">계정 및 권한 관리</h3>
                  <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar">
                    {allAccounts.map(account => (
                      <div key={account.accountId} className="p-4 rounded-xl bg-stone-800/50 border border-stone-700 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-stone-200">{account.nickname}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${
                                account.role === 'hoejoo' ? 'bg-amber-900/40 text-amber-400' :
                                account.role === 'josil' ? 'bg-indigo-900/40 text-indigo-300' :
                                account.role === 'jooji' ? 'bg-temple-gold/20 text-temple-gold' :
                                'bg-stone-700 text-stone-400'
                              }`}>
                                {account.role === 'hoejoo' ? '회주' : account.role === 'josil' ? '조실' : account.role === 'jooji' ? '주지' : '수행자'}
                              </span>
                              {/* Display cheering team badge */}
                              {account.teamId && (
                                <span 
                                  className="text-[8px] px-1.5 py-0.5 rounded-md border"
                                  style={{ 
                                    backgroundColor: KBO_TEAMS.find(t => t.id === account.teamId)?.color + '20',
                                    color: KBO_TEAMS.find(t => t.id === account.teamId)?.color,
                                    borderColor: KBO_TEAMS.find(t => t.id === account.teamId)?.color + '40'
                                  }}
                                >
                                  {KBO_TEAMS.find(t => t.id === account.teamId)?.name.split(' ')[0] || account.teamId}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-stone-500 mt-1">ID: {account.accountId.slice(0, 8)}...</p>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-stone-600 block">{new Date(account.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-stone-700/50">
                          {account.role === 'user' ? (
                            <div className="flex-1 grid grid-cols-2 gap-2">
                              <div className="flex flex-col gap-1">
                                <p className="text-[8px] text-stone-500 px-1">조실 임명 시 담당 구단 선택</p>
                                <select 
                                  id={`team-select-${account.accountId}`}
                                  className="w-full bg-stone-900 border border-stone-700 rounded-lg text-[10px] px-2 py-1 text-stone-300 focus:outline-none"
                                  defaultValue={account.teamId}
                                >
                                  {KBO_TEAMS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                                <button 
                                  onClick={() => {
                                    const select = document.getElementById(`team-select-${account.accountId}`) as HTMLSelectElement;
                                    handleAppointJosil(account.accountId, select.value);
                                  }}
                                  className="w-full py-1 rounded-lg bg-indigo-900/30 text-indigo-300 text-[10px] hover:bg-indigo-900/50 transition-all"
                                >
                                  조실 임명
                                </button>
                              </div>
                              <div className="flex flex-col gap-1">
                                <button 
                                  onClick={() => handleAppointJooji(account.accountId)}
                                  className="w-full py-1 rounded-lg bg-temple-gold/10 text-temple-gold text-[10px] hover:bg-temple-gold/20 transition-all h-full"
                                >
                                  주지 임명
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button 
                              onClick={() => handleRevokeRole(account.accountId)}
                              className="w-full py-1 rounded-lg bg-rose-900/20 text-rose-400 text-[10px] hover:bg-rose-900/40 transition-all"
                            >
                              권한 회수
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </motion.div>
          )}

          {/* 9. Admin Login Screen */}
          {screen === 'admin-login' && (
            <motion.div 
              key="admin-login"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex-1 flex flex-col items-center justify-center text-center gap-8"
            >
              <div className="space-y-4">
                <h2 className="text-2xl font-serif text-temple-gold tracking-widest">관리자 인증</h2>
                <p className="text-stone-500 text-sm">
                  {isAdmin(userProfile) 
                    ? `${userProfile.nickname}님, 관리자 권한이 확인되었습니다.` 
                    : "관리자 코드를 입력하거나 권한을 확인하십시오."}
                </p>
              </div>

              <div className="w-full max-w-xs space-y-4">
                {isAdmin(userProfile) ? (
                  <Button 
                    variant="gold" 
                    onClick={goToMain}
                    className="w-full py-4 rounded-xl text-lg"
                  >
                    관리자 모드 시작
                  </Button>
                ) : (
                  <>
                    <div className="space-y-2">
                      <input 
                        type="text"
                        placeholder="관리자 닉네임"
                        value={adminNickname}
                        onChange={(e) => setAdminNickname(e.target.value)}
                        className="w-full bg-stone-900/50 border border-stone-700 rounded-xl px-4 py-3 text-center text-sm focus:outline-none focus:border-temple-gold/50"
                      />
                      <input 
                        type="password"
                        placeholder="관리자 코드"
                        value={claimCode}
                        onChange={(e) => setClaimCode(e.target.value)}
                        className="w-full bg-stone-900/50 border border-stone-700 rounded-xl px-4 py-3 text-center text-lg tracking-[0.5em] focus:outline-none focus:border-temple-gold/50"
                      />
                      <input 
                        type="password"
                        placeholder="관리자 비밀번호"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className="w-full bg-stone-900/50 border border-stone-700 rounded-xl px-4 py-3 text-center text-sm focus:outline-none focus:border-temple-gold/50"
                      />
                    </div>
                    <Button 
                      variant="gold" 
                      onClick={handleClaimAdmin}
                      disabled={!claimCode || !adminNickname || !adminPassword || isLoading}
                      className="w-full py-3 rounded-xl"
                    >
                      {isLoading ? "확인 중..." : "인증 및 로그인"}
                    </Button>
                    <p className="text-[10px] text-stone-600 break-keep">
                      * 관리자 닉네임과 발급받은 코드를 정확히 입력하십시오.<br />
                      * 초대 회주 등록은 시스템 최초 설정 시에만 가능합니다.
                    </p>
                  </>
                )}
                <button 
                  onClick={handleBack}
                  className="text-stone-500 hover:text-stone-300 text-xs"
                >
                  돌아가기
                </button>
              </div>
            </motion.div>
          )}

          {/* 10. Support Form Screen */}
          {screen === 'support-form' && (
            <motion.div 
              key="support-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col gap-6 flex-1"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={handleBack} className="text-stone-500 hover:text-stone-200">
                    <ChevronLeft size={24} />
                  </button>
                  <h2 className="text-xl font-serif text-stone-200">문의 및 신고</h2>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">카테고리</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['bug', 'question', 'suggestion'] as const).map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSupportCategory(cat)}
                        className={`py-2 rounded-lg text-[10px] border transition-all ${
                          supportCategory === cat 
                            ? 'bg-temple-gold/10 border-temple-gold text-temple-gold' 
                            : 'bg-stone-900/50 border-stone-700 text-stone-500'
                        }`}
                      >
                        {cat === 'bug' ? '오류신고' : cat === 'question' ? '문의사항' : '건의사항'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">제목</label>
                  <input 
                    type="text"
                    placeholder="제목을 입력하세요"
                    value={supportSubject}
                    onChange={(e) => setSupportSubject(e.target.value)}
                    className="w-full bg-stone-900/50 border border-stone-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-temple-gold/50 text-stone-200"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">내용</label>
                  <textarea 
                    placeholder="상세 내용을 입력하세요"
                    value={supportContent}
                    onChange={(e) => setSupportContent(e.target.value)}
                    rows={6}
                    className="w-full bg-stone-900/50 border border-stone-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-temple-gold/50 text-stone-200 resize-none"
                  />
                </div>

                <Button 
                  variant="gold" 
                  onClick={handleSupportSubmit}
                  disabled={!supportSubject.trim() || !supportContent.trim() || isLoading}
                  className="w-full py-4 rounded-xl"
                >
                  {isLoading ? "제출 중..." : "제출하기"}
                </Button>
              </div>
            </motion.div>
          )}

          {/* 11. Admin Support Inbox Screen */}
          {screen === 'admin-support-inbox' && isAdmin(userProfile) && (
            <motion.div 
              key="admin-support-inbox"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col gap-6 flex-1"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={handleBack} className="text-stone-500 hover:text-stone-200">
                    <ChevronLeft size={24} />
                  </button>
                  <h2 className="text-xl font-serif text-stone-200">문의 내역 관리</h2>
                </div>
                <div className="flex items-center gap-2">
                  {isJosil(userProfile) && userProfile?.assignedTeamId && (
                    <span className="text-[10px] text-indigo-400 bg-indigo-900/20 px-2 py-1 rounded border border-indigo-900/50">
                      {KBO_TEAMS.find(t => t.id === userProfile.assignedTeamId)?.name} 담당
                    </span>
                  )}
                  <button onClick={fetchSupportRequests} className="text-stone-500 hover:text-stone-200">
                    <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                {supportRequests.length === 0 ? (
                  <div className="text-center py-12 text-stone-600 italic text-sm">
                    접수된 문의가 없습니다.
                  </div>
                ) : (
                  supportRequests
                    .filter(req => {
                      if (isJosil(userProfile) && !isHoejoo(userProfile)) {
                        // Josil can see all but maybe we should allow filtering?
                        // For now, let's show all but maybe highlight their team.
                        return true;
                      }
                      return true;
                    })
                    .map(req => (
                      <div 
                        key={req.id} 
                        className={`p-4 rounded-xl border space-y-3 transition-all ${
                          isJosil(userProfile) && req.author_team_id === userProfile.assignedTeamId
                            ? 'bg-indigo-900/20 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.1)]'
                            : 'bg-stone-800/50 border-stone-700'
                        }`}
                      >
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase ${
                              req.category === 'bug' ? 'bg-rose-900/30 text-rose-400' :
                              req.category === 'question' ? 'bg-indigo-900/30 text-indigo-400' :
                              'bg-emerald-900/30 text-emerald-400'
                            }`}>
                              {req.category}
                            </span>
                            <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${
                              req.status === 'new' ? 'bg-amber-900/30 text-amber-400' :
                              req.status === 'resolved' ? 'bg-emerald-900/30 text-emerald-400' :
                              'bg-stone-700 text-stone-400'
                            }`}>
                              {req.status}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-stone-200">{req.subject}</h4>
                        </div>
                        <span className="text-[9px] text-stone-600">{new Date(req.created_at).toLocaleDateString()}</span>
                      </div>
                      
                      <p className="text-xs text-stone-400 break-keep">{req.content}</p>
                      
                      <div className="pt-2 border-t border-stone-700/50 flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] text-stone-500">작성자: {req.nickname} ({KBO_TEAMS.find(t => t.id === req.author_team_id)?.name})</span>
                            <span className="text-[8px] text-stone-600">
                              공간: {req.current_space === 'private' ? '토굴' : '대웅전'} 
                              {req.room_team_id && ` (${KBO_TEAMS.find(t => t.id === req.room_team_id)?.name} 방)`}
                            </span>
                          </div>
                          <div className="flex gap-2 items-center">
                            <span className="text-[9px] text-stone-500">상태 변경:</span>
                            <select 
                              value={req.status}
                              onChange={(e) => updateSupportStatus(req.id, e.target.value, req.admin_note)}
                              className="bg-stone-900 border border-stone-700 rounded px-2 py-1 text-[9px] text-stone-300 focus:outline-none"
                            >
                              <option value="new">신규</option>
                              <option value="in_review">검토 중</option>
                              <option value="resolved">해결됨</option>
                              <option value="closed">종료</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[8px] text-stone-600 uppercase font-bold">관리자 메모</label>
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              placeholder="메모를 입력하세요..."
                              defaultValue={req.admin_note || ""}
                              onBlur={(e) => {
                                if (e.target.value !== (req.admin_note || "")) {
                                  updateSupportStatus(req.id, req.status, e.target.value);
                                }
                              }}
                              className="flex-1 bg-stone-900/50 border border-stone-700 rounded px-2 py-1.5 text-[10px] text-stone-300 focus:outline-none focus:border-stone-500"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
          {screen === 'prayer-room' && selectedTeam && (
            <motion.div 
              key="prayer-room"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-6 flex-1"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedTeam.color }} />
                  <h2 className="text-xl font-serif text-temple-gold">
                    {templeMode === 'private' ? '나의 토굴 기도방' : '대법당 (大法堂)'}
                  </h2>
                </div>
                <button onClick={handleBack} className="text-stone-500 hover:text-stone-200">
                  <X size={24} />
                </button>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto space-y-3 sm:space-y-4 pr-1 max-h-[55vh] sm:max-h-[50vh]">
                {filteredMessages.length === 0 ? (
                  <div className="text-center py-12 text-stone-600 italic break-keep text-sm sm:text-base">
                    아직 올라온 기도가 없습니다.<br />첫 소원을 빌어보세요.
                  </div>
                ) : (
                  filteredMessages.map((msg) => (
                    <motion.div 
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-stone-800/40 border-l-2 border-temple-gold p-3 sm:p-4 rounded-r-xl space-y-1.5 sm:space-y-2"
                    >
                      <div className="flex justify-between items-center text-[10px] sm:text-xs">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="text-temple-gold font-medium truncate max-w-[100px]">{msg.nickname}</span>
                          {msg.author_team_id && (
                            <span 
                              className="px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold flex-shrink-0"
                              style={{ 
                                backgroundColor: KBO_TEAMS.find(t => t.id === msg.author_team_id)?.color + '20',
                                color: KBO_TEAMS.find(t => t.id === msg.author_team_id)?.color,
                                border: `1px solid ${KBO_TEAMS.find(t => t.id === msg.author_team_id)?.color}40`
                              }}
                            >
                              {KBO_TEAMS.find(t => t.id === msg.author_team_id)?.name.split(' ')[0]}
                            </span>
                          )}
                        </div>
                        <span className="text-stone-600 flex-shrink-0">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-stone-300 text-xs sm:text-sm leading-relaxed break-keep">{msg.content}</p>
                      <button 
                        onClick={() => handleLikeMessage(msg.id)}
                        className="flex items-center gap-1 text-[10px] sm:text-xs text-stone-500 hover:text-temple-lantern transition-colors"
                      >
                        <Heart size={10} className={msg.likes > 0 ? "fill-temple-lantern text-temple-lantern" : ""} />
                        _()_ {msg.likes > 0 && msg.likes}
                      </button>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Input Area */}
              <Card className="p-4 space-y-3 mt-auto">
                <div className="flex gap-2">
                  <textarea 
                    placeholder="마음의 평정을 구하는 글을 남기세요..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    rows={2}
                    className="flex-1 bg-stone-800/50 border border-stone-700 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                  />
                  <button 
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || isLoading}
                    className="bg-temple-gold text-stone-900 p-3 rounded-lg self-end hover:opacity-90 transition-opacity disabled:opacity-30"
                  >
                    {isLoading ? <div className="w-5 h-5 border-2 border-stone-900 border-t-transparent rounded-full animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer Info */}
        {screen !== 'entrance' && (
          <footer className="mt-auto pt-8 text-center text-[10px] text-stone-600 tracking-widest uppercase">
            © 2026 야구팬법당 홈보살 · 성불하십시오
          </footer>
        )}
      </main>

        {/* 6. Profile Update Modal */}
        <AnimatePresence>
          {isProfileModalOpen && userProfile && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-stone-800 border border-stone-700 w-full max-w-sm p-6 rounded-2xl shadow-2xl space-y-6 overflow-y-auto max-h-[90vh] custom-scrollbar"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-serif text-stone-200">법당 설정 및 관리</h3>
                  <button onClick={() => setIsProfileModalOpen(false)} className="text-stone-500 hover:text-stone-200">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Section A: Profile */}
                  <div className="space-y-4 p-4 bg-stone-900/30 rounded-xl border border-stone-700/50">
                    <h4 className="text-[10px] text-stone-500 font-bold uppercase tracking-widest border-b border-stone-700/50 pb-2">수행자 정보</h4>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">이름 (닉네임)</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            defaultValue={userProfile.nickname}
                            id="update-nickname"
                            className="flex-1 bg-stone-900/50 border border-stone-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-temple-gold/50 text-stone-200"
                          />
                          <Button 
                            variant="gold" 
                            onClick={() => {
                              const input = document.getElementById('update-nickname') as HTMLInputElement;
                              handleUpdateProfile(input.value, userProfile.teamId);
                            }}
                            className="px-4 py-2 text-xs"
                          >
                            변경
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">응원팀 (변경 불가)</label>
                        <div className="flex items-center gap-3 p-3 rounded-xl border border-stone-700/50 bg-stone-900/30">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: KBO_TEAMS.find(t => t.id === userProfile.teamId)?.color }} 
                          />
                          <span className="text-sm text-stone-300">
                            {KBO_TEAMS.find(t => t.id === userProfile.teamId)?.name}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section B: Account Security */}
                  <div className="space-y-4 p-4 bg-stone-900/30 rounded-xl border border-stone-700/50">
                    <h4 className="text-[10px] text-stone-500 font-bold uppercase tracking-widest border-b border-stone-700/50 pb-2">계정 보안</h4>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[9px] text-stone-500 uppercase tracking-wider">현재 비밀번호</label>
                        <input 
                          type="password" 
                          value={currentPasswordInput}
                          onChange={(e) => setCurrentPasswordInput(e.target.value)}
                          className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-temple-gold/50"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-stone-500 uppercase tracking-wider">새 비밀번호</label>
                        <input 
                          type="password" 
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="4~8자 (영문, 숫자, !, @)"
                          className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-temple-gold/50"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-stone-500 uppercase tracking-wider">새 비밀번호 확인</label>
                        <input 
                          type="password" 
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-temple-gold/50"
                        />
                      </div>
                      <Button 
                        variant="gold" 
                        onClick={handleChangePassword}
                        className="w-full py-2 text-xs"
                        disabled={isLoading}
                      >
                        비밀번호 변경
                      </Button>
                    </div>
                  </div>

                  {/* Section C: General Actions */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] text-stone-500 font-bold uppercase tracking-widest px-1">일반 동작</h4>
                    <button 
                      onClick={() => {
                        setIsProfileModalOpen(false);
                        setIsStepBackModalOpen(true);
                      }}
                      className="w-full py-3 px-4 rounded-xl bg-stone-700/30 border border-stone-700 text-stone-300 text-sm hover:bg-stone-700/50 transition-all text-left flex justify-between items-center"
                    >
                      <div className="flex flex-col">
                        <span>물러나기</span>
                        <span className="text-[10px] text-stone-500">입장 흐름만 다시 시작합니다.</span>
                      </div>
                      <ChevronRight size={16} className="text-stone-600" />
                    </button>

                    {isJooji(userProfile) && (
                      <button 
                        onClick={() => {
                          setIsProfileModalOpen(false);
                          fetchAccounts();
                          navigateTo('abbot-room');
                        }}
                        className="w-full py-3 px-4 rounded-xl bg-temple-gold/10 border border-temple-gold/30 text-temple-gold text-sm hover:bg-temple-gold/20 transition-all text-left flex justify-between items-center"
                      >
                        <div className="flex flex-col">
                          <span>주지실 입장</span>
                          <span className="text-[10px] text-temple-gold/60">전체 시스템 및 조실 관리</span>
                        </div>
                        <Sparkles size={16} />
                      </button>
                    )}

                    {isJosil(userProfile) && (
                      <button 
                        onClick={() => {
                          setIsProfileModalOpen(false);
                          navigateTo('master-room');
                        }}
                        className="w-full py-3 px-4 rounded-xl bg-indigo-900/10 border border-indigo-900/30 text-indigo-300 text-sm hover:bg-indigo-900/20 transition-all text-left flex justify-between items-center"
                      >
                        <div className="flex flex-col">
                          <span>조실방 입장</span>
                          <span className="text-[10px] text-indigo-400/60">{KBO_TEAMS.find(t => t.id === userProfile?.assignedTeamId)?.name} 관리</span>
                        </div>
                        <Moon size={16} />
                      </button>
                    )}

                    {isHoejoo(userProfile) && (
                      <button 
                        onClick={() => {
                          setIsProfileModalOpen(false);
                          fetchAccounts();
                          navigateTo('hoejoo-room');
                        }}
                        className="w-full py-3 px-4 rounded-xl bg-temple-gold/10 border border-temple-gold/30 text-temple-gold text-sm hover:bg-temple-gold/20 transition-all text-left flex justify-between items-center"
                      >
                        <div className="flex flex-col">
                          <span>회주실 입장</span>
                          <span className="text-[10px] text-temple-gold/60">전체 시스템 및 관리자 관리</span>
                        </div>
                        <Sparkles size={16} />
                      </button>
                    )}

                    <button 
                      onClick={() => {
                        setIsProfileModalOpen(false);
                        navigateTo('support-form');
                      }}
                      className="w-full py-3 px-4 rounded-xl bg-stone-700/30 border border-stone-700 text-stone-300 text-sm hover:bg-stone-700/50 transition-all text-left flex justify-between items-center"
                    >
                      <div className="flex flex-col">
                        <span>문의 및 신고</span>
                        <span className="text-[10px] text-stone-500">오류신고 / 문의사항 / 건의사항</span>
                      </div>
                      <MessageSquare size={16} className="text-stone-600" />
                    </button>

                    <button 
                      onClick={() => {
                        setIsProfileModalOpen(false);
                        handleLogout();
                      }}
                      className="w-full py-3 px-4 rounded-xl bg-stone-700/30 border border-stone-700 text-stone-300 text-sm hover:bg-rose-900/20 hover:border-rose-900/30 transition-all text-left flex justify-between items-center"
                    >
                      <div className="flex flex-col">
                        <span>로그아웃</span>
                        <span className="text-[10px] text-stone-500">현재 계정에서 로그아웃합니다.</span>
                      </div>
                      <LogOut size={16} className="text-stone-600" />
                    </button>
                  </div>

                  {/* Section C: Private Temple Management */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] text-stone-500 font-bold uppercase tracking-widest px-1">토굴 전용 정리</h4>
                    <button 
                      onClick={() => {
                        setIsProfileModalOpen(false);
                        setIsTempleCleaningModalOpen(true);
                      }}
                      className="w-full py-3 px-4 rounded-xl bg-amber-900/10 border border-amber-900/30 text-amber-200/70 text-sm hover:bg-amber-900/20 transition-all text-left flex justify-between items-center"
                    >
                      <div className="flex flex-col">
                        <span>토굴청소</span>
                        <span className="text-[10px] text-amber-900/60">토굴의 개인 기록을 비웁니다.</span>
                      </div>
                      <Moon size={16} className="text-amber-900/50" />
                    </button>
                  </div>

                  {/* Section D: Danger Zone */}
                  <div className="space-y-3 pt-4 border-t border-stone-700/50">
                    <h4 className="text-[10px] text-rose-500/70 font-bold uppercase tracking-widest px-1">위험 영역</h4>
                    <button 
                      onClick={() => {
                        setIsProfileModalOpen(false);
                        setIsDeleteAccountModalOpen(true);
                      }}
                      className="w-full py-3 px-4 rounded-xl bg-rose-950/20 border border-rose-900/30 text-rose-400/80 text-sm hover:bg-rose-950/40 transition-all text-left flex justify-between items-center"
                    >
                      <span>계정 및 모든 기록 삭제</span>
                      <X size={16} className="text-rose-900/50" />
                    </button>
                    <p className="text-[9px] text-stone-600 px-1 leading-relaxed">
                      계정 삭제 시 토굴 기록은 즉시 삭제되며, 대웅전 기록은 잠금 처리되어 더 이상 수정할 수 없습니다.
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirmation Modals */}
        <AnimatePresence>
          {/* 1. Step Back Modal */}
          {isStepBackModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-stone-800 border border-stone-700 w-full max-w-xs p-6 rounded-2xl shadow-2xl space-y-6 text-center"
              >
                <div className="space-y-2">
                  <h3 className="text-lg font-serif text-stone-200 break-keep">물러나시겠습니까?</h3>
                  <p className="text-xs text-stone-500 leading-relaxed break-keep">
                    저장된 기록은 유지한 채 다시 입장 흐름을 시작합니다.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button variant="gold" onClick={handleStepBack} className="w-full">물러나기</Button>
                  <button onClick={() => setIsStepBackModalOpen(false)} className="py-2 text-xs text-stone-500 hover:text-stone-300 transition-colors">취소</button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* 2. Temple Cleaning Modal */}
          {isTempleCleaningModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-stone-800 border border-stone-700 w-full max-w-xs p-6 rounded-2xl shadow-2xl space-y-6 text-center"
              >
                <div className="space-y-2">
                  <h3 className="text-lg font-serif text-amber-200/80 break-keep">토굴청소를 하시겠습니까?</h3>
                  <p className="text-xs text-stone-500 leading-relaxed break-keep">
                    토굴의 개인 연등과 기도문이 모두 비워집니다.<br />
                    <span className="text-stone-400">계정은 유지됩니다.</span>
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button variant="lantern" onClick={handleTempleCleaning} className="w-full">토굴청소</Button>
                  <button onClick={() => setIsTempleCleaningModalOpen(false)} className="py-2 text-xs text-stone-500 hover:text-stone-300 transition-colors">취소</button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* 3. Delete Account Modal */}
          {isDeleteAccountModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-md flex items-center justify-center p-6"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-stone-900 border border-rose-900/30 w-full max-w-xs p-6 rounded-2xl shadow-2xl space-y-6 text-center"
              >
                <div className="space-y-3">
                  <h3 className="text-lg font-serif text-rose-400 break-keep font-bold">계정을 삭제하시겠습니까?</h3>
                  <div className="text-[11px] text-stone-500 leading-relaxed space-y-2 text-left bg-stone-950/50 p-3 rounded-lg border border-stone-800">
                    <p className="flex gap-2"><span className="text-rose-900">•</span> <span>토굴의 개인 기록이 모두 삭제됩니다.</span></p>
                    <p className="flex gap-2"><span className="text-rose-900">•</span> <span>현재 계정은 종료되며, 이후 새 계정은 이전 계정과 별도로 생성됩니다.</span></p>
                    <p className="flex gap-2"><span className="text-rose-900">•</span> <span>이전 계정의 대웅전 기록은 잠금 처리되어 관리자 외에는 수정할 수 없습니다.</span></p>
                    <p className="font-bold text-rose-500/80 pt-1">※ 이 작업은 되돌릴 수 없습니다.</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={handleDeleteAccount}
                    className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold transition-all shadow-lg shadow-rose-900/20"
                  >
                    계정과 기록 삭제
                  </button>
                  <button onClick={() => setIsDeleteAccountModalOpen(false)} className="py-2 text-xs text-stone-500 hover:text-stone-300 transition-colors">취소</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 4. Audio Selection Modal */}
        <AnimatePresence>
          {isAudioSelectionModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-stone-800 border border-stone-700 w-full max-w-xs p-6 rounded-2xl shadow-2xl space-y-6"
              >
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-serif text-stone-200">법음 선택</h3>
                  <p className="text-[10px] text-stone-500">지금 들을 불경을 고르세요</p>
                </div>

                <div className="space-y-2">
                  {AUDIO_TRACKS.map((track) => (
                    <button
                      key={track.id}
                      onClick={() => {
                        changeTrack(track);
                        setIsAudioSelectionModalOpen(false);
                      }}
                      className={`w-full p-4 rounded-xl border text-left transition-all flex items-center justify-between group ${
                        selectedTrack.id === track.id
                          ? 'bg-temple-gold/10 border-temple-gold text-temple-gold'
                          : 'bg-stone-900/50 border-stone-700 text-stone-400 hover:border-stone-500'
                      }`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">{track.title}</span>
                        {track.description && (
                          <span className="text-[9px] opacity-60">{track.description}</span>
                        )}
                      </div>
                      {selectedTrack.id === track.id && (
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                        >
                          <Sparkles size={14} />
                        </motion.div>
                      )}
                    </button>
                  ))}
                </div>

                <button 
                  onClick={() => setIsAudioSelectionModalOpen(false)}
                  className="w-full py-2 text-xs text-stone-500 hover:text-stone-300 transition-colors"
                >
                  닫기
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 5. Ticket Offering Animation Overlay */}
      <AnimatePresence>
        {isOffering && selectedTeam && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center gap-12"
          >
            <motion.div
              initial={{ y: 200, opacity: 0, scale: 0.5 }}
              animate={{ 
                y: [200, 0, -100], 
                opacity: [0, 1, 0],
                scale: [0.5, 1, 0.8],
                rotate: [0, -5, 5, 0]
              }}
              transition={{ duration: 2, times: [0, 0.3, 0.8, 1] }}
              className="relative"
            >
              <div className="bg-white text-stone-900 p-5 sm:p-6 rounded-lg shadow-2xl w-56 sm:w-64 border-t-8" style={{ borderColor: selectedTeam.color }}>
                <div className="flex justify-between items-start mb-4">
                  <Ticket size={20} sm:size={24} className="text-stone-400" />
                  <span className="text-[8px] sm:text-[10px] font-bold tracking-tighter text-stone-400">BASEBALL ADMISSION</span>
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl sm:text-2xl font-black italic truncate">{selectedTeam.name}</h3>
                  <p className="text-[10px] sm:text-xs text-stone-500">오늘의 야구번뇌 티켓</p>
                </div>
                <div className="mt-4 sm:mt-6 pt-4 border-t border-dashed border-stone-200 flex justify-between items-center">
                  <div className="w-10 sm:w-12 h-3 sm:h-4 bg-stone-100 rounded" />
                  <div className="text-base sm:text-lg font-serif text-temple-gold">_()_</div>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              className="text-temple-gold font-serif text-xl tracking-widest"
            >
              티켓이 불전함에 담겼습니다...
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
