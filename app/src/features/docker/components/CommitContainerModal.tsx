import { useEffect, useState } from "react";
import { Camera, Save, X } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";

interface CommitContainerModalProps {
    isOpen: boolean;
    onClose: () => void;
    containerName: string;
    isSaving?: boolean;
    onSubmit: (payload: { image: string; author: string; comment: string }) => void;
}

export default function CommitContainerModal({ isOpen, onClose, containerName, isSaving, onSubmit }: CommitContainerModalProps) {
    const [image, setImage] = useState("");
    const [author, setAuthor] = useState("EINFRA");
    const [comment, setComment] = useState("");

    useEffect(() => {
        if (!isOpen) return;
        setImage(`${containerName || "container"}:snapshot`);
        setAuthor("EINFRA");
        setComment(`Snapshot created from ${containerName || "container"}`);
    }, [containerName, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-[28px] border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-[#121212]">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                            <Camera className="h-5 w-5 text-cyan-500" />
                            Commit Container To Image
                        </h3>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                            Create a reusable image snapshot from the running container without dropping to a browser prompt.
                        </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="mt-5 grid gap-4">
                    <Field label="Image reference">
                        <Input value={image} onChange={(event) => setImage(event.target.value)} placeholder="team/app:snapshot" />
                    </Field>
                    <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Author">
                            <Input value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="Platform Team" />
                        </Field>
                        <Field label="Container">
                            <div className="flex h-10 items-center rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                                {containerName}
                            </div>
                        </Field>
                    </div>
                    <Field label="Comment">
                        <textarea value={comment} onChange={(event) => setComment(event.target.value)} className="min-h-[110px] w-full rounded-2xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-[#121212]" placeholder="Why was this snapshot created?" />
                    </Field>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                        Tip: commit is best for fast snapshots and recovery points. For repeatable production builds, prefer the dedicated build pipeline.
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" className="bg-cyan-600 text-white hover:bg-cyan-700" onClick={() => onSubmit({ image, author, comment })} disabled={!image.trim()} isLoading={isSaving}>
                        <Save className="mr-2 h-4 w-4" />
                        Commit Image
                    </Button>
                </div>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return <div><label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</label>{children}</div>;
}
