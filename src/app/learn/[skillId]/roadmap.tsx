"use client"

import React, { useEffect, useState } from "react"
import { useAuthContext } from "@/context/authcontext"
import { doc, onSnapshot} from 'firebase/firestore'
import { db } from '@/lib/firebase' 
import Image from "next/image"
import { IoCreateOutline } from "react-icons/io5"
import { ChevronRight, WandSparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sidebar, SidebarContent, SidebarHeader, SidebarProvider, SidebarFooter } from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SkillSpaceData } from "@/lib/skillspace";

interface RoadmapNode {
  id: string
  title: string
  status?: string
  children?: RoadmapNode[]
}

interface RoadmapData {
  title: string
  nodes: RoadmapNode[]
}

interface RoadmapProps {
  skillId?: string
  roadmap?: RoadmapData
  skill?: SkillSpaceData | null   // from app-sidebar
  onCreateRoadmap?: () => void
}

export default function Roadmap({ skillId, roadmap, onCreateRoadmap }: RoadmapProps) {
  const { user } = useAuthContext()
  const [nodes, setNodes] = useState<any[]>([])

  useEffect(() => {
    if (!user?.uid || !skillId) return
    const skillRef = doc(db, "users", user.uid, "skillspaces", skillId)
    const unsub = onSnapshot(skillRef, (snap) => {
      if (!snap.exists()) return 
      const data = snap.data()
      setNodes(data?.roadmapJSON?.nodes || [])
    })
    return () => unsub()
  }, [user, skillId])

  if (!roadmap) {
    return (
      <Sidebar variant="floating" collapsible="offcanvas">
        <SidebarContent className="p-2">
          <div className="flex flex-col items-center justify-center mt-4 space-y-3 p-2">
            <Image src="/roadmap-empty.svg" alt="Empty roadmap" width={180} height={180} />
            <p className="text-sm text-neutral-400">No Roadmap found</p>
            <Button onClick={onCreateRoadmap} className="flex items-center gap-2">
              <IoCreateOutline className="h-5 w-5" />
              Create Roadmap
            </Button>
          </div>
        </SidebarContent>
      </Sidebar>
    )
  }

  return (
      <Sidebar variant="floating" collapsible="offcanvas">
        <SidebarHeader className="border-b border-sidebar-border px-6 py-4">
          <div className="flex place-items-center justify-between">
            <h2 className="text-lg font-semibold text-sidebar-foreground">{roadmap.title}</h2>
            <Button variant="ghost" className="p-2.5 rounded-lg"><div className="flex gap-2 text-xs"><WandSparkles className="h-2 w-2"/></div></Button>
          </div>
        </SidebarHeader>
        <ScrollArea className="h-[calc(100vh-5rem)]">
          <SidebarContent className="p-2">
            {roadmap.nodes.map((node, index) => (
              <RoadmapStep key={node.id} node={node} index={index} />
            ))}
          </SidebarContent>
        </ScrollArea>
        <SidebarFooter className="border-t p-2">
        <p className="text-xs text-muted-foreground">
          Footer info or version, etc.
        </p>
      </SidebarFooter>
      </Sidebar>
  )
}

function RoadmapStep({ node, index }: { node: RoadmapNode; index: number }) {
  const statusColor = getStatusColor(node.status)

  return (
    <Collapsible className="group">
      <CollapsibleTrigger className="flex items-center w-full rounded-md px-2 py-1 text-sm font-medium text-sidebar-foreground hover:bg-neutral-100 hover:text-sidebar-accent-foreground dark:hover:bg-neutral-800 dark:text-neutral-400 dark:hover:text-white transition-colors">
        <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-90 mr-2" />
        <span className="ml-2 text-left">
          {`${index + 1}. ${node.title}`}
          {node.status ? (
            <span className={`ml-2 ${statusColor} text-xs font-semibold`}>
              ({node.status})
            </span>
          ) : null}
        </span>
      </CollapsibleTrigger>
      
      {node.children && node.children.length > 0 && (
        <CollapsibleContent>
          <div className="ml-4 pl-4 border-l border-sidebar-border mt-1">
            {node.children.map((child) => {
              const childStatusColor = getStatusColor(child.status)
              return (
              <div key={child.id} className="flex items-center w-full rounded-md px-2 py-1 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground dark:hover:bg-neutral-800 dark:text-neutral-400 dark:hover:text-white transition-colors">
                {/* Status bullet if there's a status */}
                {child.status ? (
                  <span className={`mr-2 ${childStatusColor} font-medium`}>•</span>
                ) : (
                  <span className="mr-2 text-neutral-500">•</span>
                )}
                <span className="ml-1">
                  {child.title}
                  {child.status && (
                    <span className={`ml-2 ${childStatusColor} text-xs font-semibold`}>
                      ({child.status})
                    </span>
                  )}
                </span>
              </div>
              )
            })}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}

function getStatusColor(status?: string) {
  if (!status) return "text-neutral-500"
  switch (status) {
    case "IN_PROGRESS":
      return "text-yellow-500"
    case "COMPLETED":
      return "text-green-500"
    default:
      return "text-neutral-500"
  }
}