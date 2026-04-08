export interface AudioTrack {
  id: string;
  title: string;
  filePath: string;
  fallbackUrl?: string;
  description?: string;
}

export const AUDIO_TRACKS: AudioTrack[] = [
  {
    id: 'hangeul-cheonsugyeong',
    title: '한글 천수경',
    filePath: '/audio/hangeul-cheonsugyeong.mp3',
    fallbackUrl: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808f3030e.mp3',
    description: '모든 중생의 고통을 덜어주는 자비의 경전'
  },
  {
    id: 'hangeul-banyasimgyeong',
    title: '한글 반야심경',
    filePath: '/audio/hangeul-banyasimgyeong.mp3',
    fallbackUrl: 'https://cdn.pixabay.com/audio/2022/01/24/audio_837413c5f4.mp3',
    description: '지혜의 정수를 담은 핵심 경전'
  },
  {
    id: 'obunhyanggye',
    title: '오분향계',
    filePath: '/audio/obunhyanggye.mp3',
    fallbackUrl: 'https://cdn.pixabay.com/audio/2022/03/24/audio_783910325b.mp3',
    description: '다섯 가지 향으로 공양을 올리는 게송'
  }
];

/**
 * Note for the user:
 * Please place your mp3 files in the public/audio/ folder with the following names:
 * - hangeul-cheonsugyeong.mp3
 * - hangeul-banyasimgyeong.mp3
 * - obunhyanggye.mp3
 */
