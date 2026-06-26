'use client';

import React from 'react';
import StatusBadge from './StatusBadge';

interface StatusBarProps {
  status: string;
  chunks: string[];
}

export default function StatusBar({ status, chunks }: StatusBarProps) {
  // Helper to map status to user-friendly label and description
  const getStatusInfo = (s: string) => {
    switch (s) {
      case 'JOB_STATUS_QUEUED':
        return {
          title: 'Job Queued',
          description: 'Waiting in line to be picked up...',
          color: 'from-gray-400 to-gray-500',
        };
      case 'JOB_STATUS_FETCHING':
        return {
          title: 'Fetching Content',
          description: 'Downloading transcript or scraping web page...',
          color: 'from-yellow-400 to-amber-500',
        };
      case 'JOB_STATUS_PROCESSING':
        return {
          title: 'Analyzing Content',
          description: 'Gemini AI is digesting the content and generating structure...',
          color: 'from-indigo-500 to-purple-600',
        };
      case 'JOB_STATUS_COMPLETE':
        return {
          title: 'Distillation Complete',
          description: 'All done! Saving and redirecting...',
          color: 'from-emerald-500 to-green-600',
        };
      case 'JOB_STATUS_FAILED':
        return {
          title: 'Analysis Failed',
          description: 'An error occurred during distillation.',
          color: 'from-rose-500 to-red-600',
        };
      default:
        return {
          title: 'Initializing',
          description: 'Setting up connection...',
          color: 'from-blue-400 to-indigo-500',
        };
    }
  };

  const info = getStatusInfo(status);
  const streamText = chunks.join('');

  return (
    <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-gray-100 shadow-xl p-6 space-y-6 transition-all duration-300">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            {info.title}
            {status !== 'JOB_STATUS_COMPLETE' && status !== 'JOB_STATUS_FAILED' && (
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
              </span>
            )}
          </h3>
          <p className="text-sm text-gray-500">{info.description}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${info.color} transition-all duration-500 ease-out`}
          style={{
            width:
              status === 'JOB_STATUS_QUEUED'
                ? '20%'
                : status === 'JOB_STATUS_FETCHING'
                ? '50%'
                : status === 'JOB_STATUS_PROCESSING'
                ? '80%'
                : status === 'JOB_STATUS_COMPLETE'
                ? '100%'
                : '10%',
          }}
        />
      </div>

      {/* Real-time Streaming Preview */}
      {chunks.length > 0 && (
        <div className="space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
              Live Stream Preview
            </span>
            <span className="text-xs text-gray-400">
              {streamText.length} chars received
            </span>
          </div>
          <div className="bg-gray-50/50 border border-gray-100 rounded-xl p-4 max-h-40 overflow-y-auto scrollbar-thin">
            <p className="text-sm text-gray-700 leading-relaxed font-mono whitespace-pre-wrap">
              {streamText}
              <span className="inline-block w-1.5 h-4 ml-0.5 bg-indigo-600 animate-pulse" />
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
