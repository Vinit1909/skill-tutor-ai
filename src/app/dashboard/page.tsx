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
import { CircleFadingPlus, ShieldAlert } from "lucide-react";
import Image from "next/image";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function DashboardPage() {
  const { user, loading } = useAuthContext();
  const router = useRouter();

  const [skillSpaces, setSkillSpaces] = useState<SkillSpaceData[]>([]);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [openDialog, setOpenDialog] = useState(false);

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

  async function fetchSkillSpaces() {
    if (!user?.uid) return;
    try {
		const data = await getAllSkillSpaces(user.uid);
		setSkillSpaces(data);
    } catch (err) {
      	console.error("Error fetching skill spaces:", err);
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
    return <div>Loading...</div>;
  }

  if (!user) {
	return null;
  }

  	return (
		<main className="flex flex-col w-full h-screen overflow-hidden">
		{/* Fixed-ish header area: no scrolling here */}
		<div className="flex flex-col items-center p-3 shrink-0">
			<h1 className="text-2xl font-bold mb-4">Dashboard</h1>

			{/* Dialog to create a new SkillSpace */}
			<Dialog open={openDialog} onOpenChange={setOpenDialog}>
			<DialogTrigger asChild>
				<Button variant="default" className="mb-2">
				<CircleFadingPlus className="h-4 w-4 mr-2" />
				Add SkillSpace
				</Button>
			</DialogTrigger>

			<DialogContent className="bg-white rounded-lg p-4">
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
		</div>

		{/* Scrollable content area: fill the rest of the screen */}
		<div className="flex-1 overflow-auto px-4 py-4 w-full">
			{skillSpaces.length === 0 ? (
				<div className="flex flex-col items-center space-y-4 p-10">
					<Alert className="flex flex-col items-center justify-center max-w-md mx-auto p-6 rounded-lg shadow-md">
						<Image className="mx-auto" alt="empty" src="/empty.svg" width={200} height={200} />
						<AlertTitle className="text-center mt-4 text-xl font-semibold text-gray-700">No SkillSpaces Yet</AlertTitle>
						<AlertDescription className="text-center mt-2 text-gray-500">
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
		</main>
  	);
}