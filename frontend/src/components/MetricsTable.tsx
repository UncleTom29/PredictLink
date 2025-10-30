// frontend/src/components/MetricsTable.tsx
'use client';

import { useQuery } from 'react-query';
import axios from 'axios';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

const metrics = [
  { key: 'Finalization (Uncontested)', value: '≤ 2 hours (95%)' },
  { key: 'Contested Resolution', value: '3–5 days' },
  { key: 'Daily Throughput', value: '≥ 1,000 requests' },
  { key: 'Concurrent Markets', value: '≥ 50,000' },
  { key: 'Live Liveness Windows', value: '500+' },
];

export default function MetricsTable() {
  const { data: backendHealth } = useQuery('health', () =>
    axios.get(`${BACKEND_URL}/health`).then((res) => res.data).catch(() => ({}))
  );

  return (
    <div className="overflow-x-auto mb-8 card">
      <h2 className="text-xl font-semibold mb-4">Performance Metrics</h2>
      <table className="min-w-full bg-white border border-gray-300">
        <thead>
          <tr>
            <th className="px-6 py-3 border-b bg-gray-50 text-left font-medium">Metric</th>
            <th className="px-6 py-3 border-b bg-gray-50 text-left font-medium">Target</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
              <td className="px-6 py-4 whitespace-nowrap">{metric.key}</td>
              <td className="px-6 py-4">{metric.value}</td>
            </tr>
          ))}
          {backendHealth?.uptime && (
            <tr className="bg-blue-50">
              <td className="px-6 py-4 font-medium">Uptime</td>
              <td className="px-6 py-4 text-green-600">{backendHealth.uptime}%</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}