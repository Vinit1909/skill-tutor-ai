"use client";

import SkillCard from "./skillcard";
import {SkillSpaceData} from "@/lib/skillspace";

export interface SkillSpaceProps {
    skills: SkillSpaceData[]
    onUpdated?: () => void;
}

const SkillSpace = ({skills, onUpdated}: SkillSpaceProps) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 justify-items-center items-start w-full">
            {skills.map((space) => (
            <SkillCard 
                key={space.id}
                skill={space} 
                onUpdated={onUpdated}
            />
            ))}
        </div>
    );
}

export default SkillSpace;