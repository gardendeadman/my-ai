"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import characters, { getAge, type Character } from "@/characters";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

interface Message {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string; // base64 data URL 또는 외부 URL
}

interface Conversation {
  id: string;
  character_id: string;
  updated_at: string;
  messages: { role: string; content: string; created_at: string }[];
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selected, setSelected] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/conversations");
    if (res.ok) setConversations(await res.json());
  }, []);

  useEffect(() => {
    if (user) loadConversations();
  }, [user, loadConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const signInWithGoogle = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/api/auth/callback` },
    });
  };

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setSelected(null);
    setMessages([]);
    setConversationId(null);
  };

  const startConversation = async (char: Character) => {
    setSelected(char);
    setMessages([]);
    setConversationId(null);
    setSidebarOpen(false);

    // 로그인한 경우에만 대화 기록 저장
    if (user) {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: char.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setConversationId(data.id);
      }
    }
  };

  const loadConversation = async (conv: Conversation) => {
    const char = characters.find((c) => c.id === conv.character_id);
    if (!char) return;

    const res = await fetch(`/api/conversations/${conv.id}`);
    if (!res.ok) return;
    const data = await res.json();

    setSelected(char);
    setMessages(
      data.messages.map((m: { role: "user" | "assistant"; content: string }) => ({
        role: m.role,
        content: m.content,
      }))
    );
    setConversationId(conv.id);
    setSidebarOpen(false);
  };

  const saveMessage = async (role: "user" | "assistant", content: string) => {
    if (!conversationId || !user) return;
    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, role, content }),
    });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPendingImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if ((!trimmed && !pendingImage) || isLoading || !selected) return;

    const userMessage: Message = {
      role: "user",
      content: trimmed || (pendingImage ? "📷" : ""),
      imageUrl: pendingImage ?? undefined,
    };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setPendingImage(null);
    setIsLoading(true);

    await saveMessage("user", trimmed);

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

      if (accumulated) {
        await saveMessage("assistant", accumulated);
        loadConversations();
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "잠깐, 뭔가 문제가 생긴 것 같아요. 다시 말해줄 수 있어요?",
        };
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

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return "방금";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
    return `${Math.floor(diff / 86_400_000)}일 전`;
  };

  if (authLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0f0f10]">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-[#0f0f10] text-gray-100 px-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center text-3xl mx-auto mb-6">
            🌸
          </div>
          <h1 className="text-2xl font-semibold text-white mb-2">myai</h1>
          <p className="text-gray-500 text-sm mb-10">로그인하고 캐릭터와 대화를 시작해보세요</p>
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 py-3 px-5 rounded-2xl border border-white/12 bg-white/6 hover:bg-white/10 transition-colors text-sm font-medium text-white"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google로 로그인
          </button>
        </div>
      </div>
    );
  }

  // 사이드바
  const Sidebar = () => (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-[#18181a] border-r border-white/10 z-30 flex flex-col transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
          <span className="text-sm font-medium text-white">대화 기록</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/8 text-gray-400"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {conversations.length === 0 ? (
            <p className="text-xs text-gray-600 text-center mt-8 px-4">아직 대화가 없어요</p>
          ) : (
            conversations.map((conv) => {
              const char = characters.find((c) => c.id === conv.character_id);
              if (!char) return null;
              const lastMsg = conv.messages?.[0];
              const isActive = conv.id === conversationId;
              return (
                <button
                  key={conv.id}
                  onClick={() => loadConversation(conv)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left ${
                    isActive ? "bg-white/8" : ""
                  }`}
                >
                  {char.avatarImage ? (
                    <img src={char.avatarImage} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${char.avatarBg} flex items-center justify-center text-base flex-shrink-0`}>
                      {char.avatar}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-medium text-white">{char.name}</span>
                      <span className="text-[10px] text-gray-600">{formatDate(conv.updated_at)}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {lastMsg ? lastMsg.content : "대화를 시작해보세요"}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-white/10 px-4 py-3">
          {user ? (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-sm font-semibold text-white flex-shrink-0">
                  {user.email?.[0].toUpperCase()}
                </div>
                <p className="text-xs text-gray-400 truncate flex-1">{user.email}</p>
              </div>
              <button
                onClick={signOut}
                className="w-full text-xs text-gray-500 hover:text-gray-300 py-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                로그아웃
              </button>
            </>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="w-full text-xs text-gray-400 hover:text-white py-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              Google로 로그인
            </button>
          )}
        </div>
      </aside>
    </>
  );

  if (!selected) {
    return (
      <div className="flex flex-col h-full bg-[#0f0f10] text-gray-100">
        <Sidebar />
        <header className="flex items-center px-4 py-3 border-b border-white/10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/8 text-gray-400 hover:text-white transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M3 6.75A.75.75 0 013.75 6h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 6.75zM3 12a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 12zm0 5.25a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
            </svg>
          </button>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-full max-w-md">
            <h1 className="text-2xl font-semibold text-white text-center mb-2">누구와 대화할까요?</h1>
            <p className="text-gray-500 text-sm text-center mb-8">캐릭터를 선택하면 대화가 시작됩니다</p>

            <div className="flex flex-col gap-4">
              {characters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => startConversation(char)}
                  className="flex items-center gap-4 p-5 rounded-2xl border border-white/10 bg-white/4 hover:bg-white/8 hover:border-white/20 transition-all text-left group"
                >
                  {char.avatarImage ? (
                    <img src={char.avatarImage} className="w-14 h-14 rounded-2xl object-cover flex-shrink-0 group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${char.avatarBg} flex items-center justify-center text-2xl flex-shrink-0 group-hover:scale-105 transition-transform`}>
                      {char.avatar}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-white">{char.name}</span>
                      <span className="text-xs text-gray-500">{char.age ?? getAge(char.birthdate)}세</span>
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
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-gray-600 group-hover:text-gray-400 flex-shrink-0 transition-colors">
                    <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 011.06-1.06l7.5 7.5z" clipRule="evenodd" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0f0f10] text-gray-100">
      <Sidebar />

      <header className="border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(true)}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/8 transition-colors text-gray-400 hover:text-white"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M3 6.75A.75.75 0 013.75 6h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 6.75zM3 12a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 12zm0 5.25a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
          </svg>
        </button>
        {selected.avatarImage ? (
          <img src={selected.avatarImage} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${selected.avatarBg} flex items-center justify-center text-lg`}>
            {selected.avatar}
          </div>
        )}
        <div>
          <h1 className="text-sm font-semibold text-white leading-none">{selected.name}</h1>
          <p className="text-xs text-gray-500 mt-0.5">{selected.description}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-gray-500">온라인</span>
          </div>
          <button
            onClick={() => setSelected(null)}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/8 transition-colors text-gray-400 hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M11.03 3.97a.75.75 0 010 1.06l-6.22 6.22H21a.75.75 0 010 1.5H4.81l6.22 6.22a.75.75 0 11-1.06 1.06l-7.5-7.5a.75.75 0 010-1.06l7.5-7.5a.75.75 0 011.06 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            {selected.avatarImage ? (
              <img src={selected.avatarImage} className="w-20 h-20 rounded-3xl object-cover" />
            ) : (
              <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${selected.avatarBg} flex items-center justify-center text-4xl`}>
                {selected.avatar}
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">{selected.name}</h2>
              <p className="text-gray-500 text-sm">{selected.description}</p>
            </div>
            <div className="flex gap-2 flex-wrap justify-center mt-2">
              {["안녕! 자기소개 해줘", "좋아하는 디저트 뭐야?", "오늘 기분이 안 좋아..", "같이 이야기 나눠요"].map((s) => (
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
                  selected.avatarImage ? (
                    <img src={selected.avatarImage} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 bg-gradient-to-br ${selected.avatarBg} flex items-center justify-center text-sm`}>
                      {selected.avatar}
                    </div>
                  )
                )}
                <div
                  className={`max-w-[78%] rounded-2xl overflow-hidden text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-rose-500/80 text-white rounded-tr-sm"
                      : "bg-white/8 text-gray-100 rounded-tl-sm border border-white/10"
                  }`}
                >
                  {msg.imageUrl && (
                    <img src={msg.imageUrl} className="w-full max-w-[260px] object-cover" />
                  )}
                  {(msg.content && msg.content !== "📷") && (
                    <p className="px-4 py-2.5 whitespace-pre-wrap">{msg.content}</p>
                  )}
                  {msg.role === "assistant" && isLoading && i === messages.length - 1 && msg.content === "" && (
                    <span className="inline-flex gap-1 px-4 py-3">
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

      <footer className="border-t border-white/10 px-4 py-3">
        <div className="max-w-xl mx-auto">
          {pendingImage && (
            <div className="mb-2 relative w-fit">
              <img src={pendingImage} className="h-20 rounded-xl object-cover border border-white/10" />
              <button
                type="button"
                onClick={() => setPendingImage(null)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                  <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}
          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-2 bg-white/6 border border-white/12 rounded-2xl px-4 py-3 focus-within:border-rose-400/40 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-white/8 transition-colors flex-shrink-0"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M18.97 3.659a2.25 2.25 0 00-3.182 0l-10.94 10.94a3.75 3.75 0 105.304 5.303l7.693-7.693a.75.75 0 011.06 1.06l-7.693 7.694a5.25 5.25 0 11-7.424-7.424l10.939-10.94a3.75 3.75 0 115.303 5.304L9.097 18.835l-.008.008-.007.007-.002.002-.003.002A2.25 2.25 0 015.91 15.66l7.81-7.81a.75.75 0 011.061 1.06l-7.81 7.81a.75.75 0 001.054 1.068L18.97 6.84a2.25 2.25 0 000-3.182z" clipRule="evenodd" />
              </svg>
            </button>
            {selected.images && selected.images.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const imgs = selected.images!;
                  setPendingImage(imgs[Math.floor(Math.random() * imgs.length)]);
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-white/8 transition-colors flex-shrink-0"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clipRule="evenodd" />
                </svg>
              </button>
            )}
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
              disabled={(!input.trim() && !pendingImage) || isLoading}
              className="w-8 h-8 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all flex-shrink-0"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}
