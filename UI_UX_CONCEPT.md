# UI/UX Design Guidelines

This document serves as the canonical reference for the premium SaaS aesthetic and user experience applied across all interface modules (Servers, Kubernetes, Docker, Users, Teams, Settings, etc.) in the application. Any new feature must adopt these principles, layouts, and components.

## Core Philosophy

1.  **Premium SaaS Feel:** Clean lines, ample whitespace, high contrast text, and subtle shadows/animations.
2.  **Consistency:** Similar entities should have similar layouts. A list of users should structurally mirror a list of servers or containers.
3.  **Dark Mode First, Light Mode Ready:** Tailwind rules should explicitly use `dark:` for graceful inversion, specifically with zinc/gray scales rather than pure black/white where possible.

## Color Palette & Theming (Tailwind)

*   **Backgrounds:**
    *   Light: `bg-white` or `bg-zinc-50`.
    *   Dark: `dark:bg-[#121212]` (premium off-black) or `dark:bg-black`.
*   **Surfaces/Cards:**
    *   Light: `bg-white border-zinc-200 shadow-sm`.
    *   Dark: `dark:bg-[#121212] dark:border-zinc-800`.
*   **Text (Typography):**
    *   Primary text: `text-zinc-900 dark:text-zinc-50` (e.g., Headings, Table cell primary data).
    *   Secondary text: `text-zinc-500 dark:text-zinc-400` (e.g., Subtitles, labels, datetimes, meta details).
*   **Accent Colors per Domain:**
    *   **Servers:** Emerald / Teal (`text-emerald-500`, `bg-emerald-500`)
    *   **Docker:** Blue / Purple (`text-blue-500`, `text-purple-500`)
    *   **Kubernetes:** Blue (`text-blue-500`)
    *   **Settings/Admin:** Zinc / Neutral (`text-zinc-900 dark:text-zinc-100`)

## Typography

*   **Page Titles:** `text-2xl font-semibold tracking-tight`
*   **Subtitles/Descriptions:** `text-sm text-zinc-500 dark:text-zinc-400 mt-1`
*   **Table Content:** `text-[13px]` to `text-sm`. Primary identifiers should be `font-semibold`. Secondary details or monospace data should use `font-mono text-[11px] or text-xs`.

## Standard Page Layout Structure

All list/data-heavy resource pages should follow this atomic structure:

```tsx
<div className="space-y-6 animate-in fade-in duration-500 pb-20">
    {/* 1. Header Area */}
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-2xl font-semibold ... flex items-center gap-2">
                <Icon className="h-6 w-6 text-{accent}-500" />
                Page Title
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Description of the page.
            </p>
        </div>
        
        {/* 2. Primary Actions (Create, Add, Context Selectors) */}
        <div className="flex items-center gap-2">
            {/* Optional: Context Dropdown (e.g. Server Select) */}
            <Button variant="primary" size="md">
                <Plus className="mr-2 h-4 w-4" />
                Add Resource
            </Button>
        </div>
    </div>

    {/* 3. Toolbar (Search, Filters, Secondary Actions) */}
    <div className="flex flex-col sm:flex-row gap-3">
        <div className="w-full sm:max-w-xs">
            <Input icon={<Search />} placeholder="Search..." />
        </div>
        <div className="flex items-center gap-1 sm:ml-auto">
            {/* Filter Pills / Tabs */}
        </div>
    </div>

    {/* 4. Data Content Area (Table, Grid) */}
    <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <Table>
            {/* Table components */}
        </Table>
    </div>
</div>
```

## Tables & Lists

*   **Row Interactions:** Use `group` on the `TableRow` to reveal actions on hover (`opacity-0 group-hover:opacity-100`).
*   **Primary Column:** The name/ID of the entity should be bold, interactable, and have a hover color change (`group-hover:text-blue-600 transition-colors`).
*   **Status Badges:** Use standard `<Badge>` component variants:
    *   `success` (Green)
    *   `warning` (Yellow/Orange)
    *   `error` (Red)
    *   `outline` (Neutral/Gray)
*   **Row Actions:** Align to the extreme right (`text-right`). Use `variant="ghost" size="icon"` buttons. Ensure icons have semantic hover colors (e.g., `hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20` for Delete/Trash).

## Modals & Dialogs

*   **Backdrop:** `fixed inset-0 bg-black/60 backdrop-blur-sm z-50`
*   **Animation:** `animate-in fade-in duration-200`
*   **Surface:** `bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl`
*   **Header:** Border bottom, title with icon. Close button (`X`) in top right.
*   **Content (Scrollable):** Separate from footer. Use `flex-1 overflow-y-auto custom-scrollbar p-6`.
*   **Footer:** Contextual actions aligned to the right, slightly tinted background (`bg-zinc-50/50 dark:bg-[#121212] border-t`).

## Standard Inputs & Forms

*   **Fields:** Labels should be `text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1.5`. Use the core `<Input>` component.
*   **Selects:** Apply custom Tailwind reset to look like Inputs. `bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-{accent}-500/20`.

## Specific Component Usage

*   **Icons:** Use `lucide-react`. Maintain consistent stroke widths and standard sizing (`h-4 w-4` for button items, `h-6 w-6` for headers).
*   **Notifications:** ALWAYS use `useNotification()` for CRUD actions. Provide contextual messages (e.g., "Starting Container").
*   **Empty States:** If a table has no data, return a full-row cell with height `h-48`, centered content, a large heavily-muted icon (e.g., `opacity-20 size={32}`), and a small helper text string.
*   **Loading States:** Instead of simple spinners for data tables, render 3-4 rows containing `animate-pulse` divs simulating table cells text width/height.

## Conclusion

By strictly enforcing these styles, EINFRA maintains a highly polished, Vercel/Linear-esque UI representation. Every new component should be compared to existing heavily-refactored modules (like [ContainersPage.tsx](file:///d:/Code/EPASS/EINFRA/einfra/app/src/features/docker/pages/ContainersPage.tsx) or [ServerList.tsx](file:///d:/Code/EPASS/EINFRA/einfra/app/src/features/servers/components/ServerList.tsx)) as the golden standard.
