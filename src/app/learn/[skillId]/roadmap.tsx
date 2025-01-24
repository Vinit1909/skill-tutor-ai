"use client";

interface RoadmapNode {
  id: string;
  title: string;
  status: string; 
  children?: RoadmapNode[];
}

interface RoadmapData {
  title: string;
  nodes: RoadmapNode[];
}

interface RoadmapProps {
  skillId?: string;
  roadmap?: RoadmapData;
}

export default function Roadmap({ skillId, roadmap }: RoadmapProps) {
  if (!roadmap) {
    return (
      <div className="mt-4 space-y-2">
        <p>Skill ID: {skillId} </p>
        <p className="text-sm text-red-500">No roadmap found yet.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      <h2 className="text-sm font-bold">{roadmap.title}</h2>
      <ul className="ml-4 list-disc">
        {roadmap.nodes.map((node) => (
          <RoadmapNodeItem key={node.id} node={node} />
        ))}
      </ul>
    </div>
  );
}

function RoadmapNodeItem({ node }: { node: RoadmapNode }) {
  return (
    <li className="my-1">
      <span>{node.title}</span> 
      {/*TODO: `node.status` or a "Mark as complete" button */}
      {node.children && node.children.length > 0 && (
        <ul className="ml-4 list-disc">
          {node.children.map((child) => (
            <RoadmapNodeItem key={child.id} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}