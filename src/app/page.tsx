import Link from 'next/link'

const Home = () => {
    return (
      <main className="p-4">
        <h1 className="text-2xl font-bold">Welcome to My Project</h1>
        <p>Go <span className="text-cyan-500 hover:cursor-pointer hover:underline"><Link href="/dashboard">here</Link></span> to see your skill spaces!</p>
      </main>
    );
}

export default Home;