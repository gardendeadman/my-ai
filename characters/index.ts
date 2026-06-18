import seoa from "./seoa/index";

export interface Character {
  id: string;
  name: string;
  birthdate: string; // "YYYY-MM-DD" — age가 없으면 자동 계산
  age?: number;      // 고정 나이 (설정 시 birthdate 무시)
  description: string;
  avatar: string;        // 이모지 (avatarImage 없을 때 폴백)
  avatarBg: string;      // tailwind gradient 클래스
  avatarImage?: string;  // 프로필 이미지 경로 (예: /characters/seoa.jpg)
  images?: { src: string; desc: string }[]; // 대화 연동 이미지 목록
  tags: string[];
  personality: string;   // 시스템 프롬프트
}

// 캐릭터 추가할 때 여기에만 넣으면 됩니다
const characters: Character[] = [
  seoa,
  // 새 캐릭터는 여기에 추가
];

export function getAge(birthdate: string): number {
  const today = new Date();
  const birth = new Date(birthdate);
  let age = today.getFullYear() - birth.getFullYear();
  const notYet =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (notYet) age--;
  return age;
}

export const getCharacter = (id: string) =>
  characters.find((c) => c.id === id);

export default characters;
