"use client";

import React, {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle
} from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { FaArrowUp } from "react-icons/fa";
import { VscRobot } from "react-icons/vsc";
import { MarkdownRenderer } from "@/components/learn-page/markdownrenderer";
import { getSkillSpace } from "@/lib/skillspace";
import { useAuthContext } from "@/context/authcontext";
import { loadChatMessages, addChatMessage } from "@/lib/skillChat";
import { Orbit } from "lucide-react";

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

export interface ChatRef {
    clearLocalChat: () => void;
}

interface ChatProps {
    skillId?: string;
}


const Chat = forwardRef<ChatRef, ChatProps>(function Chat({ skillId }, ref) {
    const { user } = useAuthContext();
    const [skill, setSkill] = useState<any>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [userInput, setUserInput] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

    // Expose a method to clear local chat state
    useImperativeHandle(ref, () => ({
        clearLocalChat() {
        setMessages([
            {
            role: "assistant",
            content: "Welcome to a fresh chat! I'm Groq, your tutor!",
            },
        ]);
        },
    }));

    // On mount, fetch skill doc & load chat messages from Firestore
    useEffect(() => {
        if (!user?.uid || !skillId) return;

        getSkillSpace(user.uid, skillId)
        .then((doc) => {
            if (doc) setSkill(doc);
        })
        .catch((err) => console.error("Error fetching skill doc:", err));

        loadChatMessages(user.uid, skillId)
        .then((msgs) => {
            const loaded = msgs.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
            }));
            if (loaded.length === 0) {
            loaded.push({
                role: "assistant",
                content: "Welcome to the Learn Section, I'm Groq!",
            });
            }
            setMessages(loaded);
        })
        .catch((err) => console.error("Error loading chat messages:", err));
    }, [user, skillId]);

    // Send user message + AI response
    async function handleSend() {
        if (!userInput.trim()) return;
        if (!skill) {
        console.error("Skill not loaded, cannot build system message yet.");
        return;
        }

        const userMsg: ChatMessage = { role: "user", content: userInput };
        setMessages((prev) => [...prev, userMsg]);

        if (user?.uid && skillId) {
        await addChatMessage(user.uid, skillId, "user", userInput);
        }
        setUserInput("");

        try {
        const systemMessage: ChatMessage = {
            role: "assistant",
            content: buildSystemPrompt(skill),
        };

        const finalMessages = [systemMessage, ...messages, userMsg];

        const response = await fetch("/api/llm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: finalMessages }),
        });

        if (!response.ok) {
            throw new Error(`LLM call failed with status ${response.status}`);
        }

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }

        const aiContent = data.content || "No response content.";
        const aiMsg: ChatMessage = {
            role: "assistant",
            content: aiContent,
        };
        setMessages((prev) => [...prev, aiMsg]);

        if (user?.uid && skillId) {
            await addChatMessage(user.uid, skillId, "assistant", aiContent);
        }
        } catch (err: any) {
        console.error("Error calling LLM:", err);
        const errorMsg: ChatMessage = {
            role: "assistant",
            content: `Error: ${err.message}`,
        };
        setMessages((prev) => [...prev, errorMsg]);

        if (user?.uid && skillId) {
            await addChatMessage(user.uid, skillId, "assistant", errorMsg.content);
        }
        }
    }

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    return (
        <div className="flex flex-col h-full overflow-hidden">
        <ScrollArea
            className="flex-1 px-6 pl-3 space-y-2 scroll-smooth"
            ref={scrollRef}
            style={{ height: "100%" }}
        >
            <div className="max-w-3xl mx-auto flex flex-col gap-2">
            {messages.map((msg, i) => (
                <ChatBubble key={i} role={msg.role} content={msg.content} />
            ))}
            </div>
        </ScrollArea>

        <div className="border border-r bg-neutral-50 dark:bg-[hsl(0,0%,18%)] dark:border-neutral-700 rounded-3xl flex gap-2 max-w-3xl mx-auto w-full mb-8">
            <Textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Type your question..."
            onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
                }
            }}
            className="bg-neutral-50 dark:bg-[hsl(0,0%,18%)] resize-none h-28 w-full rounded-3xl custom-scrollbar"
            />
            <Button onClick={handleSend} className="rounded-full p-2.5 self-end mb-4 mr-4">
            <FaArrowUp />
            </Button>
        </div>
        </div>
    );
});

export default Chat;

function buildSystemPrompt(skill: any | null) {
    if (!skill) {
        return `You are a fun, engaging tutor.
            The skill is not fully loaded yet, so keep it generic.
            Add slight humor but remain helpful.`;
    }

    const level = skill.roadmapContext?.level || "Unknown";
    const goals = skill.roadmapContext?.goals || "No specific goals";
    const priorKnowledge = skill.roadmapContext?.priorKnowledge || "Not mentioned";
    const skillName = skill.name || "Unnamed Skill";
    const roadmapJSON = JSON.stringify(skill.roadmapJSON || { title: "", nodes: [] });

    return `
        You are a fun, engaging tutor.
        Your domain is ${skillName}.
        The user's current level is ${level}.
        Their goals: ${goals}.
        They have prior knowledge: ${priorKnowledge}.

        We have a roadmap in JSON:
        ${roadmapJSON}

        Please strictly reference the roadmap's nodes and do not skip around.
        Feel free to be slightly humorous or encouraging, but always keep the skill content in mind.
        Also do not try to link the topics that are outside the roadmap.
        If the user asks for some topic outside the roadmap that is not related to the Skill, 
        then answer politely to continue with the current topics in the roadmap.
        Do not deviate from the skill, avoid tangential topics.
        `;
}

function ChatBubble({ role, content }: ChatMessage) {
    if (role === "assistant") {
        return (
        <div className="flex items-start w-full rounded-xl gap-4">
            <Orbit className="flex-shrink-0 mr-2 mt-1 h-8 w-8 rounded-full p-1 overflow-visible border border-neutral-300 dark:border-neutral-600 text-[#6c63ff] dark:text-[#7a83ff]" />
            <div className="flex-1 text-neutral-900 dark:text-white text-sm mb-4 break-words overflow-hidden">
                <MarkdownRenderer content={content} />
            </div>
        </div>
        );
    } else {
        return (
        <div className="flex justify-end">
            <div className="bg-neutral-100 dark:bg-[hsl(0,0%,20%)] text-neutral-900 dark:text-white text-sm p-3 rounded-3xl max-w-xl mb-4 break-words overflow-hidden">
            {content}
            </div>
        </div>
        );
    }
}