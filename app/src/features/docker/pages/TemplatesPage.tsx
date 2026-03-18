import { useState } from "react";
import { Search, LayoutTemplate, Server, Code, Play } from "lucide-react";
import { useServers } from "../../servers/api/useServers";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { useNotification } from "@/core/NotificationContext";

const MOCK_TEMPLATES = [
    { title: "NGINX", description: "Official build of Nginx.", categories: ["Web", "Proxy"], logo: "https://hub.docker.com/api/content/v1/products/images/nginx/icon" },
    { title: "MariaDB", description: "MariaDB Server is one of the most popular database servers.", categories: ["Database"], logo: "https://hub.docker.com/api/content/v1/products/images/mariadb/icon" },
    { title: "Redis", description: "Redis is an open source key-value store.", categories: ["Database", "Cache"], logo: "https://hub.docker.com/api/content/v1/products/images/redis/icon" },
    { title: "Node.js", description: "Node.js is a JavaScript-based platform for server-side writing.", categories: ["Runtime"], logo: "https://hub.docker.com/api/content/v1/products/images/node/icon" },
    { title: "WordPress", description: "The WordPress rich content management system.", categories: ["CMS"], logo: "https://hub.docker.com/api/content/v1/products/images/wordpress/icon" },
    { title: "PostgreSQL", description: "The PostgreSQL object-relational database system.", categories: ["Database"], logo: "https://hub.docker.com/api/content/v1/products/images/postgres/icon" },
    { title: "Grafana", description: "The open and composable observability architecture.", categories: ["Monitoring"], logo: "https://upload.wikimedia.org/wikipedia/commons/a/a1/Grafana_logo.svg" },
    { title: "Memcached", description: "Free & open source, high-performance, distributed memory object caching.", categories: ["Cache"], logo: "https://hub.docker.com/api/content/v1/products/images/memcached/icon" }
];

export default function TemplatesPage() {
    const { data: serverData, isLoading: isLoadingServers } = useServers({ page: 1, page_size: 100 });
    const servers = serverData?.data || [];
    
    const [selectedServerId, setSelectedServerId] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");
    
    const { showNotification } = useNotification();

    const categories = ["All", ...Array.from(new Set(MOCK_TEMPLATES.flatMap(t => t.categories)))];

    const filteredTemplates = MOCK_TEMPLATES.filter(template => {
        if (!template.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        if (selectedCategory !== "All" && !template.categories.includes(selectedCategory)) return false;
        return true;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <LayoutTemplate className="h-6 w-6 text-indigo-500" />
                        App Templates
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Deploy popular containerized applications with a single click.
                    </p>
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                    <div className="relative">
                        <Server className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 h-4 w-4" />
                        <select 
                            value={selectedServerId}
                            onChange={(e) => setSelectedServerId(e.target.value)}
                            disabled={isLoadingServers}
                            className="pl-9 pr-8 h-9 text-[13px] font-medium bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 min-w-[200px] text-zinc-900 dark:text-zinc-100 appearance-none shadow-sm cursor-pointer"
                        >
                            <option value="" disabled>Select Server...</option>
                            {servers.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.ip_address})</option>
                            ))}
                        </select>
                    </div>
                    
                    <Button variant="primary" size="md" onClick={() => window.location.href = '/templates/custom' }>
                        <Code className="mr-2 h-4 w-4" />
                        Custom Templates
                    </Button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
                <div className="flex gap-2 overflow-x-auto w-full sm:w-auto custom-scrollbar pb-1">
                    {categories.map(c => (
                        <button
                            key={c}
                            onClick={() => setSelectedCategory(c)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                                selectedCategory === c 
                                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400' 
                                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                            }`}
                        >
                            {c}
                        </button>
                    ))}
                </div>
                <div className="w-full sm:w-72">
                    <Input
                        type="text"
                        placeholder="Search templates..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        icon={<Search className="h-4 w-4 text-zinc-400" />}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredTemplates.map(template => (
                    <div key={template.title} className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-indigo-300 dark:hover:border-indigo-700/50 transition-all group flex flex-col h-full shadow-sm hover:shadow-md">
                        <div className="flex items-start justify-between mb-4">
                            <div className="h-12 w-12 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 flex items-center justify-center p-2">
                                <img 
                                    src={template.logo} 
                                    alt={template.title} 
                                    className="max-h-full max-w-full object-contain"
                                    onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjYTFBMTBhIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHJlY3QgeD0iMyIgeT0iMyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiByeD0iMiIgcnk9IjIiPjwvcmVjdD48Y2lyY2xlIGN4PSI4LjUiIGN5PSI4LjUiIHI9IjEuNSI+PC9jaXJjbGU+PHBvbHlsaW5lIHBvaW50cz0iMjEgMTUgMTYgMTAgNSAyMSI+PC9wb2x5bGluZT48L3N2Zz4=' }}
                                />
                            </div>
                            <div className="flex gap-1">
                                {template.categories.map(c => (
                                    <span key={c} className="text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                        {c}
                                    </span>
                                ))}
                            </div>
                        </div>
                        
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-lg">{template.title}</h3>
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-2 flex-grow line-clamp-3 leading-relaxed">
                            {template.description}
                        </p>
                        
                        <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
                            <Button 
                                variant="outline" 
                                className="w-full group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/10 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:border-indigo-200 dark:group-hover:border-indigo-500/30 transition-colors"
                                onClick={() => showNotification({ type: "info", message: "Deploying Template", description: `Preparing to deploy ${template.title}` })}
                            >
                                <Play className="w-4 h-4 mr-2" />
                                Deploy Application
                            </Button>
                        </div>
                    </div>
                ))}

                {filteredTemplates.length === 0 && (
                    <div className="col-span-full h-64 flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                        <LayoutTemplate size={32} className="mb-3 text-zinc-400 dark:text-zinc-600" />
                        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">No templates found</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Try adjusting your search or category filter.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
