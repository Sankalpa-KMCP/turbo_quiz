export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight sm:text-3xl">Settings</h1>
      <p className="text-slate-400 text-sm max-w-2xl">
        Manage your local storage. Export full backups as JSON files, merge new questions, reset the database, and toggle offline updates.
      </p>
    </div>
  )
}
