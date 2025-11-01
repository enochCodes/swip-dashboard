/**
 * Session Table Component
 *
 * Comprehensive table displaying session details with all P1 required columns
 */

'use client';

import { Badge } from './ui/Badge';

export interface SessionData {
  sessionId: string;
  appName: string;
  wearable: string | null;
  startedAt: Date;
  endedAt: Date | null;
  duration: number | null; // in seconds
  avgBpm: number | null;
  avgHrv: number | null;
  emotion: string | null;
  swipScore: number | null;
  stressRate: number | null;
  os: string | null;
}

interface SessionTableProps {
  sessions: SessionData[];
  loading?: boolean;
  onSessionClick?: (session: SessionData) => void;
}

const formatDuration = (seconds: number | null) => {
  if (!seconds) return 'N/A';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
};

const formatDate = (date: Date | null) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Valid emotions - map database emotions to display names
const emotionDisplayMap: Record<string, string> = {
  'stressed': 'Stressed',
  'neutral': 'Neutral',
  'happy': 'Amused', // Map 'happy' to 'Amused' for display
};

const normalizeEmotion = (emotion: string | null): string => {
  if (!emotion) return 'Unknown';
  return emotionDisplayMap[emotion.toLowerCase()] || 'Unknown';
};

const getEmotionColor = (emotion: string | null) => {
  const normalized = normalizeEmotion(emotion);
  if (normalized === 'Stressed') return 'danger';
  if (normalized === 'Amused') return 'success'; // 'happy' displayed as 'Amused'
  if (normalized === 'Neutral') return 'info';
  return 'default'; // Unknown
};

const getScoreColor = (score: number | null) => {
  if (!score) return 'text-gray-400';
  if (score >= 70) return 'text-green-500';
  if (score >= 60) return 'text-yellow-400';
  return 'text-orange-500';
};

export function SessionTable({ sessions, loading = false, onSessionClick }: SessionTableProps) {
  // Ensure sessions is always an array
  const sessionsArray = Array.isArray(sessions) ? sessions : [];

  if (loading) {
    return (
      <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-700 border-t-synheart-pink" />
        <p className="text-gray-400 mt-4">Loading sessions...</p>
      </div>
    );
  }

  if (sessionsArray.length === 0) {
    return (
      <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-12 text-center">
        <svg
          className="w-16 h-16 text-gray-600 mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
        <p className="text-gray-400 text-lg">No sessions found</p>
        <p className="text-gray-500 text-sm mt-2">Sessions will appear here once data is submitted</p>
      </div>
    );
  }

  const getEmotionColor = (emotion: string | null) => {
    if (!emotion) return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    const e = emotion.toLowerCase();
    if (e === 'calm') return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    if (e === 'focused') return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (e === 'happy') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    if (e === 'relaxed') return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    if (e === 'stressed') return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    if (e === 'anxious') return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    if (e === 'energized') return 'bg-red-500/20 text-red-400 border-red-500/30';
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  };

  const getScoreBarColor = (score: number | null) => {
    if (!score) return 'from-gray-500 to-gray-600';
    if (score >= 85) return 'from-purple-500 to-purple-600';
    if (score >= 70) return 'from-blue-500 to-blue-600';
    if (score >= 60) return 'from-pink-500 to-pink-600';
    return 'from-red-500 to-red-600';
  };

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-left border-b border-gray-800/50">
            <th className="pb-4 text-sm font-semibold text-purple-400">App</th>
            <th className="pb-4 text-sm font-semibold text-purple-400">Avg SWIP Score</th>
            <th className="pb-4 text-sm font-semibold text-purple-400">Session ID</th>
            <th className="pb-4 text-sm font-semibold text-purple-400">Emotion</th>
            <th className="pb-4 text-sm font-semibold text-purple-400 text-right">Created</th>
          </tr>
        </thead>
        <tbody>
          {sessionsArray.map((session) => (
            <tr
              key={session.sessionId}
              onClick={() => onSessionClick?.(session)}
              className="border-b border-gray-800/50 hover:bg-white/5 transition-colors cursor-pointer group"
            >
              <td className="py-4">
                <span className="text-white font-medium">{session.appName}</span>
              </td>
              <td className="py-4">
                <div className="flex items-center gap-3">
                  <span className="text-white font-semibold w-12">{session.swipScore?.toFixed(1) || 'N/A'}</span>
                  <div className="w-32 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${getScoreBarColor(session.swipScore)} rounded-full transition-all duration-500`}
                      style={{ width: `${Math.min((session.swipScore || 0), 100)}%` }}
                    />
                  </div>
                </div>
              </td>
              <td className="py-4">
                <code className="text-gray-400 text-xs font-mono">{session.sessionId.substring(0, 12)}...</code>
              </td>
              <td className="py-4">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${getEmotionColor(session.emotion)}`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-current" />
                  {normalizeEmotion(session.emotion)}
                </span>
              </td>
              <td className="py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <span className="text-gray-400 text-sm">{formatTimeAgo(session.startedAt)}</span>
                  <svg className="w-4 h-4 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

