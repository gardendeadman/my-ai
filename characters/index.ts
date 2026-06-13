import seoa from "./seoa";

export interface Character {
  id: string;
  name: string;
  age: number;
  description: string;
  avatar: string;       // 이모지 또는 이미지 경로
  avatarBg: string;     // tailwind gradient 클래스
  tags: string[];
  personality: string;  // 시스템 프롬프트
}

// 캐릭터 추가할 때 여기에만 넣으면 됩니다
const characters: Character[] = [
  seoa,
  // 새 캐릭터는 여기에 추가
];

export const getCharacter = (id: string) =>
  characters.find((c) => c.id === id);

export default characters;
