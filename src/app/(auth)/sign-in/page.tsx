"use client"

import { useState } from "react"
import Link from "next/link"
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from "firebase/auth"
import { auth } from "@/lib/firebase"
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

export default function SignInPage() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [info, setInfo] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const router = useRouter()

    const handleForgotPassword = async () => {
        setError("")
        setInfo("")
        if (!email) {
            setError("Enter your email above first, then click \"Forgot password?\".")
            return
        }
        try {
            await sendPasswordResetEmail(auth, email)
            // Same message whether or not the account exists — don't leak
            // which emails are registered.
            setInfo("If an account exists for that email, a reset link is on its way.")
        } catch (err: unknown) {
            // Firebase throws on malformed emails; keep account existence private.
            if (err instanceof Error && err.message.includes("invalid-email")) {
                setError("That doesn't look like a valid email address.")
            } else {
                setInfo("If an account exists for that email, a reset link is on its way.")
            }
        }
    }

    const handleSignIn = async (e?: React.FormEvent) => {
        e?.preventDefault()
        setError("")
        if (!email || !password) {
            setError("Please provide email and password.")
            return
        }
        setIsSubmitting(true)
        try {
            await signInWithEmailAndPassword(auth, email, password)
            router.push("/dashboard")
        } catch (err: unknown) {
            if (err instanceof Error) setError(err.message)
            else setError("An unknown error occurred.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleGoogleSignIn = async () => {
        setError("")
        setIsSubmitting(true)
        try {
            const provider = new GoogleAuthProvider()
            await signInWithPopup(auth, provider)
            router.push("/dashboard")
        } catch (err: unknown) {
            if (err instanceof Error) setError(err.message)
            else setError("Google sign-in failed")
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
                    <CardTitle className="mt-4">Welcome back</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Sign in to your SkillSpace account</p>
                </CardHeader>

                <CardContent className="px-8 pt-4 pb-4">
                    <div className="flex flex-col gap-3">
                        <Button variant="outline" className="w-full flex items-center justify-center gap-2" onClick={handleGoogleSignIn} disabled={isSubmitting}>
                            <FaGoogle />
                            Continue with Google
                        </Button>

                        <div className="flex items-center gap-3 pt-1">
                            <span className="flex-1 h-px bg-border" />
                            <span className="text-xs text-muted-foreground">or</span>
                            <span className="flex-1 h-px bg-border" />
                        </div>

                        <form onSubmit={handleSignIn} className="grid gap-3">
                            <label className="sr-only" htmlFor="email">Email</label>
                            <Input id="email" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />

                            <label className="sr-only" htmlFor="password">Password</label>
                            <Input id="password" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

                            <div className="text-right">
                                <button
                                    type="button"
                                    onClick={handleForgotPassword}
                                    className="text-xs text-muted-foreground hover:text-primary hover:underline"
                                >
                                    Forgot password?
                                </button>
                            </div>

                            {error && <p className="text-sm text-red-500">{error}</p>}
                            {info && <p className="text-sm text-green-600 dark:text-green-400">{info}</p>}

                            <Button type="submit" className="w-full mt-1" disabled={isSubmitting || !email || !password}>
                                <span className="flex items-center justify-center gap-2">
                                    <LogIn className="h-4 w-4" />
                                    {isSubmitting ? "Signing in..." : "Sign in"}
                                </span>
                            </Button>
                        </form>
                    </div>
                </CardContent>

                <CardFooter className="px-8 pb-8 flex flex-col gap-2">
                    <div className="text-sm text-center text-muted-foreground">
                        New to SkillSpace? <Link href="/sign-up" className="text-primary hover:underline">Create an account</Link>
                    </div>
                </CardFooter>
            </Card>
        </main>
    )
}