"use client"

import { useState } from "react"
import Link from "next/link"
import { createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithPopup } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"

import { FaGoogle } from "react-icons/fa";
import { LogIn, Orbit } from "lucide-react"

export default function SignUpPage() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [displayName, setDisplayName] = useState("")
    const [error, setError] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const router = useRouter()

    const handleSignUp = async (e?: React.FormEvent) => {
        e?.preventDefault()
        setError("")
        if (!email || !password || !displayName) {
            setError("Please provide name, email and password.")
            return
        }
        setIsSubmitting(true)
        try {
            const userCred = await createUserWithEmailAndPassword(auth, email, password)
            const user = userCred.user

            await updateProfile(user, { displayName })

            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                email: user.email,
                displayName,
                createdAt: serverTimestamp(),
            })

            router.push("/dashboard")
        } catch (err: unknown) {
            if (err instanceof Error) setError(err.message)
            else setError("An unexpected error occurred.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleGoogleSignUp = async () => {
        setError("")
        setIsSubmitting(true)
        try {
            const provider = new GoogleAuthProvider()
            const result = await signInWithPopup(auth, provider)
            const user = result.user

            // create user doc if it doesn't exist
            const userRef = doc(db, "users", user.uid)
            const userSnap = await getDoc(userRef)
            if (!userSnap.exists()) {
                await setDoc(userRef, {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || "",
                    createdAt: serverTimestamp(),
                })
            }

            router.push("/dashboard")
        } catch (err: unknown) {
            if (err instanceof Error) setError(err.message)
            else setError("Google sign-up failed")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-neutral-900 px-4">
            <Card className="w-full max-w-md rounded-2xl shadow-lg">
                <CardHeader className="px-8 pt-8 text-center">
                    <div className="mx-auto w-12 h-12 rounded-md flex items-center justify-center ">
                        <Orbit className="h-6 w-6"/>
                    </div>
                    <CardTitle className="mt-4">Create your account</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Start your SkillSpace journey</p>
                </CardHeader>

                <CardContent className="px-8 pt-4 pb-4">
                    <div className="flex flex-col gap-3">
                        <Button variant="outline" className="w-full flex items-center justify-center gap-2" onClick={handleGoogleSignUp} disabled={isSubmitting}>
                            <FaGoogle />
                            Sign up with Google
                        </Button>

                        <div className="flex items-center gap-3 pt-1">
                            <span className="flex-1 h-px bg-border" />
                            <span className="text-xs text-muted-foreground">or</span>
                            <span className="flex-1 h-px bg-border" />
                        </div>

                        <form onSubmit={handleSignUp} className="grid gap-3">
                            <label className="sr-only" htmlFor="name">Full name</label>
                            <Input id="name" placeholder="Full name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />

                            <label className="sr-only" htmlFor="email">Email</label>
                            <Input id="email" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />

                            <label className="sr-only" htmlFor="password">Password</label>
                            <Input id="password" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

                            {error && <p className="text-sm text-red-500">{error}</p>}

                            <Button type="submit" className="w-full mt-1" disabled={isSubmitting || !email || !password || !displayName}>
                                <span className="flex items-center justify-center gap-2">
                                    <LogIn className="h-4 w-4" />
                                    {isSubmitting ? "Creating account..." : "Create account"}
                                </span>
                            </Button>
                        </form>
                    </div>
                </CardContent>

                <CardFooter className="px-8 pb-8 flex flex-col gap-2">
                    <div className="text-sm text-center text-muted-foreground">
                        Already have an account? <Link href="/sign-in" className="text-primary hover:underline">Sign in</Link>
                    </div>
                </CardFooter>
            </Card>
        </main>
    )
}
