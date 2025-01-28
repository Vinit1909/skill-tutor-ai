// "use client";

// import React from "react";
// import { Button } from "@/components/ui/button";
// import Image from "next/image";
// import { IoCreateOutline } from "react-icons/io5";

// interface RoadmapNode {
//   id: string;
//   title: string;
//   children?: RoadmapNode[];
// }

// interface RoadmapData {
//   title: string;
//   nodes: RoadmapNode[];
// }

// interface RoadmapProps {
//   skillId?: string;
//   roadmap?: RoadmapData;
//   onCreateRoadmap?: () => void;
// }

// export default function Roadmap({
//   skillId,
//   roadmap,
//   onCreateRoadmap,
// }: RoadmapProps) {
//   if (!roadmap) {
//     return (
//       <div className="flex flex-col items-center justify-center mt-4 space-y-3 p-2">
//         <Image
//           src="/roadmap-empty.svg"
//           alt="Empty roadmap"
//           width={180}
//           height={180}
//         />
//         <p className="text-sm text-gray-500">
//           No roadmap found for skill: {skillId}
//         </p>
//         <Button onClick={onCreateRoadmap} className="flex items-center gap-2">
//           <IoCreateOutline className="h-5 w-5" />
//           Create Roadmap
//         </Button>
//       </div>
//     );
//   }

//   return (
//     <div className="relative w-full h-auto p-4">
//       {/* Title */}
//       {/* <h2 className="text-sm font-bold mb-4 text-center">{roadmap.title}</h2> */}

//       {/* The vertical line: absolutely positioned down the center */}
//       <div className="absolute top-14 left-1/2 transform -translate-x-1/2 bg-gray-300 w-[2px] h-full z-0" />

//       {/* Each step is stacked with an index. We center the card and place a small circle in line if we want. */}
//       <div className="flex flex-col items-center space-y-8">
//         {roadmap.nodes.map((node, idx) => (
//           <StepCard key={node.id} node={node} index={idx} />
//         ))}
//       </div>
//     </div>
//   );
// }

// function StepCard({ node, index }: { node: RoadmapNode; index: number }) {
//   // We can place a small circle "bullet" where the line intersects
//   // We'll do that with an absolutely positioned circle behind the card
//   return (
//     <div className="relative z-10 w-full max-w-sm">
//       {/* The small bullet on the line (center). It's 8px circle, behind the card. */}
//       <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full z-[-1]" />

//       <div className="bg-white shadow-md rounded-lg p-4 border border-gray-200">
//         <h2 className="font-semibold text-gray-600">{node.title}</h2>

//         {/* If children => show them as bullet points */}
//         {node.children && node.children.length > 0 && (
//           <ul className="list-disc mt-2 ml-4 text-sm text-gray-500 space-y-1">
//             {node.children.map((child) => (
//               <li key={child.id}>{child.title}</li>
//             ))}
//           </ul>
//         )}
//         {/* <p className="absolute pb-2 top-2 left-2 text-xs text-gray-500">Step {index + 1}</p> */}
//       </div>
//     </div>
//   );
// }



"use client"

import React from "react"
import Image from "next/image"
import { IoCreateOutline } from "react-icons/io5"
import { ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sidebar, SidebarContent, SidebarHeader, SidebarProvider } from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"

interface RoadmapNode {
  id: string
  title: string
  children?: RoadmapNode[]
}

interface RoadmapData {
  title: string
  nodes: RoadmapNode[]
}

interface RoadmapProps {
  skillId?: string
  roadmap?: RoadmapData
  onCreateRoadmap?: () => void
}

export default function Roadmap({ skillId, roadmap, onCreateRoadmap }: RoadmapProps) {
  if (!roadmap) {
    return (
      <div className="flex flex-col items-center justify-center mt-4 space-y-3 p-2">
        <Image src="/roadmap-empty.svg" alt="Empty roadmap" width={180} height={180} />
        <p className="text-sm text-muted-foreground">No roadmap found for skill: {skillId}</p>
        <Button onClick={onCreateRoadmap} className="flex items-center gap-2">
          <IoCreateOutline className="h-5 w-5" />
          Create Roadmap
        </Button>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <Sidebar className="">
        <SidebarHeader className="border-b border-sidebar-border px-6 py-4">
          <h2 className="text-lg font-semibold text-sidebar-foreground">{roadmap.title}</h2>
        </SidebarHeader>
        <ScrollArea className="h-[calc(100vh-5rem)]">
          <SidebarContent className="p-2">
            {roadmap.nodes.map((node, index) => (
              <RoadmapStep key={node.id} node={node} index={index} />
            ))}
          </SidebarContent>
        </ScrollArea>
      </Sidebar>
    </SidebarProvider>
  )
}

function RoadmapStep({ node, index }: { node: RoadmapNode; index: number }) {
  return (
    <Collapsible className="group">
      <CollapsibleTrigger className="flex items-center w-full rounded-md px-2 py-1 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
        <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-90 mr-2" />
        <span className="ml-2 text-left">{`${index + 1}. ${node.title}`}</span>
      </CollapsibleTrigger>
      {node.children && node.children.length > 0 && (
        <CollapsibleContent>
          <div className="ml-4 pl-4 border-l border-sidebar-border mt-1">
            {node.children.map((child) => (
              <div key={child.id} className="flex items-center w-full rounded-md px-2 py-1 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
                <span className="ml-2">{child.title}</span>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}