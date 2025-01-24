"use client";

import * as React from "react";
import { useRef } from "react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import {
    Sidebar,
    SidebarHeader,
    SidebarContent,
    SidebarInset,
    SidebarFooter,
  } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { MessageSquareX, MoreHorizontal, PanelLeft, PanelLeftClose, PanelLeftOpen, PanelRight, WandSparkles } from "lucide-react";
import Chat, { ChatRef } from "./chat";
import { AppSidebar } from "@/components/learn-page/app-sidebar";
import OnboardingWizard from "@/components/learn-page/onboardingWizard";
import { getSkillSpace } from "@/lib/skillspace";
import { useAuthContext } from "@/context/authcontext";
import { clearChatmessages } from "@/lib/skillChat";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";


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
	const {open, setOpen} = useSidebar();
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

    function toggleSidebar() {
        setOpen(!open);
    }

	if (loading) {
		return <div>Loading...</div>
	}

	if (!skill) {
		return <div>Loading skill...</div>;
	}

    return (
        <SidebarProvider defaultOpen={true}>
          {/* The wide overlay sidebar for roadmap */}
          <AppSidebar skill={skill}/>

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
            <header className="flex h-16 shrink-0 items-center gap-2 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2 px-3">
                <SidebarTrigger className="hover:bg-muted hover:text-gray-500 text-gray-500">
                  <Button variant="ghost" size="icon">
                    <PanelLeft className="h-4 w-4" />
                    <span className="sr-only">Open sidebar</span>
                  </Button>
                </SidebarTrigger>
                <Separator orientation="vertical" className="mr-2 h-4" />
    
                {/* breadcrumb */}
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block hover:bg-muted p-1 rounded-sm">
                      <BreadcrumbLink href="/dashboard">Your Skills</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
						<BreadcrumbPage className="hidden md:block hover:cursor-pointer hover:bg-muted p-1 rounded-sm">
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<span>Learn {skill?.name}</span>
								</DropdownMenuTrigger>
								<DropdownMenuContent>
									<DropdownMenuLabel>Actions</DropdownMenuLabel>
									<DropdownMenuSeparator />
									<DropdownMenuItem onClick={handleClearChatClick} >
										<MessageSquareX/> Clear Chat
									</DropdownMenuItem>
									<DropdownMenuItem>
										<WandSparkles/> Edit Roadmap
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>
    
            {/* Chat interface */}
            <div className="flex-1 min-h-0 ">
              <Chat ref={chatRef} skillId={skillId} />
            </div>
          </SidebarInset>
        </SidebarProvider>
      )
}