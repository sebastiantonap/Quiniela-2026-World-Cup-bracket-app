import Link from 'next/link'
import type { Entry } from '@/types/app'

export function EntryCard({ entry }: { entry: Entry }) {
  return (
    <Link
      href={`/entries/${entry.id}`}
      className="group flex flex-col rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 transition hover:ring-blue-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">
          {entry.name}
        </h3>
        <span className="ml-2 flex-shrink-0 rounded-full bg-blue-50 px-2.5 py-0.5 text-sm font-bold text-blue-700">
          {entry.total_points} pts
        </span>
      </div>
      <p className="mt-2 text-xs text-gray-400">
        Created {new Date(entry.created_at).toLocaleDateString()}
      </p>
      <p className="mt-4 text-sm font-medium text-blue-600 group-hover:underline">
        View bracket →
      </p>
    </Link>
  )
}
