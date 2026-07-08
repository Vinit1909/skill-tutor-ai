"use client";

import SkillCard from "./skillcard";
import SkillListRow from "./skill-list-row";
import {SkillSpaceData} from "@/lib/skillspace";

export type SkillViewMode = "grid" | "gallery" | "list"

export interface SkillSpaceProps {
    skills: SkillSpaceData[]
    onUpdated?: () => void;
    /** Layout: "grid" (compact cards), "gallery" (wide cards with description),
     *  or "list" (compact Notion-style rows). Defaults to grid. */
    view?: SkillViewMode
}

const SkillSpace = ({skills, onUpdated, view = "grid"}: SkillSpaceProps) => {
    if (view === "list") {
        return (
            <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {skills.map((space) => (
                    <SkillListRow key={space.id} skill={space} onUpdated={onUpdated} />
                ))}
            </div>
        );
    }

    if (view === "gallery") {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start w-full px-4 py-8 sm:px-6">
                {skills.map((space) => (
                    <SkillCard
                        key={space.id}
                        skill={space}
                        onUpdated={onUpdated}
                        variant="gallery"
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 mx-auto md:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center items-start w-full px-4 py-8">
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
