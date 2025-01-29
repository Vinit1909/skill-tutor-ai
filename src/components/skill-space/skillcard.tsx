import { useState } from 'react';
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
  } from "@/components/ui/avatar"
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
  } from "@/components/ui/hover-card"
import {
	Card,
	CardContent,
	CardHeader,
	CardDescription,
	CardTitle,
	CardFooter,
} from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuItem,
	DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, Trash2, Edit2, Info, CalendarIcon } from 'lucide-react';
import { useAuthContext } from "@/context/authcontext";
import { Progress } from "@/components/ui/progress";
import { SkillSpaceData } from "@/lib/skillspace";
import { deleteSkillSpace } from "@/lib/skillspace";
import { useRouter } from 'next/navigation';

interface SkillCardProps {
	skill: SkillSpaceData;
	onUpdated?: () => void;
}

export default function SkillCard({ skill, onUpdated }: SkillCardProps) {
	const router = useRouter();
	const { user } = useAuthContext();
	const [isHovered, setIsHovered] = useState(false);

	async function handleDelete() {
		if (!user?.uid || !skill.id) return;
		await deleteSkillSpace(user.uid, skill.id);
		if (onUpdated) onUpdated();
	}

	function handleEdit() {
		alert(`Edit skill: ${skill.name}`);
	}

	function handleGoLearn() {
		router.push(`/learn/${skill.id}`);
	}

	const progressPercentage = (skill.value / skill.max) * 100;
	
	return (
		<Card 
			className="w-64 h-40 overflow-hidden transition-all duration-300 ease-in-out hover:shadow-lg dark:bg-[hsl(0,0%,18%)] dark:border-neutral-700 dark:hover:shadow-xl"
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
		<CardHeader className="pb-2">
			<div className="flex items-start justify-between gap-2">
			<div className="flex items-center space-x-1">
				<div className={`p-2 rounded-full ${isHovered ? 'bg-primary-foreground dark:bg-[hsl(0,0%,14.9%)]' : 'bg-primary-background dark:bg-primary-background'}`}>
					<HoverCard>
						<HoverCardTrigger asChild>
							<Info className="h-4 w-4" />
						</HoverCardTrigger>
						<HoverCardContent className="w-60 dark:bg-[hsl(0,0%,18%)]">
							<div className="flex justify-between space-x-4">
								<div className="space-y-1">
									<h4 className="text-sm font-semibold">{skill.name}</h4>
									<p className="text-sm">
										{skill.description}
									</p>
									<div className="flex items-center pt-2">
									<CalendarIcon className="mr-2 h-4 w-4 opacity-70" />{" "}
									<span className="text-xs text-muted-foreground">
										{new Date(skill.createdAt.seconds * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
									</span>
									</div>
								</div>
							</div>
						</HoverCardContent>
					</HoverCard>
				</div>
				<div className="flex gap-2">
				<CardTitle
					className="text-lg font-semibold truncate hover:cursor-pointer" 
					onClick={handleGoLearn} 
					style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
					{skill.name}
				</CardTitle>
				</div>
			</div>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" className="h-8 w-8 dark:hover:bg-neutral-800">
					<ChevronDown className="h-4 w-4" />
				</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-40 dark:bg-[hsl(0,0%,18%)] dark:border-neutral-700">
				<DropdownMenuLabel>Actions</DropdownMenuLabel>
				<DropdownMenuSeparator/>
				<DropdownMenuItem onClick={handleEdit} className="flex items-center dark:hover:bg-neutral-800">
					<Edit2 className="mr-2 h-4 w-4" />
					Edit
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={handleDelete}
					className="text-destructive flex items-center dark:text-red-500 dark:hover:text-white"
				>
					<Trash2 className="mr-2 h-4 w-4" />
					Delete
				</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			</div>
		</CardHeader>

		<CardContent className="pt-6">
			<div className="space-y-2">
			<Progress 
				value={progressPercentage} 
				className="h-2 w-full"
			/>
			<div className="flex justify-between text-sm text-muted-foreground">
				<span>Progress</span>
				<span>{skill.value} / {skill.max}</span>
			</div>
			</div>
		</CardContent>
		</Card>
	);
}