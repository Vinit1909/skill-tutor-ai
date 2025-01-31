"use client"

import { useState } from "react"
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
  } from "@/components/ui/card"
import { Input } from "@/components/ui/input";

import { FcGoogle } from "react-icons/fc";
import { LogIn } from 'lucide-react'

export default function SignUpPage() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [displayName, setDisplayName] = useState("")
    const [error, setError] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const router = useRouter()

    const handleSignUp = async () => {
        setError("")
        try {
            // Create user in Firebase Auth
            const userCred = await createUserWithEmailAndPassword(auth, email, password)
            const user = userCred.user

            //Update user profile
            await updateProfile(user, {
                displayName: displayName,
            })

            // Create user doc in Firestore
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                email: user.email,
                displayName: displayName,
                createdAt: serverTimestamp(),
            })
            router.push("/dashboard")
        } catch (err: any) {
            setError(err.message)
        }
    }

    return (
        <div className = "h-screen flex items-center justify-center">
            <Card className="w-[350px]">
                <CardHeader className = "flex items-center justify-center">
                    <CardTitle>Sign Up</CardTitle>
                    <CardDescription>Start your SkillSpace Journey 🌟</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className = "flex items-center justify-center pb-6">
                        <Button className="flex" variant={"outline"}>
                            <FcGoogle/>
                            <p>Sign Up with Google</p>
                        </Button>
                    </div>
                    <form>
                        <div className="grid w-full items-center gap-4">
                            <div className="flex flex-col space-y-1.5">
                                <Input 
                                    id="name" 
                                    placeholder="Display Name" 
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col space-y-1.5">
                                <Input 
                                    id="email" 
                                    placeholder="Email" 
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col space-y-1.5">
                                <div className="relative">
                                    <Input 
                                        id="password" 
                                        placeholder="Password"
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                    {password && (
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            {showPassword ? "Hide" : "Show"}
                                        </button>
                                    )}
                                </div>
                                {error && <p className="text-red-500 mb-2">{error}</p>}
                            </div>
                        </div>
                    </form>
                </CardContent>
                <CardFooter className="flex justify-between">
                    <Button variant="outline" onClick={handleSignUp}>
                        <LogIn className="mr-2 h-4 w-4" />
                        Sign Up
                    </Button>
                    <Button onClick={() => router.push("/sign-in")}>
                        Sign In
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
