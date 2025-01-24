"use client"

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import * as React from "react"
import Roadmap from "@/app/learn/[skillId]/roadmap"
import { SkillSpaceData } from "@/lib/skillspace";
import { WandSparkles } from "lucide-react";

interface AppSidebarProps {
  skill: SkillSpaceData | null;
}

export function AppSidebar({skill}: AppSidebarProps) {
  return (
    <Sidebar
      variant="floating"
      collapsible="offcanvas"
    >
    <SidebarHeader className="flex items-center justify-between border-b p-2">
      <div className="flex items-center">
        <WandSparkles className="h-6 w-6 text-gray-500"/>
      </div>
    </SidebarHeader>
    <SidebarContent className="custom-scrollbar">
        {/* <SidebarGroup> */}
          <div className="p-4 text-sm">
            <Roadmap
              skillId={skill?.id}
              roadmap={skill?.roadmapJSON}
            />
          </div>
        {/* </SidebarGroup> */}
      </SidebarContent>
      <SidebarFooter className="border-t p-2">
        <p className="text-xs text-muted-foreground">
          Footer info or version, etc.
        </p>
      </SidebarFooter>
    </Sidebar>
  )
}