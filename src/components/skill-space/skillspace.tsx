"use client";

import SkillCard from "./skillcard";
import {SkillSpaceData} from "@/lib/skillspace";

export interface SkillSpaceProps {
    skills: SkillSpaceData[]
    onUpdated?: () => void;
}

const SkillSpace = ({skills, onUpdated}: SkillSpaceProps) => {
    return (
        <div className="grid grid-cols-1 mx-auto md:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center items-start w-full mt-4">
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