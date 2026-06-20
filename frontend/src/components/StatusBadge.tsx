const CONFIG: Record<string, { label: string; classes: string }> = {
  JOB_STATUS_QUEUED:     { label: 'Queued',     classes: 'bg-gray-100 text-gray-600'    },
  JOB_STATUS_FETCHING:   { label: 'Fetching',   classes: 'bg-yellow-100 text-yellow-700' },
  JOB_STATUS_PROCESSING: { label: 'Processing', classes: 'bg-blue-100 text-blue-700'    },
  JOB_STATUS_COMPLETE:   { label: 'Complete',   classes: 'bg-green-100 text-green-700'  },
  JOB_STATUS_FAILED:     { label: 'Failed',     classes: 'bg-red-100 text-red-600'      },
};

export default function StatusBadge({ status }: { status: string }) {
  const cfg = CONFIG[status] ?? { label: status, classes: 'bg-gray-100 text-gray-500' };
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${cfg.classes}`}>
      {cfg.label}
    </span>
  );
}