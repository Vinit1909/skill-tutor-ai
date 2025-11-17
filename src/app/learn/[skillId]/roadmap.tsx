"use client"

import React, { useEffect, useState } from "react"
import { useAuthContext } from "@/context/authcontext"
import { doc, onSnapshot} from 'firebase/firestore'
import { db } from '@/lib/firebase' 
import Image from "next/image"
import { IoCreateOutline } from "react-icons/io5"
import { ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sidebar, SidebarContent, SidebarHeader, SidebarFooter } from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { RoadmapNode, SkillSpaceData, calculateSkillProgress } from "@/lib/skillspace";
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

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

export default function Roadmap({ skillId, roadmap, skill, onCreateRoadmap }: RoadmapProps) {
  const { user } = useAuthContext()
  const [nodes, setNodes] = useState<RoadmapNode[]>([])

  // derive progress from roadmap nodes (falls back to skill doc values)
  const { value: derivedValue, max: derivedMax } = calculateSkillProgress(nodes || [])
  const skillValue = derivedMax > 0 ? derivedValue : (skill?.value ?? 0)
  const skillMax = derivedMax > 0 ? derivedMax : (skill?.max ?? 0)
  const progressPercentage = skillMax ? Math.round((skillValue / skillMax) * 100) : 0

  useEffect(() => {
    if (!user?.uid || !skillId) return
    const skillRef = doc(db, "users", user.uid, "skillspaces", skillId)
    const unsub = onSnapshot(skillRef, (snap) => {
      if (!snap.exists()) {
        console.log("No skill data found")
        setNodes([])
        return
      }
      const data = snap.data()
      console.log("Snapshot updated:", data?.roadmapJSON?.nodes)
      setNodes(data?.roadmapJSON?.nodes || [])
    }, (error) => {
      console.error("Snapshot error:", error)
    })
    return () => unsub()
  }, [user, skillId])

  if (!roadmap && nodes.length === 0) {
    return (
      <Sidebar variant="sidebar" collapsible="offcanvas">
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
      <Sidebar variant="sidebar" collapsible="offcanvas">
        <SidebarHeader className="border-b border-sidebar-border px-6 py-4">
          <div className="flex place-items-center justify-between">
            <h2 className="text-lg font-semibold text-sidebar-foreground">{roadmap?.title || "Skill Roadmap"}</h2>
            {/* <Button variant="ghost" className="p-2.5 rounded-lg"><div className="flex gap-2 text-xs"><WandSparkles className="h-2 w-2"/></div></Button> */}
          </div>
        </SidebarHeader>
        <ScrollArea className="h-[calc(100vh-5rem)]">
          <SidebarContent className="p-2">
            {nodes.map((node, index) => (
              <RoadmapStep key={node.id} node={node} index={index} />
            ))}
          </SidebarContent>
        </ScrollArea>
        <SidebarFooter className="border-t p-2 mb-4 mx-4">
        {/* <p className="text-xs text-muted-foreground"> */}
          <div className="space-y-2">
					<div className="flex justify-between text-xs text-muted-foreground">
						<span>Progress</span>
						<span>{progressPercentage}%</span>
					</div>
					<Progress 
						value={progressPercentage} 
						className="h-2"
					/>
				</div>	
        {/* </p> */}
      </SidebarFooter>
      </Sidebar>
  )
}

function RoadmapStep({ node, index }: { node: RoadmapNode; index: number }) {

  return (
    <Collapsible className="group">
      <CollapsibleTrigger className="flex items-center w-full rounded-md px-2 py-1 text-sm font-medium text-sidebar-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:text-neutral-400 dark:hover:text-white transition-colors">
      <div className="flex items-center justify-between w-full">
        <span className="ml-2 mr-2 text-left">
          {/* <span className={`ml-2 ${statusColor} text-xs font-semibold`}>
            ({(node.status).replace("_", " ").toLowerCase()})
          </span> */}
          {/* <div className="font-medium">{`${index + 1}. ${node.title}`}</div> */}
          <div className="font-medium flex items-center gap-2">
            <span>{index + 1}.</span>
            <span
              title={node.title}
            >
              {node.title}
            </span>
          </div>
          <Badge className={`text-xs ml-4 mt-1 ${getStatusColor(node.status)}`}>
            {node.status.replace("_", " ").toLowerCase()}
          </Badge>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-90 mr-2" />
      </div>
      </CollapsibleTrigger>
      {node.children && node.children.length > 0 && (
        <CollapsibleContent>
          <div className="ml-4 pl-4 border-l border-sidebar-border mt-1">
            {node.children.map((child) => {
              return (
                <div key={child.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                  <span className="text-sm mr-2">{child.title}</span>
                  <Badge className={`text-xs ${getStatusColor(child.status)}`}>
                    {getStatusIcon(child.status)}
                  </Badge>
                </div>
              )
            })}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "COMPLETED": return "bg-green-100 hover:bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
    case "IN_PROGRESS": return "bg-yellow-100 hover:bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
    default: return "bg-neutral-100 hover:bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case "COMPLETED": return "✓"
    case "IN_PROGRESS": return "○"
    default: return "·"
  }
}