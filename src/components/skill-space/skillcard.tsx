import { useState } from 'react'
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
  } from "@/components/ui/hover-card"
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuItem,
	DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Trash2, Edit2, Info, CalendarIcon, EllipsisVertical, Dices, BookOpenText } from 'lucide-react'
import { useAuthContext } from "@/context/authcontext"
import { Progress } from "@/components/ui/progress"
import { SkillSpaceData, deleteSkillSpaceDeep } from "@/lib/skillspace"
import { useRouter } from 'next/navigation'

interface SkillCardProps {
	skill: SkillSpaceData
	onUpdated?: () => void
}

export default function SkillCard({ skill, onUpdated }: SkillCardProps) {
	const router = useRouter()
	const { user } = useAuthContext()
	const [isHovered, setIsHovered] = useState(false)
	
	const progressPercentage = skill.max 
		? Math.round((skill.value / skill.max) * 100)
		: 0

	async function handleDelete() {
		if (!user?.uid || !skill.id) return

		try {
			if (!confirm(`Are you sure you want to delete ${skill.name}?`)) {
				return 
			}
			await deleteSkillSpaceDeep(user.uid, skill.id)
			if (onUpdated) onUpdated()
		} catch (err) {
			console.error("Error deleting skillspace deeply:", err)
			alert("Failed to delete skillspace. Check console.")
		}
	}

	function handleEdit() {
		alert(`Edit skill: ${skill.name}`)
	}

	function handleGoLearn() {
		router.push(`/learn/${skill.id}`)
	}

	function handleGoQuiz() {
		router.push(`/quiz/${skill.id}`)
	}

	// Format the creation date with null safety
	const formatCreatedAt = () => {
		if (!skill.createdAt?.seconds) {
			return 'Unknown date'
		}
		return new Date(skill.createdAt.seconds * 1000).toLocaleDateString('en-US', { 
			month: 'long', 
			day: 'numeric', 
			year: 'numeric' 
		})
	}
	
	return (
		<Card 
			className="w-64 h-38 overflow-hidden transition-all duration-300 ease-in-out hover:shadow-lg dark:bg-[hsl(0,0%,18%)] dark:border-neutral-700 dark:hover:shadow-xl"
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			<CardHeader className="pb-4 place-items-center">
				<div className="flex items-center justify-between w-full space-x-2">
					<div className="flex items-center min-w-0 space-x-3">
						<div className="flex-shrink-0 bg-primary-background dark:bg-primary-background">
							<HoverCard>
								<HoverCardTrigger asChild>
									<div className={`rounded-full ${isHovered ? 'bg-primary-foreground dark:bg-[hsl(0,0%,14.9%)]' : ''} hover:cursor-pointer dark:hover:text-neutral-300 hover:text-neutral-600`}> 
										<Info className="h-4 w-4" />
									</div>
								</HoverCardTrigger>
								<HoverCardContent className="w-60 dark:bg-[hsl(0,0%,18%)]">
									<div className="flex justify-between space-x-4">
										<div className="space-y-1">
											<h4 className="text-sm font-semibold">{skill.name}</h4>
											<p className="text-sm text-neutral-500 dark:text-neutral-400">
												{skill.description}
											</p>
											<div className="flex items-center pt-2">
												<CalendarIcon className="mr-2 h-4 w-4 opacity-70" />{" "}
												<span className="text-xs text-muted-foreground">
													{formatCreatedAt()}
												</span>
											</div>
										</div>
									</div>
								</HoverCardContent>
							</HoverCard>
						</div>
						<div className="flex gap-2">
							<CardTitle
								className="text-base font-medium truncate"
								style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
								{skill.name}
							</CardTitle>
						</div>
					</div>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon" className="h-8 w-8 dark:hover:bg-neutral-800 rounded-full">
							<EllipsisVertical className="h-4 w-4" />
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
			<CardContent className='px-4 pt-0 pb-2'>
				<div className='flex gap-2'>
					<Button 
						variant="ghost" 
						size="sm" 
						className="w-full justify-start border border-r rounded-full text-muted-foreground dark:border-neutral-700"
						onClick={handleGoLearn}
					>
						<div className='flex gap-2'>
							<BookOpenText className='h-4 w-4 mr-2'/> Learn
						</div>
					</Button>
					<Button 
						variant="ghost" 
						size="sm" 
						className="w-full justify-start border border-r rounded-full text-muted-foreground dark:border-neutral-700"
						onClick={handleGoQuiz}
					>
						<div className='flex gap-2'>
							<Dices className='h-4 w-4 mr-2'/> Quiz
						</div>
					</Button>
				</div>
			</CardContent>

			<CardContent className='p-4 pt-2'>
				<div className="space-y-2">
					<div className="flex justify-between text-xs text-muted-foreground">
						<span>Progress</span>
						<span>{skill.value} / {skill.max} • {progressPercentage}%</span>
					</div>
					<Progress 
						value={progressPercentage} 
						className="h-2"
					/>
				</div>			
			</CardContent>
		</Card>
	)
}