"use client";

import { useState, useRef, useEffect } from "react";
import characters, { type Character } from "@/characters";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function Home() {
  const [selected, setSelected] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectCharacter = (char: Character) => {
    setSelected(char);
    setMessages([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading || !selected) return;

    const userMessage: Message = { role: "user", content: trimmed };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    setMessages([...newMessages, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, characterId: selected.id }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              accumulated += parsed.text;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: accumulated };
                return updated;
              });
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: "잠깐, 뭔가 문제가 생긴 것 같아요. 다시 말해줄 수 있어요?" };
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const handleTextareaInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  // 캐릭터 선택 화면
  if (!selected) {
    return (
      <div className="flex flex-col h-full bg-[#0f0f10] text-gray-100 items-center justify-center px-6">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-semibold text-white text-center mb-2">
            누구와 대화할까요?
          </h1>
          <p className="text-gray-500 text-sm text-center mb-8">
            캐릭터를 선택하면 대화가 시작됩니다
          </p>

          <div className="flex flex-col gap-4">
            {characters.map((char) => (
              <button
                key={char.id}
                onClick={() => selectCharacter(char)}
                className="flex items-center gap-4 p-5 rounded-2xl border border-white/10 bg-white/4 hover:bg-white/8 hover:border-white/20 transition-all text-left group"
              >
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${char.avatarBg} flex items-center justify-center text-2xl flex-shrink-0 group-hover:scale-105 transition-transform`}>
                  {char.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-white">{char.name}</span>
                    <span className="text-xs text-gray-500">{char.age}세</span>
                  </div>
                  <p className="text-sm text-gray-400 mb-2">{char.description}</p>
                  <div className="flex gap-1 flex-wrap">
                    {char.tags.map((tag) => (
                      <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-white/8 text-gray-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-gray-600 group-hover:text-gray-400 flex-shrink-0 transition-colors">
                  <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 011.06-1.06l7.5 7.5z" clipRule="evenodd" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 채팅 화면
  return (
    <div className="flex flex-col h-full bg-[#0f0f10] text-gray-100">
      {/* Header */}
      <header className="border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setSelected(null)}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/8 transition-colors text-gray-400 hover:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd" />
          </svg>
        </button>
        <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${selected.avatarBg} flex items-center justify-center text-lg`}>
          {selected.avatar}
        </div>
        <div>
          <h1 className="text-sm font-semibold text-white leading-none">{selected.name}</h1>
          <p className="text-xs text-gray-500 mt-0.5">{selected.description}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-gray-500">온라인</span>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto scrollbar-thin px-4 py-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${selected.avatarBg} flex items-center justify-center text-4xl`}>
              {selected.avatar}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">{selected.name}</h2>
              <p className="text-gray-500 text-sm">{selected.description}</p>
            </div>
            <div className="flex gap-2 flex-wrap justify-center mt-2">
              {[
                "안녕! 자기소개 해줘",
                "좋아하는 디저트 뭐야?",
                "오늘 기분이 안 좋아..",
                "같이 이야기 나눠요",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                  className="px-3 py-1.5 text-xs text-gray-400 border border-white/10 rounded-full hover:border-rose-400/40 hover:text-gray-200 hover:bg-white/5 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-xl mx-auto space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                {msg.role === "assistant" && (
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 bg-gradient-to-br ${selected.avatarBg} flex items-center justify-center text-sm`}>
                    {selected.avatar}
                  </div>
                )}
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-rose-500/80 text-white rounded-tr-sm"
                      : "bg-white/8 text-gray-100 rounded-tl-sm border border-white/10"
                  }`}
                >
                  {msg.content}
                  {msg.role === "assistant" && isLoading && i === messages.length - 1 && msg.content === "" && (
                    <span className="inline-flex gap-1 py-1">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </main>

      {/* Input */}
      <footer className="border-t border-white/10 px-4 py-3">
        <form
          onSubmit={handleSubmit}
          className="max-w-xl mx-auto flex items-end gap-2 bg-white/6 border border-white/12 rounded-2xl px-4 py-3 focus-within:border-rose-400/40 transition-colors"
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onInput={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder={`${selected.name}에게 메시지 보내기...`}
            rows={1}
            className="flex-1 bg-transparent resize-none text-sm text-gray-100 placeholder-gray-500 outline-none min-h-[24px] max-h-[160px]"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-8 h-8 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </button>
        </form>
      </footer>
    </div>
  );
}
