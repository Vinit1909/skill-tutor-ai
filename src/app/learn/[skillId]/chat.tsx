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
import { MarkdownRenderer } from "@/components/learn-page/markdownrenderer";
import { getSkillSpace } from "@/lib/skillspace";
import { useAuthContext } from "@/context/authcontext";
import { loadChatMessages, addChatMessage } from "@/lib/skillChat";
import { Loader, Orbit } from "lucide-react";
import { ICONS, COLORS } from "@/lib/constants";
import { shuffleArray } from "@/lib/utils";
import { QuestionCard, QuestionData } from "@/components/learn-page/question-card";

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

export interface ChatRef {
    clearLocalChat: () => void;
}

interface ChatProps {
    skillId?: string;
    questions?: QuestionData[];
    // isChatEmpty?: boolean;
}

const Chat = forwardRef<ChatRef, ChatProps>(function Chat({ skillId, questions = []}, ref) {
    const { user } = useAuthContext();
    const [skill, setSkill] = useState<any>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [chatLoading, setChatLoading] = useState(true)
    const [userInput, setUserInput] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
    const [randomCards, setRandomCards] = useState<
        {question: QuestionData; Icon: any; iconColor: string}[]
    >([])

    function isChatEmpty() {
        return messages.length === 0;
    }

    // Expose a method to clear local chat state
    useImperativeHandle(ref, () => ({
        clearLocalChat() {
        setMessages([]);
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
        }, [user, skillId]);

    useEffect(() => {
        if (!user?.uid || !skillId) return;
        loadChatMessages(user.uid, skillId)
            .then((msgs) => {
                const loaded = msgs.map((m) => ({
                    role: m.role as "user" | "assistant",
                    content: m.content,
                }));
                setMessages(loaded);
            })
            .catch((err) => console.error("Error loading chat messages:", err))
            .finally(() => setChatLoading(false));
    }, [user, skillId]);

    // pick random questions, logo, color
    useEffect(() => {
        const localIsEmpty = messages.length <= 1;
        if (chatLoading) return;

        if (isChatEmpty() && questions.length > 0) {
            // shuffle questions
            const shuffledQuestions = shuffleArray(questions);
            const questionSubset = shuffledQuestions.slice(0, 4);
            // shuffle icons
            const iconShuffled = shuffleArray(ICONS);
            const iconSubset = iconShuffled.slice(0, 4)
            // shuffle colors
            const colorShuffled = shuffleArray(COLORS);
            const colorSubset = colorShuffled.slice(0, 4)

            // combined
            const combined = questionSubset.map((q, i) => ({
                question: q,
                Icon: iconSubset[i],
                iconColor: colorSubset[i],
            }))
            setRandomCards(combined)
        } else {
            setRandomCards([]);
        }
    }, [chatLoading, questions, messages]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // UTILITY: Send a message to chat with given text
    async function sendUserMessage(text: string) {
        if (!text.trim()) return;
        if (!skill) {
            console.error("Skill not loaded, cannot build system message yet.");
            return;
        }

        // Add user msg to local state
        const userMsg: ChatMessage = {role: "user", content: text};
        setMessages((prev) => [...prev, userMsg]);

        // save user msg to firestore
        if (user?.uid && skillId) {
            await addChatMessage(user.uid, skillId, "user", text);
        }

        // build system prompt
        const systemMessage: ChatMessage = {
            role: "assistant",
            content: buildSystemPrompt(skill),
        }

        // merge msgs
        const finalMessages = [systemMessage, ...messages, userMsg];

        // call LLM
        try {
            const response = await fetch("/api/llm", {
                method: "POST",
                headers: { "Content-Type": "application/json"},
                body: JSON.stringify({messages: finalMessages}),
            });
            if (!response.ok) {
                throw new Error(`LLM call failed: ${response.status}`);
            }

            const data = await response.json()
            if (data.error) {
                throw new Error(data.error);
            }

            const aiContent = data.content ?? "No reponse content.";
            const aiMsg: ChatMessage = {
                role: "assistant",
                content: aiContent,
            };
            // add ai msg to local state
            setMessages((prev) => [...prev, aiMsg]);

            // save ai msg to firestore
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

    async function handleSend() {
        if (!userInput.trim()) return;
        const text = userInput;
        setUserInput("");
        await sendUserMessage(text);
    }

    function handleQuestionCardClick(questionText: string) {
        sendUserMessage(questionText);
    }

    if (chatLoading && isChatEmpty()) {
        return (
            <div className="flex items-center justify-center fixed inset-0">
                <div className="text-md text-neutral-500 dark:text-neutral-400">
                    <div className="flex gap-2 animate-shiny-text">
                        <Loader className="animate-spin" />
                        Loading Chat
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <ScrollArea
                className="flex-1 px-6 pl-3 space-y-2 scroll-smooth"
                ref={scrollRef}
                style={{ height: "100%" }}
            >
                {/* <div className="max-w-3xl mx-auto flex flex-col gap-2"> */}
                <div className="flex h-full items-center justify-center">
                    {isChatEmpty() ? (
                        <div className="grid grid-cols-2 gap-4 place-items-center my-40">
                            {randomCards.map(({question, Icon, iconColor}, idx) => (
                                <QuestionCard
                                    key={question.id || idx}
                                    question={question}
                                    Icon={Icon}
                                    iconColorClass={iconColor}
                                    onQuestionClick={handleQuestionCardClick}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className = "flex flex-col gap-2 w-full max-w-3xl mx-auto py-4">
                            {messages.map((msg, i) => (
                                <ChatBubble key={i} role={msg.role} content={msg.content} />
                            ))}
                        </div>
                    )}
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
        You are a fun, enthsiastic, motivating, engaging tutor.
        You are always hyped up about teaching the concpets and making the user want to learn from you more.
        Your domain is ${skillName}.
        The user's current level is ${level}.
        Their goals: ${goals}.
        They have prior knowledge: ${priorKnowledge}.

        We have a roadmap in JSON:
        ${roadmapJSON}

        Please strictly reference the roadmap's nodes and do not skip around.
        Systematically follow the roadmap and make sure that the user understands each concept in depth.
        Feel free to be humorous and encouraging, but always keep the skill content in mind.
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
            <Orbit className="flex-shrink-0 mr-2 mt-2 h-8 w-8 rounded-full p-1 overflow-visible border border-neutral-300 dark:border-neutral-600 text-[#6c63ff] dark:text-[#7a83ff]" />
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