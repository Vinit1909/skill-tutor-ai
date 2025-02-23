"use client"

import { useState } from "react"
import { useRouter } from 'next/navigation'
import { useAuthContext } from "@/context/authcontext"
import { signOut } from 'firebase/auth'
import { auth } from "@/lib/firebase"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoonStar, Sun, Settings, LogOut } from "lucide-react"
import {useTheme} from 'next-themes'

export default function UserProfileBadge() {
    const {user} = useAuthContext();
    const {theme, setTheme} = useTheme();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);

    const initial = user?.displayName?.charAt(0)?.toUpperCase() || "U"

    const handleSignOut = async () => {
        try {
            await signOut(auth)
            router.push("/sign-in")
        } catch (err) {
            console.error("Sign out error:", err)
        }
    }

    const handleProfileSettings = () => {
        alert("Profile Settings coming soon!")
    }

    return  (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    className={cn(
                        "relative flex h-10 w-10 items-center justify-center rounded-full",
                        "bg-white dark:bg-[hsl(0,0%,18%)] border border-neutral-200 dark:border-neutral-700",
                        "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800",
                        "focus:outline-none focus:ring-1 focus:ring-neutral-300 dark:focus:ring-neutral-600",
                        isOpen && "border-neutral-300 dark:border-neutral-600"
                    )}
                >
                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{initial}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="w-56 rounded-xl bg-white p-2 shadow-xl dark:bg-[hsl(0,0%,18%)] dark:border-neutral-700 animate-in slide-in-from-top-2"
            >
                <DropdownMenuLabel className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                        {user?.displayName || "User"}
                    </span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                        {user?.email}
                    </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="my-1"/>
                <DropdownMenuItem
                    onClick={() => setTheme(theme==="dark" ? "light": "dark")}
                    className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                    {theme === "dark" ? (
                        <Sun className="h-4 w-4 text-yellow-500"/>
                    ) : (
                        <MoonStar className="h-4 w-4 text-indigo-500"/>
                    )}
                    <span>Change theme</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={handleProfileSettings}
                    className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                    <Settings className="h-4 w-4 text-neutral-500"/>
                    <span>Profile settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1"/>
                <DropdownMenuItem
                    onClick={handleSignOut}
                    className="flex items-center gap-2 rounded-lg p-2 text-sm text-destructive hover:bg-red-100 dark:text-red-500 dark:hover:bg-neutral-800"
                >
                    <LogOut className="h-4 w-4"/>
                    <span>Sign out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}