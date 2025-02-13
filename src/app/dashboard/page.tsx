"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/context/authcontext";
import {
	createSkillSpace,
	getAllSkillSpaces,
	SkillSpaceData,
} from "@/lib/skillspace";
import SkillSpace from "@/components/skill-space/skillspace";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogTrigger,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CircleFadingPlus, Home, Loader, Orbit, User } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dock, DockIcon } from "@/components/skill-space/dock";
import DarkModeToggle from "@/components/dark-mode-toggle";
import { AnimatedShinyText } from "@/components/animated-shiny-text";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

export default function DashboardPage() {
  const { user, loading } = useAuthContext();
  const router = useRouter();

  const [skillSpaces, setSkillSpaces] = useState<SkillSpaceData[]>([]);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [loadingSkillSpaces, setLoadingSkillSpaces] = useState(false);

  // If user not logged in once loading is done, redirect
  useEffect(() => {
    if (!loading && !user) {
      	router.push("/sign-in");
    }
  }, [loading, user, router]);

  // Fetch skillSpaces if a user
  useEffect(() => {
    if (!loading && user?.uid) {
      	fetchSkillSpaces();
    }
  }, [loading, user]);

  // Log user object for debugging
  useEffect(() => {
	if (user) {
		console.log("User Object:", user);
	}
  })

  async function fetchSkillSpaces() {
    if (!user?.uid) return;
    try {
		setLoadingSkillSpaces(true);
		const data = await getAllSkillSpaces(user.uid);
		setSkillSpaces(data);
    } catch (err) {
      	console.error("Error fetching skill spaces:", err);
    } finally {
		setLoadingSkillSpaces(false);
	}
  }

  async function handleCreateSkillSpace() {
    if (!user?.uid) return;
    try {
		await createSkillSpace(user.uid, newName, newDesc);
		setNewName("");
		setNewDesc("");
		setOpenDialog(false);
		fetchSkillSpaces();
    } catch (err) {
      	console.error("Error creating skill space:", err);
    }
  }

  if (loading) {
    return (
		<div className="flex items-center justify-center h-screen">
			<div className="text-md text-neutral-500 dark:text-neutral-400">
				<div className="flex gap-2 animate-shiny-text"><Loader className="animate-spin"/>Loading</div>
			</div>
		</div>
	)
  }

  if (!user) {
	return <div>No user sigend in</div>;
  }

  return (
	<main className="flex flex-col w-full h-screen overflow-hidden">
	  {/* Fixed-ish header area: no scrolling here */}
	  {/* <div className="flex flex-col items-center shrink-0 max-w-screen-lg w-full mx-auto pt-6 px-15"> */}
		<div className="flex justify-center items-center w-full fixed top-0 z-10">
			<div className="flex place-items-center space-x-3 justify-between text-neutral-700 dark:text-neutral-400 flex-1 max-w-screen-lg w-full mx-auto pt-6 pb-4 pr-15 pl-15">
				{/* TODO: Fix tooltip */}
				<TooltipProvider>
				<Dock direction="top">
					{/* <DockIcon className="pointer-events-none">
						<AnimatedShinyText className="inline-flex items-center justify-center px-4 py-1 transition ease-out hover:text-neutral-600 hover:duration-300 hover:dark:text-neutral-400">
							<span>
								<div className="flex gap-2 animate-shiny-text">
									<Orbit className="h-6 w-6 text-[#6c63ff] dark:text-[#7a83ff]"/>
									{user.displayName || 'Default Name'}'s Space
									</div>
							</span>
						</AnimatedShinyText>
					</DockIcon>	 */}
					<DockIcon className="pointer-events-none">
						<AnimatedShinyText
							className="inline-flex items-center gap-2 px-4 py-1
									animate-shiny-text transition ease-out
									hover:text-neutral-600 hover:dark:text-neutral-400"
						>
							<Orbit className="h-6 w-6 text-[#6c63ff] dark:text-[#7a83ff]" />
							{user.displayName || "Default Name"}'s Space
						</AnimatedShinyText>
					</DockIcon>

					
					{/* TODO: Fix the color */}
					<Separator orientation="vertical" className="h-full" />

					<DockIcon>
						<Tooltip>
							<TooltipTrigger asChild>
							<Dialog open={openDialog} onOpenChange={setOpenDialog}>
								<DialogTrigger asChild>
									<Button variant="ghost" className="size-12 rounded-xl">
										<CircleFadingPlus className="h-4 w-4" />
									</Button>
								</DialogTrigger>
								<DialogContent className="bg-white rounded-lg p-4 dark:bg-neutral-900">
									<DialogHeader>
										<DialogTitle>Create SkillSpace</DialogTitle>
										<DialogDescription>
											Provide a name and description for your new skill space.
										</DialogDescription>
									</DialogHeader>
									<div className="grid gap-4 py-4">
										<div className="grid grid-cols-4 items-center gap-4">
											<Label htmlFor="name" className="text-right">
												Skill Name
											</Label>
											<Input
												value={newName}
												onChange={(e) => setNewName(e.target.value)}
												className="col-span-3"
											/>
										</div>
										<div className="grid grid-cols-4 items-center gap-4">
											<Label htmlFor="desc" className="text-right">
												Description
											</Label>
											<Input
												id="desc"
												value={newDesc}
												onChange={(e) => setNewDesc(e.target.value)}
												className="col-span-3"
											/>
										</div>
									</div>
									<DialogFooter>
										<Button
											className="min-w-full"
											variant="default"
											onClick={handleCreateSkillSpace}
										>
											Create
										</Button>
									</DialogFooter>
								</DialogContent>
							</Dialog>
						</TooltipTrigger>
						<TooltipContent>
							<p>Add SkillSpace</p>
						</TooltipContent>
						</Tooltip>
					</DockIcon>

					<DockIcon>
						<Tooltip>
							<TooltipTrigger asChild>
								<DarkModeToggle />
							</TooltipTrigger>
							<TooltipContent>
								<p>Toggle theme</p>
							</TooltipContent>
						</Tooltip>
					</DockIcon>

					<DockIcon>
						<Button className="size-12 rounded-xl" variant="ghost">
							<Home className="h-4 w-4" />
						</Button>
					</DockIcon>
					
					<DockIcon>
						<Button className="size-12 rounded-xl" variant="ghost">
							<User className="h-4 w-4" />
						</Button>
					</DockIcon>
				</Dock>
				</TooltipProvider>
			</div>
		</div>
	  {/* </div> */}
  
	  {/* Scrollable content area: fill the rest of the screen */}
		{loadingSkillSpaces ? (
			<div className="flex items-center justify-center h-screen">
            	<div className="text-md text-neutral-500 dark:text-neutral-400">
					<div className="flex gap-2 animate-shiny-text"><Loader className="animate-spin"/>Loading SkillSpace</div>
            	</div>
          	</div>
		) : (
			<div className="flex-1 overflow-auto px-4 py-4 w-full mt-14 scroll-mt-5">
				{skillSpaces.length === 0 ? (
					<div className="flex flex-col items-center space-y-4 p-10">
						<Alert className="flex flex-col items-center justify-center max-w-md mx-auto p-6 rounded-lg shadow-md dark:bg-[hsl(0,0%,18%)] dark:border-neutral-700 dark:hover:shadow-xl">
						<Image className="mx-auto" alt="empty" src="/empty.svg" width={200} height={200} />
						<AlertTitle className="text-center mt-4 text-xl font-semibold text-neutral-700 dark:text-neutral-400">
							No SkillSpace Yet
						</AlertTitle>
						<AlertDescription className="text-center mt-2 text-neutral-500">
							Fill your Headspace with a new SkillSpace
						</AlertDescription>
						</Alert>
					</div>
				) : (
					<ScrollArea className="max-w-screen-lg w-full mx-auto pt-6 pb-4 pr-15 pl-15 h-full">
						<SkillSpace skills={skillSpaces} onUpdated={fetchSkillSpaces} />
					</ScrollArea>
				)}
			</div>
		)}
	</main>
  );
}