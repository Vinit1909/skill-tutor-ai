"use client";

import * as React from "react";
import { useRef } from "react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { BookMarked, LayoutDashboard, MessageSquareX, WandSparkles } from "lucide-react";
import Chat, { ChatRef } from "./chat";
import OnboardingWizard from "@/components/learn-page/onboardingWizard";
import { getSkillSpace } from "@/lib/skillspace";
import { useAuthContext } from "@/context/authcontext";
import { clearChatmessages } from "@/lib/skillChat";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import Roadmap from "./roadmap";
import DarkModeToggle from "@/components/dark-mode-toggle";


export default function LearnPage() {
    const params = useParams();
    let { skillId } = params || {};
    if (Array.isArray(skillId)) {
        skillId = skillId[0];
    }
    return (
        <SidebarProvider defaultOpen={true}>
            <LearnLayout skillId={skillId} />
        </SidebarProvider>
    );
}

function LearnLayout({skillId}: {skillId?: string}) {
    const {user, loading} = useAuthContext();
	const [skill, setSkill] = useState<any>(null);
	const [showWizard, setShowWizard] = useState(false);
	const chatRef = useRef<ChatRef>(null)

	useEffect(() => {
		if (!user?.uid || !skillId) return;
		
		getSkillSpace(user.uid, skillId)
			.then((doc) => {
				if (doc) {
					setSkill(doc);
					if (!doc.roadmapJSON) {
						setShowWizard(true);
					}
				} else {
					console.log("Skill not found!")
				}
			})
			.catch((err) => console.log(err));
	}, [user, skillId]);

	async function handleClearChatClick() {
		if (!user?.uid || !skillId) return;

		await clearChatmessages(user.uid, skillId);
		if (chatRef.current) {
			chatRef.current.clearLocalChat();
		}
	}

	async function handleWizardComplete() {
		setShowWizard(false);
		if (!user?.uid || !skillId) return;

		const updated = await getSkillSpace(user.uid, skillId);
		setSkill(updated);
	}

	if (loading) {
		return <div>Loading...</div>
	}

	if (!skill) {
		return <div>Loading skill...</div>;
	}

    return (
        <SidebarProvider defaultOpen={true}>
			<Roadmap
				skillId={skill?.id}
				roadmap={skill?.roadmapJSON}
				onCreateRoadmap={() => setShowWizard(true)}
			/>

		  {showWizard && user && skillId && (
			<OnboardingWizard
				skillName={skill.name}
				uid={user.uid}
				skillId={skillId}
				onComplete={handleWizardComplete}
			/>
		  )}
    
          {/* The main content area */}
          <SidebarInset className="flex flex-col h-screen overflow-hidden">
            <header className="flex h-16 shrink-0 items-center gap-2 sticky top-0 bg-white z-10 dark:bg-neutral-800">
              <div className="flex items-center gap-2 px-3">
                <SidebarTrigger/>
                <Separator orientation="vertical" className="mr-2 h-4" />
    
                {/* breadcrumb */}
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block hover:bg-muted hover:text-black p-1 rounded-md dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-700">
                      <BreadcrumbLink href="/dashboard">
					  	<div className="flex gap-1 place-items-center"><LayoutDashboard className="h-4 w-4"/>Your Skills</div>
					  </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
						<BreadcrumbPage className="hidden md:block hover:cursor-pointer text-neutral-500 hover:bg-muted hover:text-black dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-700 p-1 rounded-md">
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<div className="flex gap-1 place-items-center"><BookMarked className="h-4 w-4"/><span>Learn {skill?.name}</span></div>
								</DropdownMenuTrigger>
								<DropdownMenuContent className="dark:bg-[hsl(0,0%,18%)]">
									<DropdownMenuLabel>Actions</DropdownMenuLabel>
									<DropdownMenuSeparator />
									<DropdownMenuItem>
										<WandSparkles/> Edit Roadmap
									</DropdownMenuItem>
									<DropdownMenuItem className="text-destructive dark:text-red-500 dark:hover:text-white" onClick={handleClearChatClick} >
										<MessageSquareX/> Clear Chat
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
			  <div className="px-4 ml-auto place-items-center"><DarkModeToggle/></div>
            </header>

            {/* Chat interface */}
            <div className="flex-1 min-h-0 ">
            	<Chat ref={chatRef} skillId={skillId} />
            </div>
          </SidebarInset>
        </SidebarProvider>
    );
}