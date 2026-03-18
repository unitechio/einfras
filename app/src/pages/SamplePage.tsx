import { SampleCard, StatGrid } from "@/features/sample/SampleCard";

export default function SamplePage() {
    return (
        <div className="min-h-screen bg-slate-100 p-8">
            <div className="max-w-4xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">Dashboard Sample</h1>
                    <p className="text-slate-600">Testing Teleport-style project structure & Tailwind 4</p>
                </header>

                <section className="space-y-8">
                    <SampleCard />
                    <StatGrid />
                </section>

                <footer className="mt-12 text-center text-slate-500 text-sm">
                    Security App Infrastructure &copy; 2026
                </footer>
            </div>
        </div>
    );
}
