"use client";

import React, { FC } from "react";
import {
    Card, 
    CardTitle, 
    CardContent,
} from "@/components/ui/card";

export interface QuestionData {
    id?: string;
    nodeId?: string;
    question: string;
    shortDesc?: string;
    topicLogoKey?: string;
}

interface QuestionCardProps {
    question: QuestionData;
    Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    iconColorClass: string;
}

export const QuestionCard: FC<QuestionCardProps> = ({
    question,
    Icon,
    iconColorClass,
}) =>  {
    return (
        <Card className="group w-full max-w-xs shadow-lg hover:shadow-xl hover:cursor-pointer transition-shadow duration-300 rounded-3xl overflow-hidden dark:bg-[hsl(0,0%,18%)] dark:border-neutral-700 dark:hover:shadow-xl">
            <CardContent className="p-4">
                <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                        <Icon className={`h-6 w-6 ${iconColorClass}`}/>
                    </div>
                    <div className="flex-1">
                        <CardTitle className="text-md font-semibold text-neutral-600 group-hover:text-neutral-900 dark:text-neutral-400 dark:group-hover:text-white">
                            {question.question}
                        </CardTitle>
                        {question.shortDesc && (
                            <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
                                {question.shortDesc}
                            </p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}